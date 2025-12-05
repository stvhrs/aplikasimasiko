import React, { useState, useEffect } from 'react';
import {
    Modal, Form, Input, InputNumber, DatePicker, Upload, Button,
    Typography, message, Table, Row, Col, Empty, Alert
} from 'antd';
import { UploadOutlined, DeleteOutlined, SaveOutlined, SearchOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';

// IMPORT FIREBASE
import { db, storage } from '../../../api/firebase';
import { 
    ref, update, get, query, orderByChild, equalTo, 
    limitToLast, onValue, startAt, endAt
} from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

const { Text } = Typography;

// --- KONFIGURASI ---
const FIXED_KATEGORI = 'Penjualan Buku';
const FIXED_TIPE = 'pemasukan';

const currencyFormatter = (value) => 
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

const generateTransactionId = () => {
    const dateCode = dayjs().format('YYYYMMDD');
    const uniquePart = Math.random().toString(36).substring(2, 8).toUpperCase(); 
    return `PJ-${dateCode}-${uniquePart}`;
};

// Helper untuk preview gambar
const getBase64 = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });

const PembayaranForm = ({ open, onCancel, initialValues }) => {
    const [form] = Form.useForm();
    const [modal, contextHolder] = Modal.useModal();
    
    // --- STATE ---
    const [searchText, setSearchText] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    
    // State untuk Upload & Preview Gambar
    const [fileList, setFileList] = useState([]);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState('');
    const [previewTitle, setPreviewTitle] = useState('');
    
    const [invoiceList, setInvoiceList] = useState([]); 
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]); 
    const [paymentAllocations, setPaymentAllocations] = useState({});
    
    const [isSearching, setIsSearching] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // --- 1. USE EFFECT: DEBOUNCE SEARCH ---
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchText);
        }, 500); 
        return () => clearTimeout(timer);
    }, [searchText]);

    // --- 2. USE EFFECT: STREAM DATA (Realtime) ---
    useEffect(() => {
        if (!open) return;

        setIsSearching(true);
        let q;
        const dbRef = ref(db, 'transaksiJualBuku');

        if (!debouncedSearch) {
            q = query(dbRef, orderByChild('statusPembayaran'), equalTo('Belum'), limitToLast(50));
        } else {
            q = query(dbRef, orderByChild('namaPelanggan'), startAt(debouncedSearch), endAt(debouncedSearch + "\uf8ff"));
        }

        const unsubscribe = onValue(q, (snapshot) => {
            const list = [];
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const val = child.val();
                    if (debouncedSearch && val.statusPembayaran !== 'Belum') {
                        return;
                    }
                    list.push({
                        id: child.key,
                        ...val,
                        sisaTagihan: (val.totalTagihan || 0) - (val.jumlahTerbayar || 0)
                    });
                });
            }
            list.sort((a, b) => b.tanggal - a.tanggal);
            setInvoiceList(list);
            setIsSearching(false);
        }, (error) => {
            console.error("Error stream:", error);
            setIsSearching(false);
        });

        return () => unsubscribe();
    }, [open, debouncedSearch]);

    // --- INITIALIZATION ---
    useEffect(() => {
        if (!open) {
            resetFormState();
        } else {
            setIsSaving(false);
            if (initialValues) {
                // MODE EDIT
                const currentJumlah = Math.abs(initialValues.jumlahBayar || initialValues.jumlah || 0);
                form.setFieldsValue({
                    ...initialValues,
                    tanggal: initialValues.tanggal ? dayjs(initialValues.tanggal) : dayjs(),
                    jumlahTotal: currentJumlah,
                });

                if (initialValues.idTransaksi) {
                    const ids = Array.isArray(initialValues.idTransaksi) ? initialValues.idTransaksi : [initialValues.idTransaksi];
                    setSelectedInvoiceIds(ids);
                    const alloc = {};
                    ids.forEach(id => { alloc[id] = currentJumlah; });
                    setPaymentAllocations(alloc);
                }
                
                // --- TAMPILKAN PREVIEW SAAT EDIT ---
                if (initialValues.buktiUrl) {
                    setFileList([{ 
                        uid: '-1', 
                        name: 'Bukti Pembayaran Existing', 
                        status: 'done', 
                        url: initialValues.buktiUrl // URL ini akan otomatis dirender oleh listType="picture-card"
                    }]);
                }
            } else {
                // MODE BARU
                form.resetFields();
                form.setFieldsValue({ tanggal: dayjs(), jumlahTotal: 0 });
            }
        }
    }, [initialValues, open]);

    const resetFormState = () => {
        form.resetFields();
        setFileList([]);
        setPreviewImage('');
        setSelectedInvoiceIds([]);
        setInvoiceList([]); 
        setPaymentAllocations({});
        setSearchText('');
        setDebouncedSearch('');
        setIsSearching(false);
    };

    // --- UPLOAD HANDLERS ---
    const handleCancelPreview = () => setPreviewOpen(false);

    const handlePreview = async (file) => {
        if (!file.url && !file.preview) {
            file.preview = await getBase64(file.originFileObj);
        }
        setPreviewImage(file.url || file.preview);
        setPreviewOpen(true);
        setPreviewTitle(file.name || file.url.substring(file.url.lastIndexOf('/') + 1));
    };

    const handleUploadChange = ({ fileList: newFileList }) => setFileList(newFileList);

    const beforeUploadFn = (file) => {
        const isImage = file.type.startsWith('image/');
        if (!isImage) {
            message.error('Hanya boleh upload file gambar (JPG/PNG/GIF)!');
            // Mencegah file ditambahkan ke list jika bukan gambar
            return Upload.LIST_IGNORE; 
        }
        // Return false agar tidak auto-upload ke server saat dipilih
        return false;
    };


    // --- LOGIC HELPER LAINNYA ---
    const handleSearch = (e) => {
        setSearchText(e.target.value); 
    };

    const calculateTotal = (allocations) => {
        const total = Object.values(allocations).reduce((a, b) => a + (b || 0), 0);
        form.setFieldsValue({ jumlahTotal: total });
    };

    const handleNominalChange = (val, recordId) => {
        const newAllocations = { ...paymentAllocations, [recordId]: val };
        setPaymentAllocations(newAllocations);
        calculateTotal(newAllocations);
    };

    const rowSelection = {
        selectedRowKeys: selectedInvoiceIds,
        onChange: (selectedRowKeys, selectedRows) => {
            setSelectedInvoiceIds(selectedRowKeys);
            const newAllocations = { ...paymentAllocations };
            
            selectedRows.forEach(row => {
                if (!newAllocations[row.id]) {
                    newAllocations[row.id] = row.sisaTagihan;
                }
            });
            Object.keys(newAllocations).forEach(key => {
                if (!selectedRowKeys.includes(key)) {
                    delete newAllocations[key];
                }
            });

            setPaymentAllocations(newAllocations);
            calculateTotal(newAllocations);
        },
    };

    // --- HANDLE SAVE (SIMPAN) ---
    const handleSave = async (values) => {
        if (selectedInvoiceIds.length === 0) {
            message.error("Pilih minimal satu invoice!");
            return;
        }

        setIsSaving(true);
        message.loading({ content: 'Menyimpan pembayaran...', key: 'saving' });
        
        try {
            // 1. Upload Bukti Baru (jika ada)
            let buktiUrl = initialValues?.buktiUrl || null;
            // Cek jika ada file baru yang diupload (originFileObj ada)
            const buktiFile = (fileList.length > 0 && fileList[0].originFileObj) ? fileList[0].originFileObj : null;
            
            // Jika user menghapus gambar existing di mode edit
            if (fileList.length === 0 && initialValues?.buktiUrl) {
                 buktiUrl = null;
                 // Opsional: Hapus file lama dari storage jika perlu, tapi untuk keamanan biasanya dibiarkan.
            }

            if (buktiFile) {
                const safeName = (values.keterangan || 'bukti').substring(0, 10).replace(/[^a-z0-9]/gi, '_');
                const fileRef = storageRef(storage, `bukti_pembayaran/${safeName}-${uuidv4()}`);
                await uploadBytes(fileRef, buktiFile);
                buktiUrl = await getDownloadURL(fileRef);
            }

            const updates = {};
            const timestampNow = dayjs(values.tanggal).valueOf();

            // 2. Loop Process per Invoice
            for (const invId of selectedInvoiceIds) {
                const amount = paymentAllocations[invId];
                if (!amount || amount <= 0) continue; 

                const isSingleEdit = initialValues && selectedInvoiceIds.length === 1 && initialValues.idTransaksi === invId;
                const mutasiId = isSingleEdit ? initialValues.id : generateTransactionId();

                const invSnap = await get(ref(db, `transaksiJualBuku/${invId}`));
                if (!invSnap.exists()) continue;
                
                const dbInv = invSnap.val();
                let basePaid = Number(dbInv.jumlahTerbayar || 0);
                
                if (isSingleEdit) {
                    const oldAmount = initialValues.jumlah || 0;
                    basePaid -= oldAmount;
                }

                const newTotalPaid = basePaid + amount;
                const newStatus = newTotalPaid >= (dbInv.totalTagihan || 0) ? 'Lunas' : 'Belum';

                // Update Invoice Header
                updates[`transaksiJualBuku/${invId}/jumlahTerbayar`] = newTotalPaid;
                updates[`transaksiJualBuku/${invId}/statusPembayaran`] = newStatus;
                updates[`transaksiJualBuku/${invId}/updatedAt`] = { ".sv": "timestamp" };

                // Catat Riwayat di Invoice
                updates[`transaksiJualBuku/${invId}/riwayatPembayaran/${mutasiId}`] = { 
                    tanggal: timestampNow, 
                    jumlah: amount, 
                    mutasiId: mutasiId, 
                    keterangan: values.keterangan || `Pembayaran ${dbInv.nomorInvoice}` 
                };

                // Catat Mutasi
                const dataMutasi = {
                    id: mutasiId,
                    tipe: FIXED_TIPE, 
                    kategori: FIXED_KATEGORI, 
                    tanggal: timestampNow,
                    jumlah: amount, 
                    keterangan: values.keterangan || `Pembayaran ${dbInv.nomorInvoice}`,
                    buktiUrl: buktiUrl,
                    idTransaksi: invId, 
                    namaPelanggan: dbInv.namaPelanggan || 'Umum',
                    nomorInvoice: dbInv.nomorInvoice, 
                    detailAlokasi: {
                        [invId]: { amount: amount, noInvoice: dbInv.nomorInvoice }
                    },
                    index_kategori_tanggal: `Penjualan Buku_${timestampNow}` 
                };

                updates[`mutasi/${mutasiId}`] = dataMutasi;
                updates[`historiPembayaran/${mutasiId}`] = dataMutasi;
            }

            await update(ref(db), updates);
            message.success({ content: 'Pembayaran berhasil disimpan!', key: 'saving' });
            onCancel();

        } catch (error) {
            console.error(error);
            message.error({ content: `Gagal: ${error.message}`, key: 'saving' });
        } finally {
            setIsSaving(false);
        }
    };

    // --- HANDLE DELETE (HAPUS) ---
    const handleDelete = () => {
        modal.confirm({
            title: 'Hapus Pembayaran?',
            content: 'Saldo invoice akan dikembalikan. Yakin?',
            okText: 'Hapus',
            okType: 'danger',
            onOk: async () => {
                setIsSaving(true);
                try {
                    const mutasiId = initialValues.id;
                    const updates = {};
                    
                    updates[`mutasi/${mutasiId}`] = null; 
                    updates[`historiPembayaran/${mutasiId}`] = null;

                    const allocations = initialValues.detailAlokasi || { [initialValues.idTransaksi]: initialValues.jumlah };
                    
                    for (const [invId, val] of Object.entries(allocations)) {
                        const amount = typeof val === 'object' ? val.amount : val; 
                        const invSnap = await get(ref(db, `transaksiJualBuku/${invId}`));
                        if (invSnap.exists()) {
                            const invData = invSnap.val();
                            const currentPaid = Number(invData.jumlahTerbayar || 0);
                            const newPaid = currentPaid - Number(amount);
                            const finalPaid = newPaid < 0 ? 0 : newPaid;
                            const newStatus = finalPaid >= (invData.totalTagihan || 0) ? 'Lunas' : 'Belum';

                            updates[`transaksiJualBuku/${invId}/jumlahTerbayar`] = finalPaid;
                            updates[`transaksiJualBuku/${invId}/statusPembayaran`] = newStatus;
                            updates[`transaksiJualBuku/${invId}/riwayatPembayaran/${mutasiId}`] = null;
                            updates[`transaksiJualBuku/${invId}/updatedAt`] = { ".sv": "timestamp" };
                        }
                    }

                    await update(ref(db), updates);
                    message.success('Pembayaran dihapus.');
                    onCancel();
                } catch (error) {
                    message.error("Gagal hapus: " + error.message);
                } finally {
                    setIsSaving(false);
                }
            }
        });
    };

    // --- TABLE COLUMNS ---
    const columns = [
        { 
            title: 'Pelanggan / Invoice', 
            dataIndex: 'namaPelanggan', 
            key: 'nama',
            render: (text, r) => (
                <div>
                    <Text strong>{text}</Text>
                    <div style={{ fontSize: 11, color: '#888' }}>{r.nomorInvoice} • {dayjs(r.tanggal).format('DD/MM/YYYY')}</div>
                </div>
            )
        },
        { 
            title: 'Sisa Tagihan', 
            dataIndex: 'sisaTagihan', 
            key: 'sisa', 
            align: 'right',
            width: 120,
            render: (val) => <Text type="warning">{currencyFormatter(val)}</Text> 
        },
        { 
            title: 'Bayar (Rp)', 
            key: 'bayar', 
            width: 140,
            render: (_, r) => (
                <InputNumber 
                    value={paymentAllocations[r.id]} 
                    onChange={(v) => handleNominalChange(v, r.id)}
                    formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 
                    parser={v => v.replace(/[^\d]/g, '')} 
                    min={0}
                    disabled={!selectedInvoiceIds.includes(r.id)} 
                    style={{ width: '100%' }}
                /> 
            ) 
        }
    ];

    return (
        <>
            {contextHolder}
            <Modal
                open={open}
                title={initialValues ? "Edit Pembayaran" : "Input Pembayaran Baru"}
                onCancel={onCancel}
                width={800}
                maskClosable={false}
                footer={[
                    initialValues && <Button key="del" danger icon={<DeleteOutlined />} onClick={handleDelete}>Hapus</Button>,
                    <Button key="back" onClick={onCancel} disabled={isSaving}>Batal</Button>,
                    <Button key="submit" type="primary" loading={isSaving} icon={<SaveOutlined />} onClick={() => form.submit()}>
                        Simpan Pembayaran
                    </Button>
                ]}
            >
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    
                    <Alert 
                        message="Pilih invoice di bawah ini untuk dibayar. Data akan disimpan per invoice (split)." 
                        type="info" 
                        showIcon 
                        style={{marginBottom: 16}} 
                    />

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="tanggal" label="Tanggal Pembayaran" rules={[{ required: true }]}>
                                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Kategori">
                                <Input value={FIXED_KATEGORI} readOnly disabled />
                            </Form.Item>
                        </Col>
                    </Row>

                    <div style={{ marginBottom: 16 }}>
                        <Input 
                            placeholder="Cari Nama Pelanggan (Case Sensitive)..." 
                            prefix={<SearchOutlined />} 
                            value={searchText}
                            onChange={handleSearch}
                            allowClear
                        />
                    </div>

                    <Table 
                        rowSelection={rowSelection} 
                        columns={columns} 
                        dataSource={invoiceList} 
                        rowKey="id"
                        size="small"
                        scroll={{ y: 300 }} 
                        pagination={false}
                        loading={isSearching}
                        locale={{ emptyText: <Empty description="Tidak ada tagihan ditemukan" /> }}
                        style={{ border: '1px solid #f0f0f0', borderRadius: 8, marginBottom: 16 }}
                    />

                    <Row gutter={16} align="middle">
                        <Col span={12}>
                            <Text type="secondary">Total {selectedInvoiceIds.length} invoice dipilih</Text>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="jumlahTotal" label="Total Nominal Masuk">
                                <InputNumber 
                                    style={{ width: '100%', fontWeight: 'bold', fontSize: 16 }} 
                                    formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 
                                    readOnly
                                    prefix="Rp"
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="keterangan" label="Catatan / Keterangan (Opsional)">
                        <Input.TextArea rows={2} placeholder="Contoh: Transfer BCA" />
                    </Form.Item>
                    
                    {/* --- BAGIAN UPLOAD YANG DIPERBARUI --- */}
                    <Form.Item name="bukti" label="Upload Bukti Transfer (Gambar)">
                        <Upload 
                            accept="image/*"             // 1. Hanya menerima file gambar di dialog
                            listType="picture-card"      // 2. Tampilan kartu preview
                            maxCount={1} 
                            fileList={fileList}
                            onPreview={handlePreview}    // Handler untuk klik preview (mata)
                            onChange={handleUploadChange}
                            beforeUpload={beforeUploadFn} // 3. Validasi tipe file sebelum upload
                            showUploadList={{
                                showPreviewIcon: true,
                                showRemoveIcon: true,
                            }}
                        >
                            {/* Tampilkan tombol hanya jika belum ada file */}
                            {fileList.length < 1 ? (
                                <div>
                                    <PlusOutlined />
                                    <div style={{ marginTop: 8 }}>Upload</div>
                                </div>
                             ) : null}
                        </Upload>
                    </Form.Item>
                </Form>
            </Modal>

            {/* MODAL UNTUK PREVIEW GAMBAR BESAR */}
            <Modal open={previewOpen} title={previewTitle} footer={null} onCancel={handleCancelPreview}>
                <img alt="bukti transfer" style={{ width: '100%' }} src={previewImage} />
            </Modal>
        </>
    );
};

export default PembayaranForm;