// src/pages/pelanggan/components/PelangganForm.jsx
import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Button, message, Checkbox, Spin,Space } from 'antd';
import { db } from '../../../api/firebase'; // Sesuaikan path
import { ref, set, update, push } from 'firebase/database';

export default function PelangganForm({
    open,
    onCancel,
    onSuccess,
    initialData = null, // null for create, object for edit
    pelangganList // Untuk cek duplikat (opsional tapi bagus)
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
                    // Tambahkan field lain jika ada (alamat, email, dll)
                });
            } catch (error) {
                console.error("Error prefilling form:", error);
                message.error("Gagal memuat data pelanggan.");
                onCancel(); // Tutup jika gagal prefill
            }
        } else {
             console.log("Resetting PelangganForm for create.");
            form.resetFields(); // Pastikan bersih saat mode create
        }
        // Hanya reset/prefill saat initialData berubah ATAU saat open berubah dari false ke true
    }, [initialData, form, isEditMode, open, onCancel]);

    const handleFinish = async (values) => {
        setIsSaving(true);
        message.loading({ content: 'Menyimpan data pelanggan...', key: 'save_pelanggan' });

        try {
            const dataToSave = {
                nama: values.nama.trim(),
                telepon: values.telepon?.trim() || '', // Handle jika kosong
                isSpesial: values.isSpesial || false,
                // Tambahkan field lain jika ada
            };

            // Validasi nama tidak boleh kosong
            if (!dataToSave.nama) {
                throw new Error("Nama pelanggan tidak boleh kosong.");
            }

            // (Opsional) Cek duplikat nama/telepon (kecuali edit data yg sama)
            const duplicateExists = pelangganList.some(p =>
                (p.nama.toLowerCase() === dataToSave.nama.toLowerCase() || (dataToSave.telepon && p.telepon === dataToSave.telepon)) &&
                (!isEditMode || p.id !== initialData.id) // Abaikan jika ID sama saat edit
            );
            if (duplicateExists) {
                throw new Error("Nama atau nomor telepon pelanggan sudah ada.");
            }


            if (isEditMode) {
                // Update data
                const pelangganRef = ref(db, `pelanggan/${initialData.id}`);
                await update(pelangganRef, dataToSave);
                message.success({ content: 'Data pelanggan berhasil diperbarui', key: 'save_pelanggan' });
            } else {
                // Create data baru
                const pelangganRef = ref(db, 'pelanggan');
                const newPelangganRef = push(pelangganRef); // Generate unique ID
                await set(newPelangganRef, dataToSave);
                message.success({ content: 'Pelanggan baru berhasil ditambahkan', key: 'save_pelanggan' });
            }
            form.resetFields();
            onSuccess(); // Panggil callback sukses (menutup modal)

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
            footer={null} // Custom footer di dalam Form
            destroyOnClose
            maskClosable={false}
        >
            <Spin spinning={isSaving}>
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFinish}
                    initialValues={{ isSpesial: false }} // Default value untuk checkbox
                >
                    <Form.Item
                        name="nama"
                        label="Nama Pelanggan"
                        rules={[{ required: true, message: 'Nama tidak boleh kosong!' }, { whitespace: true, message: 'Nama tidak boleh hanya spasi!' }]}
                    >
                        <Input placeholder="Masukkan nama lengkap pelanggan" />
                    </Form.Item>

                    <Form.Item
                        name="telepon"
                        label="Nomor Telepon"
                        rules={[
                             // Opsional, tapi jika diisi, harus angka
                            { pattern: /^[0-9+-\s()]*$/, message: 'Hanya masukkan angka, spasi, +, -, (, )' }
                        ]}
                    >
                        <Input placeholder="Contoh: 08123456789" />
                    </Form.Item>

                    {/* Tambahkan field lain di sini jika perlu (Alamat, Email, dll) */}
                    {/* <Form.Item name="alamat" label="Alamat">
                        <Input.TextArea placeholder="Alamat lengkap" />
                    </Form.Item> */}

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