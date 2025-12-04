import React, { useState, useEffect, useRef } from 'react';
import {
    Modal, Form, Input, InputNumber, DatePicker, Radio, Select, Upload, Button,
    Typography, Spin, message, Table, Divider, Row, Col, Empty, Tag
} from 'antd';
import { UploadOutlined, DeleteOutlined, PrinterOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';

// IMPORT FIREBASE - Sesuaikan path dengan project Anda
import { db, storage } from '../../../api/firebase';
import { ref, push, update, get, query, orderByChild, equalTo, limitToLast, startAt, endAt } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

// IMPORT PDF GENERATOR
import { generateNotaReturPDF } from '../../../utils/notaretur'; 
// Jika Anda punya file terpisah untuk Nota Pembayaran, import di sini juga
import { generateNotaPembayaranPDF } from '../../../utils/notamutasipembayaran';

const { Text } = Typography;
const { Option } = Select;

// --- KONSTANTA ---
const TipeTransaksi = { pemasukan: 'pemasukan', pengeluaran: 'pengeluaran' };

const KategoriPemasukan = { 
    'Penjualan Buku': 'Penjualan Buku', 
    'Pemasukan Lain-lain': 'Pemasukan Lain-lain', 
    'Penjualan Sisa Kertas': 'Penjualan Sisa Kertas' 
};

const KategoriPengeluaran = { 
    komisi: "Komisi", 
    gaji_produksi: "Gaji Karyawan", 
    operasional: "Operasional", 
    retur_buku: "Retur Buku", 
    pengeluaran_lain: "Pengeluaran Lain-lain" 
};

const INVOICE_RELATED_CATEGORIES = ['Penjualan Buku', 'Retur Buku'];

const currencyFormatter = (value) => 
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

// --- HELPER: GENERATOR ID ---
const generateTransactionId = (kategori) => {
    let prefix = 'TRX';
    switch (kategori) {
        case 'Penjualan Buku': prefix = 'PJ'; break;
        case 'Retur Buku': prefix = 'RT'; break;
        default: prefix = 'XX';
    }
    const dateCode = dayjs().format('YYYYMMDD');
    const uniquePart = Math.random().toString(36).substring(2, 6).toUpperCase(); 
    return `${prefix}-${dateCode}-${uniquePart}`;
};

// --- HELPER: PRINT NOTA RETUR (Preview HTML Fallback / Button Action) ---
// Fungsi ini akan dipanggil di Modal.confirm setelah save berhasil
const printNotaReturAction = (dataMutasi, originalInvoice) => {
    // Panggil fungsi generator PDF yang sudah diimport
    // Data mutasi sudah mengandung itemsReturDetail lengkap
    const pdfDataUrl = generateNotaReturPDF({
        ...dataMutasi,
        nomorInvoice: originalInvoice.nomorInvoice, // Inject nomor invoice asal
        namaPelanggan: originalInvoice.namaPelanggan // Inject nama pelanggan
    });

    // Buka PDF di tab baru / iframe print
    const printWindow = window.open('');
    printWindow.document.write(
        `<iframe width='100%' height='100%' src='${pdfDataUrl}'></iframe>`
    );
};


const TransaksiForm = ({ open, onCancel, initialValues }) => {
    const [form] = Form.useForm();
    const [modal, contextHolder] = Modal.useModal();
    const [fileList, setFileList] = useState([]);
    
    // State Data Invoice
    const [invoiceOptions, setInvoiceOptions] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeout = useRef(null);

    // State Pembayaran & Retur
    const [selectedInvoices, setSelectedInvoices] = useState([]); 
    const [selectedReturInvoice, setSelectedReturInvoice] = useState(null);
    const [returItems, setReturItems] = useState([]); 
    const [summaryRetur, setSummaryRetur] = useState({ totalAwal: 0, totalRetur: 0, totalAkhir: 0 });
    
    const [isManualDiskon, setIsManualDiskon] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const watchingTipe = Form.useWatch('tipe', form);
    const watchingKategori = Form.useWatch('kategori', form);

    const isInvoiceRelated = INVOICE_RELATED_CATEGORIES.includes(watchingKategori);
    const isReturMode = watchingKategori === 'Retur Buku';

    // --- SETUP DATA ---
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
                totalDiskon: initialValues.totalDiskon || 0, 
                kategori: initialValues.kategori || initialValues.tipeMutasi,
                tipe: initialValues.tipe || 'pemasukan'
            });

            if (initialValues.totalDiskon !== undefined) {
                setIsManualDiskon(true);
            }

            if (initialValues.idTransaksi) {
                const idsToLoad = Array.isArray(initialValues.idTransaksi) ? initialValues.idTransaksi : [initialValues.idTransaksi];
                loadInvoicesForEdit(idsToLoad, initialValues);
            }
            if (initialValues.buktiUrl) {
                setFileList([{ uid: '-1', name: 'File terlampir', status: 'done', url: initialValues.buktiUrl }]);
            }
        } else {
            form.resetFields();
            form.setFieldsValue({ tipe: TipeTransaksi.pemasukan, tanggal: dayjs(), kategori: 'Penjualan Buku', totalDiskon: 0 });
        }
    }, [initialValues, open, form]);

    useEffect(() => {
        if (open && isInvoiceRelated && !initialValues?.idTransaksi) {
            handleSearchInvoice(""); 
        }
    }, [open, watchingKategori]); 

    const resetFormState = () => {
        form.resetFields();
        setFileList([]);
        setSelectedInvoices([]);
        setSelectedReturInvoice(null);
        setInvoiceOptions([]);
        setReturItems([]);
        setSummaryRetur({ totalAwal: 0, totalRetur: 0, totalAkhir: 0 });
        setIsManualDiskon(false);
        setIsSearching(false);
    };

    const loadInvoicesForEdit = async (ids, editData) => {
        try {
            const loadedInvoices = [];
            for (const id of ids) {
                const snapshot = await get(ref(db, `transaksiJualBuku/${id}`));
                if (snapshot.exists()) {
                    loadedInvoices.push({ id: snapshot.key, ...snapshot.val() });
                }
            }
            setInvoiceOptions(loadedInvoices);

            // A. MODE RETUR (EDIT)
            if (editData.kategori === 'Retur Buku' && loadedInvoices.length > 0) {
                const data = loadedInvoices[0];
                setSelectedReturInvoice(data);
                
                // Load items detail dari database
                const savedReturDetail = editData.itemsReturDetail || [];
                const items = data.items || [];
                
                const mappedItems = items.map(item => {
                    // Match by idBuku
                    const savedItem = savedReturDetail.find(saved => saved.idBuku === item.idBuku);
                    return { 
                        ...item, 
                        qtyRetur: savedItem ? savedItem.qty : 0 
                    };
                });
                setReturItems(mappedItems);
                
                const grossRetur = mappedItems.reduce((acc, curr) => acc + (curr.qtyRetur * curr.hargaSatuan), 0);
                const discountRetur = editData.totalDiskon || 0;
                
                setSummaryRetur({ 
                    totalAwal: data.totalTagihan, 
                    totalRetur: grossRetur - discountRetur, 
                    totalAkhir: data.totalTagihan - (grossRetur - discountRetur) 
                });
            } 
            // B. MODE PENJUALAN (EDIT)
            else {
                const mapped = loadedInvoices.map(inv => {
                    let savedAmount = 0;
                    if (editData.detailAlokasi && editData.detailAlokasi[inv.id]) {
                        const detail = editData.detailAlokasi[inv.id];
                        savedAmount = typeof detail === 'object' ? detail.amount : detail;
                    } else if (editData.idTransaksi === inv.id) {
                        savedAmount = Math.abs(editData.jumlahBayar || editData.jumlah || 0);
                    }
                    return {
                        ...inv,
                        sisaTagihan: (inv.totalTagihan || 0) - (inv.jumlahTerbayar || 0),
                        alokasiBayar: savedAmount 
                    };
                });
                setSelectedInvoices(mapped);
            }
        } catch (e) { console.error(e); }
    };

    // --- SEARCH LOGIC ---
    const handleSearchInvoice = (value) => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        setIsSearching(true); 
        searchTimeout.current = setTimeout(async () => {
            try {
                const currentIsRetur = form.getFieldValue('kategori') === 'Retur Buku';
                const targetStatus = currentIsRetur ? 'Lunas' : 'Belum';
                const keywordRaw = value ? value.trim() : "";
                const keyword = keywordRaw.toUpperCase(); 

                let results = [];

                if (!keyword) {
                    const qDefault = query(ref(db, 'transaksiJualBuku'), orderByChild('statusPembayaran'), equalTo(targetStatus), limitToLast(20));
                    const snap = await get(qDefault);
                    if (snap.exists()) results = Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] }));
                } else {
                    const qNama = query(ref(db, 'transaksiJualBuku'), orderByChild('namaPelanggan'), startAt(keyword), endAt(keyword + "\uf8ff"));
                    const snapNama = await get(qNama);
                    let foundInName = false;

                    if (snapNama.exists()) {
                        const rawData = snapNama.val();
                        const filtered = Object.keys(rawData).map(k => ({ id: k, ...rawData[k] })).filter(item => item.statusPembayaran === targetStatus);
                        if (filtered.length > 0) { results = filtered; foundInName = true; }
                    }

                    if (!foundInName) {
                        const qInv = query(ref(db, 'transaksiJualBuku'), orderByChild('nomorInvoice'), startAt(keyword), endAt(keyword + "\uf8ff"), limitToLast(20));
                        const snapInv = await get(qInv);
                        if (snapInv.exists()) {
                             const rawData = snapInv.val();
                             results = Object.keys(rawData).map(k => ({ id: k, ...rawData[k] })).filter(item => item.statusPembayaran === targetStatus);
                        }
                    }
                }

                results.sort((a, b) => b.tanggal - a.tanggal);
                if (results.length === 0 && keyword) message.warning("Data tidak ditemukan.");

                setInvoiceOptions(prev => {
                    const newIds = new Set(results.map(r => r.id));
                    const keepSelected = prev.filter(p => !newIds.has(p.id) && (
                        selectedInvoices.find(s => s.id === p.id) || (selectedReturInvoice?.id === p.id)
                    ));
                    return [...keepSelected, ...results];
                });
            } catch (error) { console.error(error); message.error("Gagal search: " + error.message); } 
            finally { setIsSearching(false); }
        }, 500); 
    };

    // UI Handlers
    const handleTipeChange = (e) => {
        const newTipe = e.target.value;
        form.setFieldsValue({ kategori: newTipe === TipeTransaksi.pemasukan ? 'Pemasukan Lain-lain' : 'Operasional', idTransaksi: [], keterangan: null, jumlah: null, totalDiskon: 0 });
        setSelectedInvoices([]); setSelectedReturInvoice(null); setIsManualDiskon(false);
    };
    const handleKategoriChange = () => {
        form.setFieldsValue({ idTransaksi: [], keterangan: null, jumlah: null, totalDiskon: 0 });
        setSelectedInvoices([]); setSelectedReturInvoice(null); setIsManualDiskon(false);
    };
    const handleMultiTxnSelect = (selectedIds) => {
        const currentIds = Array.isArray(selectedIds) ? selectedIds : [selectedIds];
        const selectedObjects = invoiceOptions.filter(opt => currentIds.includes(opt.id));
        const newSelectionState = selectedObjects.map(inv => {
            const existing = selectedInvoices.find(s => s.id === inv.id);
            const sisa = (inv.totalTagihan || 0) - (inv.jumlahTerbayar || 0);
            return { ...inv, sisaTagihan: sisa, alokasiBayar: existing ? existing.alokasiBayar : (sisa > 0 ? sisa : 0) };
        });
        setSelectedInvoices(newSelectionState);
        const totalBayar = newSelectionState.reduce((acc, curr) => acc + curr.alokasiBayar, 0);
        form.setFieldsValue({ jumlah: totalBayar });
        if(newSelectionState.length === 1) form.setFieldsValue({ keterangan: `Pembayaran invoice ${newSelectionState[0].nomorInvoice}`});
        else if (newSelectionState.length > 1) form.setFieldsValue({ keterangan: `Pembayaran ${newSelectionState.length} invoice`});
    };
    const handleAlokasiChange = (val, invoiceId) => {
        const newInvoices = selectedInvoices.map(inv => { if (inv.id === invoiceId) return { ...inv, alokasiBayar: val }; return inv; });
        setSelectedInvoices(newInvoices);
        const total = newInvoices.reduce((acc, curr) => acc + (curr.alokasiBayar || 0), 0);
        form.setFieldsValue({ jumlah: total });
    };
    const handleReturSelect = (id) => {
        const tx = invoiceOptions.find(t => t.id === id);
        if (tx) {
            setSelectedReturInvoice(tx);
            const items = tx.items || [];
            setReturItems(items.map(item => ({ ...item, qtyRetur: 0 })));
            setSummaryRetur({ totalAwal: tx.totalTagihan, totalRetur: 0, totalAkhir: tx.totalTagihan });
            form.setFieldsValue({ keterangan: `Retur buku dari invoice ${tx.nomorInvoice}`, jumlah: 0, totalDiskon: 0, tipeTransaksi: "Penjualan Buku" });
            setIsManualDiskon(false);
        }
    };
    const handleTotalDiskonChange = (value) => {
        setIsManualDiskon(true);
        const items = returItems;
        const grossTotal = items.reduce((acc, curr) => acc + (curr.qtyRetur * curr.hargaSatuan), 0);
        const netTotal = grossTotal - value;
        form.setFieldsValue({ jumlah: netTotal });
        setSummaryRetur(prev => ({ ...prev, totalRetur: netTotal, totalAkhir: prev.totalAwal - netTotal }));
    };
    const handleQtyReturChange = (value, recordIndex) => {
        const newItems = [...returItems];
        const item = newItems[recordIndex];
        const validQty = value > item.jumlah ? item.jumlah : (value < 0 ? 0 : value);
        newItems[recordIndex].qtyRetur = validQty;
        setReturItems(newItems);
        const grossTotal = newItems.reduce((acc, curr) => acc + (curr.qtyRetur * curr.hargaSatuan), 0);
        let diskonVal = form.getFieldValue('totalDiskon') || 0;
        if (!isManualDiskon) {
            diskonVal = newItems.reduce((acc, curr) => {
                const itemGross = curr.qtyRetur * curr.hargaSatuan;
                const itemDisc = itemGross * ((curr.diskonPersen || 0) / 100);
                return acc + itemDisc;
            }, 0);
            form.setFieldsValue({ totalDiskon: diskonVal });
        }
        const netTotal = grossTotal - diskonVal;
        const totalAwal = selectedReturInvoice.totalTagihan;
        const totalAkhir = totalAwal - netTotal;
        setSummaryRetur({ totalAwal, totalRetur: netTotal, totalAkhir });
        form.setFieldsValue({ jumlah: netTotal });
    };

    // --- DELETE LOGIC ---
    const handleDelete = () => {
        Modal.confirm({
            title: 'Hapus Transaksi?', icon: <ExclamationCircleOutlined />, content: 'Tindakan ini akan membatalkan dampak transaksi. Yakin?', okText: 'Ya, Hapus', okType: 'danger', cancelText: 'Batal',
            onOk: async () => {
                setIsSaving(true);
                try {
                    const mutasiId = initialValues.id;
                    const updates = {};
                    updates[`mutasi/${mutasiId}`] = null; 

                    // A. ROLLBACK RETUR
                    if (initialValues.kategori === 'Retur Buku' && initialValues.idTransaksi) {
                        const invoiceId = initialValues.idTransaksi;
                        const mutasiTimestamp = initialValues.tanggal;
                        const historyQuery = query(ref(db, 'historiStok'), orderByChild('timestamp'), equalTo(mutasiTimestamp));
                        const historySnap = await get(historyQuery);
                        const invoiceRef = ref(db, `transaksiJualBuku/${invoiceId}`);
                        const invoiceSnap = await get(invoiceRef);

                        if (invoiceSnap.exists() && historySnap.exists()) {
                            const invData = invoiceSnap.val();
                            const historyData = historySnap.val();
                            
                            let updatedItems = [...(invData.items || [])];
                            let restorationLog = [];
                            Object.values(historyData).forEach(log => {
                                restorationLog.push({ bukuId: log.bukuId, qty: Number(log.perubahan) });
                                const itemIndex = updatedItems.findIndex(i => i.idBuku === log.bukuId);
                                if (itemIndex !== -1) updatedItems[itemIndex].jumlah = Number(updatedItems[itemIndex].jumlah) + Number(log.perubahan);
                            });

                            let newTotalTagihan = 0; let newTotalQty = 0;
                            updatedItems.forEach(item => {
                                const q = Number(item.jumlah); const h = Number(item.hargaSatuan); const d = Number(item.diskonPersen || 0);
                                newTotalTagihan += (q * h * (1 - d / 100)); newTotalQty += q;
                            });
                            newTotalTagihan = newTotalTagihan - (Number(invData.diskonLain || 0)) + (Number(invData.biayaTentu || 0));

                            const refundAmount = Math.abs(initialValues.jumlahKeluar || 0);
                            const currentPaid = Number(invData.jumlahTerbayar || 0);
                            const restoredPaid = currentPaid + refundAmount;
                            const newStatus = restoredPaid >= newTotalTagihan ? 'Lunas' : 'Belum';

                            updates[`transaksiJualBuku/${invoiceId}/items`] = updatedItems;
                            updates[`transaksiJualBuku/${invoiceId}/totalTagihan`] = newTotalTagihan;
                            updates[`transaksiJualBuku/${invoiceId}/totalQty`] = newTotalQty;
                            updates[`transaksiJualBuku/${invoiceId}/jumlahTerbayar`] = restoredPaid;
                            updates[`transaksiJualBuku/${invoiceId}/statusPembayaran`] = newStatus;
                            updates[`transaksiJualBuku/${invoiceId}/updatedAt`] = { ".sv": "timestamp" };

                            for (const rec of restorationLog) {
                                const bukuSnap = await get(ref(db, `buku/${rec.bukuId}`));
                                if (bukuSnap.exists()) {
                                    updates[`buku/${rec.bukuId}/stok`] = Number(bukuSnap.val().stok || 0) - rec.qty;
                                    updates[`buku/${rec.bukuId}/updatedAt`] = { ".sv": "timestamp" };
                                }
                            }
                            Object.keys(historyData).forEach(k => updates[`historiStok/${k}`] = null);
                        }
                    } 
                    // B. ROLLBACK PEMBAYARAN
                    else if (initialValues.tipeMutasi === 'Penjualan Buku') {
                        const allocations = initialValues.detailAlokasi || { [initialValues.idTransaksi]: initialValues.jumlahBayar };
                        for (const [invId, amount] of Object.entries(allocations)) {
                            const invoiceRef = ref(db, `transaksiJualBuku/${invId}`);
                            const invSnap = await get(invoiceRef);
                            if (invSnap.exists()) {
                                const invData = invSnap.val();
                                const valAmount = typeof amount === 'object' ? amount.amount : amount;
                                const newPaid = (invData.jumlahTerbayar || 0) - Number(valAmount);
                                const finalPaid = newPaid < 0 ? 0 : newPaid;
                                const newStatus = finalPaid >= (invData.totalTagihan || 0) ? 'Lunas' : 'Belum';
                                updates[`transaksiJualBuku/${invId}/jumlahTerbayar`] = finalPaid;
                                updates[`transaksiJualBuku/${invId}/statusPembayaran`] = newStatus;
                                updates[`transaksiJualBuku/${invId}/riwayatPembayaran/${mutasiId}`] = null;
                                updates[`transaksiJualBuku/${invId}/updatedAt`] = { ".sv": "timestamp" };
                            }
                        }
                    }
                    await update(ref(db), updates);
                    message.success('Transaksi dihapus.'); onCancel();
                } catch (error) { console.error("Del Error:", error); message.error("Gagal hapus"); } 
                finally { setIsSaving(false); }
            }
        });
    };

    // --- SAVE LOGIC ---
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
            const timestampNow = dayjs(dataLain.tanggal).valueOf();
            let mutasiId = initialValues?.id; 
            if (!mutasiId) mutasiId = generateTransactionId(dataLain.kategori); 

            // ==========================================
            // A. RETUR BUKU
            // ==========================================
            if (dataLain.kategori === 'Retur Buku') {
                 const invoiceId = dataLain.idTransaksi; 
                 const invoiceRefPath = `transaksiJualBuku/${invoiceId}`;
                 const invoiceSnapshot = await get(ref(db, invoiceRefPath));
                 if (!invoiceSnapshot.exists()) throw new Error("Invoice tidak ditemukan!");
                 const originalInvoice = invoiceSnapshot.val();

                 let newTotalTagihan = 0; let newTotalQty = 0;
                 const updatedItems = (originalInvoice.items || []).map(item => {
                    const returInfo = returItems.find(r => r.idBuku === item.idBuku);
                    if (returInfo && returInfo.qtyRetur > 0) return { ...item, jumlah: Number(item.jumlah) - Number(returInfo.qtyRetur) };
                    return item;
                });

                updatedItems.forEach(item => {
                    const q = Number(item.jumlah); const h = Number(item.hargaSatuan); const d = Number(item.diskonPersen || 0);
                    newTotalTagihan += (q * h * (1 - d / 100)); newTotalQty += q;
                });
                
                const finalTotalTagihan = newTotalTagihan - (Number(originalInvoice.diskonLain||0)) + (Number(originalInvoice.biayaTentu||0));
                
                let existingPaid = Number(originalInvoice.jumlahTerbayar || 0);
                let refundAmount = 0;
                let newPaid = existingPaid;
                
                if (existingPaid > finalTotalTagihan) {
                    refundAmount = existingPaid - finalTotalTagihan;
                    newPaid = finalTotalTagihan;
                }
                const newStatus = newPaid >= finalTotalTagihan ? 'Lunas' : 'Belum';

                updates[`${invoiceRefPath}/items`] = updatedItems;
                updates[`${invoiceRefPath}/totalTagihan`] = finalTotalTagihan;
                updates[`${invoiceRefPath}/totalQty`] = newTotalQty;
                updates[`${invoiceRefPath}/jumlahTerbayar`] = newPaid; 
                updates[`${invoiceRefPath}/statusPembayaran`] = newStatus;
                updates[`${invoiceRefPath}/updatedAt`] = { ".sv": "timestamp" };

                const itemsReturDetail = []; 
                const returSummaryItems = [];
                for (const itemRetur of returItems) {
                    if (itemRetur.qtyRetur > 0) {
                        returSummaryItems.push(itemRetur);
                        const subtotalItem = itemRetur.qtyRetur * itemRetur.hargaSatuan; 
                        itemsReturDetail.push({ 
                            idBuku: itemRetur.idBuku, judulBuku: itemRetur.judulBuku, hargaSatuan: itemRetur.hargaSatuan, 
                            diskonPersen: itemRetur.diskonPersen || 0, qty: itemRetur.qtyRetur, subtotal: subtotalItem
                        });
                        const bukuSnapshot = await get(ref(db, `buku/${itemRetur.idBuku}`));
                        if (bukuSnapshot.exists()) {
                            updates[`buku/${itemRetur.idBuku}/stok`] = Number(bukuSnapshot.val().stok || 0) + itemRetur.qtyRetur;
                            updates[`buku/${itemRetur.idBuku}/updatedAt`] = { ".sv": "timestamp" };
                            const logKey = push(ref(db, 'historiStok')).key;
                            updates[`historiStok/${logKey}`] = {
                                bukuId: itemRetur.idBuku, judul: bukuSnapshot.val().judul, perubahan: itemRetur.qtyRetur,
                                keterangan: `Retur Invoice ${originalInvoice.nomorInvoice}`, refId: invoiceId, timestamp: timestampNow
                            };
                        }
                    }
                }
                
                const nominalKeluar = refundAmount > 0 ? refundAmount : Number(dataLain.jumlah);
                const dataMutasiRetur = {
                    id: mutasiId, 
                    idTransaksi: invoiceId, 
                    namaPelanggan: originalInvoice.namaPelanggan || 'Umum', 
                    tipeTransaksi: "Penjualan Buku", 
                    jumlahKeluar: nominalKeluar,
                    tanggal: timestampNow, 
                    tipeMutasi: 'Retur Buku', 
                    keterangan: dataLain.keterangan + (refundAmount > 0 ? ` (Refund: ${currencyFormatter(refundAmount)})` : ''),
                    buktiUrl, 
                    tipe: TipeTransaksi.pengeluaran, 
                    kategori: 'Retur Buku', 
                    jumlah: -Math.abs(nominalKeluar),
                    totalDiskon: Number(dataLain.totalDiskon || 0), 
                    nilaiBarangRetur: summaryRetur.totalRetur, 
                    itemsReturRingkas: returSummaryItems.map(i=> `${i.judulBuku} (x${i.qtyRetur})`).join(', '),
                    itemsReturDetail: itemsReturDetail
                };
                updates[`mutasi/${mutasiId}`] = dataMutasiRetur;

                await update(ref(db), updates);
                message.success({ content: 'Retur berhasil disimpan!', key: 'saving' });
                onCancel(); 
                
                Modal.confirm({
                    title: 'Cetak Nota Retur?', icon: <PrinterOutlined />, content: 'Cetak nota sekarang?', okText: 'Cetak', cancelText: 'Tutup',
                    onOk: () => { 
                        // Trigger print action
                        printNotaReturAction(dataMutasiRetur, originalInvoice);
                    }
                });

            } 
            // ==========================================
            // B. PEMBAYARAN (MULTI -> SPLIT TO SINGLE RECORDS)
            // ==========================================
            else if (selectedInvoices.length > 0) {
                for (const inv of selectedInvoices) {
                    if (!inv.alokasiBayar || inv.alokasiBayar <= 0) continue;
                    const specificMutasiId = generateTransactionId(dataLain.kategori);
                    const invoiceRef = ref(db, `transaksiJualBuku/${inv.id}`);
                    const snap = await get(invoiceRef);
                    if (snap.exists()) {
                        const dbInv = snap.val();
                        const currentPaid = (dbInv.jumlahTerbayar || 0) + inv.alokasiBayar;
                        let currentHistory = dbInv.riwayatPembayaran || {};
                        currentHistory[specificMutasiId] = { tanggal: timestampNow, jumlah: inv.alokasiBayar, mutasiId: specificMutasiId, keterangan: dataLain.keterangan || 'Pembayaran' };
                        const newStatus = currentPaid >= dbInv.totalTagihan ? 'Lunas' : 'Belum';
                        updates[`transaksiJualBuku/${inv.id}/jumlahTerbayar`] = currentPaid;
                        updates[`transaksiJualBuku/${inv.id}/riwayatPembayaran`] = currentHistory;
                        updates[`transaksiJualBuku/${inv.id}/statusPembayaran`] = newStatus;
                        updates[`transaksiJualBuku/${inv.id}/updatedAt`] = { ".sv": "timestamp" };

                        updates[`mutasi/${specificMutasiId}`] = {
                            id: specificMutasiId, 
                            idTransaksi: inv.id, 
                            namaPelanggan: dbInv.namaPelanggan || 'Umum', 
                            tipeTransaksi: "Penjualan Buku",
                            jumlahBayar: inv.alokasiBayar, 
                            tanggalBayar: timestampNow, 
                            tipeMutasi: dataLain.kategori, 
                            keterangan: `${dataLain.keterangan || 'Pembayaran'} (${dbInv.nomorInvoice})`,
                            buktiUrl, 
                            tipe: TipeTransaksi.pemasukan, 
                            kategori: dataLain.kategori, 
                            jumlah: inv.alokasiBayar, 
                            tanggal: timestampNow,
                            totalTagihanSnapshot: dbInv.totalTagihan 
                        };
                    }
                }
                await update(ref(db), updates);
                message.success({ content: 'Berhasil disimpan!', key: 'saving' });
                onCancel();
            }
            // C. UMUM
            else {
                const jumlah = dataLain.tipe === TipeTransaksi.pengeluaran ? -Math.abs(Number(dataLain.jumlah)) : Number(dataLain.jumlah);
                updates[`mutasi/${mutasiId}`] = { id: mutasiId, jumlah, kategori: dataLain.kategori, keterangan: dataLain.keterangan, tanggal: timestampNow, tipe: dataLain.tipe, buktiUrl, tipeMutasi: dataLain.kategori };
                await update(ref(db), updates);
                message.success({ content: 'Berhasil disimpan!', key: 'saving' });
                onCancel();
            }
        } catch (error) {
            console.error(error);
            message.error({ content: `Gagal: ${error.message}`, key: 'saving' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleOk = () => {
        form.validateFields().then(values => saveTransaction(values)).catch(info => console.log('Validate Failed:', info));
    };

    const paymentColumns = [
        { title: 'Invoice / Pelanggan', dataIndex: 'nomorInvoice', key: 'inv',
            render: (text, record) => <div style={{lineHeight: 1.2}}><Text strong>{text}</Text><br/><Text type="secondary" style={{fontSize: 11}}>{record.namaPelanggan}</Text></div>
        },
        { title: 'Sisa Tagihan', dataIndex: 'sisaTagihan', key: 'sisa', align: 'right', render: (val) => <Text type="danger">{currencyFormatter(val)}</Text> },
        { title: 'Bayar (Rp)', key: 'bayar', width: 150, render: (_, record) => <InputNumber style={{width: '100%'}} value={record.alokasiBayar} onChange={(v) => handleAlokasiChange(v, record.id)} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={v => v.replace(/[^\d]/g, '')} min={0} /> }
    ];

    const returColumns = [
        { title: 'Buku', dataIndex: 'judulBuku', key: 'judul', width: 140, render: (t) => <Text strong>{t}</Text> },
        { title: 'Harga', dataIndex: 'hargaSatuan', key: 'harga', align: 'right', render: (val) => currencyFormatter(val) },
        { title: 'Qty Beli', dataIndex: 'jumlah', key: 'qtyBeli', width: 70, align: 'center', render: (val) => <Tag color="blue">{val}</Tag> },
        { title: 'Disc', dataIndex: 'diskonPersen', key: 'diskonPersen', width: 60, align: 'center', render: (val) => val ? <Tag color="orange">{val}%</Tag> : '-' },
        { title: 'Retur', key: 'qtyRetur', width: 90, render: (_, r, i) => <InputNumber min={0} max={r.jumlah} value={r.qtyRetur} onChange={(v) => handleQtyReturChange(v, i)} size="small" /> },
        { title: 'Subtotal', align:'right', render: (_,r) => currencyFormatter(r.qtyRetur * (r.hargaSatuan * (1-(r.diskonPersen||0)/100))) }
    ];

    return (
        <>
            {contextHolder}
            <Modal
                open={open}
                title={initialValues ? `Edit Transaksi (${initialValues.id})` : 'Tambah Transaksi'}
                onCancel={onCancel}
                width={isReturMode || selectedInvoices.length > 0 ? 800 : 520}
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
                        <Col span={12}><Form.Item name="tanggal" label="Tanggal"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
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
                                label={isReturMode ? "Cari Invoice Retur" : "Cari Invoice Pembayaran"}
                                rules={[{ required: true, message: 'Pilih Invoice' }]}
                            >
                                <Select
                                    mode={isReturMode ? undefined : "multiple"} 
                                    showSearch
                                    placeholder="Cari Nama Pelanggan / No Invoice..."
                                    onSelect={isReturMode ? handleReturSelect : undefined}
                                    onChange={isReturMode ? undefined : handleMultiTxnSelect}
                                    onSearch={handleSearchInvoice}
                                    filterOption={false}
                                    notFoundContent={isSearching ? <Spin size="small" /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Data tidak ditemukan" />}
                                    disabled={!!initialValues?.idTransaksi}
                                    style={{ width: '100%' }}
                                    optionLabelProp="label"
                                >
                                    {invoiceOptions.map(tx => (
                                        <Option key={tx.id} value={tx.id} label={`${tx.namaPelanggan} - ${tx.nomorInvoice}`}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>{tx.nomorInvoice} - <b>{tx.namaPelanggan}</b></span>
                                                <Tag>{currencyFormatter(tx.totalTagihan - (tx.jumlahTerbayar||0))}</Tag>
                                            </div>
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            {!isReturMode && selectedInvoices.length > 0 && (
                                <div style={{ marginBottom: 24, border: '1px solid #f0f0f0', borderRadius: 8, padding: 10, background:'#fafafa' }}>
                                    <Text strong>Rincian Pembayaran:</Text>
                                    <Table dataSource={selectedInvoices} columns={paymentColumns} pagination={false} size="small" rowKey="id"
                                        summary={(pageData) => {
                                            let totalBayar = 0;
                                            pageData.forEach(({ alokasiBayar }) => { totalBayar += alokasiBayar; });
                                            return (
                                                <Table.Summary.Row>
                                                    <Table.Summary.Cell index={0} colSpan={2} align="right"><Text strong>Total:</Text></Table.Summary.Cell>
                                                    <Table.Summary.Cell index={1}><Text strong style={{color: '#1890ff'}}>{currencyFormatter(totalBayar)}</Text></Table.Summary.Cell>
                                                </Table.Summary.Row>
                                            );
                                        }}
                                    />
                                </div>
                            )}

                            {isReturMode && selectedReturInvoice && (
                                <div style={{ marginBottom: 16 }}>
                                    <Table dataSource={returItems} columns={returColumns} pagination={false} size="small" scroll={{ y: 200 }} bordered />
                                </div>
                            )}
                        </>
                    )}

                    <Form.Item name="keterangan" label="Keterangan">
                        <Input.TextArea rows={2} placeholder="Tambahkan catatan..." />
                    </Form.Item>
                    
                    <Row gutter={16}>
                        {isReturMode && (
                            <Col span={12}>
                                <Form.Item name="totalDiskon" label="Total Diskon Retur">
                                    <InputNumber 
                                        style={{ width: '100%' }} 
                                        formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 
                                        parser={v => v.replace(/[^\d]/g, '')} 
                                        prefix="Rp"
                                        onChange={handleTotalDiskonChange} 
                                    />
                                </Form.Item>
                            </Col>
                        )}
                        <Col span={isReturMode ? 12 : 24}>
                            <Form.Item name="jumlah" label="Total Nominal (Net Refund)">
                                <InputNumber style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={v => v.replace(/[^\d]/g, '')} prefix="Rp" readOnly={selectedInvoices.length > 0 && !isReturMode} />
                            </Form.Item>
                        </Col>
                    </Row>
                    
                    <Form.Item name="bukti" label="Bukti Upload">
                        <Upload maxCount={1} beforeUpload={() => false} listType="picture" fileList={fileList} onChange={({fileList}) => setFileList(fileList)}>
                            <Button icon={<UploadOutlined />}>Upload</Button>
                        </Upload>
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
};

export default TransaksiForm;