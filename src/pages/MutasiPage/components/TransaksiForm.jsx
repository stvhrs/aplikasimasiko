import React, { useState, useEffect, useRef } from 'react';
import {
    Modal, Form, Input, InputNumber, DatePicker, Radio, Select, Upload, Button,
    Typography, Spin, message, Table, Divider, Row, Col, Empty, Tag
} from 'antd';
import { UploadOutlined, DeleteOutlined, SearchOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';

// IMPORT FIREBASE - Sesuaikan path ini dengan project Anda
import { db, storage } from '../../../api/firebase';
import { ref, push, update, get, query, orderByChild, equalTo } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { searchInvoices } from '../../../hooks/useFirebaseData';

const { Text } = Typography;
const { Option } = Select;

const TipeTransaksi = { pemasukan: 'pemasukan', pengeluaran: 'pengeluaran' };
const KategoriPemasukan = { 'Penjualan Buku': 'Penjualan Buku', 'Pemasukan Lain-lain': 'Pemasukan Lain-lain', 'Penjualan Sisa Kertas': 'Penjualan Sisa Kertas' };
const KategoriPengeluaran = { komisi: "Komisi", gaji_produksi: "Gaji Karyawan", operasional: "Operasional", retur_buku: "Retur Buku", pengeluaran_lain: "Pengeluaran Lain-lain" };
const INVOICE_RELATED_CATEGORIES = ['Penjualan Buku', 'Retur Buku'];

const currencyFormatter = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

const TransaksiForm = ({ open, onCancel, initialValues }) => {
    const [form] = Form.useForm();
    
    // Hook Modal Antd untuk konfirmasi delete
    const [modal, contextHolder] = Modal.useModal();

    const [fileList, setFileList] = useState([]);
    const [selectedTxnDetails, setSelectedTxnDetails] = useState(null);
    const [invoiceOptions, setInvoiceOptions] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeout = useRef(null);

    // State untuk Retur
    const [returItems, setReturItems] = useState([]); 
    const [summaryRetur, setSummaryRetur] = useState({ totalAwal: 0, totalRetur: 0, totalAkhir: 0 });

    const [isSaving, setIsSaving] = useState(false);

    const watchingTipe = Form.useWatch('tipe', form);
    const watchingKategori = Form.useWatch('kategori', form);

    const isInvoiceRelated = INVOICE_RELATED_CATEGORIES.includes(watchingKategori);
    const isReturMode = watchingKategori === 'Retur Buku';

    // --- 1. SETUP DATA AWAL (EDIT/NEW) ---
    useEffect(() => {
        if (!open) {
            resetFormState();
            return;
        }
        if (initialValues) {
            const currentJumlah = Math.abs(initialValues.jumlahBayar || initialValues.jumlah || 0);
            
            form.setFieldsValue({
                ...initialValues,
                tanggal: initialValues.tanggal ? dayjs(initialValues.tanggal) : dayjs(initialValues.tanggalBayar),
                jumlah: currentJumlah,
                kategori: initialValues.kategori || initialValues.tipeMutasi,
                tipe: initialValues.tipe || 'pemasukan'
            });

            if (initialValues.idTransaksi) {
                loadSingleInvoice(initialValues.idTransaksi, currentJumlah);
            }
            if (initialValues.buktiUrl) {
                setFileList([{ uid: '-1', name: 'File terlampir', status: 'done', url: initialValues.buktiUrl }]);
            }
        } else {
            form.resetFields();
            form.setFieldsValue({ tipe: TipeTransaksi.pemasukan, tanggal: dayjs(), kategori: 'Pemasukan Lain-lain' });
        }
    }, [initialValues, open, form]);

    useEffect(() => {
        if (open && isInvoiceRelated && !initialValues?.idTransaksi) {
            handleSearchInvoice("");
        }
    }, [watchingKategori, open]);

    const loadSingleInvoice = async (id, currentPaymentAmount) => {
        try {
            const snapshot = await get(ref(db, `transaksiJualBuku/${id}`));
            if (snapshot.exists()) {
                const data = { id: snapshot.key, ...snapshot.val() };
                setInvoiceOptions([data]);
                
                const adjustAmount = (initialValues?.tipeMutasi !== 'Retur Buku') ? currentPaymentAmount : 0;
                setSelectedTxnDetails({
                    ...data,
                    jumlahTerbayar: (data.jumlahTerbayar || 0) - adjustAmount
                });

                if (initialValues?.kategori === 'Retur Buku') {
                    const items = data.items || [];
                    // Saat edit, logika retur items mungkin perlu fetch history, 
                    // tapi untuk simplifikasi form, kita set 0 dulu
                    const mappedItems = items.map(item => ({ ...item, qtyRetur: 0 }));
                    setReturItems(mappedItems);
                }
            }
        } catch (e) { console.error(e); }
    };

    const resetFormState = () => {
        form.resetFields();
        setFileList([]);
        setSelectedTxnDetails(null);
        setInvoiceOptions([]);
        setReturItems([]);
        setSummaryRetur({ totalAwal: 0, totalRetur: 0, totalAkhir: 0 });
        setIsSearching(false);
    };

    // --- 2. LOGIC PENCARIAN & PILIH INVOICE ---
    const handleSearchInvoice = (value) => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        setIsSearching(true);
        if (!value) setInvoiceOptions([]);

        const delay = value ? 500 : 0;
        searchTimeout.current = setTimeout(async () => {
            const currentIsRetur = form.getFieldValue('kategori') === 'Retur Buku';
            const results = await searchInvoices(value, currentIsRetur);
            setInvoiceOptions(results);
            setIsSearching(false);
        }, delay);
    };

    const handleTipeChange = (e) => {
        const newTipe = e.target.value;
        form.setFieldsValue({
            kategori: newTipe === TipeTransaksi.pemasukan ? 'Pemasukan Lain-lain' : 'Operasional',
            idTransaksi: null, keterangan: null, jumlah: null
        });
        setSelectedTxnDetails(null); setInvoiceOptions([]); setReturItems([]);
    };

    const handleKategoriChange = () => {
        form.setFieldsValue({ idTransaksi: null, keterangan: null, jumlah: null });
        setSelectedTxnDetails(null); setInvoiceOptions([]); setReturItems([]);
    };

    const handleTxnSelect = (selectedId) => {
        const tx = invoiceOptions.find(t => t.id === selectedId);
        if (tx) {
            setSelectedTxnDetails(tx);
            if (isReturMode) {
                const items = tx.items || [];
                // Set qtyRetur awal 0
                const mappedItems = items.map(item => ({ ...item, qtyRetur: 0 }));
                setReturItems(mappedItems);
                setSummaryRetur({ totalAwal: tx.totalTagihan, totalRetur: 0, totalAkhir: tx.totalTagihan });
                form.setFieldsValue({
                    keterangan: `Retur buku dari invoice ${tx.nomorInvoice}`,
                    jumlah: 0,
                    tipeTransaksi: "Penjualan Buku",
                    tipe: TipeTransaksi.pengeluaran
                });
            } else {
                const sisaTagihan = tx.totalTagihan - tx.jumlahTerbayar;
                form.setFieldsValue({
                    keterangan: `Pembayaran invoice ${tx.nomorInvoice} (${tx.namaPelanggan})`,
                    jumlah: sisaTagihan,
                    tipeTransaksi: "Penjualan Buku"
                });
            }
        }
    };

    const handleQtyReturChange = (value, recordIndex) => {
        const newItems = [...returItems];
        const item = newItems[recordIndex];
        const maxQty = item.jumlah; // Jumlah saat ini di invoice
        const validQty = value > maxQty ? maxQty : (value < 0 ? 0 : value);
        
        newItems[recordIndex].qtyRetur = validQty;
        setReturItems(newItems);

        // Hitung Nominal Retur
        const nilaiReturTotal = newItems.reduce((acc, curr) => {
            const harga = curr.hargaSatuan || 0;
            const diskon = curr.diskonPersen || 0;
            const bersih = harga * (1 - diskon / 100);
            return acc + (curr.qtyRetur * bersih);
        }, 0);

        const totalAwal = selectedTxnDetails.totalTagihan;
        const totalAkhir = totalAwal - nilaiReturTotal;

        setSummaryRetur({ totalAwal, totalRetur: nilaiReturTotal, totalAkhir });
        form.setFieldsValue({ jumlah: nilaiReturTotal });
    };


    // ==========================================
    // LOGIC SIMPAN (UPDATE INVOICE ITEMS)
    // ==========================================
    const saveTransaction = async (values) => {
        setIsSaving(true);
        message.loading({ content: 'Menyimpan...', key: 'saving' });
        
        const { bukti, ...dataLain } = values;
        const buktiFile = (bukti && bukti.length > 0 && bukti[0].originFileObj) ? bukti[0].originFileObj : null;
        let buktiUrl = initialValues?.buktiUrl || null;

        try {
            if (buktiFile) {
                const safeKeterangan = (dataLain.keterangan || 'bukti').substring(0, 10).replace(/[^a-z0-9]/gi, '_');
                const fileRef = storageRef(storage, `bukti_mutasi/${safeKeterangan}-${uuidv4()}`);
                await uploadBytes(fileRef, buktiFile);
                buktiUrl = await getDownloadURL(fileRef);
            }

            const updates = {};
            const mutasiId = initialValues?.id || push(ref(db, 'mutasi')).key;
            const timestampNow = dayjs(dataLain.tanggal).valueOf();

            // A. JIKA KATEGORI RETUR BUKU
            if (dataLain.kategori === 'Retur Buku') {
                const invoiceRefPath = `transaksiJualBuku/${dataLain.idTransaksi}`;
                const invoiceSnapshot = await get(ref(db, invoiceRefPath));
                if (!invoiceSnapshot.exists()) throw new Error("Invoice tidak ditemukan!");
                
                const originalInvoice = invoiceSnapshot.val();
                
                // 1. Update Items di Invoice (Kurangi Qty)
                let newTotalTagihan = 0;
                let newTotalQty = 0;
                
                const updatedItems = (originalInvoice.items || []).map(item => {
                    const returInfo = returItems.find(r => r.idBuku === item.idBuku);
                    if (returInfo && returInfo.qtyRetur > 0) {
                        // Kurangi jumlah item di invoice
                        return { ...item, jumlah: Number(item.jumlah) - Number(returInfo.qtyRetur) };
                    }
                    return item;
                });

                // 2. Hitung Ulang Total Tagihan Invoice
                updatedItems.forEach(item => {
                    const qty = Number(item.jumlah);
                    const harga = Number(item.hargaSatuan);
                    const diskon = Number(item.diskonPersen || 0);
                    const subtotal = qty * harga * (1 - diskon / 100);
                    
                    newTotalTagihan += subtotal;
                    newTotalQty += qty;
                });

                const diskonLain = Number(originalInvoice.diskonLain || 0);
                const biayaTentu = Number(originalInvoice.biayaTentu || 0);
                const finalTotalTagihan = newTotalTagihan - diskonLain + biayaTentu;
                
                // 3. Cek Status Pembayaran
                const existingPaid = Number(originalInvoice.jumlahTerbayar || 0);
                const newStatus = existingPaid >= finalTotalTagihan ? 'Lunas' : 'Belum';

                // Masukkan update invoice ke objek updates
                updates[`${invoiceRefPath}/items`] = updatedItems;
                updates[`${invoiceRefPath}/totalTagihan`] = finalTotalTagihan;
                updates[`${invoiceRefPath}/totalQty`] = newTotalQty;
                updates[`${invoiceRefPath}/statusPembayaran`] = newStatus;
                updates[`${invoiceRefPath}/updatedAt`] = { ".sv": "timestamp" };

                // 4. Update Stok & Log Histori
                for (const itemRetur of returItems) {
                    if (itemRetur.qtyRetur > 0) {
                        const bukuSnapshot = await get(ref(db, `buku/${itemRetur.idBuku}`));
                        if (bukuSnapshot.exists()) {
                            const bukuData = bukuSnapshot.val();
                            const stokSekarang = Number(bukuData.stok || 0);
                            const stokBaru = stokSekarang + itemRetur.qtyRetur; // Tambah stok

                            updates[`buku/${itemRetur.idBuku}/stok`] = stokBaru;
                            
                            const logKey = push(ref(db, 'historiStok')).key;
                            updates[`historiStok/${logKey}`] = {
                                bukuId: itemRetur.idBuku,
                                judul: bukuData.judul,
                                perubahan: itemRetur.qtyRetur,
                                stokSebelum: stokSekarang,
                                stokSesudah: stokBaru,
                                keterangan: `Retur Invoice ${originalInvoice.nomorInvoice}`,
                                refId: dataLain.idTransaksi,
                                timestamp: timestampNow // Penting untuk delete nanti
                            };
                        }
                    }
                }

                // 5. Simpan Data Mutasi
                const refundAmount = Number(dataLain.jumlah);
                updates[`mutasi/${mutasiId}`] = {
                    idTransaksi: dataLain.idTransaksi,
                    tipeTransaksi: "Penjualan Buku",
                    jumlahKeluar: refundAmount,
                    tanggal: timestampNow,
                    tipeMutasi: 'Retur Buku',
                    keterangan: dataLain.keterangan,
                    buktiUrl,
                    tipe: TipeTransaksi.pengeluaran,
                    kategori: 'Retur Buku',
                    jumlah: -Math.abs(refundAmount),
                    nilaiBarangRetur: summaryRetur.totalRetur,
                    itemsReturRingkas: returItems.filter(i=>i.qtyRetur>0).map(i=> `${i.judulBuku} (x${i.qtyRetur})`).join(', ')
                };

            } 
            // B. JIKA PEMBAYARAN BIASA
            else if (dataLain.idTransaksi) {
                const newPaymentAmount = Number(dataLain.jumlah);
                const mutasiData = {
                    idTransaksi: dataLain.idTransaksi,
                    tipeTransaksi: "Penjualan Buku",
                    jumlahBayar: newPaymentAmount,
                    tanggalBayar: timestampNow,
                    tipeMutasi: dataLain.kategori,
                    keterangan: dataLain.keterangan,
                    buktiUrl,
                    tipe: TipeTransaksi.pemasukan,
                    kategori: dataLain.kategori,
                    jumlah: newPaymentAmount,
                    tanggal: timestampNow
                };
                updates[`mutasi/${mutasiId}`] = mutasiData;

                const invoiceRef = ref(db, `transaksiJualBuku/${dataLain.idTransaksi}`);
                const invoiceSnapshot = await get(invoiceRef);
                
                if (invoiceSnapshot.exists()) {
                    const invoiceData = invoiceSnapshot.val();
                    let currentPaid = (invoiceData.jumlahTerbayar || 0) + newPaymentAmount;
                    let currentHistory = invoiceData.riwayatPembayaran || {};
                    currentHistory[mutasiId] = {
                        tanggal: timestampNow,
                        jumlah: newPaymentAmount,
                        mutasiId: mutasiId,
                        keterangan: mutasiData.keterangan
                    };

                    let newStatus = currentPaid >= invoiceData.totalTagihan ? 'Lunas' : 'Belum';
                    
                    updates[`transaksiJualBuku/${dataLain.idTransaksi}/jumlahTerbayar`] = currentPaid;
                    updates[`transaksiJualBuku/${dataLain.idTransaksi}/riwayatPembayaran`] = currentHistory;
                    updates[`transaksiJualBuku/${dataLain.idTransaksi}/statusPembayaran`] = newStatus;
                }
            } 
            // C. TRANSAKSI UMUM
            else {
                const jumlah = dataLain.tipe === TipeTransaksi.pengeluaran ? -Math.abs(Number(dataLain.jumlah)) : Number(dataLain.jumlah);
                updates[`mutasi/${mutasiId}`] = {
                    jumlah, kategori: dataLain.kategori, keterangan: dataLain.keterangan,
                    tanggal: timestampNow, tipe: dataLain.tipe, buktiUrl, tipeMutasi: dataLain.kategori
                };
            }

            await update(ref(db), updates);
            message.success({ content: 'Berhasil!', key: 'saving' });
            onCancel();
        } catch (error) {
            console.error(error);
            message.error({ content: `Gagal: ${error.message}`, key: 'saving' });
        } finally {
            setIsSaving(false);
        }
    };


    // ==========================================
    // LOGIC DELETE (RESTORE INVOICE ITEMS)
    // ==========================================
    const handleDelete = () => {
        if (!initialValues || !initialValues.id) {
            message.error("Gagal: ID Transaksi tidak ditemukan.");
            return;
        }

        modal.confirm({
            title: 'Hapus Transaksi?',
            icon: <ExclamationCircleOutlined />,
            content: 'Jika ini Retur, item akan dikembalikan ke Invoice dan Stok akan ditarik kembali. Yakin?',
            okText: 'Ya, Hapus Permanen',
            okType: 'danger',
            cancelText: 'Batal',
            onOk: async () => {
                setIsSaving(true);
                try {
                    const mutasiId = initialValues.id;
                    const invoiceId = initialValues.idTransaksi;
                    const mutasiTimestamp = Number(initialValues.tanggal);

                    const updates = {};
                    updates[`mutasi/${mutasiId}`] = null;

                    // 1. ROLLBACK RETUR BUKU
                    if (initialValues.kategori === 'Retur Buku' && invoiceId) {
                        
                        // Cari log stok untuk mengetahui apa yg diretur dulu
                        const historyQuery = query(ref(db, 'historiStok'), orderByChild('timestamp'), equalTo(mutasiTimestamp));
                        const historySnap = await get(historyQuery);
                        const invoiceRef = ref(db, `transaksiJualBuku/${invoiceId}`);
                        const invoiceSnap = await get(invoiceRef);

                        if (invoiceSnap.exists() && historySnap.exists()) {
                            const invData = invoiceSnap.val();
                            const historyData = historySnap.val();
                            
                            // A. Pulihkan Items Invoice
                            let updatedItems = [...(invData.items || [])];
                            let restorationLog = [];

                            Object.keys(historyData).forEach(histKey => {
                                const log = historyData[histKey];
                                const bukuId = log.bukuId;
                                const qtyYangDuluDiretur = Number(log.perubahan); // Angka positif

                                restorationLog.push({ bukuId, qty: qtyYangDuluDiretur });

                                const itemIndex = updatedItems.findIndex(i => i.idBuku === bukuId);
                                if (itemIndex !== -1) {
                                    // Tambahkan qty kembali ke invoice
                                    updatedItems[itemIndex].jumlah = Number(updatedItems[itemIndex].jumlah) + qtyYangDuluDiretur;
                                }
                            });

                            // B. Hitung Ulang Total Tagihan
                            let recountTotalTagihan = 0;
                            let recountTotalQty = 0;
                            updatedItems.forEach(item => {
                                const q = Number(item.jumlah);
                                const h = Number(item.hargaSatuan);
                                const d = Number(item.diskonPersen || 0);
                                recountTotalTagihan += (q * h * (1 - d / 100));
                                recountTotalQty += q;
                            });
                            recountTotalTagihan = recountTotalTagihan - (Number(invData.diskonLain || 0)) + (Number(invData.biayaTentu || 0));

                            // C. Status Pembayaran
                            const terbayar = Number(invData.jumlahTerbayar || 0);
                            const newStatus = terbayar >= recountTotalTagihan ? 'Lunas' : 'Belum';

                            updates[`transaksiJualBuku/${invoiceId}/items`] = updatedItems;
                            updates[`transaksiJualBuku/${invoiceId}/totalTagihan`] = recountTotalTagihan;
                            updates[`transaksiJualBuku/${invoiceId}/totalQty`] = recountTotalQty;
                            updates[`transaksiJualBuku/${invoiceId}/statusPembayaran`] = newStatus;

                            // D. Tarik Stok Kembali (Kurangi Stok) & Hapus Log
                            for (const rec of restorationLog) {
                                const bukuSnap = await get(ref(db, `buku/${rec.bukuId}`));
                                if (bukuSnap.exists()) {
                                    const stokSekarang = Number(bukuSnap.val().stok || 0);
                                    updates[`buku/${rec.bukuId}/stok`] = stokSekarang - rec.qty;
                                }
                            }
                            Object.keys(historyData).forEach(k => updates[`historiStok/${k}`] = null);
                        }
                    }

                    // 2. ROLLBACK PEMBAYARAN BIASA
                    else if (invoiceId) {
                        const invoiceRef = ref(db, `transaksiJualBuku/${invoiceId}`);
                        const invoiceSnap = await get(invoiceRef);
                        if (invoiceSnap.exists()) {
                            const invData = invoiceSnap.val();
                            const nominalBayarDihapus = Math.abs(initialValues.jumlah || 0);
                            const currentPaid = invData.jumlahTerbayar || 0;

                            const newPaid = currentPaid - nominalBayarDihapus;
                            const finalPaid = newPaid < 0 ? 0 : newPaid;
                            const newStatus = finalPaid >= (invData.totalTagihan||0) ? 'Lunas' : 'Belum';

                            updates[`transaksiJualBuku/${invoiceId}/jumlahTerbayar`] = finalPaid;
                            updates[`transaksiJualBuku/${invoiceId}/statusPembayaran`] = newStatus;
                            updates[`transaksiJualBuku/${invoiceId}/riwayatPembayaran/${mutasiId}`] = null;
                        }
                    }

                    await update(ref(db), updates);
                    message.success('Transaksi dihapus & data dipulihkan.');
                    onCancel();
                } catch (error) {
                    console.error("Delete Error:", error);
                    message.error(`Gagal menghapus: ${error.message}`);
                } finally {
                    setIsSaving(false);
                }
            }
        });
    };

    const handleOk = () => {
        form.validateFields().then(values => saveTransaction(values)).catch(info => console.log('Validate Failed:', info));
    };

    const returColumns = [
        { title: 'Buku', dataIndex: 'judulBuku', key: 'judul', render: (text) => <Text strong>{text}</Text> },
        { title: 'Harga', key: 'harga', render: (_, r) => currencyFormatter(r.hargaSatuan * (1 - (r.diskonPersen || 0) / 100)) },
        { title: 'Beli', dataIndex: 'jumlah', key: 'qtyBeli', width: 60, align: 'center' },
        { title: 'Retur', key: 'qtyRetur', width: 90, render: (_, r, i) => <InputNumber min={0} max={r.jumlah} value={r.qtyRetur} onChange={(v) => handleQtyReturChange(v, i)} size="small" /> },
        { title: 'Subtotal', key: 'subtotal', align: 'right', render: (_, r) => currencyFormatter(r.qtyRetur * (r.hargaSatuan * (1 - (r.diskonPersen || 0) / 100))) }
    ];

    return (
        <>
            {contextHolder}
            <Modal
                open={open}
                title={initialValues ? 'Edit Transaksi' : 'Tambah Transaksi'}
                onCancel={onCancel}
                width={isReturMode ? 850 : 520}
                footer={[
                    initialValues && (
                        <Button key="del" danger onClick={handleDelete} loading={isSaving} icon={<DeleteOutlined />}>Hapus</Button>
                    ),
                    <Button key="back" onClick={onCancel} disabled={isSaving}>Batal</Button>,
                    <Button key="submit" type="primary" loading={isSaving} onClick={handleOk}>Simpan</Button>
                ]}
            >
                <Form form={form} layout="vertical">
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="tanggal" label="Tanggal">
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="tipe" label="Tipe">
                                <Radio.Group onChange={handleTipeChange} disabled={!!initialValues?.idTransaksi || isReturMode} buttonStyle="solid">
                                    <Radio.Button value="pemasukan">Masuk</Radio.Button>
                                    <Radio.Button value="pengeluaran">Keluar</Radio.Button>
                                </Radio.Group>
                            </Form.Item>
                        </Col>
                    </Row>
                    
                    <Form.Item name="kategori" label="Kategori">
                        <Select onChange={handleKategoriChange} disabled={!!initialValues?.idTransaksi}>
                            {(watchingTipe === 'pemasukan' ? Object.entries(KategoriPemasukan) : Object.entries(KategoriPengeluaran)).map(([k, v]) => (
                                <Option key={k} value={v}>{v}</Option>
                            ))}
                        </Select>
                    </Form.Item>

                    {isInvoiceRelated && (
                        <>
                            <Form.Item
                                name="idTransaksi"
                                label={isReturMode ? "Cari Invoice (Semua Status)" : "Cari Invoice (Hanya 'Belum')"}
                                rules={[{ required: true, message: 'Pilih Invoice' }]}
                            >
                                <Select
                                    showSearch
                                    placeholder="Ketik nama pelanggan / no invoice..."
                                    onSelect={handleTxnSelect}
                                    onSearch={handleSearchInvoice}
                                    filterOption={false}
                                    notFoundContent={isSearching ? <div style={{ padding: 10, textAlign: 'center' }}><Spin size="small" tip=" Memuat Data..." /></div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Data tidak ditemukan" />}
                                    disabled={!!initialValues?.idTransaksi}
                                    style={{ width: '100%' }}
                                    suffixIcon={<SearchOutlined />}
                                    listHeight={280}
                                    optionLabelProp="label"
                                >
                                    {invoiceOptions.map(tx => (
                                        <Option key={tx.id} value={tx.id} label={`${tx.namaPelanggan} - ${tx.nomorInvoice}`}>
                                            <div style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                    <Text strong style={{ fontSize: 15 }}>{tx.namaPelanggan}</Text>
                                                    <Tag color="blue">{tx.nomorInvoice}</Tag>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(tx.tanggal).format('DD MMM YYYY')}</Text>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <Text style={{ fontSize: 13, marginRight: 8 }}>Tagihan: {currencyFormatter(tx.totalTagihan)}</Text>
                                                        {tx.statusPembayaran === 'Lunas' ? <Tag color="success">Lunas</Tag> : <Tag color="warning">Belum</Tag>}
                                                    </div>
                                                </div>
                                            </div>
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            <Form.Item name="tipeTransaksi" hidden><Input /></Form.Item>
                            
                            {isReturMode && selectedTxnDetails && (
                                <div style={{ marginBottom: 16 }}>
                                    <Table dataSource={returItems} columns={returColumns} pagination={false} size="small" scroll={{ y: 200 }} bordered />
                                </div>
                            )}

                            {!isReturMode && selectedTxnDetails && (
                                <div style={{ background: '#fff', border: '1px solid #d9d9d9', borderRadius: 8, padding: 16, marginBottom: 24 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <Text type="secondary">Total Tagihan</Text>
                                        <Text strong style={{ fontSize: 16 }}>{currencyFormatter(selectedTxnDetails.totalTagihan)}</Text>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <Text type="secondary">Sudah Dibayar</Text>
                                        <Text style={{ color: '#52c41a', fontSize: 15 }}>{currencyFormatter(selectedTxnDetails.jumlahTerbayar)}</Text>
                                    </div>
                                    <Divider style={{ margin: '8px 0' }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Text strong>Sisa Tagihan</Text>
                                        <Text strong style={{ color: '#cf1322', fontSize: 18 }}>
                                            {currencyFormatter(selectedTxnDetails.totalTagihan - selectedTxnDetails.jumlahTerbayar)}
                                        </Text>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <Form.Item name="keterangan" label="Keterangan">
                        <Input.TextArea rows={2} placeholder="Tambahkan catatan..." />
                    </Form.Item>
                    <Form.Item name="jumlah" label="Nominal">
                        <InputNumber style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={v => v.replace(/[^\d]/g, '')} prefix="Rp" />
                    </Form.Item>
                    <Form.Item name="bukti" label="Bukti" valuePropName="fileList" getValueFromEvent={e => Array.isArray(e) ? e : e && e.fileList}>
                        <Upload maxCount={1} beforeUpload={() => false} listType="text">
                            <Button icon={<UploadOutlined />}>Upload</Button>
                        </Upload>
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
};

export default TransaksiForm;