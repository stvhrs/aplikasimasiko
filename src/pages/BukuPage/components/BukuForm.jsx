// ================================
// FILE: src/pages/buku/components/BukuForm.jsx
// PERUBAHAN:
// 1. Modal dibuat FULLSCREEN (width="100vw", style, bodyStyle) agar responsive.
// 2. Semua <Col> di dalam <Row> diubah dari `span={X}` menjadi props responsive
//    (cth: `xs={24} md={X}`) agar form menumpuk (stacking) di mobile.
// 3. Kolom Harga & Diskon (4 kolom) dibuat `xs={12}` agar muat 2 per baris di mobile.
// 4. Menambahkan helper `rupiahFormatter` & `rupiahParser` untuk input harga.
// ================================

import React, { useState, useEffect } from 'react';
import {
    Modal, Form, Input, InputNumber, Select, Row, Col, message, Button, Typography
} from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { db } from '../../../api/firebase';
import { ref, push, update, remove } from 'firebase/database';

const { Option } = Select;
const { Title } = Typography;

const TIPE_BUKU_OPTIONS = ['HET', 'BTP', 'BUKU UTAMA', 'Referensi', 'Fiksi'];
const KELAS_OPTIONS = ['PAUD', 'TK A', 'TK B', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 'Umum'];

// --- Helper Rupiah (dicopy dari form lain) ---
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
// ------------------------------------------

