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
import { ref, push, update, get, query, orderByChild, equalTo, limitToLast, startAt, endAt } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

// PDF GENERATOR
import { generateNotaReturPDF } from '../../../utils/notaretur'; 

const { Text } = Typography;
const { Option } = Select;

const currencyFormatter = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

// GENERATOR ID RETUR
const generateReturId = () => {
    const dateCode = dayjs().format('YYYYMMDD');
    const uniquePart = Math.random().toString(36).substring(2, 6).toUpperCase(); 
    return `RT-${dateCode}-${uniquePart}`;
};

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
                // Panggil fungsi load khusus Edit
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
            handleSearchInvoice(""); // Load default list
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

    // --- LOAD DATA (EDIT MODE - FIX QTY RETUR & UNKNOWN BOOK) ---
    const loadInvoiceForEdit = async (invoiceId, editData) => {
        try {
            message.loading({ content: 'Memuat data retur...', key: 'load' });
            
            // 1. Ambil Invoice Asli
            const snapshot = await get(ref(db, `transaksiJualBuku/${invoiceId}`));
            if (!snapshot.exists()) {
                message.error({ content: 'Invoice asal tidak ditemukan', key: 'load' });
                return;
            }
            
            const invoiceData = { id: snapshot.key, ...snapshot.val() };
            setInvoiceOptions([invoiceData]);
            setSelectedInvoice(invoiceData);

            // 2. Mapping Item dengan Data Tersimpan
            // editData.itemsReturDetail berisi data retur yg tersimpan sebelumnya
            const savedDetails = editData.itemsReturDetail || [];
            const originalItems = invoiceData.items || [];

            const mappedItems = await Promise.all(originalItems.map(async (item) => {
                // Cari apakah item ini pernah diretur sebelumnya
                const savedItem = savedDetails.find(s => s.idBuku === item.idBuku);
                
                // --- FIX JUDUL BUKU ---
                // Priority: Data Tersimpan > Data Invoice > Master Buku DB
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
                    jumlah: Number(item.jumlah), // Qty Awal Beli
                    diskonPersen: Number(item.diskonPersen || 0),
                    
                    // --- FIX QTY RETUR (EDIT MODE) ---
                    // Jika ada savedItem (berarti pernah diretur), ambil qty-nya.
                    // Jika tidak, berarti item ini dulu tidak diretur (0).
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

    // --- SEARCH INVOICE (Hanya Lunas / Partial) ---
    const handleSearchInvoice = (val) => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        setIsSearching(true);
        
        searchTimeout.current = setTimeout(async () => {
            try {
                const keyword = (val || "").toUpperCase().trim();
                let results = [];

                if (!keyword) {
                    // Default: Ambil 20 transaksi terakhir
                    const q = query(ref(db, 'transaksiJualBuku'), limitToLast(20));
                    const snap = await get(q);
                    if (snap.exists()) results = Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] }));
                } else {
                    // Search by Nama
                    const qNama = query(ref(db, 'transaksiJualBuku'), orderByChild('namaPelanggan'), startAt(keyword), endAt(keyword + "\uf8ff"));
                    const snapNama = await get(qNama);
                    if (snapNama.exists()) {
                        const raw = snapNama.val();
                        results = Object.keys(raw).map(k => ({ id: k, ...raw[k] }));
                    }
                    // Fallback Search by No Invoice
                    if (results.length === 0) {
                        const qInv = query(ref(db, 'transaksiJualBuku'), orderByChild('nomorInvoice'), startAt(keyword), endAt(keyword + "\uf8ff"));
                        const snapInv = await get(qInv);
                        if (snapInv.exists()) {
                            const raw = snapInv.val();
                            results = Object.keys(raw).map(k => ({ id: k, ...raw[k] }));
                        }
                    }
                }

                // Filter hanya yang punya item buku
                results = results.filter(r => r.items && r.items.length > 0);
                results.sort((a, b) => b.tanggal - a.tanggal);

                setInvoiceOptions(results);
            } catch (e) { console.error(e); }
            finally { setIsSearching(false); }
        }, 500);
    };

    // --- SELECT INVOICE BARU (MODE INPUT BARU) ---
    const handleSelectInvoice = async (id) => {
        const tx = invoiceOptions.find(t => t.id === id);
        if (!tx) return;

        setSelectedInvoice(tx);
        message.loading({ content: 'Menyiapkan item...', key: 'prep' });

        try {
            const items = tx.items || [];
            // Ambil detail buku lengkap
            const itemsWithTitle = await Promise.all(items.map(async (item) => {
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
                    
                    // --- DEFAULT VALUE QTY (BARU) ---
                    // Kalau baru pilih invoice, semua item retur default-nya 0
                    qtyRetur: 0 
                };
            }));

            setReturItems(itemsWithTitle);
            
            // Auto fill fields
            form.setFieldsValue({
                keterangan: `Retur dari Invoice ${tx.nomorInvoice}`,
                jumlah: 0,
                totalDiskon: 0
            });
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
        
        // Validasi Max Qty (Tidak boleh retur lebih dari beli)
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
        // Recalculate dengan diskon manual baru
        const gross = returItems.reduce((acc, curr) => acc + (curr.qtyRetur * curr.hargaSatuan), 0);
        const net = gross - (val || 0);
        form.setFieldsValue({ jumlah: net < 0 ? 0 : net });
    };

    const recalculateTotal = (items) => {
        // Hitung Gross Total (Harga x Qty Retur)
        const gross = items.reduce((acc, curr) => acc + (curr.qtyRetur * curr.hargaSatuan), 0);
        
        let discount = Number(form.getFieldValue('totalDiskon') || 0);

        // Jika mode otomatis, hitung diskon proporsional dari item
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

    // --- SIMPAN TRANSAKSI ---
    const handleSave = async (values) => {
        // Validasi: Harus ada item yang diretur
        const itemsToRetur = returItems.filter(i => i.qtyRetur > 0);
        if (itemsToRetur.length === 0) {
            message.error("Belum ada buku yang diretur (Qty masih 0)");
            return;
        }

        setIsSaving(true);
        message.loading({ content: 'Menyimpan Retur...', key: 'save' });

        try {
            // 1. Upload Bukti
            let buktiUrl = initialValues?.buktiUrl || null;
            const file = (values.bukti && values.bukti.length > 0) ? values.bukti[0].originFileObj : null;
            if (file) {
                const refFile = storageRef(storage, `bukti_retur/${uuidv4()}`);
                await uploadBytes(refFile, file);
                buktiUrl = await getDownloadURL(refFile);
            }

            const updates = {};
            const returId = initialValues?.id || generateReturId();
            const timestamp = values.tanggal.valueOf();
            const invoiceId = values.idTransaksi;

            // 2. Prepare Data Update Invoice & Stok
            const invRef = `transaksiJualBuku/${invoiceId}`;
            
            // Ambil data invoice terbaru untuk konsistensi
            const snap = await get(ref(db, invRef));
            if(!snap.exists()) throw new Error("Invoice hilang!");
            const invData = snap.val();

            let newTotalTagihan = 0; 
            let newTotalQty = 0;
            
            // Reconstruct Items Invoice (Kurangi Qty Beli sesuai Retur)
            const updatedInvItems = (invData.items || []).map(invItem => {
                const returItem = itemsToRetur.find(r => r.idBuku === invItem.idBuku);
                if (returItem) {
                    // Kurangi qty di invoice
                    return { ...invItem, jumlah: Number(invItem.jumlah) - Number(returItem.qtyRetur) };
                }
                return invItem;
            });

            // Hitung ulang tagihan invoice setelah barang dikurangi
            updatedInvItems.forEach(i => {
                const q = Number(i.jumlah);
                const h = Number(i.hargaSatuan);
                const d = Number(i.diskonPersen || 0);
                newTotalTagihan += (q * h * (1 - d/100));
                newTotalQty += q;
            });
            // Terapkan diskon global invoice jika ada
            newTotalTagihan = newTotalTagihan - (Number(invData.diskonLain||0)) + (Number(invData.biayaTentu||0));

            // Logic Saldo / Refund
            const currentPaid = Number(invData.jumlahTerbayar || 0);
            let refundAmount = 0;
            let newPaidAmount = currentPaid;

            if (currentPaid > newTotalTagihan) {
                refundAmount = currentPaid - newTotalTagihan;
                newPaidAmount = newTotalTagihan; // Balance invoice jadi Lunas pas
            }
            const newStatus = newPaidAmount >= newTotalTagihan ? 'Lunas' : 'Belum';

            // --- UPDATE BATCH ---
            // A. Update Invoice
            updates[`${invRef}/items`] = updatedInvItems;
            updates[`${invRef}/totalTagihan`] = newTotalTagihan;
            updates[`${invRef}/totalQty`] = newTotalQty;
            updates[`${invRef}/jumlahTerbayar`] = newPaidAmount;
            updates[`${invRef}/statusPembayaran`] = newStatus;
            updates[`${invRef}/updatedAt`] = { ".sv": "timestamp" };

            // B. Update Stok & History
            const itemsDetailRecord = [];
            for (const item of itemsToRetur) {
                // Catat detail untuk record mutasi
                itemsDetailRecord.push({
                    idBuku: item.idBuku,
                    judulBuku: item.judulBuku,
                    hargaSatuan: item.hargaSatuan,
                    qty: item.qtyRetur,
                    subtotal: item.qtyRetur * item.hargaSatuan
                });

                // Kembalikan Stok ke Gudang
                const bSnap = await get(ref(db, `buku/${item.idBuku}`));
                if(bSnap.exists()) {
                    const stokNow = Number(bSnap.val().stok || 0);
                    updates[`buku/${item.idBuku}/stok`] = stokNow + item.qtyRetur;
                    
                    // Log History Stok
                    const logId = push(ref(db, 'historiStok')).key;
                    updates[`historiStok/${logId}`] = {
                        bukuId: item.idBuku,
                        judul: item.judulBuku,
                        perubahan: item.qtyRetur, // Positif (nambah stok)
                        keterangan: `Retur Invoice ${invData.nomorInvoice}`,
                        refId: invoiceId,
                        timestamp: timestamp
                    };
                }
            }

            // C. Simpan Record (Retur)
            // Nominal di buku kas adalah NEGATIF (Pengeluaran/Refund)
            const nominalKeluar = refundAmount > 0 ? refundAmount : values.jumlah;

            const mutasiData = {
                id: returId,
                tipe: 'pengeluaran', // Selalu pengeluaran
                kategori: 'Retur Buku',
                tanggal: timestamp,
                jumlah: -Math.abs(nominalKeluar), // Negatif
                jumlahKeluar: Math.abs(nominalKeluar),
                
                idTransaksi: invoiceId,
                namaPelanggan: invData.namaPelanggan || 'Umum',
                keterangan: values.keterangan,
                buktiUrl: buktiUrl,
                
                // Detail Retur
                itemsReturDetail: itemsDetailRecord,
                itemsReturRingkas: itemsDetailRecord.map(i => `${i.judulBuku} (x${i.qty})`).join(', '),
                totalDiskon: values.totalDiskon,
                
                // Composite Key untuk Indexing Cepat
                index_kategori_tanggal: `Retur Buku_${timestamp}`
            };

            // Simpan di MUTASI (Kas Gabungan)
            updates[`mutasi/${returId}`] = mutasiData;
            
            // Simpan di HISTORI RETUR (Stream Khusus)
            updates[`historiRetur/${returId}`] = {
                ...mutasiData,
                refId: invoiceId,
                judul: itemsDetailRecord.map(i => i.judulBuku).join(', '),
                perubahan: itemsDetailRecord.reduce((a,b) => a + b.qty, 0),
                timestamp: timestamp
            };

            await update(ref(db), updates);
            
            message.success({ content: 'Retur berhasil diproses!', key: 'save' });
            onCancel();

            // Opsional: Trigger Print Nota Retur
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
            content: 'Stok buku akan ditarik kembali dan tagihan invoice dikembalikan seperti semula. Yakin?',
            okType: 'danger',
            onOk: async () => {
                setIsSaving(true);
                try {
                    const returId = initialValues.id;
                    const invoiceId = initialValues.idTransaksi;
                    const itemsDiretur = initialValues.itemsReturDetail || [];
                    const updates = {};

                    // 1. Hapus Mutasi & History
                    updates[`mutasi/${returId}`] = null;
                    updates[`historiRetur/${returId}`] = null;

                    // 2. Balikin Invoice & Stok
                    const invSnap = await get(ref(db, `transaksiJualBuku/${invoiceId}`));
                    if (invSnap.exists()) {
                        const invData = invSnap.val();
                        let updatedItems = [...(invData.items || [])];

                        // Kembalikan Qty Invoice & Tarik Stok
                        for (const rItem of itemsDiretur) {
                            const idx = updatedItems.findIndex(i => i.idBuku === rItem.idBuku);
                            if (idx >= 0) {
                                updatedItems[idx].jumlah = Number(updatedItems[idx].jumlah) + Number(rItem.qty);
                            }
                            
                            // Tarik stok dari gudang (krn batal retur -> barang dianggap terjual lagi)
                            const bSnap = await get(ref(db, `buku/${rItem.idBuku}`));
                            if (bSnap.exists()) {
                                const sNow = Number(bSnap.val().stok || 0);
                                updates[`buku/${rItem.idBuku}/stok`] = sNow - Number(rItem.qty);
                                updates[`buku/${rItem.idBuku}/updatedAt`] = { ".sv": "timestamp" };
                            }
                        }

                        // Recalculate Invoice Totals
                        let totalTagihan = 0; let totalQty = 0;
                        updatedItems.forEach(i => {
                            totalTagihan += (Number(i.jumlah) * Number(i.hargaSatuan) * (1 - (i.diskonPersen||0)/100));
                            totalQty += Number(i.jumlah);
                        });
                        totalTagihan = totalTagihan - (Number(invData.diskonLain||0)) + (Number(invData.biayaTentu||0));

                        // Reverse Refund (Uang yg sudah dikeluarin dianggap masuk lagi ke pembayaran invoice)
                        const refundYgDibatalkan = Math.abs(initialValues.jumlah || 0);
                        const paidBaru = Number(invData.jumlahTerbayar || 0) + refundYgDibatalkan;
                        const statusBaru = paidBaru >= totalTagihan ? 'Lunas' : 'Belum';

                        updates[`transaksiJualBuku/${invoiceId}/items`] = updatedItems;
                        updates[`transaksiJualBuku/${invoiceId}/totalTagihan`] = totalTagihan;
                        updates[`transaksiJualBuku/${invoiceId}/totalQty`] = totalQty;
                        updates[`transaksiJualBuku/${invoiceId}/jumlahTerbayar`] = paidBaru;
                        updates[`transaksiJualBuku/${invoiceId}/statusPembayaran`] = statusBaru;
                    }

                    await update(ref(db), updates);
                    message.success('Retur dibatalkan.');
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
                    // Highlight input jika ada nilai retur
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
                <Alert message="Retur akan mengembalikan stok buku ke gudang & mengurangi tagihan invoice." type="warning" showIcon style={{marginBottom: 20}} />
                
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
    listHeight={250} // Tambahan agar list lebih panjang
>
    {invoiceOptions.map(i => (
        <Option key={i.id} value={i.id}>
            {/* TAMPILAN BARU: Nama - No Invoice (Total Rp xxx) */}
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

                    {/* TABLE ITEM RETUR */}
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