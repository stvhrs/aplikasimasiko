import React, { useState } from 'react';
import {
    Modal, Form, Input, InputNumber, Select, Button, Space, DatePicker, message, Typography,
    Row, Col // <-- PERUBAHAN 1: Tambahkan 'Row' dan 'Col' di sini
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { db } from '../../../api/firebase';
import { ref, push, update, serverTimestamp } from 'firebase/database';
import dayjs from 'dayjs';

const { Option } = Select;
const { Text, Title } = Typography;

// <-- PERUBAHAN 2: Beri nilai default array kosong '[]' pada props
// Ini mencegah '.map' crash jika data masih 'undefined' (loading)
const TransaksiJualForm = ({ bukuList = [], pelangganList = [] }) => {
    const [form] = Form.useForm();
    const [isSaving, setIsSaving] = useState(false);
    const [selectedPelanggan, setSelectedPelanggan] = useState(null);

    // Helper untuk format mata uang
    // const currencyFormatter = (value) =>
    //     new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

    // Fungsi untuk mendapatkan harga & diskon berdasarkan pelanggan
    const getHargaOtomatis = (idBuku, pelanggan) => {
        const buku = bukuList.find(b => b.id === idBuku);
        if (!buku) return { hargaSatuan: 0, diskonPersen: 0 };

        const isSpesial = pelanggan?.isSpesial || false;
        
        return {
            hargaSatuan: (isSpesial ? buku.hargaJualSpesial : buku.hargaJual) || 0, // Fallback ke 0
            diskonPersen: (isSpesial ? buku.diskonJualSpesial : buku.diskonJual) || 0 // Fallback ke 0
        };
    };

    // Handler saat pelanggan utama diubah
    const handlePelangganChange = (idPelanggan) => {
        const pelanggan = pelangganList.find(p => p.id === idPelanggan);
        setSelectedPelanggan(pelanggan);

        // Update harga untuk semua item yang sudah ada di form
        const items = form.getFieldValue('items') || [];
        const newItems = items.map(item => {
            if (!item || !item.idBuku) return item;
            const { hargaSatuan, diskonPersen } = getHargaOtomatis(item.idBuku, pelanggan);
            return {
                ...item,
                hargaSatuan,
                diskonPersen
            };
        });
        form.setFieldsValue({ items: newItems });
    };

    // Handler saat buku di dalam Form.List diubah
    const handleBukuChange = (index, idBuku) => {
        const { hargaSatuan, diskonPersen } = getHargaOtomatis(idBuku, selectedPelanggan);
        const items = form.getFieldValue('items');
        items[index] = {
            ...items[index],
            idBuku: idBuku,
            hargaSatuan: hargaSatuan,
            diskonPersen: diskonPersen,
        };
        form.setFieldsValue({ items: [...items] });
    };

    // Handler saat form disubmit
    const handleFinish = async (values) => {
        setIsSaving(true);
        message.loading({ content: 'Menyimpan Transaksi...', key: 'tx' });

        try {
            const { idPelanggan, items, ...data } = values;
            if (!items || items.length === 0) {
                throw new Error("Transaksi harus memiliki minimal 1 item buku.");
            }

            const pelanggan = pelangganList.find(p => p.id === idPelanggan);
            if (!pelanggan) throw new Error("Pelanggan tidak valid."); // Validasi tambahan

            let totalTagihan = 0;

            const updates = {};
            const txKey = push(ref(db, 'transaksiJualBuku')).key;

            // Proses setiap item untuk kalkulasi total dan update stok
            const processedItems = items.map(item => {
                const buku = bukuList.find(b => b.id === item.idBuku);
                if (!buku) throw new Error(`Buku ${item.idBuku} tidak ditemukan`);

                const hargaSatuan = item.hargaSatuan || 0;
                const diskonPersen = item.diskonPersen || 0;
                const jumlah = item.jumlah || 0;

                const hargaFinal = (hargaSatuan * (1 - (diskonPersen / 100))) * jumlah;
                totalTagihan += hargaFinal;

                // Siapkan update stok
                const stokSebelum = Number(buku.stok || 0);
                const perubahan = -Math.abs(Number(jumlah));
                const stokSesudah = stokSebelum + perubahan;

                const logKey = push(ref(db, `buku/${item.idBuku}/historiStok`)).key;
                const logEntri = {
                    timestamp: serverTimestamp(),
                    keterangan: `Penjualan via invoice ${data.nomorInvoice || txKey}`,
                    perubahan,
                    stokSebelum,
                    stokSesudah
                };

                updates[`buku/${item.idBuku}/stok`] = stokSesudah;
                updates[`buku/${item.idBuku}/historiStok/${logKey}`] = logEntri;

                return {
                    idBuku: item.idBuku,
                    judulBuku: buku.judul,
                    jumlah: jumlah,
                    hargaSatuan: hargaSatuan,
                    diskonPersen: diskonPersen
                };
            });

            // Siapkan data transaksi utama
            const txData = {
                ...data,
                tanggal: data.tanggal.valueOf(),
                idPelanggan,
                namaPelanggan: pelanggan.nama,
                pelangganIsSpesial: pelanggan.isSpesial || false,
                items: processedItems,
                totalTagihan,
                jumlahTerbayar: 0,
                statusPembayaran: 'Belum Bayar',
                historiPembayaran: null
            };

            updates[`transaksiJualBuku/${txKey}`] = txData;

            // Jalankan update atomik
            await update(ref(db), updates);

            message.success({ content: 'Transaksi berhasil disimpan', key: 'tx' });
            form.resetFields();
            setSelectedPelanggan(null);

        } catch (error) {
            console.error("Error saving transaction:", error);
            message.error({ content: `Gagal menyimpan: ${error.message}`, key: 'tx' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Form form={form} layout="vertical" onFinish={handleFinish} initialValues={{ tanggal: dayjs() }}>
            {/* Baris ini sekarang aman karena 'Row' dan 'Col' sudah diimpor */}
            <Row gutter={16}>
                <Col span={12}><Form.Item name="nomorInvoice" label="Nomor Invoice" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="tanggal" label="Tanggal" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
            
            <Form.Item name="idPelanggan" label="Pelanggan" rules={[{ required: true }]}>
                <Select
                    showSearch
                    placeholder="Pilih pelanggan"
                    onChange={handlePelangganChange}
                    filterOption={(input, option) => 
                        (option.children?.toString() ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                >
                    {/* Baris ini sekarang aman karena 'pelangganList' punya nilai default [] */}
                    {pelangganList.map(p => (
                        <Option key={p.id} value={p.id}>{p.nama} {p.isSpesial && "(Spesial)"}</Option>
                    ))}
                </Select>
            </Form.Item>

            <Title level={5} style={{ marginTop: 24, marginBottom: 16 }}>Item Buku</Title>
            
            <Form.List name="items">
                {(fields, { add, remove }) => (
                    <>
                        {fields.map(({ key, name, ...restField }, index) => (
                            <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                <Form.Item {...restField} name={[name, 'idBuku']} rules={[{ required: true }]} style={{ width: '300px' }}>
                                    <Select
                                        showSearch
                                        placeholder="Pilih Buku"
                                        onChange={(idBuku) => handleBukuChange(index, idBuku)}
                                        filterOption={(input, option) => 
                                            (option.children?.toString() ?? '').toLowerCase().includes(input.toLowerCase())
                                        }
                                    >
                                        {/* Baris ini sekarang aman karena 'bukuList' punya nilai default [] */}
                                        {bukuList.map(b => <Option key={b.id} value={b.id}>{b.judul}</Option>)}
                                    </Select>
                                </Form.Item>
                                <Form.Item {...restField} name={[name, 'jumlah']} rules={[{ required: true }]} initialValue={1}>
                                    <InputNumber placeholder="Qty" min={1} />
                                </Form.Item>
                                <Form.Item {...restField} name={[name, 'hargaSatuan']} rules={[{ required: true }]}>
                                    <InputNumber placeholder="Harga Satuan" prefix="Rp " style={{ width: '150px' }} min={0}/>
                                </Form.Item>
                                <Form.Item {...restField} name={[name, 'diskonPersen']} initialValue={0}>
                                    <InputNumber placeholder="Diskon" suffix="%" style={{ width: '80px' }} min={0} max={100} />
                                </Form.Item>
                                <DeleteOutlined onClick={() => remove(name)} />
                            </Space>
                        ))}
                        <Form.Item>
                            <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} disabled={!selectedPelanggan}>
                                Tambah Item Buku
                            </Button>
                            {!selectedPelanggan && <Text type="warning">Pilih pelanggan terlebih dahulu untuk menambah item.</Text>}
                        </Form.Item>
                    </>
                )}
            </Form.List>

            <Form.Item style={{ marginTop: 32 }}>
                <Button type="primary" htmlType="submit" loading={isSaving} size="large">
                    Simpan Transaksi
                </Button>
            </Form.Item>
        </Form>
    );
};

export default TransaksiJualForm;