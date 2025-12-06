// src/pages/pelanggan/components/PelangganForm.jsx
import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Button, message, Checkbox, Spin, Space } from 'antd';
import { db } from '../../../api/firebase';
import { ref, set, update, push } from 'firebase/database';

export default function PelangganForm({
    open,
    onCancel,
    onSuccess,
    initialData = null,
    pelangganList
}) {
    const [form] = Form.useForm();
    const [isSaving, setIsSaving] = useState(false);
    const isEditMode = !!initialData;

    useEffect(() => {
        if (isEditMode && initialData) {
            console.log("Prefilling PelangganForm with:", initialData);
            try {
                form.setFieldsValue({
                    nama: initialData.nama || '',
                    telepon: initialData.telepon || '',
                    isSpesial: initialData.isSpesial || false,
                });
            } catch (error) {
                console.error("Error prefilling form:", error);
                message.error("Gagal memuat data pelanggan.");
                onCancel();
            }
        } else {
            console.log("Resetting PelangganForm for create.");
            form.resetFields();
        }
    }, [initialData, form, isEditMode, open, onCancel]);

    const handleFinish = async (values) => {
        setIsSaving(true);
        message.loading({ content: 'Menyimpan data pelanggan...', key: 'save_pelanggan' });

        try {
            // SAFEGUARD: Pastikan tersimpan uppercase meskipun logic di form tembus
            const namaClean = values.nama.trim().toUpperCase();

            const dataToSave = {
                nama: namaClean,
                telepon: values.telepon?.trim() || '',
                isSpesial: values.isSpesial || false,
            };

            if (!dataToSave.nama) {
                throw new Error("Nama pelanggan tidak boleh kosong.");
            }

            // Cek duplikat
            const duplicateExists = pelangganList.some(p =>
                (p.nama.toLowerCase() === dataToSave.nama.toLowerCase() || (dataToSave.telepon && p.telepon === dataToSave.telepon)) &&
                (!isEditMode || p.id !== initialData.id)
            );
            if (duplicateExists) {
                throw new Error("Nama atau nomor telepon pelanggan sudah ada.");
            }

            if (isEditMode) {
                const pelangganRef = ref(db, `pelanggan/${initialData.id}`);
                await update(pelangganRef, dataToSave);
                message.success({ content: 'Data pelanggan berhasil diperbarui', key: 'save_pelanggan' });
            } else {
                const pelangganRef = ref(db, 'pelanggan');
                const newPelangganRef = push(pelangganRef);
                await set(newPelangganRef, dataToSave);
                message.success({ content: 'Pelanggan baru berhasil ditambahkan', key: 'save_pelanggan' });
            }
            form.resetFields();
            onSuccess();

        } catch (error) {
            console.error("Error saving pelanggan:", error);
            message.error({ content: `Gagal menyimpan: ${error.message}`, key: 'save_pelanggan', duration: 5 });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            title={isEditMode ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}
            open={open}
            onCancel={onCancel}
            footer={null}
            destroyOnClose
            maskClosable={false}
        >
            <Spin spinning={isSaving}>
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFinish}
                    initialValues={{ isSpesial: false }}
                >
                    <Form.Item
                        name="nama"
                        label="Nama Pelanggan"
                        // PERUBAHAN UTAMA DI SINI:
                        // normalize akan mengubah input menjadi Uppercase SEBELUM masuk ke state form
                        normalize={(value) => (value || '').toUpperCase()} 
                        rules={[
                            { required: true, message: 'Nama tidak boleh kosong!' }, 
                            { whitespace: true, message: 'Nama tidak boleh hanya spasi!' }
                        ]}
                    >
                        {/* Input biasa, logic uppercase ditangani oleh Form.Item normalize */}
                        <Input placeholder="MASUKKAN NAMA LENGKAP PELANGGAN" />
                    </Form.Item>

                    <Form.Item
                        name="telepon"
                        label="Nomor Telepon"
                        rules={[
                            { pattern: /^[0-9+-\s()]*$/, message: 'Hanya masukkan angka, spasi, +, -, (, )' }
                        ]}
                    >
                        <Input placeholder="Contoh: 08123456789" />
                    </Form.Item>

                    <Form.Item name="isSpesial" valuePropName="checked">
                        <Checkbox>Pelanggan Spesial (Harga & Diskon Khusus)</Checkbox>
                    </Form.Item>

                    <div style={{ textAlign: 'right', marginTop: 24 }}>
                        <Space>
                            <Button onClick={onCancel} disabled={isSaving}>
                                Batal
                            </Button>
                            <Button type="primary" htmlType="submit" loading={isSaving}>
                                {isEditMode ? 'Simpan Perubahan' : 'Tambah Pelanggan'}
                            </Button>
                        </Space>
                    </div>
                </Form>
            </Spin>
        </Modal>
    );
}