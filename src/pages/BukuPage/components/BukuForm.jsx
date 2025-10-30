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
    Checkbox
} from 'antd';
// (FIX) Tambahkan 'update', 'push', 'serverTimestamp', dan 'remove'
import { ref, update, push, serverTimestamp, remove, set } from 'firebase/database'; 
// (FIX) Memperbaiki path import dari ../../../ menjadi ../../
import { db } from '../../../api/firebase';

const { Option } = Select;
const { Text } = Typography;

const BukuForm = ({ open, onCancel, initialValues }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const isEditing = !!initialValues;
    const screens = Grid.useBreakpoint();

    const isHetValue = Form.useWatch('isHet', form);

    useEffect(() => {
        if (open) {
            if (isEditing) {
                // Ini sudah benar, akan mengisi form jika initialValues ada
                form.setFieldsValue(initialValues);
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
            }
        }
    }, [initialValues, isEditing, form, open]); // Dependensi ini sudah benar

    // --- (PERBAIKAN BESAR) ---
    // 'handleSubmit' sekarang menangani 'Edit' dan 'Create'
    const handleSubmit = async (values) => {
        setLoading(true);

        if (isEditing) {
            // --- LOGIKA UNTUK EDIT/UPDATE ---
            message.loading({ content: 'Memperbarui buku...', key: 'update' });
            try {
                // Gunakan ID unik buku (push key) dari initialValues
                const bookRef = ref(db, `buku/${initialValues.id}`);
                
                // Siapkan data update, HANYA field dari form
                // 'stok' tidak diubah di sini
                // 'createdAt' dipertahankan
                const updateData = {
                    ...values, // Ambil semua data terbaru dari form
                    updatedAt: serverTimestamp(),
                    stok: initialValues.stok, // Jaga stok (tidak diedit di form ini)
                    createdAt: initialValues.createdAt || serverTimestamp(), // Jaga create time
                };

                await update(bookRef, updateData);
                message.success({ content: `Buku "${values.judul}" berhasil diperbarui.`, key: 'update' });
                onCancel(); // Tutup modal setelah sukses

            } catch (error) {
                console.error("Gagal memperbarui buku:", error);
                message.error({ content: "Gagal memperbarui buku: " + error.message, key: 'update' });
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

                const initialStok = Number(values.stok) || 0;
                const now = serverTimestamp();
                const updates = {};

                // 3. Data Buku Utama (menggunakan newBookId)
                updates[`buku/${newBookId}`] = {
                    ...values,
                    id: newBookId, // Simpan ID unik di dalam data buku
                    stok: initialStok,
                    createdAt: now,
                    updatedAt: now,
                    // Hapus 'historiStok' (sesuai kode asli Anda)
                    historiStok: null 
                };

                // 4. Data Histori Stok Awal (menggunakan newHistoryKey)
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

                // 5. Lakukan multi-path update
                await update(ref(db), updates);

                message.success({ content: `Buku "${values.judul}" berhasil dibuat.`, key: 'create' });
                onCancel(); // Tutup modal setelah sukses

            } catch (error) {
                console.error("Gagal menyimpan buku baru:", error);
                message.error({ content: "Gagal menyimpan buku: " + error.message, key: 'create' });
            }
        }
        setLoading(false);
    };
    // --- (AKHIR PERBAIKAN) ---

    const handleDelete = async () => {
        // Logika ini sudah benar, asalkan 'remove' diimpor
        if (!initialValues?.id) return;
        setDeleting(true);
        try {
            await remove(ref(db, `buku/${initialValues.id}`));
            message.success(`Buku "${initialValues.judul}" berhasil dihapus.`);
            onCancel();
        } catch (error) {
            console.error("Delete error:", error);
            message.error("Gagal menghapus buku: " + error.message);
        } finally {
            setDeleting(false);
        }
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
            onCancel={onCancel}
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
                            <Button onClick={onCancel} disabled={loading || deleting}>Batal</Button>
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

