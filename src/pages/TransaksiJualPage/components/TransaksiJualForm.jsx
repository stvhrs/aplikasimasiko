    // ================================
    // FILE: src/pages/transaksi-jual/components/TransaksiJualForm.jsx
    // - Memungkinkan stok negatif.
    // - Update `updatedAt` pada buku saat stok berubah.
    // - Teks UI dalam Bahasa Indonesia.
    // ================================

    import React, { useEffect, useState } from 'react';
    import {
        Modal,
        Form, Input, InputNumber, Select, Button, Space, DatePicker, message, Typography,
        Row, Col, Spin, Popconfirm, Divider, Card, Statistic
    } from 'antd';
    import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
    import { db } from '../../../api/firebase'; // <-- PASTIKAN PATH INI BENAR
    import {
        ref, update, remove, serverTimestamp,
        query, orderByKey, startAt, endAt, get, push
    } from 'firebase/database';
    import dayjs from 'dayjs';

    const { Option } = Select;
    const { Text } = Typography;

    // ---------- Helpers: Rupiah Formatter / Parser ----------
    const rupiahFormatter = (v) =>
        new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(Number(v || 0));

    const rupiahParser = (v) => {
        const digits = String(v || '0').replace(/[^\d]/g, '');
        return Number(digits || 0);
    };

    export default function TransaksiJualForm({
        open,
        onCancel,
        mode = 'create',
        initialTx = null,
        bukuList = [],       // <-- Pastikan prop ini terisi array buku
        pelangganList = [], // <-- Pastikan prop ini terisi array pelanggan
        onSuccess,
        loadingDependencies // <-- Prop untuk status loading data master
    }) {
        const [form] = Form.useForm();
        const [isSaving, setIsSaving] = useState(false);
        const [selectedPelanggan, setSelectedPelanggan] = useState(null);
        const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(mode === 'create');

        // ===== Prefill saat EDIT =====
        useEffect(() => {
            // Hanya jalan saat modal dibuka
            if (open) {
                if (mode === 'edit' && initialTx) {
                    console.log("Memuat data form untuk edit:", initialTx);
                    try {
                        const p = pelangganList.find((x) => x.id === initialTx.idPelanggan) || null;
                        setSelectedPelanggan(p);
                        const itemsToSet = (initialTx.items && Array.isArray(initialTx.items))
                            ? initialTx.items.map((it) => ({
                                idBuku: it.idBuku,
                                jumlah: it.jumlah,
                                hargaSatuan: it.hargaSatuan,
                                diskonPersen: it.diskonPersen || 0
                            }))
                            : [];

                        form.setFieldsValue({
                            nomorInvoice: initialTx.nomorInvoice || initialTx.id,
                            tanggal: initialTx.tanggal && dayjs(initialTx.tanggal).isValid() ? dayjs(initialTx.tanggal) : dayjs(),
                            idPelanggan: initialTx.idPelanggan,
                            keterangan: initialTx.keterangan || '',
                            items: itemsToSet,
                        });
                        console.log("Data form edit berhasil dimuat.");
                    } catch (error) {
                        console.error("Gagal memuat data form edit:", error);
                        message.error("Gagal memuat data transaksi untuk diedit. Periksa konsol.");
                        onCancel(); // Tutup modal jika gagal load
                    }
                } else if (mode === 'create') {
                    console.log("Inisialisasi form mode create.");
                    form.resetFields();
                    form.setFieldsValue({ tanggal: dayjs(), items: [{}] }); // Set default
                    setSelectedPelanggan(null); // Reset pelanggan terpilih
                    setIsGeneratingInvoice(true); // Pastikan flag generate aktif
                    // Nomor invoice akan digenerate oleh effect lain
                }
            }
        }, [mode, initialTx, pelangganList, form, onCancel, open]); // Tambahkan 'open'

        // ===== Generate nomor invoice saat CREATE =====
        useEffect(() => {
            // Hanya jalan di mode create & saat modal terbuka
            if (mode !== 'create' || !open || !isGeneratingInvoice) return; // Tambah cek isGeneratingInvoice
            let isMounted = true; // Flag untuk mencegah state update jika komponen unmount

            const generateInvoiceNumber = async () => {
                // State sudah di set true di effect sebelumnya
                try {
                    const now = dayjs();
                    const year = now.format('YYYY');
                    const month = now.format('MM');
                    const keyPrefix = `INV-${year}-${month}-`;
                    const txRef = ref(db, 'transaksiJualBuku');
                    const qy = query(txRef, orderByKey(), startAt(keyPrefix), endAt(keyPrefix + '\uf8ff'));
                    const snapshot = await get(qy);
                    let nextNum = 1;
                    if (snapshot.exists()) {
                        const keys = Object.keys(snapshot.val());
                        keys.sort((a, b) => {
                            const numA = parseInt(a.split('-').pop() || '0', 10);
                            const numB = parseInt(b.split('-').pop() || '0', 10);
                            return numA - numB;
                        });
                        const lastKey = keys[keys.length - 1];
                        const lastNumStr = lastKey?.split('-').pop(); // Tambah optional chaining
                        if (lastNumStr && !isNaN(parseInt(lastNumStr, 10))) {
                        nextNum = parseInt(lastNumStr, 10) + 1;
                        }
                    }
                    const newNumStr = String(nextNum).padStart(4, '0');
                    const displayInvoice = `INV/${year}/${month}/${newNumStr}`;
                    if (isMounted) { // Cek jika masih mounted
                        form.setFieldsValue({ nomorInvoice: displayInvoice });
                    }
                } catch (e) {
                    console.error("Gagal membuat nomor invoice:", e);
                    if (isMounted) {
                        message.error('Gagal membuat nomor invoice. Coba tutup dan buka lagi form.');
                    }
                } finally {
                    if (isMounted) {
                        setIsGeneratingInvoice(false);
                    }
                }
            };

            // Tambahkan sedikit delay jika diperlukan, atau panggil langsung
            // setTimeout(generateInvoiceNumber, 100);
            generateInvoiceNumber();


            // Cleanup function
            return () => {
                isMounted = false;
            };
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [mode, open, isGeneratingInvoice]); // Hanya re-run jika mode, open, atau isGeneratingInvoice berubah


        // ===== Helper harga otomatis (memperhitungkan zona jika ada) =====
        const getHargaOtomatis = (idBuku, pelanggan) => {
            const buku = bukuList.find((b) => b.id === idBuku);
            if (!buku) return { hargaSatuan: 0, diskonPersen: 0 };
            const isSpesial = pelanggan?.isSpesial || false;

            const zonaPelanggan = pelanggan?.zona;
            const hargaZonaKey = zonaPelanggan ? `harga_zona_${zonaPelanggan}` : null;
            let hargaJualBuku = Number(buku.hargaJual) || 0; // Default Zona 1

            if (hargaZonaKey && buku[hargaZonaKey] !== undefined && buku[hargaZonaKey] !== null) {
                hargaJualBuku = Number(buku[hargaZonaKey]) || hargaJualBuku;
            }

            // Tentukan harga final berdasarkan spesial atau tidak
            let finalHargaSatuan = isSpesial
                ? (Number(buku.hargaJualSpesial) || hargaJualBuku) // Jika spesial, utamakan harga spesial, fallback ke harga zona/jual
                : hargaJualBuku; // Jika tidak spesial, gunakan harga zona/jual

            // Tentukan diskon final
            let finalDiskonPersen = isSpesial
                ? (Number(buku.diskonJualSpesial) || 0) // Jika spesial, gunakan diskon spesial
                : (Number(buku.diskonJual) || 0); // Jika tidak spesial, gunakan diskon jual biasa

            return {
                hargaSatuan: finalHargaSatuan,
                diskonPersen: finalDiskonPersen,
            };
        };


        // ===== Handler ganti pelanggan/buku =====
        const handlePelangganChange = (idPelanggan) => {
            const pel = pelangganList.find((p) => p.id === idPelanggan) || null;
            setSelectedPelanggan(pel);
            const items = form.getFieldValue('items') || [];
            const newItems = items.map((item) => {
                if (!item || !item.idBuku) return item;
                const { hargaSatuan, diskonPersen } = getHargaOtomatis(item.idBuku, pel);
                return { ...item, hargaSatuan, diskonPersen };
            });
            form.setFieldsValue({ items: newItems });
        };

        const handleBukuChange = (index, idBuku) => {
            const { hargaSatuan, diskonPersen } = getHargaOtomatis(idBuku, selectedPelanggan);
            const items = form.getFieldValue('items') || [];
            items[index] = { ...(items[index] || {}), idBuku, hargaSatuan, diskonPersen };
            form.setFieldsValue({ items: [...items] });
        };

        // ===== Submit (Logika mode EDIT diubah drastis, Validasi Stok Dihapus) =====
        const handleFinish = async (values) => {
            console.log("Form disubmit dengan data:", values);
            setIsSaving(true);
            message.loading({ content: 'Menyimpan Transaksi...', key: 'tx', duration: 0 });
            try {
                const { idPelanggan, items, ...data } = values;

                if (!data.nomorInvoice || !data.nomorInvoice.startsWith('INV/')) {
                    throw new Error('Nomor Invoice tidak valid atau belum terbuat.');
                }
                const parts = data.nomorInvoice.split('/');
                if (parts.length !== 4) throw new Error('Format Nomor Invoice tidak dikenali.');
                const txKey = (mode === 'edit' && initialTx?.id)
                    ? initialTx.id
                    : `INV-${parts[1]}-${parts[2]}-${parts[3]}`;


                if (!items || items.length === 0 || items.some(item => !item || !item.idBuku)) {
                    throw new Error('Transaksi harus memiliki minimal 1 item buku yang valid.');
                }
                const pelanggan = pelangganList.find((p) => p.id === idPelanggan);
                if (!pelanggan) throw new Error('Pelanggan tidak valid.');

                let totalTagihan = 0;
                let totalQty = 0;
                const processedItems = items.map((item, index) => {
                    if (!item || !item.idBuku || item.jumlah == null || item.hargaSatuan == null) { throw new Error(`Data item #${index + 1} tidak lengkap.`); }
                    const buku = bukuList.find((b) => b.id === item.idBuku);
                    if (!buku) throw new Error(`Buku ${item.idBuku} (item #${index + 1}) tidak ditemukan`);
                    const hargaSatuan = Number(item.hargaSatuan);
                    const diskonPersen = Number(item.diskonPersen || 0);
                    const jumlah = Number(item.jumlah);
                    if (isNaN(hargaSatuan) || isNaN(diskonPersen) || isNaN(jumlah) || jumlah <= 0) { throw new Error(`Nilai jumlah/harga/diskon item #${index + 1} tidak valid.`); }

                    const hargaFinal = Math.round(hargaSatuan * (1 - diskonPersen / 100) * jumlah);
                    totalQty += jumlah;
                    totalTagihan += hargaFinal;
                    return { idBuku: item.idBuku, judulBuku: buku.judul, jumlah, hargaSatuan, diskonPersen };
                });

                if (!data.tanggal || !dayjs(data.tanggal).isValid()) {
                    throw new Error("Tanggal transaksi tidak valid.");
                }

                const baseTx = {
                    nomorInvoice: data.nomorInvoice,
                    tanggal: data.tanggal.valueOf(),
                    idPelanggan,
                    namaPelanggan: pelanggan.nama,
                    telepon: pelanggan.telepon || '', // Ambil telepon
                    pelangganIsSpesial: pelanggan.isSpesial || false,
                    items: processedItems,
                    totalTagihan,
                    totalQty,
                    keterangan: data.keterangan || '',
                };

                console.log("Mempersiapkan data simpan:", { txKey, baseTx });

                const updates = {};

                if (mode === 'create') {
                    updates[`transaksiJualBuku/${txKey}`] = {
                        ...baseTx,
                        jumlahTerbayar: 0,
                        statusPembayaran: 'Belum Bayar',
                        historiPembayaran: null,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    };

                    // Update Stok (Mode Create - Tanpa validasi negatif)
                    for (const item of processedItems) {
                        const buku = bukuList.find((b) => b.id === item.idBuku);
                        // Ambil stok terbaru langsung dari DB untuk keamanan (opsional tapi lebih aman)
                        // const currentBookSnap = await get(ref(db, `buku/${item.idBuku}/stok`));
                        // const stokSebelum = Number(currentBookSnap.val() || 0);
                        const stokSebelum = Number(buku?.stok || 0); // Atau dari list jika cukup cepat
                        const perubahan = -Math.abs(Number(item.jumlah));
                        const stokSesudah = stokSebelum + perubahan;
                        const histRef = ref(db, `buku/${item.idBuku}/historiStok`);
                        const logKey = push(histRef).key;
                        updates[`buku/${item.idBuku}/stok`] = stokSesudah;
                        updates[`buku/${item.idBuku}/updatedAt`] = serverTimestamp();
                        updates[`buku/${item.idBuku}/historiStok/${logKey}`] = {
                            timestamp: serverTimestamp(),
                            keterangan: `Penjualan via invoice ${data.nomorInvoice}`,
                            refId: txKey,
                            perubahan,
                            stokSebelum,
                            stokSesudah,
                        };
                    }
                } else { // EDIT MODE
                    if (!initialTx?.id) throw new Error("ID transaksi edit tidak ditemukan.");
                    const editTxKey = initialTx.id;
                    const originalItems = initialTx.items || [];

                    updates[`transaksiJualBuku/${editTxKey}`] = {
                        ...initialTx,
                        ...baseTx,
                        updatedAt: serverTimestamp()
                    };

                    const stockChanges = new Map();

                    originalItems.forEach(item => {
                        const currentDelta = stockChanges.get(item.idBuku) || 0;
                        stockChanges.set(item.idBuku, currentDelta + Number(item.jumlah || 0));
                    });

                    processedItems.forEach(item => {
                        const currentDelta = stockChanges.get(item.idBuku) || 0;
                        stockChanges.set(item.idBuku, currentDelta - Number(item.jumlah || 0));
                    });

                    console.log("Perhitungan perubahan stok (delta):", Object.fromEntries(stockChanges));

                    for (const [idBuku, deltaQty] of stockChanges.entries()) {
                        if (deltaQty === 0) continue;

                        const buku = bukuList.find((b) => b.id === idBuku);
                        if (!buku) {
                            console.warn(`Buku dengan ID ${idBuku} tidak ditemukan saat penyesuaian stok edit.`);
                            continue;
                        }
                        const stokSebelum = Number(buku.stok || 0);
                        const perubahan = deltaQty;
                        const stokSesudah = stokSebelum + perubahan;

                        const histRef = ref(db, `buku/${idBuku}/historiStok`);
                        const logKey = push(histRef).key;

                        updates[`buku/${idBuku}/stok`] = stokSesudah;
                        updates[`buku/${idBuku}/updatedAt`] = serverTimestamp();
                        updates[`buku/${idBuku}/historiStok/${logKey}`] = {
                            timestamp: serverTimestamp(),
                            keterangan: `Penyesuaian/Retur Edit Invoice ${data.nomorInvoice}`,
                            refId: editTxKey,
                            perubahan,
                            stokSebelum,
                            stokSesudah,
                        };
                    }
                }

                console.log("Update Firebase final:", updates);
                await update(ref(db), updates);

                message.success({ content: 'Transaksi berhasil disimpan', key: 'tx' });
                form.resetFields();
                setSelectedPelanggan(null);
                onSuccess?.();
            } catch (error) {
                console.error("Gagal menyimpan transaksi:", error);
                message.error({ content: `Gagal menyimpan: ${error.message}`, key: 'tx', duration: 7 });
            } finally {
                setIsSaving(false);
            }
        };


        // ===== Delete (Edit only) =====
        const handleDelete = async () => {
            if (mode !== 'edit' || !initialTx?.id) return;

            setIsSaving(true);
            message.loading({ content: 'Menghapus transaksi & mengembalikan stok...', key: 'del_tx', duration: 0 });
            try {
                const deleteTxKey = initialTx.id;
                const itemsToReturn = initialTx.items || [];
                const updates = {};

                updates[`transaksiJualBuku/${deleteTxKey}`] = null;

                for (const item of itemsToReturn) {
                    const buku = bukuList.find((b) => b.id === item.idBuku);
                    if (!buku) {
                        console.warn(`Buku ${item.idBuku} tidak ditemukan saat proses hapus/retur.`);
                        continue;
                    }
                    const stokSebelum = Number(buku.stok || 0);
                    const perubahan = Math.abs(Number(item.jumlah || 0));
                    const stokSesudah = stokSebelum + perubahan;

                    const histRef = ref(db, `buku/${item.idBuku}/historiStok`);
                    const logKey = push(histRef).key;

                    updates[`buku/${item.idBuku}/stok`] = stokSesudah;
                    updates[`buku/${item.idBuku}/updatedAt`] = serverTimestamp();
                    updates[`buku/${item.idBuku}/historiStok/${logKey}`] = {
                        timestamp: serverTimestamp(),
                        keterangan: `Retur Hapus Invoice ${initialTx.nomorInvoice || deleteTxKey}`,
                        refId: deleteTxKey,
                        perubahan,
                        stokSebelum,
                        stokSesudah,
                    };
                }

                console.log("Update Firebase (delete):", updates);
                await update(ref(db), updates);

                message.success({ content: 'Transaksi dihapus & stok dikembalikan.', key: 'del_tx' });
                onSuccess?.();
            } catch (e) {
                console.error("Gagal menghapus transaksi:", e);
                message.error({ content: `Gagal menghapus transaksi: ${e.message}`, key: 'del_tx' });
            } finally {
                setIsSaving(false);
            }
        };


        // ===== Subtotal item (read-only) =====
        const SubtotalField = ({ index }) => (
            <Form.Item
                noStyle
                shouldUpdate={(prev, cur) =>
                    prev.items?.[index]?.jumlah !== cur.items?.[index]?.jumlah ||
                    prev.items?.[index]?.hargaSatuan !== cur.items?.[index]?.hargaSatuan ||
                    prev.items?.[index]?.diskonPersen !== cur.items?.[index]?.diskonPersen
                }
            >
                {({ getFieldValue }) => {
                    const jumlah = Number(getFieldValue(['items', index, 'jumlah']) || 0);
                    const hargaSatuan = Number(getFieldValue(['items', index, 'hargaSatuan']) || 0);
                    const diskon = Number(getFieldValue(['items', index, 'diskonPersen']) || 0);
                    const subtotal = Math.round(hargaSatuan * jumlah * (1 - diskon / 100));
                    return (
                        <InputNumber
                            value={subtotal} readOnly disabled formatter={rupiahFormatter} parser={rupiahParser}
                            style={{ width: '100%', textAlign: 'right', background: '#f0f2f5', color: 'rgba(0, 0, 0, 0.88)' }}
                        />
                    );
                }}
            </Form.Item>
        );

        // ===== Render Form di dalam Modal =====
        return (
            <Modal
                title={mode === 'create' ? 'Tambah Transaksi Penjualan' : 'Edit Transaksi Penjualan'}
                open={open}
                onCancel={onCancel}
                width={800}
                confirmLoading={isSaving} // <-- Loading state for OK button
                destroyOnClose
                footer={null} // Manual footer rendering
                maskClosable={false}
            >
                <Spin spinning={loadingDependencies} tip="Memuat data master...">
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleFinish}
                        initialValues={{ tanggal: dayjs(), items: [{}] }}
                    >
                        {/* --- Header Form Responsive --- */}
                        <Row gutter={16}>
                            <Col xs={24} md={12}>
                                <Form.Item name="nomorInvoice" label="Nomor Invoice" rules={[{ required: true, message: 'Nomor invoice diperlukan' }]}>
                                    <Input disabled readOnly addonBefore={isGeneratingInvoice ? <Spin size="small" /> : null} placeholder={isGeneratingInvoice ? 'Membuat nomor...' : 'Nomor invoice'}/>
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item name="tanggal" label="Tanggal" rules={[{ required: true, message: 'Tanggal diperlukan' }]}>
                                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                                </Form.Item>
                            </Col>
                        </Row>

                        {/* --- Form Pelanggan & Keterangan --- */}
                        <Form.Item name="idPelanggan" label="Pelanggan" rules={[{ required: true, message: 'Pelanggan wajib dipilih!' }]}>
                            <Select
                                showSearch
                                placeholder="Pilih pelanggan"
                                onChange={handlePelangganChange}
                                filterOption={(input, option) => (option?.children?.toString() ?? '').toLowerCase().includes(input.toLowerCase()) }
                                disabled={(isGeneratingInvoice && mode === 'create')} // Disable saat generate invoice saja
                                loading={loadingDependencies}
                                notFoundContent={loadingDependencies ? <Spin size="small" /> : 'Data pelanggan tidak ditemukan'}
                            >
                                {pelangganList.map((p) => (<Option key={p.id} value={p.id}>{p.nama} {p.isSpesial && '(Spesial)'}</Option>))}
                            </Select>
                        </Form.Item>
                        <Form.Item name="keterangan" label="Keterangan (Opsional)">
                            <Input.TextArea rows={2} placeholder="Catatan untuk transaksi ini..." />
                        </Form.Item>

                        <Typography.Title level={5} style={{ marginTop: 24, marginBottom: 8 }}>Item Buku</Typography.Title>

                        {/* --- Form.List Card --- */}
                        <Form.List name="items">
                            {(fields, { add, remove }) => (
                                <>
                                    {fields.map(({ key, name, ...restField }, index) => (
                                        <Card key={key} size="small" style={{ marginBottom: 16, backgroundColor: '#f9f9f9' }} extra={ fields.length > 1 ? (<Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />) : null }>
                                            <Row gutter={16}>
                                                {/* Kolom Buku */}
                                                <Col span={24}>
                                                    <Form.Item {...restField} name={[name, 'idBuku']} rules={[{ required: true, message: 'Pilih buku' }]} label={`Item #${index + 1}: Buku`} style={{ marginBottom: 8 }}>
                                                        <Select
                                                            showSearch
                                                            placeholder="Pilih Buku"
                                                            onChange={(idBuku) => handleBukuChange(index, idBuku)}
                                                            filterOption={(input, option) => (option?.children?.toString() ?? '').toLowerCase().includes(input.toLowerCase())}
                                                            disabled={!selectedPelanggan || loadingDependencies} // Disable jika pelanggan belum dipilih atau data master loading
                                                            loading={loadingDependencies}
                                                            notFoundContent={loadingDependencies ? <Spin size="small" /> : 'Data buku tidak ditemukan'}
                                                        >
                                                            {bukuList.map((b) => (<Option key={b.id} value={b.id}>{b.judul}</Option>))}
                                                        </Select>
                                                    </Form.Item>
                                                </Col>
                                                {/* Kolom Qty */}
                                                <Col xs={12} sm={8}><Form.Item {...restField} name={[name, 'jumlah']} rules={[{ required: true, message: 'Isi Qty' }]} initialValue={1} label="Qty" style={{ marginBottom: 8 }}><InputNumber min={1} style={{ width: '100%' }} placeholder="Jumlah" /></Form.Item></Col>
                                                {/* Kolom Diskon */}
                                                <Col xs={12} sm={8}><Form.Item {...restField} name={[name, 'diskonPersen']} initialValue={0} label="Diskon (%)" style={{ marginBottom: 8 }}><InputNumber min={0} max={100} suffix="%" style={{ width: '100%' }} placeholder="Diskon" /></Form.Item></Col>
                                                {/* Kolom Harga */}
                                                <Col xs={24} sm={8}><Form.Item {...restField} name={[name, 'hargaSatuan']} rules={[{ required: true, message: 'Isi Harga' }]} label="Harga Satuan" style={{ marginBottom: 8 }}><InputNumber placeholder="Harga" min={0} formatter={rupiahFormatter} parser={rupiahParser} style={{ width: '100%', textAlign: 'right' }} /></Form.Item></Col>
                                                {/* Kolom Subtotal */}
                                                <Col span={24}><Form.Item label="Subtotal" style={{ marginBottom: 0 }}><SubtotalField index={index} /></Form.Item></Col>
                                            </Row>
                                        </Card>
                                    ))}
                                    <Form.Item>
                                        <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} disabled={!selectedPelanggan || (isGeneratingInvoice && mode === 'create') || loadingDependencies}>Tambah Item Buku</Button>
                                        {!selectedPelanggan && ( <Text type="warning" style={{ display: 'block', marginTop: 8 }}> Pilih pelanggan terlebih dahulu untuk menambah item.</Text> )}
                                    </Form.Item>
                                </>
                            )}
                        </Form.List>

                        {/* --- GRAND TOTAL --- */}
                        <Form.Item noStyle shouldUpdate={(prev, cur) => JSON.stringify(prev.items || []) !== JSON.stringify(cur.items || [])}>
                            {({ getFieldValue }) => {
                                const items = getFieldValue('items') || [];
                                let total = 0; let qty = 0;
                                items.forEach((it) => {
                                if (it && it.hargaSatuan != null && it.jumlah != null) {
                                        const harga = Number(it.hargaSatuan); const diskon = Number(it.diskonPersen || 0); const jml = Number(it.jumlah);
                                        if (!isNaN(harga) && !isNaN(diskon) && !isNaN(jml)) { total += Math.round(harga * jml * (1 - diskon / 100)); qty += jml;}
                                }
                                });
                                return (
                                    <>
                                        <Divider />
                                        <Row gutter={16}>
                                            <Col xs={24} md={12} style={{ marginBottom: 16 }}><Card bordered={false} style={{ backgroundColor: '#fafafa' }}><Statistic title="Total Qty Buku" value={qty} /></Card></Col>
                                            <Col xs={24} md={12}><Card bordered={false} style={{ backgroundColor: '#fafafa' }}><Statistic title="Grand Total" value={total} formatter={rupiahFormatter} /></Card></Col>
                                        </Row>
                                        <Divider />
                                    </>
                                );
                            }}
                        </Form.Item>

                        {/* --- Tombol Aksi di dalam Modal Footer --- */}
                        <Row justify="space-between" style={{ marginTop: 24 }}>
                            <Col>
                                {mode === 'edit' && (
                                    <Popconfirm title="Hapus transaksi ini? Stok akan dikembalikan." okText="Hapus" cancelButtonText="Batal" okButtonProps={{ danger: true }} onConfirm={handleDelete} disabled={isSaving}>
                                        <Button danger icon={<DeleteOutlined />} disabled={isSaving}> Hapus Transaksi </Button> {/* Loading untuk delete ditangani isSaving */}
                                    </Popconfirm>
                                )}
                                <Button style={{ marginLeft: mode === 'edit' ? 8 : 0 }} onClick={onCancel} disabled={isSaving}> Batal </Button>
                            </Col>
                            <Col>
                                <Button type="primary" htmlType="submit" loading={isSaving} size="large" disabled={(isGeneratingInvoice && mode === 'create') || loadingDependencies}>
                                    {mode === 'create' ? 'Simpan Transaksi' : 'Simpan Perubahan'}
                                </Button>
                            </Col>
                        </Row>
                    </Form>
                </Spin>
            </Modal>
        );
    }