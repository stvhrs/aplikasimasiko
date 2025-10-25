// src/components/BulkRestockModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    Modal, Form, Input, InputNumber, Button, message, Spin, Alert, Typography, Select, Space, Divider, Card, Row, Col, Statistic
} from 'antd';
import { ref, push, serverTimestamp, runTransaction } from 'firebase/database';
import { db } from '../../../api/firebase'; // Sesuaikan path
import { numberFormatter } from '../../../utils/formatters'; // Sesuaikan path
import { PlusOutlined, DeleteOutlined, MinusCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;
const { Option } = Select;

// Helper subtotal (tidak berubah)
const SubtotalDisplay = ({ index }) => (
    <Form.Item
        noStyle
        shouldUpdate={(prev, cur) => prev.items?.[index]?.quantity !== cur.items?.[index]?.quantity }
    >
        {({ getFieldValue }) => {
            const quantity = Number(getFieldValue(['items', index, 'quantity']) || 0);
            const color = quantity > 0 ? '#52c41a' : (quantity < 0 ? '#f5222d' : '#8c8c8c');
            const prefix = quantity > 0 ? '+' : '';
            return (
                <Input
                    readOnly disabled value={`${prefix}${numberFormatter(quantity)}`}
                    style={{ width: '100%', textAlign: 'right', background: '#f0f2f5', color: color, fontWeight: 'bold' }}
                />
            );
         }}
    </Form.Item>
);


const BulkRestockModal = ({ open, onClose, bukuList }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [selectedBookIdsInForm, setSelectedBookIdsInForm] = useState(new Set());

    // Reset form (tidak berubah)
    useEffect(() => {
        if (open) {
            form.resetFields();
            form.setFieldsValue({ items: [{}] });
            setSelectedBookIdsInForm(new Set());
        }
    }, [open, form]);

    // Update selected IDs (tidak berubah)
    const handleFormValuesChange = useCallback((_, allValues) => {
        const currentIds = new Set(allValues.items?.map(item => item?.bookId).filter(Boolean) || []);
        setSelectedBookIdsInForm(currentIds);
    }, [form]);


    // Handler Submit Form
    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            const overallRemark = values.overallRemark || '';
            const items = values.items || [];
            const validItems = items.filter(item => item && item.bookId && item.quantity !== null && item.quantity !== undefined);

            if (validItems.length === 0) {
                message.warning('Tambahkan setidaknya satu buku dengan jumlah perubahan yang valid.');
                return;
            }
            const hasZeroQuantity = validItems.some(item => Number(item.quantity) === 0);
            if (hasZeroQuantity) {
                 message.error('Jumlah perubahan tidak boleh 0. Hapus baris atau isi jumlah valid.');
                 return;
            }

            const booksToUpdate = validItems
                .map(item => {
                     const book = bukuList.find(b => b.id === item.bookId);
                    if (book) {
                        return {
                            book,
                            quantity: Number(item.quantity),
                            specificRemark: item.specificRemark || ''
                        };
                    }
                    return null;
                })
                .filter(Boolean);

            if (booksToUpdate.length === 0) {
                message.info("Tidak ada perubahan stok yang valid untuk disimpan.");
                return;
            }

            setLoading(true);
            console.log("Books to update:", booksToUpdate); // DEBUG

            // Proses update
            const updatePromises = booksToUpdate.map(async ({ book, quantity, specificRemark }) => {
                const jumlahNum = quantity;
                const stokSebelum = Number(book.stok) || 0;
                const stokSesudah = stokSebelum + jumlahNum;

                let keteranganGabungan = overallRemark;
                 if (specificRemark) {
                    keteranganGabungan = overallRemark ? `${overallRemark} (${specificRemark})` : specificRemark;
                }
                 if (!keteranganGabungan) {
                      keteranganGabungan = jumlahNum > 0 ? 'Stok Masuk (Borongan)' : 'Stok Keluar (Borongan)';
                 }

                // --- PENAMBAHAN PROPERTI 'perubahan' ---
                const historyData = {
                    bukuId: book.id,
                    judul: book.judul,
                    kode_buku: book.kode_buku,
                    jumlah: jumlahNum, // Ini adalah jumlah *setelah* perubahan (deprecated?)
                    perubahan: jumlahNum, // <-- TAMBAHKAN INI (Jumlah perubahannya)
                    keterangan: keteranganGabungan,
                    stokSebelum: stokSebelum,
                    stokSesudah: stokSesudah,
                    timestamp: serverTimestamp(),
                };
                // --- AKHIR PENAMBAHAN ---
                console.log(`Updating ${book.id}: Qty ${jumlahNum}`, historyData); // DEBUG

                const bookHistoryRef = ref(db, `buku/${book.id}/historiStok`);
                const historyPromise = push(bookHistoryRef, historyData);

                const bukuStokRef = ref(db, `buku/${book.id}/stok`);
                const transactionPromise = runTransaction(bukuStokRef, (currentStok) => {
                    const currentNum = Number(currentStok) || 0;
                    return currentNum + jumlahNum;
                });

                await Promise.all([historyPromise, transactionPromise]);
             });

            await Promise.all(updatePromises);

            message.success(`Stok ${booksToUpdate.length} buku berhasil diperbarui.`);
            onClose();

        } catch (error) { /* ... error handling ... */
             console.error("Bulk Restock Error:", error);
            if (error.code && error.message) { message.error(`Gagal update stok: ${error.message} (Kode: ${error.code})`);}
            else if (error.errorFields) { message.error("Periksa kembali input form. Pastikan semua buku dan jumlah terisi.");}
            else { message.error("Terjadi kesalahan saat menyimpan data.");}
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Restock Buku Borongan"
            open={open}
            onCancel={onClose}
            footer={null} // Footer dirender manual
            destroyOnClose
            width={1000} // Kembali ke lebar tetap
        >
             <Spin spinning={loading} tip="Menyimpan perubahan stok...">
                  <Alert
                    message="Tambahkan buku satu per satu ke dalam daftar di bawah. Isi jumlah penambahan (+) atau pengurangan (-). Keterangan Umum akan ditambahkan ke setiap riwayat stok buku."
                    type="info" showIcon style={{ marginBottom: 16 }}
                  />
                 <Form
                    form={form} layout="vertical" autoComplete="off"
                    onValuesChange={handleFormValuesChange}
                    initialValues={{ items: [{}] }}
                 >
                    <Form.Item name="overallRemark" label="Keterangan Umum (Opsional)">
                        <Input.TextArea rows={2} placeholder="Contoh: Stok opname bulanan Q4 2025" />
                    </Form.Item>

                    <Typography.Title level={5} style={{ marginTop: 24, marginBottom: 8 }}>Item Buku</Typography.Title>

                    {/* --- Form.List Item Buku --- */}
                    <Form.List name="items">
                        {(fields, { add, remove }, { errors }) => (
                            <>
                                <div style={{ maxHeight: '50vh', overflowY: 'auto', marginBottom: '16px', border: '1px solid #d9d9d9', borderRadius: '2px', padding: '8px' }}>
                                    {fields.map(({ key, name, ...restField }, index) => (
                                        <Card key={key} size="small" style={{ marginBottom: 16, backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9f9f9' }}
                                            extra={fields.length > 0 ? (<Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />) : null}>
                                            <Row gutter={[16, 0]}>
                                                {/* Kolom Pilih Buku */}
                                                <Col xs={24} md={10} lg={8}>
                                                    <Form.Item {...restField} name={[name, 'bookId']} label={`Item #${index + 1}: Buku`} rules={[{ required: true, message: 'Pilih buku' }]} style={{ marginBottom: 8 }}>
                                                        <Select
                                                             showSearch placeholder="Cari & Pilih Buku..." optionFilterProp="children"
                                                            filterOption={(input, option) => (option?.children?.toString() ?? '').toLowerCase().includes(input.toLowerCase())}
                                                            filterSort={(optionA, optionB) => (optionA?.children?.toString() ?? '').toLowerCase().localeCompare((optionB?.children?.toString() ?? '').toLowerCase())}
                                                            disabled={!bukuList || bukuList.length === 0}
                                                            notFoundContent={!bukuList || bukuList.length === 0 ? <Spin size="small" /> : 'Buku tidak ditemukan'}
                                                        >
                                                            {bukuList?.map((buku) => (
                                                                <Option key={buku.id} value={buku.id} disabled={selectedBookIdsInForm.has(buku.id) && form.getFieldValue(['items', name, 'bookId']) !== buku.id}>
                                                                    {buku.judul} (Stok: {numberFormatter(buku.stok)})
                                                                </Option>
                                                            ))}
                                                        </Select>
                                                    </Form.Item>
                                                </Col>
                                                {/* Kolom Quantity */}
                                                <Col xs={12} md={4} lg={3}>
                                                     <Form.Item {...restField} name={[name, 'quantity']} label="Qty (+/-)"
                                                        rules={[{ required: true, message: 'Isi Qty' }, { type: 'number', message: 'Angka?'}]}
                                                        style={{ marginBottom: 8 }}>
                                                        <InputNumber placeholder="+/-" style={{ width: '100%' }} />
                                                    </Form.Item>
                                                </Col>
                                                 {/* Kolom Tampilan Perubahan */}
                                                <Col xs={12} md={4} lg={3}>
                                                    <Form.Item label="Perubahan" style={{ marginBottom: 8 }}>
                                                       <SubtotalDisplay index={index} />
                                                    </Form.Item>
                                                </Col>
                                                {/* Kolom Keterangan Spesifik */}
                                                <Col xs={24} md={6} lg={10}>
                                                    <Form.Item {...restField} name={[name, 'specificRemark']} label="Ket. Spesifik" style={{ marginBottom: 8 }}>
                                                        <Input placeholder="Opsional" />
                                                    </Form.Item>
                                                </Col>
                                            </Row>
                                        </Card>
                                    ))}
                                </div>
                                <Form.Item>
                                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} disabled={!bukuList || bukuList.length === 0}>
                                        Tambah Item Buku
                                    </Button>
                                    <Form.ErrorList errors={errors} />
                                </Form.Item>
                            </>
                        )}
                    </Form.List>

                    {/* --- Total Qty Keseluruhan --- */}
                    <Form.Item noStyle shouldUpdate={(prev, cur) => JSON.stringify(prev.items || []) !== JSON.stringify(cur.items || [])}>
                        {({ getFieldValue }) => {
                            const items = getFieldValue('items') || [];
                            let totalQtyChange = 0;
                            items.filter(it => it && it.bookId && it.quantity !== null && it.quantity !== undefined).forEach((it) => {
                                totalQtyChange += Number(it.quantity || 0);
                            });
                            return (
                                <>
                                    <Divider />
                                    <Row justify="end">
                                        <Col xs={12} sm={8} md={6}>
                                              <Statistic title="Total Perubahan Qty" value={totalQtyChange} formatter={numberFormatter} />
                                        </Col>
                                    </Row>
                                    <Divider />
                                </>
                            );
                         }}
                    </Form.Item>

                     {/* --- Tombol Aksi --- */}
                    <Row justify="end" style={{ marginTop: 24 }}>
                        <Col>
                            <Space>
                                <Button onClick={onClose} disabled={loading}> Batal </Button>
                                <Button type="primary" onClick={handleOk} loading={loading} size="large">
                                    Simpan Perubahan Stok
                                </Button>
                            </Space>
                        </Col>
                    </Row>
                 </Form>
             </Spin>
        </Modal>
    );
};

export default BulkRestockModal;