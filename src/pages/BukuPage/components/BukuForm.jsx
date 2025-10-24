// ================================
// FILE: src/pages/buku/components/BukuForm.jsx
// Versi dengan pencatatan histori stok otomatis saat edit
// ================================

import React, { useState, useEffect } from 'react';
import {
    Modal, Form, Input, InputNumber, Select, Row, Col, message, Button, Typography
} from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { db } from '../../../api/firebase'; // Pastikan path benar
// Impor fungsi Firebase yang dibutuhkan
import { ref, push, update, remove, serverTimestamp } from 'firebase/database';

const { Option } = Select;
const { Title } = Typography;

// --- Konstanta Opsi (sesuaikan jika perlu) ---
const TIPE_BUKU_OPTIONS = ['HET', 'BTP', 'BUKU UTAMA', 'Referensi', 'Fiksi', 'LKS'];
const KELAS_OPTIONS = ['PAUD', 'TK A', 'TK B', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 'UMUM'];
const JENJANG_OPTIONS = ['SD', 'SMP', 'SMA', 'SMK', 'UMUM'];
const PERUNTUKAN_OPTIONS = ['siswa', 'guru', 'UMUM'];
const SPEK_OPTIONS = ['Buku', 'LKS'];

// --- Helper Rupiah ---
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
                // Saat edit, isi semua field termasuk stok
                form.setFieldsValue(initialValues);
            } else {
                // Saat tambah baru, reset form (stok akan disable dan 0)
                form.resetFields();
                form.setFieldsValue({ stok: 0 }); // Set default stok 0
            }
        }
    }, [open, initialValues, form, isEditing]);

    const handleFinish = async (values) => {
        setIsSaving(true);
        message.loading({ content: 'Menyimpan...', key: 'saving' });

        // --- Tambahkan ini untuk Debugging (bisa dihapus nanti) ---
        console.log("Form Values on Submit:", values);
        // -----------------------------------------------------------

        try {
            if (isEditing) {
                // --- MODE EDIT ---
                const bukuId = initialValues.id;
                const bukuRef = ref(db, `buku/${bukuId}`);

                // Ambil nilai stok lama (pastikan number, default 0)
                const stokSebelum = Number(initialValues?.stok ?? 0);
                // Ambil nilai stok baru dari form (pastikan number, default 0)
                const stokSesudah = Number(values?.stok ?? 0);
                const perubahan = stokSesudah - stokSebelum;

                // --- Debugging Stok ---
                console.log(`Stok Sebelum: ${stokSebelum}, Stok Sesudah: ${stokSesudah}, Perubahan: ${perubahan}`);
                // -----------------------

                // Siapkan payload update dasar (semua field lain dari form)
                // Hapus 'stok' dari 'values' agar tidak konflik jika 'perubahan' = 0
                const { stok, ...otherValues } = values;
                const updatePayload = {
                    ...otherValues, // Masukkan field lain (judul, penerbit, dll)
                };

                // 1. SELALU update field 'stok' utama jika mode edit
                updatePayload.stok = stokSesudah;

                // 2. JIKA ADA PERUBAHAN, tambahkan entri histori
                if (perubahan !== 0) {
                    // Generate key unik di path histori spesifik buku ini
                    const historyPath = `buku/${bukuId}/historiStok`;
                    const newHistoryRef = push(ref(db, historyPath)); // Generate key di path yang benar
                    const historyKey = newHistoryRef.key;

                    if (!historyKey) {
                       throw new Error("Gagal membuat kunci unik untuk histori stok.");
                    }

                    const newHistoryEntry = {
                        keterangan: "Penyesuaian Stok Manual (Edit Form)", // Keterangan lebih jelas
                        perubahan: perubahan,
                        stokSebelum: stokSebelum,
                        stokSesudah: stokSesudah,
                        timestamp: serverTimestamp(), // Gunakan timestamp server
                        user: "Admin/Sistem" // Placeholder, ganti jika ada auth context
                    };

                    // Tambahkan histori baru ke payload menggunakan path lengkap relatif dari root
                    updatePayload[`historiStok/${historyKey}`] = newHistoryEntry;

                    // --- Debugging Histori ---
                    console.log("Menambahkan Histori:", newHistoryEntry);
                    message.info(`Mencatat perubahan stok ${perubahan > 0 ? '+' : ''}${perubahan}.`, 2);
                    // --------------------------
                } else {
                     console.log("Tidak ada perubahan stok, histori tidak ditambahkan.");
                }

                // --- Debugging Payload Final ---
                console.log("Final Update Payload:", updatePayload);
                // ------------------------------

                // Lakukan update ke Firebase
                await update(bukuRef, updatePayload);
                message.success({ content: 'Buku berhasil diperbarui', key: 'saving' });

            } else {
                // --- MODE TAMBAH BARU ---
                const newBukuData = {
                    ...values,
                    stok: 0, // Stok awal selalu 0 saat buat dari form ini
                    historiStok: {} // Histori kosong saat awal
                };
                const bukuListRef = ref(db, 'buku'); // Ref ke list buku
                await push(bukuListRef, newBukuData); // Gunakan push ke list
                message.success({ content: 'Buku baru berhasil ditambahkan', key: 'saving' });
            }
            onCancel(); // Tutup modal setelah sukses
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
            content: `Apakah Anda yakin ingin menghapus buku "${initialValues?.judul ?? 'ini'}"? Tindakan ini tidak dapat dibatalkan.`,
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
            width="100vw"
            style={{ top: 0, padding: 0, margin: 0, maxWidth: '100vw' }}
            bodyStyle={{ padding: '24px', height: 'calc(100vh - 55px - 53px)', overflowY: 'auto' }}
            footer={[
                contextHolder,
                isEditing && (
                    <Button key="delete" danger icon={<DeleteOutlined />} onClick={handleDelete} style={{ float: 'left' }} loading={isSaving}> Hapus </Button>
                ),
                <Button key="back" onClick={onCancel} disabled={isSaving}> Batal </Button>,
                <Button key="submit" type="primary" loading={isSaving} onClick={form.submit}> Simpan </Button>,
            ]}
        >
            <Form form={form} layout="vertical" onFinish={handleFinish}>

                <Row gutter={16}>
                    <Col xs={24} md={6}>
                        <Form.Item name="kode_buku" label="Kode Buku">
                            <Input placeholder="(Opsional)" />
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                        <Form.Item name="judul" label="Judul Buku" rules={[{ required: true, message: 'Judul tidak boleh kosong!' }]}>
                            <Input />
                        </Form.Item>
                    </Col>
                     <Col xs={24} md={6}>
                         <Form.Item
                             name="stok"
                             label="Stok Saat Ini"
                             rules={[{ type: 'number', message: 'Stok harus angka' }]}
                         >
                             {/* Disable saat tambah baru, enable saat edit */}
                             <InputNumber style={{ width: '100%' }} disabled={!isEditing} />
                         </Form.Item>
                     </Col>
                </Row>
                <Row gutter={16}>
                     <Col xs={24} md={8}><Form.Item name="penerbit" label="Penerbit"><Input /></Form.Item></Col>
                     <Col xs={24} md={8}><Form.Item name="tahun" label="Tahun Terbit"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                     <Col xs={24} md={8}><Form.Item name="spekKertas" label="Spesifikasi Kertas"><Input.TextArea rows={1} /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                    <Col xs={24} md={6}>
                        <Form.Item name="jenjang" label="Jenjang">
                            <Select placeholder="Pilih Jenjang" allowClear>
                                {JENJANG_OPTIONS.map(j => <Option key={j} value={j}>{j}</Option>)}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={6}>
                        <Form.Item name="kelas" label="Kelas">
                            <Select placeholder="Pilih kelas" allowClear>
                                {KELAS_OPTIONS.map(k => <Option key={k} value={k}>{typeof k === 'number' ? `Kelas ${k}` : k}</Option>)}
                            </Select>
                        </Form.Item>
                    </Col>
                     <Col xs={24} md={6}>
                        <Form.Item name="mapel" label="Mapel / Kategori">
                             <Input placeholder="cth: IPA, Fiksi" />
                        </Form.Item>
                    </Col>
                     <Col xs={24} md={6}>
                        <Form.Item name="tipeBuku" label="Tipe Buku">
                            <Select placeholder="Pilih tipe" allowClear>
                                {TIPE_BUKU_OPTIONS.map(tipe => <Option key={tipe} value={tipe}>{tipe}</Option>)}
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>
                 <Row gutter={16}>
                    <Col xs={12} md={6}>
                        <Form.Item name="spek" label="Spek (Buku/LKS)">
                             <Select placeholder="Pilih Spek" allowClear>
                                {SPEK_OPTIONS.map(s => <Option key={s} value={s}>{s}</Option>)}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                        <Form.Item name="peruntukan" label="Peruntukan">
                             <Select placeholder="Pilih Peruntukan" allowClear>
                                {PERUNTUKAN_OPTIONS.map(p => <Option key={p} value={p}>{p}</Option>)}
                            </Select>
                        </Form.Item>
                    </Col>
                 </Row>

                <Title level={5} style={{ marginTop: 16 }}>Harga Jual</Title>
                <Row gutter={16}>
                    <Col xs={12} md={6}><Form.Item name="hargaJual" label="Harga (Umum)"><InputNumber formatter={rupiahFormatter} parser={rupiahParser} style={{ width: '100%' }} /></Form.Item></Col>
                    <Col xs={12} md={6}><Form.Item name="diskonJual" label="Diskon (%)"><InputNumber suffix="%" style={{ width: '100%' }} min={0} max={100}/></Form.Item></Col>
                    <Col xs={12} md={6}><Form.Item name="hargaJualSpesial" label="Harga (Spesial)"><InputNumber formatter={rupiahFormatter} parser={rupiahParser} style={{ width: '100%' }} /></Form.Item></Col>
                    <Col xs={12} md={6}><Form.Item name="diskonJualSpesial" label="Diskon Spesial (%)"><InputNumber suffix="%" style={{ width: '100%' }} min={0} max={100} /></Form.Item></Col>
                </Row>

                <Title level={5} style={{ marginTop: 16 }}>Harga Cetak</Title>
                <Row gutter={16}>
                    <Col xs={12} md={6}><Form.Item name="hargaCetak" label="Harga (Umum)"><InputNumber formatter={rupiahFormatter} parser={rupiahParser} style={{ width: '100%' }} /></Form.Item></Col>
                    <Col xs={12} md={6}><Form.Item name="diskonCetak" label="Diskon (%)"><InputNumber suffix="%" style={{ width: '100%' }} min={0} max={100}/></Form.Item></Col>
                    <Col xs={12} md={6}><Form.Item name="hargaCetakSpesial" label="Harga (Spesial)"><InputNumber formatter={rupiahFormatter} parser={rupiahParser} style={{ width: '100%' }} /></Form.Item></Col>
                    <Col xs={12} md={6}><Form.Item name="diskonCetakSpesial" label="Diskon Spesial (%)"><InputNumber suffix="%" style={{ width: '100%' }} min={0} max={100} /></Form.Item></Col>
                </Row>
            </Form>
        </Modal>
    );
};

export default BukuForm;