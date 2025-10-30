// ================================
// FILE: src/pages/buku/components/BukuForm.jsx
// - MODIFIKASI: Tambah unggah cover buku ke Firebase Storage
// - MODIFIKASI: Tampilkan cover saat edit
// - MODIFIKASI: Cache gambar 1 bulan
// ================================

import React, { useState, useEffect } from 'react';
import {
    Modal,
    Form,
    Input,
    InputNumber,
    Select,
    Row,
    Col,
    Grid,
    message,
    Typography,
    Button,
    Space,
    Popconfirm,
    Checkbox,
    Upload, // <--- TAMBAHAN
    Image   // <--- TAMBAHAN
} from 'antd';
import { PlusOutlined } from '@ant-design/icons'; // <--- TAMBAHAN
// (FIX) Tambahkan 'update', 'push', 'serverTimestamp', dan 'remove'
import { ref, update, push, serverTimestamp, remove, set } from 'firebase/database';
// (FIX) Memperbaiki path import dan menambah 'app'
import { db, app } from '../../../api/firebase'; // <-- Asumsi 'app' diekspor dari sini
// <--- TAMBAHAN: Impor Firebase Storage --->
import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from 'firebase/storage';

const { Option } = Select;
const { Text } = Typography;

// <--- TAMBAHAN: Inisialisasi Firebase Storage --->
const storage = getStorage(app);

