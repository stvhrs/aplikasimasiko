import React, { useState, useMemo, useCallback, useDeferredValue } from 'react';
import {
    Layout, Card, Table, Tag, Button, Modal, Input, Space, Typography, Row, Col,
    message, Tooltip, Grid, DatePicker, Spin, Divider
} from 'antd';
import {
    PlusOutlined, EditOutlined, EyeOutlined, SyncOutlined, DownloadOutlined, ShareAltOutlined,
    FilterOutlined, UnorderedListOutlined, PrinterOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/id';

// UTILS & HOOKS
import { currencyFormatter } from '../../utils/formatters';
import { KategoriPemasukan, KategoriPengeluaran } from '../../constants';
import { useMutasiStream } from '../../hooks/useFirebaseData';
import useDebounce from '../../hooks/useDebounce';
import { generateMutasiPdf } from '../../utils/pdfMutas'; 
// IMPORT GENERATOR PDF INVOICE/NOTA
import { generateNotaReturPDF } from '../../utils/notaretur';
import { generateNotaPembayaranPDF } from '../../utils/notamutasipembayaran'; // Import dari file baru
// COMPONENTS
import RekapitulasiCard from './components/RekapitulasiCard';
import KategoriChips from './components/KategoriChips';
import MutasiForm from './components/MutasiForm';
import PdfPreviewModal from '../BukuPage/components/PdfPreviewModal';

dayjs.locale('id');
const { Content } = Layout;
const { Text } = Typography;
const { RangePicker } = DatePicker;

// --- STYLING ---
const styles = {
    pageContainer: { padding: '16px', backgroundColor: '#f5f7fa', minHeight: '100vh' },
    card: { borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' },
    headerCompact: { padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' },
    headerTitle: { fontSize: 14, fontWeight: 600, margin: 0, color: '#262626' },
    iconBox: (color, bg) => ({ background: bg, padding: 6, borderRadius: 8, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10, fontSize: 14 }),
    inputRadius: { borderRadius: 8 }
};

const getRowClassName = (record, index) => index % 2 === 0 ? 'table-row-even' : 'table-row-odd';

const MutasiPage = () => {
    // --- STATE ---
    const defaultStart = dayjs().subtract(2, 'month').startOf('day');
    const defaultEnd = dayjs().endOf('day');
    const [dateRange, setDateRange] = useState([defaultStart, defaultEnd]);
    
    // --- DATA ---
    const streamParams = useMemo(() => ({ 
        mode: 'range', 
        startDate: dateRange?.[0] ? dateRange[0].valueOf() : null, 
        endDate: dateRange?.[1] ? dateRange[1].valueOf() : null 
    }), [dateRange]);

    const { mutasiList = [], loadingMutasi = false } = useMutasiStream(streamParams) || {};

    // --- FILTERS ---
    const [filterType, setFilterType] = useState('Semua');
    const [selectedKategori, setSelectedKategori] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [pagination, setPagination] = useState({ current: 1, pageSize: 25, showSizeChanger: true });

    // --- MODALS ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMutasi, setEditingMutasi] = useState(null);
    const [isProofModalOpen, setIsProofModalOpen] = useState(false);
    const [viewingProofUrl, setViewingProofUrl] = useState('');
    const [isProofLoading, setIsProofLoading] = useState(false);
    
    // --- PDF MODAL ---
    const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
    const [pdfFileName, setPdfFileName] = useState('');

    // --- HOOKS ---
    const debouncedSearchText = useDebounce(searchText, 300);
    const deferredMutasiList = useDeferredValue(mutasiList);
    const deferredFilterType = useDeferredValue(filterType);
    const deferredSelectedKategori = useDeferredValue(selectedKategori);
    const deferredSearch = useDeferredValue(debouncedSearchText);

    // --- CONSTANTS ---
    const SafeKategoriPemasukan = KategoriPemasukan || {};
    const SafeKategoriPengeluaran = KategoriPengeluaran || {};
    const ExtendedKategoriPengeluaran = useMemo(() => ({ ...SafeKategoriPengeluaran, retur_buku: "Retur Buku" }), [SafeKategoriPengeluaran]);

    const getTimestamp = useCallback((r) => r?.tanggal || r?.tanggalBayar || 0, []);
    
    // --- CALC BALANCE ---
    const balanceMap = useMemo(() => {
        const list = deferredMutasiList || [];
        if (list.length === 0) return new Map();
        const sorted = [...list].sort((a, b) => getTimestamp(a) - getTimestamp(b));
        const map = new Map();
        let bal = 0;
        for (const tx of sorted) { 
            bal += (Number(tx.jumlah) || 0); 
            map.set(tx.id, bal); 
        }
        return map;
    }, [deferredMutasiList, getTimestamp]);

    // --- FILTER LOGIC ---
    const filteredMutasi = useMemo(() => {
        let data = deferredMutasiList || [];
        if (deferredFilterType !== 'Semua') {
            const dbType = deferredFilterType === 'Masuk' ? 'pemasukan' : 'pengeluaran';
            data = data.filter(tx => tx.tipe === dbType);
        }
        if (deferredSelectedKategori.length > 0) {
            data = data.filter(tx => deferredSelectedKategori.includes(tx.kategori) || deferredSelectedKategori.includes(tx.tipeMutasi));
        }
        if (deferredSearch) {
            const q = deferredSearch.toLowerCase();
            data = data.filter(tx => String(tx.keterangan || '').toLowerCase().includes(q) || String(tx.nomorInvoice || '').toLowerCase().includes(q));
        }
        return data.map(tx => ({ ...tx, saldoSetelah: balanceMap.get(tx.id) })).sort((a, b) => getTimestamp(b) - getTimestamp(a));
    }, [deferredMutasiList, deferredFilterType, deferredSelectedKategori, deferredSearch, balanceMap, getTimestamp]);

    // --- REKAP DATA ---
    const rekapDataForCard = useMemo(() => {
        const data = filteredMutasi;
        let inTotal = 0; let outTotal = 0;
        const inMap = new Map(); Object.values(SafeKategoriPemasukan).forEach(c => inMap.set(c, 0));
        const outMap = new Map(); Object.values(ExtendedKategoriPengeluaran).forEach(c => outMap.set(c, 0));
        
        if (data.length > 0) {
            for (const tx of data) {
                const isMasuk = tx.tipe === 'pemasukan';
                const rawCat = tx.kategori || tx.tipeMutasi;
                const targetMap = isMasuk ? SafeKategoriPemasukan : ExtendedKategoriPengeluaran;
                const catName = Object.values(targetMap).find(v => v === rawCat) || (isMasuk ? 'Pemasukan Lain-lain' : 'Pengeluaran Lain-lain');
                const val = Math.abs(Number(tx.jumlah) || 0);
                if (isMasuk) { inTotal += val; inMap.set(catName, (inMap.get(catName) || 0) + val); } 
                else { outTotal += val; outMap.set(catName, (outMap.get(catName) || 0) + val); }
            }
        }
        return { 
            pemasukanEntries: Array.from(inMap.entries()).sort((a, b) => b[1] - a[1]), 
            pengeluaranEntries: Array.from(outMap.entries()).sort((a, b) => b[1] - a[1]), 
            totalPemasukan: inTotal, totalPengeluaran: outTotal 
        };
    }, [filteredMutasi, SafeKategoriPemasukan, ExtendedKategoriPengeluaran]);

    // --- HANDLERS ---
    const handleSearchChange = (e) => { setSearchText(e.target.value); setPagination(p => ({ ...p, current: 1 })); };
    const handleDateChange = (d) => { if (d) { setDateRange(d); setPagination(p => ({ ...p, current: 1 })); } };
    const handleMultiSelectFilter = (val) => { setSelectedKategori(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]); setPagination(p => ({ ...p, current: 1 })); };
    const handleTableChange = (p) => setPagination(p);
    const resetFilters = useCallback(() => { setFilterType('Semua'); setSelectedKategori([]); setSearchText(''); setDateRange([defaultStart, defaultEnd]); setPagination(p => ({ ...p, current: 1 })); }, [defaultStart, defaultEnd]);
    
    const handleViewProof = (url) => { setIsProofLoading(true); setViewingProofUrl(url); setIsProofModalOpen(true); };
    const handleTambah = () => { setEditingMutasi(null); setIsModalOpen(true); };
    const handleEdit = (r) => { setEditingMutasi(r); setIsModalOpen(true); };

    // --- PDF HANDLER (REKAP MUTASI) ---
    const handleGeneratePdf = () => {
        if (filteredMutasi.length === 0) return message.warning('Data kosong');
        try {
            message.loading({ content: 'Membuat PDF...', key: 'pdfGen' });
            const { blobUrl, fileName } = generateMutasiPdf(
                filteredMutasi, 
                { dateRange }, 
                balanceMap, 
                SafeKategoriPemasukan, 
                ExtendedKategoriPengeluaran
            );
            setPdfPreviewUrl(blobUrl);
            setPdfFileName(fileName);
            setIsPreviewModalVisible(true);
            message.success({ content: 'PDF Siap', key: 'pdfGen' });
        } catch (e) {
            console.error("GAGAL GENERATE PDF:", e);
            message.error({ content: `Error: ${e.message}`, key: 'pdfGen' });
        }
    };

    // --- PDF HANDLER (SINGLE TRANSAKSI - NOTA) ---
   const handlePrintTransaction = (record) => {
    try {
        let pdfData = '';
        let fileName = '';

        // 1. Bersihkan Kategori (jaga-jaga ada spasi)
        const kategori = record.kategori ? record.kategori.trim() : '';

        // --- A. KATEGORI: PENJUALAN BUKU / PEMBAYARAN (PAKAI NOTA PEMBAYARAN) ---
        if (kategori === 'Penjualan Buku' || kategori === 'Pembayaran' || kategori === 'Pembayaran Hutang') {
            
            // Format data agar cocok dengan Nota Pembayaran
            const dataToPrint = {
                ...record, // Copy semua data record
                id: record.nomorDokumen || record.id || record.idMutasi,
                totalBayar: record.total || record.jumlah,
                // Jika Penjualan Buku (Ringkas), buat list invoice manual
                listInvoices: [{
                    noInvoice: record.idMutasi || '-',
                    keterangan: record.keterangan || 'Mutasi Penjualan',
                    jumlahBayar: record.total || record.jumlah
                }]
            };

            pdfData = generateNotaPembayaranPDF(dataToPrint);
            fileName = `Nota_Penjualan_${dataToPrint.id}.pdf`;

        } 
        // --- B. KATEGORI: RETUR BUKU (PAKAI NOTA RETUR) ---
        else if (kategori === 'Retur Buku') {
            
            // PERBAIKAN UTAMA DISINI:
            // Kita harus memaksa 'record.items' masuk ke 'itemsReturDetail'
            // dan memastikan field 'judulBuku', 'qty', 'harga' terisi.
            const itemsSiapCetak = (record.itemsReturDetail || []).map(item => ({
                judulBuku: item.judulBuku ,// Ambil judul dari berbagai kemungkinan key
                qty: Number(item.qty || item.jumlah || item.quantity || 0),
                harga: Number(item.harga || item.hargaSatuan || item.nominal || 0),
                diskon: Number(item.diskon || item.potongan || 0)
            }));

            const dataToPrint = {
                id: record.nomorDokumen || record.id,
                idMutasi: record.referensiDokumen || record.idMutasi,
                tanggal: record.tanggal,
                namaPelanggan: record.namaPelanggan || 'Umum',
                keterangan: record.keterangan,
                
                // Masukkan item yang sudah dirapikan di atas ke sini
                itemsReturDetail: itemsSiapCetak, 
                
                totalDiskon: record.potongan || 0,
                nilaiBarangRetur: record.total || record.jumlah
            };

            pdfData = generateNotaReturPDF(dataToPrint);
            fileName = `Nota_Retur_${dataToPrint.id}.pdf`;
        }

        // --- EKSEKUSI BUKA MODAL ---
        if (pdfData) {
            setPdfPreviewUrl(pdfData);
            setPdfFileName(fileName);
            setIsPreviewModalVisible(true);
        } else {
            // Jika masuk sini, cek console browser untuk lihat kenapa kategori tidak terdeteksi
            console.warn("Kategori tidak dikenali:", kategori);
            message.warning(`Gagal membuat PDF. Kategori: ${kategori}`);
        }

    } catch (error) {
        console.error("Gagal generate Nota PDF:", error);
        message.error("Terjadi kesalahan sistem saat membuat PDF");
    }
};

    const handleClosePreviewModal = () => { setIsPreviewModalVisible(false); if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(''); setPdfFileName(''); };

    // --- UTILS LAIN ---
    const handleDownloadProof = async (url) => { if (!url) return; message.loading({ content: 'Unduh...', key: 'dl' }); try { const r = await fetch(url); const b = await r.blob(); const l = document.createElement('a'); l.href = window.URL.createObjectURL(b); l.setAttribute('download', url.split('/').pop().split('?')[0] || 'bukti'); document.body.appendChild(l); l.click(); l.remove(); message.success({ content: 'Berhasil', key: 'dl' }); } catch (e) { message.error({ content: 'Gagal', key: 'dl' }); } };
    const handleShareProof = async (url) => { if (navigator.share) { try { const r = await fetch(url); const b = await r.blob(); const f = new File([b], "bukti.jpg", { type: b.type }); await navigator.share({ files: [f], title: 'Bukti' }); } catch (e) { message.error('Gagal share'); } } else message.warning('Tidak support'); };

    // --- COLUMNS ---
  // --- COLUMNS ---
    const columns = useMemo(() => [
        { 
            title: "Tanggal", 
            dataIndex: 'tanggal', 
            key: 'tanggal', 
            width: 140, 
            render: (tgl, r) => <div>{dayjs(getTimestamp(r)).format('DD MMM YYYY')}</div>, 
            sorter: (a, b) => getTimestamp(a) - getTimestamp(b), 
            defaultSortOrder: 'descend' 
        },
        { 
            title: 'Jenis Mutasi', 
            dataIndex: 'kategori', 
            key: 'kategori', 
            width: 200, 
            render: (k, r) => { 
                const katText = r.tipe === 'pemasukan' ? SafeKategoriPemasukan[k] || k : ExtendedKategoriPengeluaran[k] || k; 
                return <Tag color={r.tipe === 'pemasukan' ? 'green' : 'red'} style={{ borderRadius: 8, fontSize: 11 }}>{katText || r.tipeMutasi}</Tag>; 
            } 
        },
        { 
            title: 'Keterangan', 
            dataIndex: 'keterangan', 
            key: 'keterangan', 
            render: (t) => <Text style={{ fontSize: 13 }}>{t}</Text> 
        },
        { 
            title: 'Nominal', 
            dataIndex: 'jumlah', 
            key: 'jumlah', 
            align: 'right', 
            width: 150, 
            render: (v) => <Text strong type={v >= 0 ? 'success' : 'danger'}>{currencyFormatter(v)}</Text>, 
            sorter: (a, b) => a.jumlah - b.jumlah 
        },
        { 
            title: 'Aksi', 
            key: 'aksi', 
            align: 'center', 
            width: 140, 
            render: (_, r) => {
                // LOGIKA BARU:
                // Cek apakah kategori adalah Penjualan Buku atau Retur Buku
                const isRestricted = r.kategori === 'Penjualan Buku' || r.kategori === 'Retur Buku';

                // Jika restricted, hilangkan tombol aksi (return null)
                if (isRestricted) {
                    return null; 
                }

                // Jika BUKAN kategori tersebut, tampilkan tombol standar (Lihat Bukti & Edit)
                return (
                    <Space>
                        <Tooltip title="Lihat Bukti">
                            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleViewProof(r.buktiUrl)} disabled={!r.buktiUrl} />
                        </Tooltip>
                        <Tooltip title="Edit">
                            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} />
                        </Tooltip>
                    </Space>
                );
            } 
        },
    ], [getTimestamp, SafeKategoriPemasukan, ExtendedKategoriPengeluaran]);
    const isFilterActive = filterType !== 'Semua' || selectedKategori.length > 0 || !!searchText || (!dateRange[0].isSame(defaultStart, 'day') || !dateRange[1].isSame(defaultEnd, 'day'));

    return (
        <Content style={styles.pageContainer}>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }} align="stretch">
                <Col xs={24} lg={13} style={{ display: 'flex', flexDirection: 'column' }}>
                    <Card style={styles.card} bodyStyle={{ padding: 0 }}>
                        <div style={styles.headerCompact}>
                            <div style={{ display: 'flex', alignItems: 'center' }}><div style={styles.iconBox('#1890ff', '#e6f7ff')}><FilterOutlined /></div><Text style={styles.headerTitle}>Filter Mutasi</Text></div>
                            {isFilterActive && (<Button type="text" size="small" icon={<SyncOutlined />} onClick={resetFilters} style={{ color: '#8c8c8c', fontSize: 12 }}>Reset</Button>)}
                        </div>
                        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <Spin spinning={loadingMutasi}>
                                <Row gutter={[12, 12]}>
                                    <Col xs={24} sm={12}><Text type="secondary" style={{ fontSize: 11, marginBottom: 4, display: 'block' }}>Periode Tanggal</Text><RangePicker style={{ width: '100%', ...styles.inputRadius }} onChange={handleDateChange} value={dateRange} format="D MMM YYYY" allowClear={false} /></Col>
                                    <Col xs={24} sm={12}><Text type="secondary" style={{ fontSize: 11, marginBottom: 4, display: 'block' }}>Pencarian</Text><Input.Search style={styles.inputRadius} placeholder="Cari keterangan / invoice..." value={searchText} onChange={handleSearchChange} allowClear /></Col>
                                </Row>
                                <Divider style={{ margin: '12px 0' }} dashed />
                                <div style={{ background: '#fafafa', padding: '12px', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                                    {(filterType === 'Semua' || filterType === 'Masuk') && (<div style={{ marginBottom: filterType === 'Semua' ? 12 : 0 }}>{filterType === 'Semua' && <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block' }}>Kategori Masuk</Text>}<KategoriChips kategoriMap={SafeKategoriPemasukan} onSelect={(_, val) => handleMultiSelectFilter(val)} selectedKategori={selectedKategori} /></div>)}
                                    {(filterType === 'Semua' || filterType === 'Keluar') && (<div>{filterType === 'Semua' && <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block' }}>Kategori Keluar</Text>}<KategoriChips kategoriMap={ExtendedKategoriPengeluaran} onSelect={(_, val) => handleMultiSelectFilter(val)} selectedKategori={selectedKategori} /></div>)}
                                </div>
                            </Spin>
                        </div>
                    </Card>
                </Col>
                <Col xs={24} lg={11} style={{ display: 'flex', flexDirection: 'column' }}>
                    <RekapitulasiCard rekapData={rekapDataForCard} loading={loadingMutasi} dateRange={dateRange} />
                </Col>
            </Row>

            <Card style={styles.card} bodyStyle={{ padding: 0 }}> 
                <div style={styles.headerCompact}>
                    <div style={{ display: 'flex', alignItems: 'center' }}><div style={styles.iconBox('#fa8c16', '#fff7e6')}><UnorderedListOutlined /></div><Text style={styles.headerTitle}>Riwayat Mutasi</Text></div>
                    <Space>
                        <Tooltip title="Download Laporan PDF"> <Button
      icon={<DownloadOutlined />}
      onClick={handleGeneratePdf}
      disabled={filteredMutasi.length === 0}
      style={{ borderRadius: 8 }}
    >
      Download
    </Button></Tooltip>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleTambah} disabled={loadingMutasi} style={{ borderRadius: 8 }}>Baru</Button>
                    </Space>
                </div>
                <div style={{ padding: '0 16px 16px 16px' }}>
                    <Table columns={columns} dataSource={filteredMutasi} loading={loadingMutasi} rowKey="id" size="middle" scroll={{ x: 'max-content' }} pagination={{ ...pagination, size: 'small', showTotal: (t) => <Text type="secondary" style={{ fontSize: 12 }}>Total {t}</Text> }} onChange={handleTableChange} rowClassName={getRowClassName} />
                </div>
            </Card>

            {isModalOpen && (<MutasiForm open={isModalOpen} onCancel={() => { setIsModalOpen(false); setEditingMutasi(null); }} initialValues={editingMutasi} />)}
            <PdfPreviewModal visible={isPreviewModalVisible} onClose={handleClosePreviewModal} pdfBlobUrl={pdfPreviewUrl} fileName={pdfFileName} />
            <Modal open={isProofModalOpen} title="Bukti Mutasi" centered width={800} onCancel={() => setIsProofModalOpen(false)} footer={[<Button key="close" onClick={() => setIsProofModalOpen(false)} style={{ borderRadius: 8 }}>Tutup</Button>, navigator.share && (<Button key="share" icon={<ShareAltOutlined />} onClick={() => handleShareProof(viewingProofUrl)} style={{ borderRadius: 8 }}>Share</Button>), <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={() => handleDownloadProof(viewingProofUrl)} style={{ borderRadius: 8 }}>Download</Button>]}>{isProofLoading && <div style={{textAlign: 'center', padding: 20}}><Spin /></div>}{viewingProofUrl && (<div style={{ background: '#f0f2f5', borderRadius: 8, padding: 4, minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{viewingProofUrl.toLowerCase().includes('.pdf') ? (<iframe src={viewingProofUrl} style={{ width: '100%', height: '60vh', border: 'none', display: isProofLoading ? 'none' : 'block' }} title="Bukti PDF" onLoad={() => setIsProofLoading(false)} />) : (<img alt="Bukti Mutasi" style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', display: isProofLoading ? 'none' : 'block' }} src={viewingProofUrl} onLoad={() => setIsProofLoading(false)} />)}</div>)}</Modal>
        </Content>
    );
};

export default MutasiPage;