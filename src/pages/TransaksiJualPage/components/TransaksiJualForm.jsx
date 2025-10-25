// ================================
// FILE: src/pages/transaksi-jual/components/TransaksiJualForm.jsx
// PERUBAHAN:
// 1. Header (No. Invoice, Tanggal) dibuat responsive (xs={24} md={12}).
// 2. Daftar Item (Form.List) diubah total:
//    - Menghapus <ItemsHeader>
//    - Mengganti <Row> per item menjadi <Card> per item.
//    - Tombol Hapus dipindah ke <Card extra>.
//    - Input Qty, Diskon, Harga di-layout responsive (xs/sm) di dalam Card.
//    - Menambahkan label di setiap Form.Item (menggantikan header).
// 3. Grand Total sudah responsive (tidak diubah).
// ================================

import React, { useEffect, useState } from 'react';
import {
    Form, Input, InputNumber, Select, Button, Space, DatePicker, message, Typography,
    Row, Col, Spin, Popconfirm, Divider, Card, Statistic
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { db } from '../../../api/firebase';
import {
    ref, update, remove, serverTimestamp,
    query, orderByKey, startAt, endAt, get, push
} from 'firebase/database';
import dayjs from 'dayjs';

const { Option } = Select;
const { Text } = Typography;

// ---------- Helpers: Rupiah Formatter / Parser (Tidak berubah) ----------
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

    // ===== Prefill saat EDIT (Tidak berubah) =====
    useEffect(() => {
        if (mode === 'edit' && initialTx) {
            const p = pelangganList.find((x) => x.id === initialTx.idPelanggan) || null;
            setSelectedPelanggan(p);
            form.setFieldsValue({
                nomorInvoice: initialTx.nomorInvoice || initialTx.id,
                tanggal: initialTx.tanggal ? dayjs(initialTx.tanggal) : dayjs(),
                idPelanggan: initialTx.idPelanggan,
                keterangan: initialTx.keterangan || '',
                items: (initialTx.items || []).map((it) => ({
                    idBuku: it.idBuku,
                    jumlah: it.jumlah,
                    hargaSatuan: it.hargaSatuan,
                    diskonPersen: it.diskonPersen || 0
                })),
            });
        }
    }, [mode, initialTx, pelangganList, form]);

    // ===== Generate nomor invoice saat CREATE (Tidak berubah) =====
    useEffect(() => {
        if (mode !== 'create') return;
        const generateInvoiceNumber = async () => {
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
                    const lastKey = keys[keys.length - 1];
                    const lastNumStr = lastKey.split('-').pop();
                    nextNum = parseInt(lastNumStr, 10) + 1;
                }
                const newNumStr = String(nextNum).padStart(4, '0');
                const displayInvoice = `INV/${year}/${month}/${newNumStr}`;
                form.setFieldsValue({ nomorInvoice: displayInvoice });
            } catch (e) {
                console.error(e);
                message.error('Gagal membuat nomor invoice. Coba lagi.');
            } finally {
                setIsGeneratingInvoice(false);
            }
        };
        generateInvoiceNumber();
    }, [mode, form]);

    // ===== Helper harga otomatis (Tidak berubah) =====
    const getHargaOtomatis = (idBuku, pelanggan) => {
        const buku = bukuList.find((b) => b.id === idBuku);
        if (!buku) return { hargaSatuan: 0, diskonPersen: 0 };
        const isSpesial = pelanggan?.isSpesial || false;
        return {
            hargaSatuan: (isSpesial ? buku.hargaJualSpesial : buku.hargaJual) || 0,
            diskonPersen: (isSpesial ? buku.diskonJualSpesial : buku.diskonJual) || 0,
        };
    };

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
        items[index] = { ...items[index], idBuku, hargaSatuan, diskonPersen };
        form.setFieldsValue({ items: [...items] });
    };

    // ===== Submit (Tidak berubah) =====
    const handleFinish = async (values) => {
        setIsSaving(true);
        message.loading({ content: 'Menyimpan Transaksi...', key: 'tx' });
        try {
            const { idPelanggan, items, ...data } = values;
            if (!data.nomorInvoice) throw new Error('Nomor Invoice tidak valid.');

            const txKey = mode === 'create' ? data.nomorInvoice.replace(/\//g, '-') : initialTx.id;

            if (!items || items.length === 0) throw new Error('Transaksi harus memiliki minimal 1 item buku.');
            const pelanggan = pelangganList.find((p) => p.id === idPelanggan);
            if (!pelanggan) throw new Error('Pelanggan tidak valid.');

            let totalTagihan = 0;
            let totalQty = 0;
            const processedItems = items.map((item) => {
                const buku = bukuList.find((b) => b.id === item.idBuku);
                if (!buku) throw new Error(`Buku ${item.idBuku} tidak ditemukan`);
                const hargaSatuan = Number(item.hargaSatuan || 0);
                const diskonPersen = Number(item.diskonPersen || 0);
                const jumlah = Number(item.jumlah || 0);
                const hargaFinal = hargaSatuan * (1 - diskonPersen / 100) * jumlah;
                totalQty += jumlah;
                totalTagihan += hargaFinal;
                return { idBuku: item.idBuku, judulBuku: buku.judul, jumlah, hargaSatuan, diskonPersen };
            });

            const baseTx = {
                nomorInvoice: data.nomorInvoice,
                tanggal: data.tanggal.valueOf(),
                idPelanggan,
                namaPelanggan: pelanggan.nama,
                pelangganIsSpesial: pelanggan.isSpesial || false,
                items: processedItems,
                totalTagihan,
                totalQty,
                keterangan: data.keterangan || '',
            };

            if (mode === 'create') {
                const updates = {};
                updates[`transaksiJualBuku/${txKey}`] = {
                    ...baseTx,
                    jumlahTerbayar: 0,
                    statusPembayaran: 'Belum Bayar',
                    historiPembayaran: null,
                };

                for (const item of processedItems) {
                    const buku = bukuList.find((b) => b.id === item.idBuku);
                    const stokSebelum = Number(buku?.stok || 0);
                    const perubahan = -Math.abs(Number(item.jumlah || 0));
                    const stokSesudah = stokSebelum + perubahan;

                    const histRef = ref(db, `buku/${item.idBuku}/historiStok`);
                    const logKey = push(histRef).key;

                    updates[`buku/${item.idBuku}/stok`] = stokSesudah;
                    updates[`buku/${item.idBuku}/historiStok/${logKey}`] = {
                        timestamp: serverTimestamp(),
                        keterangan: `Penjualan via invoice ${data.nomorInvoice}`,
                        perubahan,
                        stokSebelum,
                        stokSesudah,
                    };
                }
                await update(ref(db), updates);
            } else {
                // EDIT
                const keepPaid = {
                    jumlahTerbayar: Number(initialTx.jumlahTerbayar || 0),
                    statusPembayaran: initialTx.statusPembayaran || 'Belum Bayar',
                    historiPembayaran: initialTx.historiPembayaran || null,
                };
                await update(ref(db, `transaksiJualBuku/${txKey}`), { ...baseTx, ...keepPaid });
            }

            message.success({ content: 'Transaksi berhasil disimpan', key: 'tx' });
            form.resetFields();
            setSelectedPelanggan(null);
            onSuccess?.();
        } catch (error) {
            console.error(error);
            message.error({ content: `Gagal menyimpan: ${error.message}`, key: 'tx' });
        } finally {
            setIsSaving(false);
        }
    };

    // ===== Delete (Edit only) (Tidak berubah) =====
    const handleDelete = async () => {
        if (mode !== 'edit' || !initialTx?.id) return;
        try {
            await remove(ref(db, `transaksiJualBuku/${initialTx.id}`));
            message.success('Transaksi dihapus.');
            onSuccess?.();
        } catch (e) {
            console.error(e);
            message.error('Gagal menghapus transaksi');
        }
    };

    // ===== Subtotal item (read-only) =====
    // DIUBAH: style width 100% dan background
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
                        value={subtotal}
                        readOnly
                        disabled
                        formatter={rupiahFormatter}
                        parser={rupiahParser}
                        style={{
                            width: '100%',
                            textAlign: 'right',
                            background: '#f0f2f5', // <-- Warna disabled
                            color: 'rgba(0, 0, 0, 0.88)' // <-- Teks agar terbaca
                        }}
                    />
                );
            }}
        </Form.Item>
    );

    // ===== Header List Item (DIHAPUS) =====
    // const ItemsHeader = () => ( ... );

    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={handleFinish}
            initialValues={{ tanggal: dayjs() }}
        >
            {/* --- PERUBAHAN 1: Header Form Responsive --- */}
            <Row gutter={16}>
                <Col xs={24} md={12}>
                    <Form.Item name="nomorInvoice" label="Nomor Invoice" rules={[{ required: true }]}>
                        <Input
                            disabled
                            addonBefore={isGeneratingInvoice ? <Spin size="small" /> : null}
                            placeholder={isGeneratingInvoice ? 'Membuat nomor...' : 'Nomor invoice'}
                        />
                    </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                    <Form.Item name="tanggal" label="Tanggal" rules={[{ required: true }]}>
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                </Col>
            </Row>

            {/* --- Form Pelanggan & Keterangan (Tidak Berubah) --- */}
            <Form.Item name="idPelanggan" label="Pelanggan" rules={[{ required: true }]}>
                <Select
                    showSearch
                    placeholder="Pilih pelanggan"
                    onChange={handlePelangganChange}
                    filterOption={(input, option) =>
                        (option?.children?.toString() ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    disabled={isGeneratingInvoice && mode === 'create'}
                >
                    {pelangganList.map((p) => (
                        <Option key={p.id} value={p.id}>
                            {p.nama} {p.isSpesial && '(Spesial)'}
                        </Option>
                    ))}
                </Select>
            </Form.Item>

            <Form.Item name="keterangan" label="Keterangan (Opsional)">
                <Input.TextArea rows={2} placeholder="Catatan untuk transaksi ini..." />
            </Form.Item>

            <Typography.Title level={5} style={{ marginTop: 24, marginBottom: 8 }}>
                Item Buku
            </Typography.Title>

            {/* Header kolom DIHAPUS */}
            {/* <ItemsHeader /> */}

            {/* --- PERUBAHAN 2: Form.List diubah menjadi Card --- */}
            <Form.List name="items">
                {(fields, { add, remove }) => (
                    <>
                        {fields.map(({ key, name, ...restField }, index) => (
                            <Card
                                key={key}
                                size="small"
                                style={{ marginBottom: 16, backgroundColor: '#f9f9f9' }}
                                extra={
                                    <Button
                                        type="text"
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={() => remove(name)}
                                    />
                                }
                            >
                                <Row gutter={16}>
                                    {/* Kolom Buku (Full width) */}
                                    <Col span={24}>
                                        <Form.Item
                                            {...restField}
                                            name={[name, 'idBuku']}
                                            rules={[{ required: true, message: 'Pilih buku' }]}
                                            label={`Item #${index + 1}: Buku`}
                                        >
                                            <Select
                                                showSearch
                                                placeholder="Pilih Buku"
                                                onChange={(idBuku) => handleBukuChange(index, idBuku)}
                                                filterOption={(input, option) =>
                                                    (option?.children?.toString() ?? '').toLowerCase().includes(input.toLowerCase())
                                                }
                                            >
                                                {bukuList.map((b) => (
                                                    <Option key={b.id} value={b.id}>
                                                        {b.judul}
                                                    </Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                    </Col>

                                    {/* Kolom Qty (Responsive) */}
                                    <Col xs={12} sm={8}>
                                        <Form.Item
                                            {...restField}
                                            name={[name, 'jumlah']}
                                            rules={[{ required: true, message: 'Isi Qty' }]}
                                            initialValue={1}
                                            label="Qty"
                                        >
                                            <InputNumber min={1} style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>

                                    {/* Kolom Diskon (Responsive) */}
                                    <Col xs={12} sm={8}>
                                        <Form.Item
                                            {...restField}
                                            name={[name, 'diskonPersen']}
                                            initialValue={0}
                                            label="Diskon (%)"
                                        >
                                            <InputNumber min={0} max={100} suffix="%" style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>

                                    {/* Kolom Harga (Responsive) */}
                                    <Col xs={24} sm={8}>
                                        <Form.Item
                                            {...restField}
                                            name={[name, 'hargaSatuan']}
                                            rules={[{ required: true, message: 'Isi Harga' }]}
                                            label="Harga Satuan"
                                        >
                                            <InputNumber
                                                placeholder="Harga"
                                                min={0}
                                                formatter={rupiahFormatter}
                                                parser={rupiahParser}
                                                style={{ width: '100%', textAlign: 'right' }}
                                            />
                                        </Form.Item>
                                    </Col>
                                    
                                    {/* Kolom Subtotal (Full width) */}
                                    <Col span={24}>
                                         <Form.Item label="Subtotal" style={{ marginBottom: 0 }}>
                                            <SubtotalField index={index} />
                                         </Form.Item>
                                    </Col>
                                </Row>
                            </Card>
                        ))}

                        <Form.Item>
                            <Button
                                type="dashed"
                                onClick={() => add()}
                                block
                                icon={<PlusOutlined />}
                                disabled={!selectedPelanggan || (isGeneratingInvoice && mode === 'create')}
                            >
                                Tambah Item Buku
                            </Button>
                            {!selectedPelanggan && (
                                <Text type="warning"> Pilih pelanggan terlebih dahulu untuk menambah item.</Text>
                            )}
                        </Form.Item>
                    </>
                )}
            </Form.List>

            {/* --- GRAND TOTAL (Layout ini sudah responsive, tidak diubah) --- */}
            <Form.Item
                noStyle
                shouldUpdate={(prev, cur) => JSON.stringify(prev.items || []) !== JSON.stringify(cur.items || [])}
            >
                {({ getFieldValue }) => {
                    const items = getFieldValue('items') || [];
                    let total = 0;
                    let qty = 0;
                    items.forEach((it) => {
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
                                    <Card bordered={false} style={{ backgroundColor: '#fafafa' }}>
                                        <Statistic title="Total Qty Buku" value={qty} />
                                    </Card>
                                </Col>
                                <Col xs={24} md={12}>
                                    <Card bordered={false} style={{ backgroundColor: '#fafafa' }}>
                                        <Statistic
                                            title="Grand Total"
                                            value={total}
                                            formatter={rupiahFormatter}
                                        />
                                    </Card>
                                </Col>
                            </Row>
                            <Divider />
                        </>
                    );
                }}
            </Form.Item>

            {/* --- Tombol Aksi (Tidak berubah) --- */}
            <Row justify="space-between" style={{ marginTop: 8 }}>
                <Col>
                    {mode === 'edit' && (
                        <Popconfirm
                            title="Hapus transaksi ini?"
                            okText="Hapus"
                            okButtonProps={{ danger: true }}
                            onConfirm={handleDelete}
                        >
                            <Button danger icon={<DeleteOutlined />}>
                                Hapus Transaksi
                            </Button>
                        </Popconfirm>
                    )}
                </Col>
                <Col>
                    <Button
                        type="primary"
                        htmlType="submit"
                        loading={isSaving}
                        size="large"
                        disabled={isGeneratingInvoice && mode === 'create'}
                    >
                        {mode === 'create' ? 'Simpan Transaksi' : 'Simpan Perubahan'}
                    </Button>
                </Col>
            </Row>
        </Form>
    );
}