const BukuForm = ({ open, onCancel, initialValues }) => {
    const [form] = Form.useForm();
    const [isSaving, setIsSaving] = useState(false);
    const [modal, contextHolder] = Modal.useModal();
    
    const isEditing = !!(initialValues && initialValues.id); 

    useEffect(() => {
        if (open) {
            if (isEditing) {
                form.setFieldsValue(initialValues);
            } else {
                form.resetFields();
            }
        }
    }, [open, initialValues, form, isEditing]);

    const handleFinish = async (values) => {
        setIsSaving(true);
        message.loading({ content: 'Menyimpan...', key: 'saving' });

        try {
            if (isEditing) {
                // --- MODE EDIT ---
                const bukuRef = ref(db, `buku/${initialValues.id}`);
                await update(bukuRef, values);
                message.success({ content: 'Buku berhasil diperbarui', key: 'saving' });
            } else {
                // --- MODE TAMBAH BARU ---
                const newBukuData = {
                    ...values,
                    stok: 0,
                    historiStok: {} 
                };
                const bukuRef = ref(db, 'buku');
                await push(bukuRef, newBukuData);
                message.success({ content: 'Buku baru berhasil ditambahkan', key: 'saving' });
            }
            onCancel();
        } catch (error) {
            console.error("Error saving book: ", error);
            message.error({ content: `Gagal menyimpan: ${error.message}`, key: 'saving' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = () => {
        modal.confirm({
            title: 'Konfirmasi Hapus',
            content: `Apakah Anda yakin ingin menghapus buku "${initialValues.judul}"? Tindakan ini tidak dapat dibatalkan.`,
            okText: 'Hapus',
            okType: 'danger',
            onOk: async () => {
                setIsSaving(true);
                message.loading({ content: 'Menghapus...', key: 'deleting' });
                try {
                    await remove(ref(db, `buku/${initialValues.id}`));
                    message.success({ content: 'Buku berhasil dihapus', key: 'deleting' });
                    onCancel();
                } catch (error) {
                    message.error({ content: `Gagal menghapus: ${error.message}`, key: 'deleting' });
                } finally {
                    setIsSaving(false);
                }
            }
        });
    };

    return (
        <Modal
            open={open}
            title={isEditing ? 'Edit Detail Buku' : 'Tambah Buku Baru'}
            onCancel={onCancel}
            onOk={form.submit}
            confirmLoading={isSaving}
            destroyOnClose
            
            // --- PERUBAHAN 1: Modal Fullscreen ---
            width="100vw"
            style={{ top: 0, padding: 0, margin: 0, maxWidth: '100vw' }}
            // Body dibuat scrollable
            bodyStyle={{ padding: '24px', height: 'calc(100vh - 55px - 53px)', overflowY: 'auto' }}

            footer={[
                contextHolder,
                isEditing && (
                    <Button
                        key="delete"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={handleDelete}
                        style={{ float: 'left' }}
                        loading={isSaving}
                    >
                        Hapus
                    </Button>
                ),
                <Button key="back" onClick={onCancel} disabled={isSaving}>
                    Batal
                </Button>,
                <Button key="submit" type="primary" loading={isSaving} onClick={form.submit}>
                    Simpan
                </Button>,
            ]}
        >
            <Form form={form} layout="vertical" onFinish={handleFinish}>
                
                {/* --- PERUBAHAN 2: Grid Responsive (xs={24} md={...}) --- */}
                <Row gutter={16}>
                    <Col xs={24} md={18}><Form.Item name="judul" label="Judul Buku" rules={[{ required: true }]}><Input /></Form.Item></Col>
                    <Col xs={24} md={6}><Form.Item name="tahun" label="Tahun Terbit"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                    <Col xs={24} md={12}><Form.Item name="penerbit" label="Penerbit"><Input /></Form.Item></Col>
                    <Col xs={24} md={12}><Form.Item name="spekKertas" label="Spesifikasi Kertas"><Input.TextArea rows={1} /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                    <Col xs={24} md={8}>
                        <Form.Item name="tipeBuku" label="Tipe Buku">
                            <Select placeholder="Pilih tipe">
                                {TIPE_BUKU_OPTIONS.map(tipe => <Option key={tipe} value={tipe}>{tipe}</Option>)}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                        <Form.Item name="mapel" label="Mapel / Kategori">
                            <Input placeholder="cth: IPA, Fiksi, Referensi" />
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                        <Form.Item name="kelas" label="Kelas">
                            <Select placeholder="Pilih kelas" allowClear>
                            {KELAS_OPTIONS.map(k => (
                                <Option key={k} value={k}>
                                    {typeof k === 'number' ? `Kelas ${k}` : k}
                                </Option>
                            ))}
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>

                <Title level={5} style={{ marginTop: 16 }}>Harga Jual</Title>
                
                {/* --- PERUBAHAN 3: Grid Responsive (xs={12} md={6}) --- */}
                <Row gutter={16}>
                    <Col xs={12} md={6}>
                        <Form.Item name="hargaJual" label="Harga (Umum)">
                            <InputNumber formatter={rupiahFormatter} parser={rupiahParser} style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                        <Form.Item name="diskonJual" label="Diskon (%)">
                            <InputNumber suffix="%" style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                        <Form.Item name="hargaJualSpesial" label="Harga (Spesial)">
                            <InputNumber formatter={rupiahFormatter} parser={rupiahParser} style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                        <Form.Item name="diskonJualSpesial" label="Diskon Spesial (%)">
                            <InputNumber suffix="%" style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                </Row>
                
                <Title level={5} style={{ marginTop: 16 }}>Harga Cetak</Title>
                <Row gutter={16}>
                    <Col xs={12} md={6}>
                        <Form.Item name="hargaCetak" label="Harga (Umum)">
                            <InputNumber formatter={rupiahFormatter} parser={rupiahParser} style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                        <Form.Item name="diskonCetak" label="Diskon (%)">
                            <InputNumber suffix="%" style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                        <Form.Item name="hargaCetakSpesial" label="Harga (Spesial)">
                            <InputNumber formatter={rupiahFormatter} parser={rupiahParser} style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                        <Form.Item name="diskonCetakSpesial" label="Diskon Spesial (%)">
                            <InputNumber suffix="%" style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                </Row>
            </Form>
        </Modal>
    );
};

export default BukuForm;