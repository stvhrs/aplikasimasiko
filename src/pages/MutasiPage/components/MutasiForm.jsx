import React, { useState, useEffect } from 'react';
import {
    Modal, Form, Input, InputNumber, Radio, Select, Upload, Button,
    Row, Col, message, Image, DatePicker
} from 'antd';
import { UploadOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';

// IMPORT FIREBASE
import { db, storage } from '../../../api/firebase'; 
import { ref, update } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

const { Option } = Select;

// --- KONSTANTA ---
const TipeTransaksi = { pemasukan: 'pemasukan', pengeluaran: 'pengeluaran' };

const KategoriPemasukan = { 
    'Pemasukan Lain-lain': 'Pemasukan Lain-lain', 
    'Penjualan Sisa Kertas': 'Penjualan Sisa Kertas' 
};

const KategoriPengeluaran = { 
    komisi: "Komisi", 
    gaji_produksi: "Gaji Karyawan", 
    operasional: "Operasional", 
    pengeluaran_lain: "Pengeluaran Lain-lain" 
};

const generateTransactionId = () => {
    const prefix = 'UM'; // Umum
    const dateCode = dayjs().format('YYYYMMDD');
    const uniquePart = Math.random().toString(36).substring(2, 6).toUpperCase(); 
    return `${prefix}-${dateCode}-${uniquePart}`;
};

const MutasiForm = ({ open, onCancel, initialValues }) => {
    const [form] = Form.useForm();
    const [modal, contextHolder] = Modal.useModal();

    const [fileList, setFileList] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    
    // State untuk preview gambar besar
    const [previewImage, setPreviewImage] = useState('');
    const [previewOpen, setPreviewOpen] = useState(false);

    const watchingTipe = Form.useWatch('tipe', form);

    // --- INITIALIZATION ---
    useEffect(() => {
        if (!open) {
            form.resetFields();
            setFileList([]);
            setIsSaving(false);
            setPreviewImage('');
            return;
        }

        if (initialValues) {
            // --- MODE EDIT ---
            const currentJumlah = Math.abs(initialValues.jumlah || 0);
            
            form.setFieldsValue({
                ...initialValues,
                tanggal: initialValues.tanggal ? dayjs(initialValues.tanggal) : dayjs(),
                jumlah: currentJumlah,
                tipe: initialValues.tipe || (initialValues.jumlah < 0 ? 'pengeluaran' : 'pemasukan')
            });

            // --- SET PREVIEW IMAGE ---
            if (initialValues.buktiUrl) {
                setFileList([{ 
                    uid: '-1', 
                    name: 'Bukti Transaksi', 
                    status: 'done', 
                    url: initialValues.buktiUrl,
                    thumbUrl: initialValues.buktiUrl 
                }]);
            } else {
                setFileList([]);
            }
        } else {
            // --- MODE BARU ---
            form.resetFields();
            setFileList([]);
            form.setFieldsValue({ 
                tipe: TipeTransaksi.pengeluaran, 
                tanggal: dayjs(), 
                kategori: 'Operasional' 
            });
        }
    }, [initialValues, open, form]);

    // --- HANDLERS ---
    const handleTipeChange = (e) => {
        const newTipe = e.target.value;
        const defaultKat = newTipe === 'pemasukan' ? 'Pemasukan Lain-lain' : 'Operasional';
        form.setFieldsValue({ kategori: defaultKat });
    };

    const handlePreview = async (file) => {
        if (!file.url && !file.preview) {
            file.preview = await getBase64(file.originFileObj);
        }
        setPreviewImage(file.url || file.preview);
        setPreviewOpen(true);
    };

    const getBase64 = (file) =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });

    // --- SAVE LOGIC ---
    const handleSave = async (values) => {
        setIsSaving(true);
        message.loading({ content: 'Menyimpan...', key: 'saving' });

        try {
            let finalBuktiUrl = ""; // Default string kosong

            // 1. Cek File Upload
            // Kasus A: Ada file baru diupload (objek File asli ada di originFileObj)
            if (fileList.length > 0 && fileList[0].originFileObj) {
                const file = fileList[0].originFileObj;
                const safeName = (values.keterangan || 'bukti').substring(0, 10).replace(/[^a-z0-9]/gi, '_');
                const fileName = `bukti_mutasi/${safeName}-${uuidv4()}`;
                const fileRef = storageRef(storage, fileName);
                
                // PERBAIKAN: Langsung upload tanpa metadata manual untuk menghindari error 412
                await uploadBytes(fileRef, file);
                
                finalBuktiUrl = await getDownloadURL(fileRef);
            } 
            // Kasus B: Tidak ada file baru, tapi ada file lama (dari Edit)
            else if (fileList.length > 0 && fileList[0].url) {
                finalBuktiUrl = fileList[0].url;
            }
            
            // 2. Prepare Data
            const mutasiId = initialValues?.id || generateTransactionId();
            const timestampNow = values.tanggal.valueOf();
            
            const finalAmount = values.tipe === 'pengeluaran' ? -Math.abs(values.jumlah) : Math.abs(values.jumlah);

            const dataMutasi = {
                id: mutasiId,
                tipe: values.tipe,
                kategori: values.kategori,
                tanggal: timestampNow,
                jumlah: finalAmount,
                // Pastikan tidak undefined
                keterangan: values.keterangan || "", 
                buktiUrl: finalBuktiUrl || "", 
                // Composite key
                index_kategori_tanggal: `${values.kategori}_${timestampNow}`
            };

            // 3. Simpan ke Firebase
            const updates = {};
            updates[`mutasi/${mutasiId}`] = dataMutasi;

            await update(ref(db), updates);
            
            message.success({ content: 'Berhasil disimpan!', key: 'saving' });
            onCancel();

        } catch (error) {
            console.error("Save Error:", error);
            message.error({ content: `Gagal: ${error.message}`, key: 'saving' });
        } finally {
            setIsSaving(false);
        }
    };

    // --- DELETE LOGIC ---
    const handleDelete = () => {
        modal.confirm({
            title: 'Hapus Transaksi?',
            content: 'Data akan dihapus permanen. Yakin?',
            okText: 'Hapus',
            okType: 'danger',
            onOk: async () => {
                setIsSaving(true);
                try {
                    const updates = {};
                    updates[`mutasi/${initialValues.id}`] = null;
                    await update(ref(db), updates);
                    message.success('Transaksi dihapus.');
                    onCancel();
                } catch (e) {
                    message.error(e.message);
                } finally { setIsSaving(false); }
            }
        });
    };

    return (
        <>
            {contextHolder}
            <Modal
                open={open}
                title={initialValues ? "Edit Mutasi Umum" : "Catat Mutasi Umum"}
                onCancel={onCancel}
                width={600}
                maskClosable={false}
                footer={[
                    initialValues && (
                        <Button key="del" danger onClick={handleDelete} loading={isSaving} icon={<DeleteOutlined />}>
                            Hapus
                        </Button>
                    ),
                    <Button key="back" onClick={onCancel} disabled={isSaving}>Batal</Button>,
                    <Button key="submit" type="primary" loading={isSaving} icon={<SaveOutlined />} onClick={() => form.submit()}>
                        Simpan
                    </Button>
                ]}
            >
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="tanggal" label="Tanggal" rules={[{ required: true }]}>
                                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="tipe" label="Jenis Transaksi">
                                <Radio.Group onChange={handleTipeChange} buttonStyle="solid">
                                    <Radio.Button value="pemasukan">Masuk</Radio.Button>
                                    <Radio.Button value="pengeluaran">Keluar</Radio.Button>
                                </Radio.Group>
                            </Form.Item>
                        </Col>
                    </Row>
                    
                    <Form.Item name="kategori" label="Kategori" rules={[{ required: true }]}>
                        <Select>
                            {(watchingTipe === 'pemasukan' ? Object.values(KategoriPemasukan) : Object.values(KategoriPengeluaran)).map((val) => (
                                <Option key={val} value={val}>{val}</Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="jumlah" label="Nominal (Rp)" rules={[{ required: true, message: 'Wajib diisi' }]}>
                        <InputNumber 
                            style={{ width: '100%', fontWeight: 'bold' }} 
                            formatter={v => `Rp ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 
                            parser={v => v.replace(/\D/g, '')}
                            min={0}
                        />
                    </Form.Item>

                    <Form.Item name="keterangan" label="Keterangan">
                        <Input.TextArea rows={3} placeholder="Contoh: Beli tinta printer, Gaji Pak Budi, dll..." />
                    </Form.Item>
                    
                    <Form.Item name="bukti" label="Upload Bukti / Struk">
                        <Upload 
                            listType="picture-card" 
                            maxCount={1} 
                            fileList={fileList} 
                            onChange={({ fileList: newFileList }) => setFileList(newFileList)}
                            onPreview={handlePreview} 
                            beforeUpload={() => false} 
                        >
                            {fileList.length < 1 && (
                                <div>
                                    <UploadOutlined />
                                    <div style={{ marginTop: 8 }}>Upload</div>
                                </div>
                            )}
                        </Upload>
                    </Form.Item>
                </Form>
            </Modal>
            
            {/* Modal Preview Gambar Besar */}
            {previewImage && (
                <Image
                    wrapperStyle={{ display: 'none' }}
                    src={previewImage}
                    preview={{
                        visible: previewOpen,
                        onVisibleChange: (visible) => setPreviewOpen(visible),
                        scaleStep: 0.5,
                    }}
                />
            )}
        </>
    );
};

export default MutasiForm;