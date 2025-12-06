import React, { useState, useEffect, useRef } from 'react';
import {
    Modal, Form, Input, InputNumber, DatePicker, Select, Upload, Button,
    Typography, Spin, message, Table, Row, Col, Empty, Tag, Alert
} from 'antd';
import { UploadOutlined, DeleteOutlined, PrinterOutlined, SaveOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';

// FIREBASE
import { db, storage } from '../../../api/firebase';
// Pastikan import orderByKey ada
import { ref, push, update, get, query, orderByChild, equalTo, limitToLast, startAt, endAt, orderByKey } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

// PDF GENERATOR (Sesuaikan path import Anda)
import { generateNotaReturPDF } from '../../../utils/notaretur'; 

const { Text } = Typography;
const { Option } = Select;

const currencyFormatter = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

// --- HELPER: PRINT NOTA RETUR ---
const printNotaReturAction = (dataMutasi, originalInvoice) => {
    try {
        const pdfDataUrl = generateNotaReturPDF({
            ...dataMutasi,
            nomorInvoice: originalInvoice.nomorInvoice, 
            namaPelanggan: originalInvoice.namaPelanggan 
        });

        const printWindow = window.open('');
        printWindow.document.write(
            `<iframe width='100%' height='100%' src='${pdfDataUrl}'></iframe>`
        );
    } catch (e) {
        message.error("Gagal mencetak nota: " + e.message);
    }
};

const ReturForm = ({ open, onCancel, initialValues }) => {
    const [form] = Form.useForm();
    const [modal, contextHolder] = Modal.useModal(); 
    
    const [fileList, setFileList] = useState([]);
    
    // DATA STATES
    const [invoiceOptions, setInvoiceOptions] = useState([]);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [returItems, setReturItems] = useState([]); 
    const [isSearching, setIsSearching] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isManualDiskon, setIsManualDiskon] = useState(false);
    
    const searchTimeout = useRef(null);

    // --- INITIALIZATION ---
    useEffect(() => {
        if (!open) {
            resetState();
            return;
        }
        setIsSaving(false);

        if (initialValues) {
            // MODE EDIT
            const currentTotal = Math.abs(initialValues.jumlah || 0);
            form.setFieldsValue({
                ...initialValues,
                tanggal: initialValues.tanggal ? dayjs(initialValues.tanggal) : dayjs(),
                jumlah: currentTotal,
                totalDiskon: initialValues.totalDiskon || 0,
            });

            if (initialValues.idTransaksi) {
                loadInvoiceForEdit(initialValues.idTransaksi, initialValues);
            }
            if (initialValues.buktiUrl) {
                setFileList([{ uid: '-1', name: 'Bukti Retur', status: 'done', url: initialValues.buktiUrl }]);
            }
        } else {
            // MODE BARU
            form.resetFields();
            form.setFieldsValue({ 
                tanggal: dayjs(), 
                jumlah: 0, 
                totalDiskon: 0 
            });
            handleSearchInvoice(""); 
        }
    }, [initialValues, open, form]);

    const resetState = () => {
        form.resetFields();
        setFileList([]);
        setSelectedInvoice(null);
        setInvoiceOptions([]);
        setReturItems([]);
        setIsManualDiskon(false);
        setIsSearching(false);
    };

    // --- LOAD DATA (EDIT MODE) ---
    const loadInvoiceForEdit = async (invoiceId, editData) => {
        try {
            message.loading({ content: 'Memuat data retur...', key: 'load' });
            
            const snapshot = await get(ref(db, `transaksiJualBuku/${invoiceId}`));
            if (!snapshot.exists()) {
                message.error({ content: 'Invoice asal tidak ditemukan', key: 'load' });
                return;
            }
            
            const invoiceData = { id: snapshot.key, ...snapshot.val() };
            setInvoiceOptions([invoiceData]);
            setSelectedInvoice(invoiceData);

            const savedDetails = editData.itemsReturDetail || [];
            const originalItems = invoiceData.items || [];

            const mappedItems = await Promise.all(originalItems.map(async (item) => {
                const savedItem = savedDetails.find(s => s.idBuku === item.idBuku);
                
                let judul = savedItem?.judulBuku || item.judulBuku || item.namaBuku || item.judul;
                
                if (!judul || judul === 'Unknown') {
                    try {
                        const bSnap = await get(ref(db, `buku/${item.idBuku}`));
                        if(bSnap.exists()) {
                            const bVal = bSnap.val();
                            judul = bVal.judul || bVal.namaBuku || 'Unknown Book';
                        } else {
                            judul = 'Unknown Book';
                        }
                    } catch (e) { judul = 'Unknown Book'; }
                }

                return {
                    ...item,
                    judulBuku: judul,
                    hargaSatuan: Number(item.hargaSatuan),
                    jumlah: Number(item.jumlah), 
                    diskonPersen: Number(item.diskonPersen || 0),
                    qtyRetur: savedItem ? Number(savedItem.qty) : 0 
                };
            }));

            setReturItems(mappedItems);
            message.success({ content: 'Data siap diedit', key: 'load' });

        } catch (e) {
            console.error(e);
            message.error({ content: 'Gagal load data', key: 'load' });
        }
    };

    // --- SEARCH INVOICE ---
    const handleSearchInvoice = (val) => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        setIsSearching(true);
        
        searchTimeout.current = setTimeout(async () => {
            try {
                const keyword = (val || "").toUpperCase().trim();
                let results = [];

                if (!keyword) {
                    const q = query(ref(db, 'transaksiJualBuku'), limitToLast(20));
                    const snap = await get(q);
                    if (snap.exists()) results = Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] }));
                } else {
                    const qNama = query(ref(db, 'transaksiJualBuku'), orderByChild('namaPelanggan'), startAt(keyword), endAt(keyword + "\uf8ff"));
                    const snapNama = await get(qNama);
                    if (snapNama.exists()) {
                        const raw = snapNama.val();
                        results = Object.keys(raw).map(k => ({ id: k, ...raw[k] }));
                    }
                    if (results.length === 0) {
                        const qInv = query(ref(db, 'transaksiJualBuku'), orderByChild('nomorInvoice'), startAt(keyword), endAt(keyword + "\uf8ff"));
                        const snapInv = await get(qInv);
                        if (snapInv.exists()) {
                            const raw = snapInv.val();
                            results = Object.keys(raw).map(k => ({ id: k, ...raw[k] }));
                        }
                    }
                }

                results = results.filter(r => r.items && r.items.length > 0);
                results.sort((a, b) => b.tanggal - a.tanggal);

                setInvoiceOptions(results);
            } catch (e) { console.error(e); }
            finally { setIsSearching(false); }
        }, 500);
    };

    // --- SELECT INVOICE BARU ---
   // --- SELECT INVOICE BARU ---
    const handleSelectInvoice = async (id) => {
        const tx = invoiceOptions.find(t => t.id === id);
        if (!tx) return;

        setSelectedInvoice(tx);
        message.loading({ content: 'Menyiapkan item...', key: 'prep' });

        try {
            const items = tx.items || [];
            const itemsWithTitle = await Promise.all(items.map(async (item) => {
                // ... (LOGIC MAPPING ITEM BIARKAN SAMA) ...
                let judul = item.judulBuku || item.namaBuku || item.judul;
                
                if (!judul || judul === 'Unknown') {
                    try {
                        const bSnap = await get(ref(db, `buku/${item.idBuku}`));
                        if(bSnap.exists()) {
                            const bVal = bSnap.val();
                            judul = bVal.judul || bVal.namaBuku || 'Unknown Book';
                        } else {
                            judul = 'Unknown Book';
                        }
                    } catch (e) { judul = 'Unknown Book'; }
                }

                return {
                    ...item,
                    judulBuku: judul,
                    hargaSatuan: Number(item.hargaSatuan),
                    jumlah: Number(item.jumlah),
                    diskonPersen: Number(item.diskonPersen || 0),
                    qtyRetur: 0 
                };
            }));

            setReturItems(itemsWithTitle);
            
            // === BAGIAN INI YANG DIUBAH ===
            form.setFieldsValue({
                // Contoh Hasil: "Retur SD AL AZHAR (Inv: SL-2025-001)"
                keterangan: `Retur ${tx.namaPelanggan || 'Umum'} (Inv: ${tx.nomorInvoice})`, 
                jumlah: 0,
                totalDiskon: 0
            });
            // ==============================

            setIsManualDiskon(false);
            message.success({ content: 'Silakan input jumlah retur', key: 'prep' });

        } catch (e) {
            console.error(e);
            message.error({ content: 'Gagal menyiapkan item', key: 'prep' });
        }
    };
    // --- LOGIC PERHITUNGAN ---
    const handleQtyChange = (val, index) => {
        const newItems = [...returItems];
        const item = newItems[index];
        
        const max = Number(item.jumlah);
        let input = Number(val || 0);
        if (input < 0) input = 0;
        if (input > max) input = max;

        newItems[index].qtyRetur = input;
        setReturItems(newItems);
        recalculateTotal(newItems);
    };

    const handleTotalDiskonChange = (val) => {
        setIsManualDiskon(true);
        const gross = returItems.reduce((acc, curr) => acc + (curr.qtyRetur * curr.hargaSatuan), 0);
        const net = gross - (val || 0);
        form.setFieldsValue({ jumlah: net < 0 ? 0 : net });
    };

    const recalculateTotal = (items) => {
        const gross = items.reduce((acc, curr) => acc + (curr.qtyRetur * curr.hargaSatuan), 0);
        
        let discount = Number(form.getFieldValue('totalDiskon') || 0);

        if (!isManualDiskon) {
            discount = items.reduce((acc, curr) => {
                const subGross = curr.qtyRetur * curr.hargaSatuan;
                const subDisc = subGross * (curr.diskonPersen / 100);
                return acc + subDisc;
            }, 0);
            form.setFieldsValue({ totalDiskon: discount });
        }

        const net = gross - discount;
        form.setFieldsValue({ jumlah: net < 0 ? 0 : net });
    };

    // --- FUNGSI GENERATE ID URUT (Baru) ---
    const getNewReturId = async () => {
        const today = dayjs();
        const year = today.format('YYYY');
        const month = today.format('MM');
        
        // Format Prefix untuk Database Key: RJ-2025-01-
        const prefix = `RJ-${year}-${month}-`; 

        try {
            // Cari data terakhir di historiRetur yang depannya RJ-2025-01-
            const q = query(
                ref(db, 'historiRetur'),
                orderByKey(),
                startAt(prefix),
                endAt(prefix + "\uf8ff"),
                limitToLast(1)
            );

            const snapshot = await get(q);
            let nextSequence = 1;

            if (snapshot.exists()) {
                const data = snapshot.val();
                const lastKey = Object.keys(data)[0]; // misal: RJ-2025-01-0045
                
                // Ambil 4 digit terakhir
                const parts = lastKey.split('-'); 
                const lastNum = parseInt(parts[parts.length - 1]);
                
                if (!isNaN(lastNum)) {
                    nextSequence = lastNum + 1;
                }
            }

            // Return format: RJ-2025-01-0001
            return `${prefix}${String(nextSequence).padStart(4, '0')}`;
        } catch (error) {
            console.error("Gagal generate ID:", error);
            return `RJ-${year}-${month}-${Math.floor(Math.random() * 10000)}`;
        }
    };

    // --- HANDLE SAVE (Definisi ada DI DALAM Component) ---
    const handleSave = async (values) => {
        const itemsToRetur = returItems.filter(i => i.qtyRetur > 0);
        if (itemsToRetur.length === 0) {
            message.error("Belum ada buku yang diretur (Qty masih 0)");
            return;
        }

        setIsSaving(true);
        message.loading({ content: 'Menyimpan Retur...', key: 'save' });

        try {
            // 1. GENERATE ID BARU (Async)
            let returId = initialValues?.id;
            if (!returId) {
                returId = await getNewReturId(); 
            }

            // 2. Upload Bukti
            let buktiUrl = initialValues?.buktiUrl || null;
            const file = (values.bukti && values.bukti.length > 0) ? values.bukti[0].originFileObj : null;
            if (file) {
                const refFile = storageRef(storage, `bukti_retur/${uuidv4()}`);
                await uploadBytes(refFile, file);
                buktiUrl = await getDownloadURL(refFile);
            }

            const updates = {};
            const timestamp = values.tanggal.valueOf();
            const invoiceId = values.idTransaksi;

            const snap = await get(ref(db, `transaksiJualBuku/${invoiceId}`));
            if(!snap.exists()) throw new Error("Invoice tidak ditemukan!");
            const invData = snap.val();

            // A. Update Stok & History
            const itemsDetailRecord = [];
            for (const item of itemsToRetur) {
                itemsDetailRecord.push({
                    idBuku: item.idBuku,
                    judulBuku: item.judulBuku,
                    hargaSatuan: item.hargaSatuan,
                    qty: item.qtyRetur,
                    subtotal: item.qtyRetur * item.hargaSatuan
                });

                const bSnap = await get(ref(db, `buku/${item.idBuku}`));
                if(bSnap.exists()) {
                    const stokNow = Number(bSnap.val().stok || 0);
                    updates[`buku/${item.idBuku}/stok`] = stokNow + item.qtyRetur;
                    
                    const logId = push(ref(db, 'historiStok')).key;
                    updates[`historiStok/${logId}`] = {
                        bukuId: item.idBuku,
                        judul: item.judulBuku,
                        perubahan: item.qtyRetur,
                        keterangan: `Retur Invoice ${invData.nomorInvoice} (${returId})`,
                        refId: invoiceId,
                        timestamp: timestamp
                    };
                }
            }

            // B. Simpan Record
            const nominalKeluar = values.jumlah; 

            const mutasiData = {
                id: returId,
                tipe: 'pengeluaran',
                kategori: 'Retur Buku',
                tanggal: timestamp,
                jumlah: -Math.abs(nominalKeluar),
                jumlahKeluar: Math.abs(nominalKeluar),
                idTransaksi: invoiceId,
                nomorInvoice: invData.nomorInvoice,
                namaPelanggan: invData.namaPelanggan || 'Umum',
                keterangan: values.keterangan,
                buktiUrl: buktiUrl,
                itemsReturDetail: itemsDetailRecord,
                itemsReturRingkas: itemsDetailRecord.map(i => `${i.judulBuku} (x${i.qty})`).join(', '),
                totalDiskon: values.totalDiskon,
                index_kategori_tanggal: `Retur Buku_${timestamp}`
            };

            updates[`mutasi/${returId}`] = mutasiData;
            updates[`historiRetur/${returId}`] = {
                ...mutasiData,
                refId: invoiceId,
                judul: itemsDetailRecord.map(i => i.judulBuku).join(', '),
                perubahan: itemsDetailRecord.reduce((a,b) => a + b.qty, 0),
                timestamp: timestamp
            };

            await update(ref(db), updates);
            
            message.success({ content: `Retur ${returId} berhasil diproses!`, key: 'save' });
            onCancel();

            modal.confirm({
                title: 'Cetak Nota Retur?',
                icon: <PrinterOutlined />,
                content: 'Apakah Anda ingin mencetak bukti retur ini?',
                okText: 'Cetak',
                onOk: () => printNotaReturAction(mutasiData, invData)
            });

        } catch (e) {
            console.error(e);
            message.error({ content: `Gagal: ${e.message}`, key: 'save' });
        } finally {
            setIsSaving(false);
        }
    };

    // --- DELETE / BATAL RETUR ---
    const handleDelete = () => {
        modal.confirm({
            title: 'Batalkan Retur?',
            content: 'Stok buku akan ditarik kembali dari gudang. Invoice asli tetap utuh.',
            okType: 'danger',
            onOk: async () => {
                setIsSaving(true);
                try {
                    const returId = initialValues.id;
                    const itemsDiretur = initialValues.itemsReturDetail || [];
                    const updates = {};

                    updates[`mutasi/${returId}`] = null;
                    updates[`historiRetur/${returId}`] = null;

                    for (const rItem of itemsDiretur) {
                        const bSnap = await get(ref(db, `buku/${rItem.idBuku}`));
                        if (bSnap.exists()) {
                            const sNow = Number(bSnap.val().stok || 0);
                            updates[`buku/${rItem.idBuku}/stok`] = sNow - Number(rItem.qty);
                            
                            const logId = push(ref(db, 'historiStok')).key;
                            updates[`historiStok/${logId}`] = {
                                bukuId: rItem.idBuku,
                                judul: rItem.judulBuku,
                                perubahan: -Number(rItem.qty), 
                                keterangan: `Batal Retur ${returId}`,
                                timestamp: dayjs().valueOf()
                            };
                        }
                    }

                    await update(ref(db), updates);
                    message.success('Retur dibatalkan. Stok dikoreksi.');
                    onCancel();
                } catch (e) {
                    message.error(e.message);
                } finally { setIsSaving(false); }
            }
        });
    };

    // --- TABLE COLUMNS ---
    const columns = [
        { title: 'Buku', dataIndex: 'judulBuku', key: 'judul', render: t => <b>{t}</b> },
        { title: 'Harga', dataIndex: 'hargaSatuan', align: 'right', render: v => currencyFormatter(v) },
        { title: 'Qty Beli', dataIndex: 'jumlah', align: 'center', width: 80, render: v => <Tag>{v}</Tag> },
        { title: 'Disc %', dataIndex: 'diskonPersen', align: 'center', width: 80 },
        { 
            title: 'Jml Retur', 
            width: 100,
            render: (_, r, i) => (
                <InputNumber 
                    min={0} 
                    max={r.jumlah} 
                    value={r.qtyRetur} 
                    onChange={(v) => handleQtyChange(v, i)}
                    style={{ width: '100%' }}
                    status={r.qtyRetur > 0 ? 'warning' : ''}
                />
            )
        },
        { 
            title: 'Subtotal', 
            align: 'right',
            render: (_, r) => {
                const sub = r.qtyRetur * r.hargaSatuan * (1 - (r.diskonPersen/100));
                return currencyFormatter(sub);
            }
        }
    ];

    return (
        <>
            {contextHolder}
            <Modal
                open={open}
                title={initialValues ? "Edit Retur Buku" : "Input Retur Buku Baru"}
                onCancel={onCancel}
                width={800}
                maskClosable={false}
                footer={[
                    initialValues && <Button key="del" danger icon={<DeleteOutlined />} onClick={handleDelete}>Batalkan Retur</Button>,
                    <Button key="back" onClick={onCancel}>Tutup</Button>,
                    <Button key="save" type="primary" icon={<SaveOutlined />} loading={isSaving} onClick={() => form.submit()}>Proses Retur</Button>
                ]}
            >
                <Alert message="Mode Aman: Retur ini HANYA akan mengembalikan stok buku ke gudang dan mencatat pengeluaran. Tagihan Invoice Asli TIDAK akan berubah." type="info" showIcon style={{marginBottom: 20}} />
                
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="tanggal" label="Tanggal Retur" rules={[{ required: true }]}>
                                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="idTransaksi" label="Pilih Invoice Asal" rules={[{ required: true }]}>
                                <Select
                                    showSearch
                                    placeholder="Cari No Invoice / Nama Pelanggan"
                                    onSearch={handleSearchInvoice}
                                    onSelect={handleSelectInvoice}
                                    filterOption={false}
                                    notFoundContent={isSearching ? <Spin size="small" /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                                    disabled={!!initialValues}
                                    listHeight={250}
                                >
                                    {invoiceOptions.map(i => (
                                        <Option key={i.id} value={i.id}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span>
                                                    <span style={{ fontWeight: 500 }}>{i.namaPelanggan}</span>
                                                    <span style={{ color: '#8c8c8c' }}> - {i.nomorInvoice}</span>
                                                </span>
                                                <span style={{ fontWeight: 'bold', color: '#1890ff', marginLeft: 10 }}>
                                                    {currencyFormatter(i.totalTagihan || 0)}
                                                </span>
                                            </div>
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    {selectedInvoice && (
                        <div style={{ marginBottom: 20, border: '1px solid #f0f0f0', borderRadius: 8 }}>
                            <Table 
                                dataSource={returItems} 
                                columns={columns} 
                                pagination={false} 
                                size="small" 
                                rowKey="idBuku"
                                scroll={{ y: 240 }}
                            />
                        </div>
                    )}

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="totalDiskon" label="Potongan Retur (Jika ada)">
                                <InputNumber 
                                    style={{ width: '100%' }} 
                                    formatter={v => `Rp ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 
                                    parser={v => v.replace(/\D/g, '')}
                                    onChange={handleTotalDiskonChange}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="jumlah" label="Total Nilai Retur (Refund)">
                                <InputNumber 
                                    style={{ width: '100%', fontWeight: 'bold', color: 'red' }} 
                                    formatter={v => `Rp ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 
                                    readOnly
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="keterangan" label="Alasan Retur / Catatan">
                        <Input.TextArea rows={2} placeholder="Misal: Buku rusak, salah cetak, dll" />
                    </Form.Item>

                    <Form.Item name="bukti" label="Foto Bukti (Opsional)">
                        <Upload maxCount={1} beforeUpload={() => false} listType="picture" fileList={fileList} onChange={({fileList}) => setFileList(fileList)}>
                            <Button icon={<UploadOutlined />}>Upload Foto</Button>
                        </Upload>
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
};

export default ReturForm;