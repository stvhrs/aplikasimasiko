import React, { useState, useEffect } from 'react';
import {
    Modal, Form, Input, InputNumber, Select, Row, Col, message, Button, Typography // <-- PERUBAHAN 1: Tambahkan Typography
} from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { db } from '../../../api/firebase';
import { ref, push, update, remove } from 'firebase/database';

const { Option } = Select;
const { Title } = Typography; // <-- PERUBAHAN 2: Ambil Title dari Typography

const TIPE_BUKU_OPTIONS = ['HET', 'BTP', 'BUKU UTAMA', 'Referensi', 'Fiksi'];
// GANTI INI:

// MENJADI INI:
const KELAS_OPTIONS = ['PAUD', 'TK A', 'TK B', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 'Umum'];
const BukuForm = ({ open, onCancel, initialValues }) => {
    const [form] = Form.useForm();
    const [isSaving, setIsSaving] = useState(false);
    const [modal, contextHolder] = Modal.useModal();
    
    // <-- PERUBAHAN 3: Logika isEditing dibuat lebih aman
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
                // Inisialisasi stok awal dan histori
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
            width={800}
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
                <Row gutter={16}>
                    <Col span={18}><Form.Item name="judul" label="Judul Buku" rules={[{ required: true }]}><Input /></Form.Item></Col>
                    <Col span={6}><Form.Item name="tahun" label="Tahun Terbit"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                    <Col span={12}><Form.Item name="penerbit" label="Penerbit"><Input /></Form.Item></Col>
                    <Col span={12}><Form.Item name="spekKertas" label="Spesifikasi Kertas"><Input.TextArea rows={1} /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item name="tipeBuku" label="Tipe Buku">
                            <Select placeholder="Pilih tipe">
                                {TIPE_BUKU_OPTIONS.map(tipe => <Option key={tipe} value={tipe}>{tipe}</Option>)}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="mapel" label="Mapel / Kategori">
                            <Input placeholder="cth: IPA, Fiksi, Referensi" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
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
                <Row gutter={16}>
                    <Col span={6}><Form.Item name="hargaJual" label="Harga Jual (Umum)"><InputNumber prefix="Rp " style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={6}><Form.Item name="diskonJual" label="Diskon (%)"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={6}><Form.Item name="hargaJualSpesial" label="Harga Jual (Spesial)"><InputNumber prefix="Rp " style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={6}><Form.Item name="diskonJualSpesial" label="Diskon Spesial (%)"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                </Row>
                
                <Title level={5} style={{ marginTop: 16 }}>Harga Cetak</Title>
                <Row gutter={16}>
                    <Col span={6}><Form.Item name="hargaCetak" label="Harga Cetak (Umum)"><InputNumber prefix="Rp " style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={6}><Form.Item name="diskonCetak" label="Diskon (%)"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={6}><Form.Item name="hargaCetakSpesial" label="Harga Cetak (Spesial)"><InputNumber prefix="Rp " style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={6}><Form.Item name="diskonCetakSpesial" label="Diskon Spesial (%)"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                </Row>
            </Form>
        </Modal>
    );
};

export default BukuForm;