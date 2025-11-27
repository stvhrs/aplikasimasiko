    // ================================
    // FILE: src/pages/transaksi-jual/components/TransaksiJualForm.jsx
    // ================================

    import React, { useEffect, useState } from 'react';
    import {
        Modal,
        Form, Input, InputNumber, Select, Button, Space, DatePicker, message, Typography,Tag,
        Row, Col, Spin, Popconfirm, Divider, Card, Statistic
    } from 'antd';
    import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
    import { db } from '../../../api/firebase'; 
    import {
        ref, update, remove, serverTimestamp,
        query, orderByKey, startAt, endAt, get, push
    } from 'firebase/database';
    import dayjs from 'dayjs';

    // --- IMPORT HOOKS BARU (ANTI-RELOAD / LAZY LOAD) ---
    import { useBukuStream, usePelangganStream } from '../../../hooks/useFirebaseData'; 

    const { Option } = Select;
    const { Text } = Typography;

    // --- Helpers ---
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
        onSuccess,
    }) {
        // --- LAZY LOAD DATA MASTER ---
        const { bukuList, loadingBuku } = useBukuStream();
        const { pelangganList, loadingPelanggan } = usePelangganStream();
        
        const loadingDependencies = loadingBuku || loadingPelanggan;

        const [form] = Form.useForm();
        const [isSaving, setIsSaving] = useState(false);
        const [selectedPelanggan, setSelectedPelanggan] = useState(null);
        const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(mode === 'create');

        // ===== Prefill saat EDIT =====
        useEffect(() => {
            if (open && !loadingDependencies) {
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
                            daerah: initialTx.daerah || '',
                            keterangan: initialTx.keterangan || '',
                            diskonLain: initialTx.diskonLain || 0,
                            biayaTentu: initialTx.biayaTentu || 0,
                            items: itemsToSet,
                        });
                    } catch (error) {
                        console.error("Gagal memuat data form edit:", error);
                        message.error("Gagal memuat data transaksi. Coba lagi.");
                        onCancel();
                    }
                } else if (mode === 'create') {
                    form.resetFields();
                    form.setFieldsValue({
                        tanggal: dayjs(),
                        items: [{}],
                        diskonLain: 0,
                        biayaTentu: 0
                    });
                    setSelectedPelanggan(null);
                    setIsGeneratingInvoice(true);
                }
            }
        }, [mode, initialTx, pelangganList, form, onCancel, open, loadingDependencies]);

        // ===== Generate Nomor Invoice (Create Mode) =====
        useEffect(() => {
            if (mode !== 'create' || !open || !isGeneratingInvoice) return;
            let isMounted = true;
            
            const generateInvoiceNumber = async () => {
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
                        const lastNumStr = lastKey?.split('-').pop();
                        if (lastNumStr && !isNaN(parseInt(lastNumStr, 10))) {
                            nextNum = parseInt(lastNumStr, 10) + 1;
                        }
                    }
                    
                    const newNumStr = String(nextNum).padStart(4, '0');
                    const displayInvoice = `INV/${year}/${month}/${newNumStr}`;
                    
                    if (isMounted) {
                        form.setFieldsValue({ nomorInvoice: displayInvoice });
                    }
                } catch (e) {
                    console.error("Gagal generate invoice:", e);
                    if (isMounted) message.error('Gagal generate nomor invoice.');
                } finally {
                    if (isMounted) setIsGeneratingInvoice(false);
                }
            };
            
            generateInvoiceNumber();
            return () => { isMounted = false; };
        }, [mode, open, isGeneratingInvoice]);

        // ===== Helper Harga Otomatis =====
        const getHargaOtomatis = (idBuku, pelanggan) => {
            const buku = bukuList.find((b) => b.id === idBuku);
            if (!buku) return { hargaSatuan: 0, diskonPersen: 0 };
            
            const isSpesial = pelanggan?.isSpesial || false;
            const zonaPelanggan = pelanggan?.zona;
            const hargaZonaKey = zonaPelanggan ? `harga_zona_${zonaPelanggan}` : null;
            
            let hargaJualBuku = Number(buku.hargaJual) || 0;
            if (hargaZonaKey && buku[hargaZonaKey] != null) {
                hargaJualBuku = Number(buku[hargaZonaKey]) || hargaJualBuku;
            }
            
            let finalHargaSatuan = isSpesial ? (Number(buku.hargaJualSpesial) || hargaJualBuku) : hargaJualBuku;
            let finalDiskonPersen = isSpesial ? (Number(buku.diskonJualSpesial) || 0) : (Number(buku.diskonJual) || 0);
            
            return { hargaSatuan: finalHargaSatuan, diskonPersen: finalDiskonPersen };
        };

        // ===== Handlers =====
        const handlePelangganChange = (idPelanggan) => {
            const pel = pelangganList.find((p) => p.id === idPelanggan) || null;
            setSelectedPelanggan(pel);
            
            // Update harga item yang sudah dipilih sesuai tipe pelanggan baru
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

        // ===== Submit Logic (Create & Edit) =====
        const handleFinish = async (values) => {
            console.log("Submit:", values);
            setIsSaving(true);
            message.loading({ content: 'Menyimpan...', key: 'tx', duration: 0 });
            
            try {
                const { idPelanggan, items, diskonLain, biayaTentu, ...data } = values;
                const nominalDiskonLain = Number(diskonLain || 0);
                const nominalBiayaTentu = Number(biayaTentu || 0);

                if (!items || items.length === 0 || items.some(i => !i || !i.idBuku)) {
                    throw new Error('Minimal 1 item buku valid.');
                }
                const pelanggan = pelangganList.find((p) => p.id === idPelanggan);
                if (!pelanggan) throw new Error('Pelanggan tidak valid.');

                // Proses Item & Hitung Total
                let totalTagihanItems = 0; 
                let totalQty = 0;
                
                const processedItems = items.map((item, index) => {
                    const buku = bukuList.find((b) => b.id === item.idBuku);
                    if (!buku) throw new Error(`Buku (Baris ${index + 1}) tidak ditemukan`);
                    
                    const hargaSatuan = Number(item.hargaSatuan);
                    const diskonPersen = Number(item.diskonPersen || 0);
                    const jumlah = Number(item.jumlah);
                    const hargaFinal = Math.round(hargaSatuan * (1 - diskonPersen / 100) * jumlah);
                    
                    totalQty += jumlah;
                    totalTagihanItems += hargaFinal;
                    
                    return {
                        idBuku: item.idBuku,
                        judulBuku: buku.judul,
                        jumlah,
                        hargaSatuan,
                        diskonPersen,
                        _bukuData: buku // Untuk referensi stok
                    };
                });

                // Hitung Grand Total Final
                const finalTotalTagihan = totalTagihanItems - nominalDiskonLain + nominalBiayaTentu;

                // Bersihkan _bukuData sebelum simpan
                const cleanItems = processedItems.map(item => {
                    const { _bukuData, ...rest } = item;
                    return rest;
                });

                const baseTx = {
                    nomorInvoice: data.nomorInvoice,
                    tanggal: data.tanggal.valueOf(),
                    idPelanggan,
                    namaPelanggan: pelanggan.nama,
                    telepon: pelanggan.telepon || '',
                    pelangganIsSpesial: pelanggan.isSpesial || false,
                    items: cleanItems,
                    totalTagihan: finalTotalTagihan,
                    totalQty,
                    daerah: data.daerah || '',
                    keterangan: data.keterangan || '',
                    diskonLain: nominalDiskonLain,
                    biayaTentu: nominalBiayaTentu,
                };

                const updates = {};

                if (mode === 'create') {
                    // --- LOGIC CREATE ---
                    const parts = data.nomorInvoice.split('/');
                    const txKey = `INV-${parts[1]}-${parts[2]}-${parts[3]}`;
                    
                    updates[`transaksiJualBuku/${txKey}`] = {
                        ...baseTx,
                        jumlahTerbayar: 0,
                        statusPembayaran: 'Belum',
                        historiPembayaran: null,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    };

                    // Kurangi Stok
                    for (const item of processedItems) {
                        const buku = item._bukuData;
                        const stokBaru = Number(buku?.stok || 0) - Number(item.jumlah);
                        
                        updates[`buku/${item.idBuku}/stok`] = stokBaru;
                        updates[`buku/${item.idBuku}/updatedAt`] = serverTimestamp();

                        const logKey = push(ref(db, 'historiStok')).key;
                        updates[`historiStok/${logKey}`] = {
                            bukuId: buku.id, judul: buku.judul, kode_buku: buku.kode_buku, penerbit: buku.penerbit || '-',
                            perubahan: -Number(item.jumlah), stokSebelum: buku.stok, stokSesudah: stokBaru,
                            // [UPDATE] Tambah nama pelanggan
                            keterangan: `Penjualan ${data.nomorInvoice} - ${pelanggan.nama}`, 
                            refId: txKey, timestamp: serverTimestamp()
                        };
                    }

                } else { 
                    // --- LOGIC EDIT (Dengan Rekalkulasi Status) ---
                    const editTxKey = initialTx.id;
                    const existingTerbayar = Number(initialTx.jumlahTerbayar || 0);
                    
                    // Cek Status Baru berdasarkan tagihan revisi
                    let statusBaru = 'Belum';
                    if (existingTerbayar >= finalTotalTagihan) statusBaru = 'Lunas';
                    else if (existingTerbayar > 0) statusBaru = 'Belum';

                    updates[`transaksiJualBuku/${editTxKey}`] = {
                        ...initialTx,
                        ...baseTx,
                        statusPembayaran: statusBaru,
                        updatedAt: serverTimestamp()
                    };

                    // Koreksi Stok (Selisih Qty Lama vs Baru)
                    const oldItems = initialTx.items || [];
                    const stockDiff = new Map(); // Map<idBuku, deltaQty>

                    // Kembalikan stok lama
                    oldItems.forEach(i => stockDiff.set(i.idBuku, (stockDiff.get(i.idBuku)||0) + Number(i.jumlah)));
                    // Kurangi stok baru
                    processedItems.forEach(i => stockDiff.set(i.idBuku, (stockDiff.get(i.idBuku)||0) - Number(i.jumlah)));

                    for (const [idBuku, delta] of stockDiff.entries()) {
                        if (delta === 0) continue;
                        const buku = processedItems.find(i => i.idBuku === idBuku)?._bukuData || bukuList.find(b => b.id === idBuku);
                        if (buku) {
                            const stokBaru = Number(buku.stok || 0) + delta;
                            updates[`buku/${idBuku}/stok`] = stokBaru;
                            updates[`buku/${idBuku}/updatedAt`] = serverTimestamp();
                            
                            const logKey = push(ref(db, 'historiStok')).key;
                            updates[`historiStok/${logKey}`] = {
                                bukuId: buku.id, judul: buku.judul, kode_buku: buku.kode_buku, penerbit: buku.penerbit,
                                perubahan: delta, stokSebelum: buku.stok, stokSesudah: stokBaru,
                                // [UPDATE] Tambah nama pelanggan
                                keterangan: `Revisi Invoice ${data.nomorInvoice} - ${pelanggan.nama}`, 
                                refId: editTxKey, timestamp: serverTimestamp()
                            };
                        }
                    }
                }

                await update(ref(db), updates);
                message.success({ content: 'Berhasil disimpan!', key: 'tx' });
                form.resetFields();
                onSuccess?.();
            } catch (error) {
                console.error("Save error:", error);
                message.error({ content: `Gagal: ${error.message}`, key: 'tx' });
            } finally {
                setIsSaving(false);
            }
        };

        // ===== Delete Logic =====
        const handleDelete = async () => {
            if (mode !== 'edit' || !initialTx?.id) return;
            setIsSaving(true);
            message.loading({ content: 'Menghapus...', key: 'del', duration: 0 });
            try {
                const txKey = initialTx.id;
                const updates = {};
                updates[`transaksiJualBuku/${txKey}`] = null; // Hapus transaksi

                // Ambil nama pelanggan untuk log
                const namaPelanggan = initialTx.namaPelanggan || 'Tanpa Nama';

                // Kembalikan Stok
                for (const item of (initialTx.items || [])) {
                    const buku = bukuList.find(b => b.id === item.idBuku);
                    if (buku) {
                        const stokBaru = Number(buku.stok || 0) + Number(item.jumlah);
                        updates[`buku/${item.idBuku}/stok`] = stokBaru;
                        updates[`buku/${item.idBuku}/updatedAt`] = serverTimestamp();
                        
                        const logKey = push(ref(db, 'historiStok')).key;
                        updates[`historiStok/${logKey}`] = {
                            bukuId: buku.id, judul: buku.judul, kode_buku: buku.kode_buku, penerbit: buku.penerbit,
                            perubahan: Number(item.jumlah), stokSebelum: buku.stok, stokSesudah: stokBaru,
                            // [UPDATE] Tambah nama pelanggan
                            keterangan: `Hapus Invoice ${initialTx.nomorInvoice} - ${namaPelanggan}`, 
                            refId: txKey, timestamp: serverTimestamp()
                        };
                    }
                }
                
                await update(ref(db), updates);
                message.success({ content: 'Transaksi dihapus', key: 'del' });
                onSuccess?.();
            } catch (e) {
                message.error({ content: `Gagal hapus: ${e.message}`, key: 'del' });
            } finally {
                setIsSaving(false);
            }
        };

        // ===== Subtotal Component =====
        const SubtotalField = ({ index }) => (
            <Form.Item noStyle shouldUpdate={(p, c) => 
                p.items?.[index]?.jumlah !== c.items?.[index]?.jumlah || 
                p.items?.[index]?.hargaSatuan !== c.items?.[index]?.hargaSatuan || 
                p.items?.[index]?.diskonPersen !== c.items?.[index]?.diskonPersen
            }>
                {({ getFieldValue }) => {
                    const jml = Number(getFieldValue(['items', index, 'jumlah']) || 0);
                    const hrg = Number(getFieldValue(['items', index, 'hargaSatuan']) || 0);
                    const disc = Number(getFieldValue(['items', index, 'diskonPersen']) || 0);
                    return <InputNumber value={Math.round(hrg * jml * (1 - disc / 100))} readOnly disabled formatter={rupiahFormatter} parser={rupiahParser} style={{ width: '100%', textAlign: 'right', background: '#f5f5f5', color: 'black' }} />;
                }}
            </Form.Item>
        );

        return (
            <Modal
                title={mode === 'create' ? 'Tambah Transaksi' : 'Edit Transaksi'}
                open={open}
                onCancel={onCancel}
                width={900}
                confirmLoading={isSaving}
                destroyOnClose
                footer={null}
                maskClosable={false}
            >
                {/* LAZY LOAD INDICATOR */}
                <Spin spinning={loadingDependencies} tip="Memuat data Buku & Pelanggan..." size="large">
                    {!loadingDependencies && (
                        <Form form={form} layout="vertical" onFinish={handleFinish} initialValues={{ tanggal: dayjs(), items: [{}], diskonLain: 0, biayaTentu: 0 }}>
                            <Row gutter={16}>
                                <Col xs={24} md={12}><Form.Item name="nomorInvoice" label="Nomor Invoice" rules={[{ required: true }]}><Input disabled readOnly placeholder={isGeneratingInvoice ? "Generating..." : ""} /></Form.Item></Col>
                                <Col xs={24} md={12}><Form.Item name="tanggal" label="Tanggal" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
                            </Row>

                            <Form.Item name="idPelanggan" label="Pelanggan" rules={[{ required: true }]}>
                                <Select showSearch placeholder="Pilih Pelanggan" onChange={handlePelangganChange} filterOption={(input, option) => (option?.children?.toString() ?? '').toLowerCase().includes(input.toLowerCase())} disabled={isGeneratingInvoice && mode === 'create'}>
                                    {pelangganList.map(p => <Option key={p.id} value={p.id}>{p.nama} {p.isSpesial && '(Spesial)'}</Option>)}
                                </Select>
                            </Form.Item>

                            <Row gutter={16}>
                                <Col xs={24} md={12}><Form.Item name="daerah" label="Daerah (Opsional)"><Input /></Form.Item></Col>
                                <Col xs={24} md={12}><Form.Item name="keterangan" label="Catatan (Opsional)"><Input /></Form.Item></Col>
                            </Row>

<Divider orientation="left" orientationMargin={0}>
    Detail Item Buku
</Divider>

                            <Form.List name="items">
                                {(fields, { add, remove }) => (
                                    <>
                                        {fields.map(({ key, name, ...restField }, index) => {
                                            const sortedBuku = [...bukuList].sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
                                            return (
                                                <Card key={key} size="small" style={{ marginBottom: 12, background: '#fafafa' }} extra={fields.length > 1 && <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />}>
                                                    <Row gutter={12}>
                                                        <Col span={24}>
                                                            <Form.Item {...restField} name={[name, 'idBuku']} label={`Buku #${index+1}`} rules={[{ required: true }]}>
                                                                <Select 
                                                                    showSearch 
                                                                    placeholder="Pilih Buku (Cari berdasarkan Judul, Penerbit, atau Kode Buku)" 
                                                                    onChange={(val) => handleBukuChange(index, val)} 
                                                                    // filterOption mencakup 'label' yang kini berisi kode_buku
                                                                    filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} 
                                                                    optionLabelProp="label" 
                                                                    disabled={!selectedPelanggan}
                                                                >
                                                                    {sortedBuku.map(b => (
                                                                            <Option 
                                                                                key={b.id} 
                                                                                value={b.id} 
                                                                                // [UPDATE] Menyertakan kode_buku di label untuk pencarian
                                                                                label={`${b.kode_buku} | ${b.judul} (${b.penerbit}) | ${b.peruntukan} | Stok: ${b.stok}`}
                                                                            >
                                                                            <Text strong>{b.judul}</Text>
                                                                            <br/>
                                                                           <div
    style={{
        display: "flex",
        flexWrap: "wrap", // Agar tidak berantakan di layar kecil
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        background: "#f9f9f9",
        borderRadius: 6,
        border: "1px solid #f0f0f0",
        marginTop: 6
    }}
>
    {/* 1. Kode Buku: Pakai Tag Biru (Geekblue) agar terlihat identitas unik */}
    <Tag color="geekblue" style={{ margin: 0, fontFamily: 'monospace', fontWeight: 600 }}>
        {b.kode_buku}
    </Tag>

    {/* Divider Vertikal Halus */}
    <div style={{ width: 1, height: 14, background: '#d9d9d9' }} />

    {/* 2. Penerbit: Info Sekunder (Abu-abu) */}
    <Text type="secondary" style={{ fontSize: 12 }}>
        <span style={{ color: '#8c8c8c' }}>Penerbit:</span> 
        <span style={{ color: '#262626', marginLeft: 4, fontWeight: 500 }}>{b.penerbit}</span>
    </Text>

    {/* Divider Vertikal Halus */}
    <div style={{ width: 1, height: 14, background: '#d9d9d9' }} />

    {/* 3. Peruntukan: Info Tambahan */}
    <Text type="secondary" style={{ fontSize: 12 }}>
        {b.peruntukan}
    </Text>

    {/* Spacer otomatis agar Stok terdorong ke kanan (opsional, atau biarkan nempel) */}
    <div style={{ flex: 1 }} /> 

    {/* 4. Stok: Highlight dengan Background Pill */}
    <div 
        style={{ 
            fontSize: 12, 
            fontWeight: 'bold',
            padding: '2px 8px',
            borderRadius: 20,
            // Logika Warna: Hijau (Aman) vs Merah (Habis/Sedikit)
            background: b.stok > 0 ? '#f6ffed' : '#fff1f0', 
            color: b.stok > 0 ? '#389e0d' : '#cf1322',
            border: `1px solid ${b.stok > 0 ? '#b7eb8f' : '#ffa39e'}`
        }}
    >
        Stok: {b.stok}
    </div>
</div>
                                                                        </Option>
                                                                    ))}
                                                                </Select>
                                                            </Form.Item>
                                                        </Col>
                                                        <Col span={6}><Form.Item {...restField} name={[name, 'jumlah']} label="Qty" initialValue={1} rules={[{required:true}]}><InputNumber min={1} style={{width:'100%'}} /></Form.Item></Col>
                                                        <Col span={6}><Form.Item {...restField} name={[name, 'diskonPersen']} label="Disc %" initialValue={0}><InputNumber min={0} max={100} style={{width:'100%'}} /></Form.Item></Col>
                                                        <Col span={6}><Form.Item {...restField} name={[name, 'hargaSatuan']} label="Harga" rules={[{required:true}]}><InputNumber formatter={rupiahFormatter} parser={rupiahParser} style={{width:'100%'}} /></Form.Item></Col>
                                                        <Col span={6}><Form.Item label="Subtotal"><SubtotalField index={index} /></Form.Item></Col>
                                                    </Row>
                                                </Card>
                                            );
                                        })}
                                        <Form.Item><Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} disabled={!selectedPelanggan}>Tambah Buku</Button></Form.Item>
                                    </>
                                )}
                            </Form.List>

                            <Row gutter={16} style={{ marginTop: 16 }}>
                                <Col span={12}><Form.Item name="diskonLain" label="Diskon Lain (Rp)"><InputNumber min={0} formatter={rupiahFormatter} parser={rupiahParser} style={{width:'100%'}} /></Form.Item></Col>
                                <Col span={12}><Form.Item name="biayaTentu" label="Biaya Lain (Rp)"><InputNumber min={0} formatter={rupiahFormatter} parser={rupiahParser} style={{width:'100%'}} /></Form.Item></Col>
                            </Row>

                            {/* Grand Total Summary */}
                            <Form.Item noStyle shouldUpdate>
                                {({ getFieldValue }) => {
                                    const items = getFieldValue('items') || [];
                                    const diskonLain = Number(getFieldValue('diskonLain') || 0);
                                    const biayaTentu = Number(getFieldValue('biayaTentu') || 0);
                                    
                                    let subtotal = 0;
                                    let totalDiscItem = 0;
                                    let totalQty = 0;

                                    items.forEach(i => {
                                        const h = Number(i?.hargaSatuan||0), q = Number(i?.jumlah||0), d = Number(i?.diskonPersen||0);
                                        const bruto = h * q;
                                        const discVal = Math.round(bruto * d / 100);
                                        subtotal += (bruto - discVal);
                                        totalDiscItem += discVal;
                                        totalQty += q;
                                    });

                                    const grandTotal = subtotal - diskonLain + biayaTentu;
                                    const totalDiscAll = totalDiscItem + diskonLain;

                                    return (
                                        <Card style={{ background: '#f0f2f5', border: 'none' }}>
                                            <Row gutter={16} style={{ textAlign: 'center' }}>
                                                <Col span={8}><Statistic title="Total Qty" value={totalQty} /></Col>
                                                <Col span={8}><Statistic title="Total Hemat" value={totalDiscAll} valueStyle={{ color: '#faad14' }} prefix="Rp" /></Col>
                                                <Col span={8}><Statistic title="Grand Total" value={grandTotal} valueStyle={{ color: '#3f8600', fontWeight: 'bold' }} prefix="Rp" /></Col>
                                            </Row>
                                        </Card>
                                    );
                                }}
                            </Form.Item>

                            <Row justify="space-between" style={{ marginTop: 24 }}>
                                <Col>{mode === 'edit' && <Popconfirm title="Hapus?" onConfirm={handleDelete} okButtonProps={{ danger: true }}><Button danger loading={isSaving}>Hapus</Button></Popconfirm>} <Button style={{ marginLeft: 8 }} onClick={onCancel}>Batal</Button></Col>
                                <Col><Button type="primary" htmlType="submit" loading={isSaving} size="large">Simpan</Button></Col>
                            </Row>
                        </Form>
                    )}
                </Spin>
            </Modal>
        );
    }