const BukuForm = ({ open, onCancel, initialValues }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const isEditing = !!initialValues;
    const screens = Grid.useBreakpoint();

    const isHetValue = Form.useWatch('isHet', form);

    // <--- TAMBAHAN: State untuk file upload --->
    const [fileToUpload, setFileToUpload] = useState(null);
    const [existingImageUrl, setExistingImageUrl] = useState(null);

    useEffect(() => {
        if (open) {
            if (isEditing) {
                // Ini sudah benar, akan mengisi form jika initialValues ada
                form.setFieldsValue(initialValues);
                // <--- TAMBAHAN: Set gambar & bersihkan file tertunda --->
                setExistingImageUrl(initialValues.coverBukuUrl || null);
                setFileToUpload(null);
            } else {
                // Ini untuk 'Tambah Buku', mereset form
                form.resetFields();
                form.setFieldsValue({
                    stok: 0,
                    hargaJual: 0,
                    diskonJual: 0,
                    diskonJualSpesial: 0,
                    isHet: false,
                    harga_zona_2: 0,
                    harga_zona_3: 0,
                    harga_zona_4: 0,
                    harga_zona_5a: 0,
                    harga_zona_5b: 0,
                });
                // <--- TAMBAHAN: Bersihkan state gambar --->
                setExistingImageUrl(null);
                setFileToUpload(null);
            }
        }
    }, [initialValues, isEditing, form, open]); // Dependensi ini sudah benar

    // <--- TAMBAHAN: Helper untuk unggah gambar --- >
    /**
     * Mengunggah file ke Firebase Storage dengan cache 1 bulan.
     * @param {File} file - File yang akan diunggah.
     * @param {string} bookId - ID unik buku (untuk path folder).
     * @returns {Promise<{downloadURL: string, fullPath: string}>}
     */
    const handleImageUpload = async (file, bookId) => {
        if (!file) return null;
        
        // Buat path yang unik: bukuCovers/BOOK-ID/namafile.jpg
        const fileRef = storageRef(storage, `bukuCovers/${bookId}/${file.name}`);
        
        // Metadata untuk cache 30 hari (2592000 detik)
        const metadata = {
            cacheControl: 'public, max-age=2592000',
        };

        const uploadResult = await uploadBytes(fileRef, file, metadata);
        const downloadURL = await getDownloadURL(uploadResult.ref);
        
        return { downloadURL, fullPath: uploadResult.ref.fullPath };
    };

    // --- (PERBAIKAN BESAR) ---
    // 'handleSubmit' sekarang menangani 'Edit' dan 'Create'
    const handleSubmit = async (values) => {
        setLoading(true);
        const imgLoadingKey = 'upload_cover'; // Kunci pesan loading gambar

        if (isEditing) {
            // --- LOGIKA UNTUK EDIT/UPDATE ---
            message.loading({ content: 'Memperbarui buku...', key: 'update' });
            try {
                const bookId = initialValues.id;
                const oldImagePath = initialValues.coverBukuPath || null;
                let newImageData = {
                    coverBukuUrl: initialValues.coverBukuUrl || null,
                    coverBukuPath: oldImagePath,
                };

                // 1. Cek jika ada file baru untuk diunggah
                if (fileToUpload) {
                    message.loading({ content: 'Mengunggah cover buku...', key: imgLoadingKey, duration: 0 });
                    const uploadResult = await handleImageUpload(fileToUpload, bookId);
                    newImageData = {
                        coverBukuUrl: uploadResult.downloadURL,
                        coverBukuPath: uploadResult.fullPath,
                    };
                    message.destroy(imgLoadingKey);
                }
                
                const bookRef = ref(db, `buku/${bookId}`);
                
                const updateData = {
                    ...values, // Ambil semua data terbaru dari form
                    ...newImageData, // Timpa dengan data gambar baru (jika ada)
                    updatedAt: serverTimestamp(),
                    stok: initialValues.stok, // Jaga stok (tidak diedit di form ini)
                    createdAt: initialValues.createdAt || serverTimestamp(), // Jaga create time
                };

                // 2. Update database RTDB
                await update(bookRef, updateData);
                
                // 3. Hapus gambar lama (jika ada) SETELAH update DB berhasil
                if (fileToUpload && oldImagePath) {
                    try {
                        await deleteObject(storageRef(storage, oldImagePath));
                    } catch (deleteError) {
                        console.warn("Gagal hapus gambar lama (mungkin sudah terhapus):", deleteError);
                    }
                }

                message.success({ content: `Buku "${values.judul}" berhasil diperbarui.`, key: 'update' });
                handleCloseModal(); // Tutup modal setelah sukses

            } catch (error) {
                console.error("Gagal memperbarui buku:", error);
                message.error({ content: "Gagal memperbarui buku: " + error.message, key: 'update' });
                message.destroy(imgLoadingKey);
            }

        } else {
            // --- LOGIKA UNTUK CREATE/TAMBAH BUKU (DIPERBAIKI) ---
            message.loading({ content: 'Menyimpan buku baru...', key: 'create' });
            try {
                // 1. Buat ID unik (push key) untuk BUKU BARU
                const newBookRef = push(ref(db, 'buku'));
                const newBookId = newBookRef.key;
                
                // 2. Buat ID unik (push key) untuk HISTORI STOK
                const newHistoryKey = push(ref(db, 'historiStok')).key;
                
                // 3. Unggah gambar (jika ada)
                let newImageData = { coverBukuUrl: null, coverBukuPath: null };
                if (fileToUpload) {
                    message.loading({ content: 'Mengunggah cover buku...', key: imgLoadingKey, duration: 0 });
                    const uploadResult = await handleImageUpload(fileToUpload, newBookId);
                    newImageData = {
                        coverBukuUrl: uploadResult.downloadURL,
                        coverBukuPath: uploadResult.fullPath,
                    };
                    message.destroy(imgLoadingKey);
                }

                const initialStok = Number(values.stok) || 0;
                const now = serverTimestamp();
                const updates = {};

                // 4. Data Buku Utama (menggunakan newBookId)
                updates[`buku/${newBookId}`] = {
                    ...values,
                    ...newImageData, // <--- Masukkan data gambar
                    id: newBookId, // Simpan ID unik di dalam data buku
                    stok: initialStok,
                    createdAt: now,
                    updatedAt: now,
                    historiStok: null
                };

                // 5. Data Histori Stok Awal (menggunakan newHistoryKey)
                updates[`historiStok/${newHistoryKey}`] = {
                    bukuId: newBookId, // Referensi ke ID unik buku
                    kode_buku: values.kode_buku || 'N/A', // Simpan kode buku
                    judul: values.judul || 'N/A',
                    penerbit: values.penerbit || 'N/A', // Tambahkan penerbit
                    perubahan: initialStok,
                    stokSebelum: 0,
                    stokSesudah: initialStok,
                    keterangan: "Stok Awal (Input Manual)",
                    timestamp: now,
                };

                // 6. Lakukan multi-path update
                await update(ref(db), updates);

                message.success({ content: `Buku "${values.judul}" berhasil dibuat.`, key: 'create' });
                handleCloseModal(); // Tutup modal setelah sukses

            } catch (error) {
                console.error("Gagal menyimpan buku baru:", error);
                message.error({ content: "Gagal menyimpan buku: " + error.message, key: 'create' });
                message.destroy(imgLoadingKey);
            }
        }
        setLoading(false);
    };
    // --- (AKHIR PERBAIKAN) ---

    const handleDelete = async () => {
        if (!initialValues?.id) return;
        setDeleting(true);
        
        const imagePathToDelete = initialValues.coverBukuPath || null; // <--- TAMBAHAN
        
        try {
            // 1. Hapus data dari RTDB
            await remove(ref(db, `buku/${initialValues.id}`));
            
            // 2. Hapus gambar dari Storage (jika ada)
            if (imagePathToDelete) {
                try {
                    await deleteObject(storageRef(storage, imagePathToDelete));
                } catch (deleteError) {
                    console.warn("Gagal hapus gambar (mungkin sudah terhapus):", deleteError);
                }
            }
            
            message.success(`Buku "${initialValues.judul}" berhasil dihapus.`);
            handleCloseModal(); // Gunakan handleCloseModal
        } catch (error) {
            console.error("Delete error:", error);
            message.error("Gagal menghapus buku: " + error.message);
        } finally {
            setDeleting(false);
        }
    };
    
    // <--- TAMBAHAN: Fungsi bersih-bersih saat modal ditutup ---
    const handleCloseModal = () => {
        form.resetFields();
        setFileToUpload(null);
        setExistingImageUrl(null);
        setLoading(false); // Pastikan loading state reset
        setDeleting(false); // Pastikan deleting state reset
        onCancel(); // Panggil prop onCancel asli
    };

    const priceInput = (
        <InputNumber
            style={{ width: '100%' }}
            min={0}
            formatter={value => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={value => value.replace(/Rp\s?|(,*)/g, '')}
        />
    );

    const tipeBukuOptions = [
        "BTU",
        "BTP",
        "Non Teks",
        "Buku Guru ",
        "Umum",
        "LKS",
        "Jurnal",
    ];

    return (
        <Modal
            title={isEditing ? "Edit Buku" : "Tambah Buku Baru"}
            open={open}
            onCancel={handleCloseModal} // <--- MODIFIKASI: Gunakan handler kustom
            width={screens.md ? 1000 : '95vw'}
            destroyOnClose
            footer={null}
        >
            <Form form={form} layout="vertical" onFinish={handleSubmit}>
                <Row gutter={16}>
                    <Col sm={12} xs={24}>
                        <Form.Item name="kode_buku" label="Kode Buku" rules={[{ required: true, message: 'Kode Buku harus diisi' }]}>
                            {/* (UBAH) Nonaktifkan edit kode buku jika sedang mengedit */}
                            <Input placeholder="Contoh: 11-22-333-4" readOnly={isEditing} />
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
                            {/* Input stok HANYA bisa diisi saat 'Tambah Baru' */}
                            <InputNumber style={{ width: '100%' }} placeholder="Stok awal" readOnly={isEditing} min={0} />
                        </Form.Item>
                        {isEditing && (
                            <Text type="secondary" style={{ fontSize: 12, marginTop: -12, display: 'block' }}>
                                Stok hanya bisa diubah melalui menu 'Update Stok'.
                            </Text>
                        )}
                    </Col>
                </Row>

                <Text strong style={{ display: 'block', marginBottom: 8, marginTop: 16 }}>Data Harga</Text>

                <Form.Item name="isHet" valuePropName="checked">
                    <Checkbox>Buku ini memiliki HET (Harga Eceran Tertinggi)</Checkbox>
                </Form.Item>

                <Row gutter={16}>
                    {/* Zona 1 (selalu tampil) */}
                    <Col sm={8} xs={24}>
                        <Form.Item name="hargaJual" label="Harga Jual (Zona 1)">{priceInput}</Form.Item>
                    </Col>

                    {/* Zona 2-5b (tampil kondisional) */}
                    {isHetValue && (
                        <>
                            <Col sm={8} xs={24}><Form.Item name="harga_zona_2" label="Harga Zona 2">{priceInput}</Form.Item></Col>
                            <Col sm={8} xs={24}><Form.Item name="harga_zona_3" label="Harga Zona 3">{priceInput}</Form.Item></Col>
                            <Col sm={8} xs={24}><Form.Item name="harga_zona_4" label="Harga Zona 4">{priceInput}</Form.Item></Col>
                            <Col sm={8} xs={24}><Form.Item name="harga_zona_5a" label="Harga Zona 5a">{priceInput}</Form.Item></Col>
                            <Col sm={8} xs={24}><Form.Item name="harga_zona_5b" label="Harga Zona 5b">{priceInput}</Form.Item></Col>
                        </>
                    )}
                </Row>

                <Text strong style={{ display: 'block', marginBottom: 8, marginTop: 16 }}>Data Diskon</Text>
                <Row gutter={16}>
                    <Col sm={8} xs={12}>
                        <Form.Item name="diskonJual" label="Diskon Jual (%)">
                            <InputNumber style={{ width: '100%' }} min={0} max={100} formatter={v => `${v}%`} parser={v => v.replace('%', '')} />
                        </Form.Item>
                    </Col>
                    <Col sm={8} xs={12}>
                        <Form.Item name="diskonJualSpesial" label="Diskon Spesial (%)">
                            <InputNumber style={{ width: '100%' }} min={0} max={100} formatter={v => `${v}%`} parser={v => v.replace('%', '')} />
                        </Form.Item>
                    </Col>
                </Row>
                
                {/* <--- TAMBAHAN: Bagian Upload Cover Buku --- */}
                <Text strong style={{ display: 'block', marginBottom: 8, marginTop: 16 }}>Cover Buku (Opsional)</Text>
                {isEditing && existingImageUrl && (
                    <Form.Item label="Cover Saat Ini">
                        <Image width={100} src={existingImageUrl} alt="Cover Buku" />
                    </Form.Item>
                )}
                <Form.Item label={isEditing && existingImageUrl ? "Ganti Cover" : "Upload Cover"}>
                    <Upload
                        listType="picture"
                        maxCount={1}
                        fileList={fileToUpload ? [fileToUpload] : []} // <-- Kontrol daftar file
                        beforeUpload={(file) => {
                            // Cek tipe file (opsional tapi disarankan)
                            const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp';
                            if (!isJpgOrPng) {
                                message.error('Anda hanya bisa mengunggah file JPG/PNG/WEBP!');
                                return Upload.LIST_IGNORE;
                            }
                            setFileToUpload(file); // <-- Simpan file ke state
                            return false; // <-- Hentikan upload otomatis
                        }}
                        onRemove={() => {
                            setFileToUpload(null); // <-- Hapus file dari state
                        }}
                    >
                        <Button icon={<PlusOutlined />} disabled={loading || deleting}>Pilih File</Button>
                    </Upload>
                </Form.Item>
                {/* --- Akhir Bagian Upload --- */}

                <Text strong style={{ display: 'block', marginBottom: 8, marginTop: 16 }}>Data Kategori</Text>
                <Row gutter={16}>
                    <Col sm={8} xs={12}><Form.Item name="mapel" label="Mata Pelajaran"><Input placeholder="Contoh: Matematika" /></Form.Item></Col>
                    <Col sm={8} xs={12}><Form.Item name="kelas" label="Kelas"><Input placeholder="Contoh: 10 atau X" /></Form.Item></Col>
                    <Col sm={8} xs={12}>
                        <Form.Item name="tahunTerbit" label="Tahun Terbit">
                            <Input placeholder="Contoh: 2024" />
                        </Form.Item>
                    </Col>

                    <Col sm={8} xs={12}>
                        <Form.Item name="peruntukan" label="Peruntukan">
                            <Select allowClear>
                                <Option value="Guru">Guru</Option>
                                <Option value="Siswa">Siswa</Option>
                                <Option value="Buku Pegangan">Buku Pegangan</Option>
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col sm={8} xs={12}><Form.Item name="spek_kertas" label="Spek Kertas"><Input placeholder="Contoh: HVS 70gr" /></Form.Item></Col>
                    <Col sm={8} xs={12}><Form.Item name="tipe_buku" label="Tipe Buku">
                        <Select allowClear>
                            {tipeBukuOptions.map(tipe => (
                                <Option key={tipe} value={tipe}>{tipe}</Option>
                            ))}
                        </Select>
                    </Form.Item></Col>
                </Row>

                {/* FOOTER BUTTONS */}
                <Row justify="space-between" style={{ marginTop: 24 }}>
                    <Col>
                        {isEditing && (
                            <Popconfirm
                                title="Yakin ingin menghapus buku ini?"
                                description={`Buku "${initialValues?.judul || 'ini'}" akan dihapus permanen.`}
                                onConfirm={handleDelete}
                                okText="Ya, Hapus"
                                cancelText="Batal"
                                okButtonProps={{ loading: deleting }}
                                disabled={deleting}
                            >
                                <Button danger>
                                    Hapus Buku
                                </Button>
                            </Popconfirm>
                        )}
                    </Col>

                    <Col>
                        <Space>
                            <Button onClick={handleCloseModal} disabled={loading || deleting}>Batal</Button>
                            <Button type="primary" loading={loading} onClick={() => form.submit()} disabled={loading || deleting}>
                                {isEditing ? 'Perbarui' : 'Simpan'}
                            </Button>
                        </Space>
                    </Col>
                </Row>
            </Form>
        </Modal>
    );
};

export default BukuForm;
