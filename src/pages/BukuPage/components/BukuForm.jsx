import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, Row, Col, Grid, message, Typography } from 'antd';
import { ref, push, set, serverTimestamp } from 'firebase/database';
import { db, storage } from '../../../api/firebase';

const { Option } = Select;

const BukuForm = ({ open, onCancel, initialValues }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const isEditing = !!initialValues;
    const screens = Grid.useBreakpoint();

    useEffect(() => {
        if (isEditing) {
            form.setFieldsValue(initialValues);
        } else {
            form.resetFields();
            form.setFieldsValue({ stok: 0 });
        }
    }, [initialValues, isEditing, form, open]);

    const handleSubmit = async (values) => {
        setLoading(true);
        try {
            const data = {
                ...values,
                hargaJual: Number(values.hargaJual) || 0,
                // NEW: Tambahkan harga zona
                harga_zona_2: Number(values.harga_zona_2) || 0,
                harga_zona_3: Number(values.harga_zona_3) || 0,
                harga_zona_4: Number(values.harga_zona_4) || 0,
                harga_zona_5a: Number(values.harga_zona_5a) || 0,
                harga_zona_5b: Number(values.harga_zona_5b) || 0,
                // ---
                diskonJual: Number(values.diskonJual) || 0,
                diskonJualSpesial: Number(values.diskonJualSpesial) || 0,
                stok: Number(values.stok) || 0,
                updatedAt: serverTimestamp(),
            };

            if (isEditing) {
                const bukuRef = ref(db, `buku/${initialValues.id}`);
                await set(bukuRef, {
                    ...initialValues,
                    ...data
                });
                message.success("Buku berhasil diperbarui.");
            } else {
                const bukuRef = ref(db, 'buku');
                data.createdAt = serverTimestamp();
                await push(bukuRef, data);
                message.success("Buku baru berhasil ditambahkan.");
            }
            onCancel();
        } catch (error) {
            console.error("Form submit error:", error);
            message.error("Gagal menyimpan data: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Helper JSX untuk input harga
    const priceInput = (
         <InputNumber 
            style={{ width: '100%' }} 
            min={0} 
            formatter={value => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 
            parser={value => value.replace(/Rp\s?|(,*)/g, '')} 
         />
    );

    return (
        <Modal
            title={isEditing ? "Edit Buku" : "Tambah Buku Baru"}
            open={open}
            onCancel={onCancel}
            onOk={() => form.submit()}
            confirmLoading={loading}
            width={screens.md ? 1000 : '95vw'} // Dibuat lebih lebar
            destroyOnClose
        >
            <Form form={form} layout="vertical" onFinish={handleSubmit}>
                <Row gutter={16}>
                    <Col sm={12} xs={24}>
                        <Form.Item name="kode_buku" label="Kode Buku">
                            <Input placeholder="Contoh: 11-22-333-4" />
                        </Form.Item>
                    </Col>
                    <Col sm={12} xs={24}>
                        <Form.Item name="judul" label="Judul Buku" rules={[{ required: true, message: 'Judul harus diisi' }]}>
                            <Input placeholder="Judul lengkap buku" />
                        </Form.Item>
                    </Col>
                    <Col sm={12} xs={24}>
                        <Form.Item name="penerbit" label="Penerbit">
                            <Input placeholder="Nama penerbit" />
                        </Form.Item>
                    </Col>
                     <Col sm={12} xs={24}>
                        <Form.Item name="stok" label="Stok Awal" rules={[{ required: true, message: 'Stok harus diisi' }]}>
                            <InputNumber style={{ width: '100%' }} placeholder="Stok awal" readOnly={isEditing} />
                        </Form.Item>
                        {isEditing && <small>Stok hanya bisa diubah melalui menu 'Update Stok'.</small>}
                    </Col>
                </Row>
                
                {/* --- NEW: Bagian Harga Zona --- */}
                <Typography.Text strong style={{display: 'block', marginBottom: 8, marginTop: 16}}>Data Harga</Typography.Text>
                <Row gutter={16}>
                     <Col sm={8} xs={24}>
                        <Form.Item name="hargaJual" label="Harga Jual (Zona 1)">
                           {priceInput}
                        </Form.Item>
                    </Col>
                    <Col sm={8} xs={24}>
                        <Form.Item name="harga_zona_2" label="Harga Zona 2">
                           {priceInput}
                        </Form.Item>
                    </Col>
                    <Col sm={8} xs={24}>
                        <Form.Item name="harga_zona_3" label="Harga Zona 3">
                           {priceInput}
                        </Form.Item>
                    </Col>
                    <Col sm={8} xs={24}>
                        <Form.Item name="harga_zona_4" label="Harga Zona 4">
                           {priceInput}
                        </Form.Item>
                    </Col>
                    <Col sm={8} xs={24}>
                        <Form.Item name="harga_zona_5a" label="Harga Zona 5a">
                           {priceInput}
                        </Form.Item>
                    </Col>
                     <Col sm={8} xs={24}>
                        <Form.Item name="harga_zona_5b" label="Harga Zona 5b">
                           {priceInput}
                        </Form.Item>
                    </Col>
                </Row>

                {/* --- Bagian Diskon --- */}
                 <Typography.Text strong style={{display: 'block', marginBottom: 8, marginTop: 16}}>Data Diskon</Typography.Text>
                <Row gutter={16}>
                    <Col sm={8} xs={12}>
                        <Form.Item name="diskonJual" label="Diskon Jual (%)">
                            <InputNumber style={{ width: '100%' }} min={0} max={100} formatter={value => `${value}%`} parser={value => value.replace('%', '')} />
                        </Form.Item>
                    </Col>
                    <Col sm={8} xs={12}>
                        <Form.Item name="diskonJualSpesial" label="Diskon Spesial (%)">
                            <InputNumber style={{ width: '100%' }} min={0} max={100} formatter={value => `${value}%`} parser={value => value.replace('%', '')} />
                        </Form.Item>
                    </Col>
                </Row>

                {/* --- Bagian Kategori --- */}
                <Typography.Text strong style={{display: 'block', marginBottom: 8, marginTop: 16}}>Data Kategori</Typography.Text>
                <Row gutter={16}>
                    <Col sm={8} xs={12}>
                        <Form.Item name="mapel" label="Mata Pelajaran">
                            <Input placeholder="Contoh: Matematika" />
                        </Form.Item>
                    </Col>
                    <Col sm={8} xs={12}>
                        <Form.Item name="kelas" label="Kelas">
                            <Input placeholder="Contoh: 10 atau X" />
                        </Form.Item>
                    </Col>
                    <Col sm={8} xs={12}>
                        <Form.Item name="spek" label="Spek">
                            <Select placeholder="Pilih Spek" allowClear>
                                <Option value="K21">K21</Option>
                                <Option value="K22">K22</Option>
                                <Option value="K23">K23</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col sm={8} xs={12}>
                        <Form.Item name="peruntukan" label="Peruntukan">
                             <Select placeholder="Pilih Peruntukan" allowClear>
                                <Option value="Guru">Guru</Option>
                                <Option value="Siswa">Siswa</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    
                    <Col sm={8} xs={12}>
                        <Form.Item name="spek_kertas" label="Spek Kertas">
                            <Input placeholder="Contoh: HVS 70gr" />
                        </Form.Item>
                    </Col>
                    <Col sm={8} xs={12}>
                        <Form.Item name="tipe_buku" label="Tipe Buku">
                            <Input placeholder="Contoh: Teks, LKS, Pegangan" />
                        </Form.Item>
                    </Col>
                </Row>
            </Form>
        </Modal>
    );
};

export default BukuForm;