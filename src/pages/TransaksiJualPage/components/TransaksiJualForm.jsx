// ================================
// FILE: src/pages/transaksi-jual/components/TransaksiJualForm.jsx
// Versi dengan layout responsive, update/reversal stok otomatis,
// dan perbaikan warning console.
// ================================

import React, { useEffect, useState, useCallback } from 'react';
import {
    Form, Input, InputNumber, Select, Button, Space, DatePicker, message, Typography,
    Row, Col, Spin, Popconfirm, Divider, Card, Statistic, Modal
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { db } from '../../../api/firebase'; // Pastikan path benar
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

// Komponen Form Utama
export default function TransaksiJualForm({
    open,
    onCancel,
    mode = 'create',
    initialTx = null,
    bukuList = [],
    pelangganList = [],
    onSuccess
}) {
    const [form] = Form.useForm();
    const [isSaving, setIsSaving] = useState(false);
    const [selectedPelanggan, setSelectedPelanggan] = useState(null);
    const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(mode === 'create');
    const [modalHook, contextHolderModal] = Modal.useModal();

    const isEditing = mode === 'edit' && !!initialTx?.id;
    const transactionId = initialTx?.id;

    // ===== Prefill saat EDIT =====
    useEffect(() => {
        if (open) {
            if (isEditing) {
                const p = pelangganList.find((x) => x.id === initialTx.idPelanggan) || null;
                setSelectedPelanggan(p);
                // PERBAIKAN WARNING: Pastikan nilai default tidak null
                form.setFieldsValue({
                    nomorInvoice: initialTx.nomorInvoice || initialTx.id || '', // default string kosong
                    tanggal: initialTx.tanggal ? dayjs(initialTx.tanggal) : dayjs(),
                    idPelanggan: initialTx.idPelanggan,
                    keterangan: initialTx.keterangan || '', // default string kosong
                    items: (initialTx.items || []).map((it) => ({
                        idBuku: it.idBuku,
                        jumlah: it.jumlah || 1, // default 1
                        hargaSatuan: it.hargaSatuan || 0, // default 0
                        diskonPersen: it.diskonPersen || 0 // default 0
                    })),
                });
            } else {
                form.resetFields();
                // PERBAIKAN WARNING: default tanggal & item awal
                form.setFieldsValue({
                    tanggal: dayjs(),
                    items: [{}], // Satu item kosong
                    keterangan: '', // default string kosong
                });
                generateInvoiceNumber();
                setSelectedPelanggan(null);
            }
        }
    }, [open, isEditing, initialTx, pelangganList, form]); // Hapus generateInvoiceNumber dari dependency array

    // ===== Generate nomor invoice saat CREATE =====
     const generateInvoiceNumber = useCallback(async () => {
        if (mode !== 'create' || !open) return; // Hanya jalan saat create & modal open
        setIsGeneratingInvoice(true);
        const now = dayjs();
        const year = now.format('YYYY');
        const month = now.format('MM');
        const keyPrefix = `INV-${year}-${month}-`;

        const txRef = ref(db, 'transaksiJualBuku');
        const qy = query(txRef, orderByKey(), startAt(keyPrefix), endAt(keyPrefix + '\uf8ff'));

        try {
            const snapshot = await get(qy);
            let nextNum = 1;
            if (snapshot.exists()) {
                const keys = Object.keys(snapshot.val());
                const validKeys = keys.filter(k => k.startsWith(keyPrefix));
                 if(validKeys.length > 0) {
                    const lastKey = validKeys.sort().pop();
                    const lastNumStr = lastKey.split('-').pop();
                    const lastNum = parseInt(lastNumStr, 10);
                     if (!isNaN(lastNum)) nextNum = lastNum + 1;
                 }
            }
            const newNumStr = String(nextNum).padStart(4, '0');
            const displayInvoice = `INV/${year}/${month}/${newNumStr}`;
            // Hanya set nomor invoice jika masih mode create
            if (form.getFieldValue('nomorInvoice') === undefined || form.getFieldValue('nomorInvoice') === '') {
                 form.setFieldsValue({ nomorInvoice: displayInvoice });
            }
        } catch (e) {
            console.error("Gagal generate invoice:", e);
            message.error('Gagal membuat nomor invoice. Coba lagi.');
        } finally {
            setIsGeneratingInvoice(false);
        }
    }, [mode, open, form]); // Tambahkan `open`

     // Panggil generateInvoiceNumber saat mode create dan modal terbuka
     useEffect(() => {
        if (mode === 'create' && open) {
            generateInvoiceNumber();
        }
     }, [mode, open, generateInvoiceNumber]);


    // ===== Helper harga otomatis =====
    const getHargaOtomatis = useCallback((idBuku, pelanggan) => {
        const buku = bukuList.find((b) => b.id === idBuku);
        if (!buku) return { hargaSatuan: 0, diskonPersen: 0 };
        const isSpesial = pelanggan?.isSpesial || false;
        // PERBAIKAN WARNING: default 0 jika harga null/undefined
        return {
            hargaSatuan: (isSpesial ? buku.hargaJualSpesial : buku.hargaJual) || 0,
            diskonPersen: (isSpesial ? buku.diskonJualSpesial : buku.diskonJual) || 0,
        };
    }, [bukuList]);

    const handlePelangganChange = useCallback((idPelanggan) => {
        const pel = pelangganList.find((p) => p.id === idPelanggan) || null;
        setSelectedPelanggan(pel);
        const items = form.getFieldValue('items') || [];
        items.forEach((item, index) => { // Gunakan forEach untuk update langsung
            if (item && item.idBuku) {
                const { hargaSatuan, diskonPersen } = getHargaOtomatis(item.idBuku, pel);
                form.setFieldValue(['items', index, 'hargaSatuan'], hargaSatuan);
                form.setFieldValue(['items', index, 'diskonPersen'], diskonPersen);
            }
        });
    }, [pelangganList, form, getHargaOtomatis]);

    const handleBukuChange = useCallback((index, idBuku) => {
        const { hargaSatuan, diskonPersen } = getHargaOtomatis(idBuku, selectedPelanggan);
        form.setFieldValue(['items', index, 'hargaSatuan'], hargaSatuan);
        form.setFieldValue(['items', index, 'diskonPersen'], diskonPersen);
         // Reset jumlah ke 1 saat buku diganti
         form.setFieldValue(['items', index, 'jumlah'], 1);
    }, [form, getHargaOtomatis, selectedPelanggan]);


    // ===== Submit Form (CREATE / EDIT) =====
    const handleFinish = async (values) => {
        setIsSaving(true);
        message.loading({ content: 'Menyimpan Transaksi...', key: 'savingTx' });

        try {
            const { idPelanggan, items, ...data } = values;
             if (!data.nomorInvoice || (mode === 'create' && isGeneratingInvoice)) {
                throw new Error('Nomor Invoice belum siap atau tidak valid.');
            }
            // Filter item kosong sebelum validasi
            const validItemsInput = (items || []).filter(item => item && item.idBuku && item.jumlah > 0);
            if (validItemsInput.length === 0) {
                throw new Error('Transaksi harus memiliki minimal 1 item buku yang valid dengan jumlah lebih dari 0.');
            }
            const pelanggan = pelangganList.find((p) => p.id === idPelanggan);
            if (!pelanggan) throw new Error('Pelanggan tidak valid.');

            let totalTagihan = 0;
            let totalQty = 0;
            const processedItems = validItemsInput.map((item) => {
                const buku = bukuList.find((b) => b.id === item.idBuku);
                // Seharusnya tidak error karena sudah difilter di atas, tapi cek lagi
                if (!buku) throw new Error(`Buku ${item.idBuku} tidak ditemukan (kesalahan internal)`);
                const hargaSatuan = Number(item.hargaSatuan || 0);
                const diskonPersen = Number(item.diskonPersen || 0);
                const jumlah = Number(item.jumlah || 1); // Default jumlah 1
                const hargaFinal = hargaSatuan * jumlah * (1 - diskonPersen / 100);
                totalQty += jumlah;
                totalTagihan += hargaFinal;
                return { idBuku: item.idBuku, judulBuku: buku.judul, jumlah, hargaSatuan, diskonPersen };
            });

            const baseTxData = {
                nomorInvoice: data.nomorInvoice,
                tanggal: data.tanggal.valueOf(),
                idPelanggan,
                namaPelanggan: pelanggan.nama,
                pelangganIsSpesial: pelanggan.isSpesial || false,
                items: processedItems,
                totalTagihan: Math.round(totalTagihan),
                totalQty,
                keterangan: data.keterangan || '', // Pastikan string kosong, bukan null
            };

            const updates = {};

            if (isEditing) {
                // --- MODE EDIT ---
                const oldItems = initialTx?.items || [];
                const oldItemsMap = new Map(oldItems.map(item => [item.idBuku, Number(item.jumlah || 0)]));
                const newItemsMap = new Map(processedItems.map(item => [item.idBuku, Number(item.jumlah || 0)]));
                const allInvolvedBookIds = new Set([...oldItemsMap.keys(), ...newItemsMap.keys()]);

                for (const bookId of allInvolvedBookIds) {
                     if (!bookId) continue;
                     const oldQty = oldItemsMap.get(bookId) || 0;
                     const newQty = newItemsMap.get(bookId) || 0;
                     const perubahanQtyItem = newQty - oldQty;

                     if (perubahanQtyItem !== 0) {
                         const bookRef = ref(db, `buku/${bookId}`);
                         const bookSnapshot = await get(bookRef);
                         if (bookSnapshot.exists()) {
                             const currentBookData = bookSnapshot.val();
                             const stokSebelumUpdate = Number(currentBookData.stok || 0);
                             const stokSesudahUpdate = stokSebelumUpdate - perubahanQtyItem;
                             const historyPath = `buku/${bookId}/historiStok`;
                             const newHistoryRef = push(ref(db, historyPath));
                             const historyKey = newHistoryRef.key;
                             if (historyKey) {
                                 const newHistoryEntry = {
                                     keterangan: `Penyesuaian Order Jual (Edit) - Inv: ${baseTxData.nomorInvoice}`,
                                     perubahan: -perubahanQtyItem,
                                     stokSebelum: stokSebelumUpdate,
                                     stokSesudah: stokSesudahUpdate,
                                     timestamp: serverTimestamp(),
                                     user: "Admin/Sistem"
                                 };
                                 updates[`buku/${bookId}/stok`] = stokSesudahUpdate;
                                 updates[`buku/${bookId}/historiStok/${historyKey}`] = newHistoryEntry;
                             }
                         } else {
                              message.warn(`Buku ${bookId} tidak ditemukan. Stok tidak diupdate.`);
                         }
                     }
                 }
                const keepPaidStatus = {
                    jumlahTerbayar: Number(initialTx.jumlahTerbayar || 0),
                    statusPembayaran: initialTx.statusPembayaran || 'Belum Bayar',
                    historiPembayaran: initialTx.historiPembayaran || null, // null bukan undefined
                };
                updates[`transaksiJualBuku/${transactionId}`] = { ...baseTxData, ...keepPaidStatus };

            } else {
                // --- MODE CREATE ---
                const txKey = baseTxData.nomorInvoice.replace(/\//g, '-');
                updates[`transaksiJualBuku/${txKey}`] = {
                    ...baseTxData,
                    jumlahTerbayar: 0,
                    statusPembayaran: 'Belum Bayar',
                    historiPembayaran: null, // null bukan undefined
                    createdAt: serverTimestamp()
                };
                for (const item of processedItems) {
                    const bookRef = ref(db, `buku/${item.idBuku}`);
                    const bookSnapshot = await get(bookRef);
                    if (bookSnapshot.exists()) {
                        const currentBookData = bookSnapshot.val();
                        const stokSebelum = Number(currentBookData.stok || 0);
                        const perubahan = -Math.abs(Number(item.jumlah || 0));
                        const stokSesudah = stokSebelum + perubahan;
                        const historyPath = `buku/${item.idBuku}/historiStok`;
                        const newHistoryRef = push(ref(db, historyPath));
                        const historyKey = newHistoryRef.key;
                        if (historyKey) {
                            updates[`buku/${item.idBuku}/stok`] = stokSesudah;
                            updates[`buku/${item.idBuku}/historiStok/${historyKey}`] = {
                                timestamp: serverTimestamp(),
                                keterangan: `Penjualan - Inv: ${baseTxData.nomorInvoice}`,
                                perubahan, stokSebelum, stokSesudah, user: "Admin/Sistem",
                            };
                        }
                    } else {
                         message.warn(`Buku ${item.idBuku} tidak ditemukan saat mengurangi stok.`);
                    }
                }
            }
            await update(ref(db), updates);
            message.success({ content: 'Transaksi berhasil disimpan', key: 'savingTx' });
            // form.resetFields(); // Reset di useEffect saja
            // setSelectedPelanggan(null); // Reset di useEffect saja
            onSuccess?.(); // Panggil callback (menutup modal)

        } catch (error) {
            console.error("Gagal menyimpan transaksi:", error);
            message.error({ content: `Gagal menyimpan: ${error.message}`, key: 'savingTx' });
        } finally {
            setIsSaving(false);
        }
    };


    // ===== Delete Transaksi (Edit only) =====
    const handleDelete = async () => {
        if (!isEditing || !transactionId) return;

        modalHook.confirm({
            title: 'Konfirmasi Hapus Transaksi',
            content: `Anda yakin ingin menghapus invoice ${initialTx?.nomorInvoice}? Stok buku yang terkait akan dikembalikan. Tindakan ini tidak dapat dibatalkan.`,
            okText: 'Ya, Hapus', okType: 'danger', cancelText: 'Batal',
            onOk: async () => {
                setIsSaving(true);
                message.loading({ content: `Menghapus ${initialTx?.nomorInvoice}...`, key: 'deletingTx' });
                try {
                    const itemsToDelete = initialTx?.items || [];
                    const transactionPath = `transaksiJualBuku/${transactionId}`;
                    const updates = {};

                    for (const item of itemsToDelete) {
                        if (!item.idBuku || !item.jumlah) continue;
                        const bookId = item.idBuku;
                        const qtyDibatalkan = Number(item.jumlah || 0);
                        if (qtyDibatalkan === 0) continue;

                        const bookRef = ref(db, `buku/${bookId}`);
                        const bookSnapshot = await get(bookRef);
                        if (bookSnapshot.exists()) {
                            const currentBookData = bookSnapshot.val();
                            const stokSebelumReversal = Number(currentBookData.stok || 0);
                            const stokSesudahReversal = stokSebelumReversal + qtyDibatalkan;
                            const historyPath = `buku/${bookId}/historiStok`;
                            const newHistoryRef = push(ref(db, historyPath));
                            const historyKey = newHistoryRef.key;
                            if (historyKey) {
                                const reversalHistoryEntry = {
                                    keterangan: `Pembatalan Order Jual - Inv: ${initialTx?.nomorInvoice}`,
                                    perubahan: +qtyDibatalkan,
                                    stokSebelum: stokSebelumReversal,
                                    stokSesudah: stokSesudahReversal,
                                    timestamp: serverTimestamp(),
                                    user: "Admin/Sistem"
                                };
                                updates[`buku/${bookId}/stok`] = stokSesudahReversal;
                                updates[`buku/${bookId}/historiStok/${historyKey}`] = reversalHistoryEntry;
                            }
                        } else {
                             message.warn(`Buku ${bookId} tidak ditemukan saat pemulihan stok.`);
                        }
                    }
                    updates[transactionPath] = null; // Tandai transaksi untuk dihapus

                    if (Object.keys(updates).length > 0) {
                       await update(ref(db), updates);
                    } else {
                       await remove(ref(db, transactionPath)); // Hapus jika tidak ada stok yg perlu diupdate
                    }
                    message.success({ content: `Transaksi ${initialTx?.nomorInvoice} dihapus`, key: 'deletingTx' });
                    onSuccess?.(); // Panggil callback (menutup modal)
                } catch (error) {
                    console.error("Error deleting transaction:", error);
                    message.error({ content: `Gagal menghapus: ${error.message}`, key: 'deletingTx' });
                } finally {
                    setIsSaving(false);
                }
            },
        });
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
                        value={subtotal} readOnly disabled
                        formatter={rupiahFormatter} parser={rupiahParser}
                        style={{ width: '100%', textAlign: 'right', background: '#f0f2f5', color: 'rgba(0, 0, 0, 0.88)' }}
                    />
                );
            }}
        </Form.Item>
    );

    // Render Form dalam Modal
    return (
        <Modal
            open={open}
            title={isEditing ? `Edit Transaksi Jual (${initialTx?.nomorInvoice || ''})` : 'Tambah Transaksi Jual Baru'}
            onCancel={onCancel}
            footer={null} // Footer dirender manual di dalam Form
            destroyOnClose
            width="100vw"
            style={{ top: 0, padding: 0, margin: 0, maxWidth: '100vw' }}
            bodyStyle={{ padding: '24px', height: 'calc(100vh - 55px)', overflowY: 'auto' }}
        >
             {contextHolderModal}
            <Form
                form={form}
                layout="vertical"
                onFinish={handleFinish}
                // PERBAIKAN WARNING: Default values yang lebih aman
                initialValues={{ tanggal: dayjs(), items: [{}], keterangan: '' }}
            >
                {/* --- Header Form Responsive --- */}
                <Row gutter={16}>
                    <Col xs={24} md={12}>
                        <Form.Item name="nomorInvoice" label="Nomor Invoice" rules={[{ required: true }]}>
                            <Input disabled addonBefore={isGeneratingInvoice ? <Spin size="small" /> : null} placeholder={isGeneratingInvoice ? 'Membuat nomor...' : 'Nomor invoice'} />
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                        <Form.Item name="tanggal" label="Tanggal" rules={[{ required: true }]}>
                            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
                        </Form.Item>
                    </Col>
                </Row>

                {/* --- Form Pelanggan & Keterangan --- */}
                <Form.Item name="idPelanggan" label="Pelanggan" rules={[{ required: true, message: 'Pelanggan wajib dipilih!' }]}>
                    <Select showSearch placeholder="Pilih pelanggan" onChange={handlePelangganChange} filterOption={(input, option) => (option?.children?.toString() ?? '').toLowerCase().includes(input.toLowerCase())} disabled={isGeneratingInvoice && mode === 'create'}>
                        {pelangganList.map((p) => (<Option key={p.id} value={p.id}>{p.nama} {p.isSpesial && '(Spesial)'}</Option>))}
                    </Select>
                </Form.Item>
                <Form.Item name="keterangan" label="Keterangan (Opsional)">
                    <Input.TextArea rows={2} placeholder="Catatan untuk transaksi ini..." />
                </Form.Item>

                <Typography.Title level={5} style={{ marginTop: 24, marginBottom: 8 }}>Item Buku</Typography.Title>

                {/* --- Form.List Item Buku (Layout Card) --- */}
                <Form.List name="items">
                    {(fields, { add, remove }, { errors }) => (
                        <>
                            {fields.map(({ key, name, ...restField }, index) => (
                                <Card key={key} size="small" style={{ marginBottom: 16, backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9f9f9' }}
                                    extra={fields.length > 1 ? (<Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />) : null}>
                                    <Row gutter={[16, 0]}>
                                        <Col span={24} style={{ marginBottom: 8 }}>
                                            <Form.Item {...restField} name={[name, 'idBuku']} label={`Item #${index + 1}: Buku`} rules={[{ required: true, message: 'Pilih buku' }]} style={{ marginBottom: 0 }}>
                                                <Select showSearch placeholder="Cari & Pilih Buku..." onChange={(idBuku) => handleBukuChange(index, idBuku)} filterOption={(input, option) => (option?.children?.toString() ?? '').toLowerCase().includes(input.toLowerCase())} disabled={!selectedPelanggan}>
                                                    {bukuList.map((b) => (<Option key={b.id} value={b.id}>{b.judul} (Stok: {b.stok || 0})</Option>))}
                                                </Select>
                                            </Form.Item>
                                        </Col>
                                        <Col xs={12} sm={6}>
                                            <Form.Item {...restField} name={[name, 'jumlah']} label="Qty" rules={[{ required: true, message: 'Isi Qty' }]} initialValue={1} style={{ marginBottom: 8 }}>
                                                <InputNumber min={1} style={{ width: '100%' }} placeholder="Jumlah" />
                                            </Form.Item>
                                        </Col>
                                         <Col xs={12} sm={9}>
                                            <Form.Item {...restField} name={[name, 'hargaSatuan']} label="Harga Satuan" rules={[{ required: true, message: 'Isi Harga' }]} style={{ marginBottom: 8 }}>
                                                <InputNumber min={0} formatter={rupiahFormatter} parser={rupiahParser} style={{ width: '100%', textAlign: 'right' }} placeholder="Harga jual" />
                                            </Form.Item>
                                        </Col>
                                         <Col xs={12} sm={9}>
                                            <Form.Item {...restField} name={[name, 'diskonPersen']} label="Diskon (%)" initialValue={0} style={{ marginBottom: 8 }}>
                                                <InputNumber min={0} max={100} suffix="%" style={{ width: '100%' }} />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} sm={12}>
                                             <Form.Item label="Subtotal" style={{ marginBottom: 8 }}>
                                                <SubtotalField index={index} />
                                             </Form.Item>
                                        </Col>
                                    </Row>
                                </Card>
                            ))}
                            <Form.Item>
                                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} disabled={!selectedPelanggan || (isGeneratingInvoice && mode === 'create')}>Tambah Item Buku</Button>
                                {!selectedPelanggan && (<Text type="warning" style={{ display: 'block', marginTop: '8px' }}>Pilih pelanggan terlebih dahulu.</Text>)}
                                <Form.ErrorList errors={errors} />
                            </Form.Item>
                        </>
                    )}
                </Form.List>

                {/* --- GRAND TOTAL --- */}
                <Form.Item noStyle shouldUpdate={(prev, cur) => JSON.stringify(prev.items || []) !== JSON.stringify(cur.items || [])}>
                    {({ getFieldValue }) => {
                        const items = getFieldValue('items') || [];
                        let total = 0;
                        let qty = 0;
                        items.filter(it => it && it.idBuku && it.jumlah > 0).forEach((it) => {
                            const harga = Number(it?.hargaSatuan || 0);
                            const diskon = Number(it?.diskonPersen || 0);
                            const jml = Number(it?.jumlah || 0);
                            total += harga * jml * (1 - diskon / 100);
                            qty += jml;
                        });
                        return (
                            <>
                                <Divider />
                                <Row gutter={16}>
                                    <Col xs={24} md={12} style={{ marginBottom: 16 }}>
                                        {/* PERBAIKAN WARNING: bordered={false} -> variant="borderless" */}
                                        <Card variant="borderless" size="small" style={{ backgroundColor: '#fafafa' }}>
                                            <Statistic title="Total Qty Buku" value={qty} />
                                        </Card>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        {/* PERBAIKAN WARNING: bordered={false} -> variant="borderless" */}
                                        <Card variant="borderless" size="small" style={{ backgroundColor: '#fafafa' }}>
                                            <Statistic title="Grand Total" value={Math.round(total)} formatter={rupiahFormatter} />
                                        </Card>
                                    </Col>
                                </Row>
                                <Divider />
                            </>
                        );
                    }}
                </Form.Item>

                {/* --- Tombol Aksi --- */}
                <Row justify="space-between" style={{ marginTop: 8 }}>
                    <Col>
                        {isEditing && (
                            <Button danger icon={<DeleteOutlined />} onClick={handleDelete} loading={isSaving}> Hapus Transaksi </Button>
                        )}
                    </Col>
                    <Col>
                         <Space>
                             <Button onClick={onCancel} disabled={isSaving}> Batal </Button>
                             <Button type="primary" htmlType="submit" loading={isSaving} size="large" disabled={isGeneratingInvoice && mode === 'create'}>
                                 {isEditing ? 'Simpan Perubahan' : 'Simpan Transaksi'}
                             </Button>
                         </Space>
                    </Col>
                </Row>
            </Form>
        </Modal>
    );
}