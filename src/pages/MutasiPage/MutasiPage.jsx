import React, { useState, useMemo, useCallback, useDeferredValue } from 'react';
import {
    Layout, Card, Table, Tag, Button, Modal, Input, Space, Typography, Row, Col,
    message, Tooltip, Grid, DatePicker, Spin, Divider
} from 'antd';
import {
    PlusOutlined, EditOutlined, EyeOutlined, SyncOutlined, DownloadOutlined, ShareAltOutlined,
    SearchOutlined, FilterOutlined, UnorderedListOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/id';

// UTILS & HOOKS
import { currencyFormatter } from '../../utils/formatters';
import { KategoriPemasukan, KategoriPengeluaran } from '../../constants';
import { useMutasiStream } from '../../hooks/useFirebaseData';
import useDebounce from '../../hooks/useDebounce';
import { generateMutasiPdf } from '../../utils/pdfMutas';

// COMPONENTS
import RekapitulasiCard from './components/RekapitulasiCard';
import KategoriChips from './components/KategoriChips';
import TransaksiForm from './components/TransaksiForm';
import PdfPreviewModal from '../BukuPage/components/PdfPreviewModal';

dayjs.locale('id');
const { Content } = Layout;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// --- STYLING KANTIP PRESET ---
const styles = {
    pageContainer: {
        padding: '16px',
        backgroundColor: '#f5f7fa',
        minHeight: '100vh'
    },
    card: {
        borderRadius: 12,
        border: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100%'
    },
    headerCompact: {
        padding: '12px 16px', // Padding kiri header adalah 16px
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#fff'
    },
    headerTitle: {
        fontSize: 14,
        fontWeight: 600,
        margin: 0,
        color: '#262626'
    },
    iconBox: (color, bg) => ({
        background: bg,
        padding: 6,
        borderRadius: 8,
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        fontSize: 14
    }),
    inputRadius: {
        borderRadius: 8
    }
};

const getRowClassName = (record, index) => index % 2 === 0 ? 'table-row-even' : 'table-row-odd';

const MutasiPage = () => {
    // ... (Logika state & hooks sama seperti sebelumnya, tidak berubah) ...
    // Saya sembunyikan bagian logic agar fokus ke UI, paste logic sebelumnya di sini jika perlu.
    
    const screens = Grid.useBreakpoint();
    const defaultStart = dayjs().subtract(2, 'month').startOf('day');
    const defaultEnd = dayjs().endOf('day');
    const [dateRange, setDateRange] = useState([defaultStart, defaultEnd]);
    const streamParams = useMemo(() => ({ mode: 'range', startDate: dateRange?.[0] ? dateRange[0].valueOf() : null, endDate: dateRange?.[1] ? dateRange[1].valueOf() : null }), [dateRange]);
    const { mutasiList = [], loadingMutasi = false } = useMutasiStream(streamParams) || {};
    const [filterType, setFilterType] = useState('Semua');
    const [selectedKategori, setSelectedKategori] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [pagination, setPagination] = useState({ current: 1, pageSize: 25, showSizeChanger: true });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaksi, setEditingTransaksi] = useState(null);
    const [isProofModalOpen, setIsProofModalOpen] = useState(false);
    const [viewingProofUrl, setViewingProofUrl] = useState('');
    const [isProofLoading, setIsProofLoading] = useState(false);
    const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
    const [pdfFileName, setPdfFileName] = useState('');
    const debouncedSearchText = useDebounce(searchText, 300);
    const deferredMutasiList = useDeferredValue(mutasiList);
    const deferredFilterType = useDeferredValue(filterType);
    const deferredSelectedKategori = useDeferredValue(selectedKategori);
    const deferredSearch = useDeferredValue(debouncedSearchText);
    const SafeKategoriPemasukan = KategoriPemasukan || {};
    const SafeKategoriPengeluaran = KategoriPengeluaran || {};
    const ExtendedKategoriPengeluaran = useMemo(() => ({ ...SafeKategoriPengeluaran, retur_buku: "Retur Buku" }), [SafeKategoriPengeluaran]);
    const getTimestamp = useCallback((r) => r?.tanggal || r?.tanggalBayar || 0, []);

    const balanceMap = useMemo(() => {
        const list = deferredMutasiList || [];
        if (list.length === 0) return new Map();
        const sorted = [...list].sort((a, b) => getTimestamp(a) - getTimestamp(b));
        const map = new Map();
        let bal = 0;
        for (const tx of sorted) { bal += (Number(tx.jumlah) || 0); map.set(tx.id, bal); }
        return map;
    }, [deferredMutasiList, getTimestamp]);

    const filteredTransaksi = useMemo(() => {
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

    const rekapDataForCard = useMemo(() => {
        const data = filteredTransaksi;
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
                if (isMasuk) { inTotal += val; inMap.set(catName, (inMap.get(catName) || 0) + val); } else { outTotal += val; outMap.set(catName, (outMap.get(catName) || 0) + val); }
            }
        }
        return { pemasukanEntries: Array.from(inMap.entries()).sort((a, b) => b[1] - a[1]), pengeluaranEntries: Array.from(outMap.entries()).sort((a, b) => b[1] - a[1]), totalPemasukan: inTotal, totalPengeluaran: outTotal };
    }, [filteredTransaksi, SafeKategoriPemasukan, ExtendedKategoriPengeluaran]);

    const handleSearchChange = (e) => { setSearchText(e.target.value); setPagination(p => ({ ...p, current: 1 })); };
    const handleDateChange = (d) => { if (d) { setDateRange(d); setPagination(p => ({ ...p, current: 1 })); } };
    const handleMultiSelectFilter = (val) => { setSelectedKategori(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]); setPagination(p => ({ ...p, current: 1 })); };
    const handleTableChange = (p) => setPagination(p);
    const resetFilters = useCallback(() => { setFilterType('Semua'); setSelectedKategori([]); setSearchText(''); setDateRange([defaultStart, defaultEnd]); setPagination(p => ({ ...p, current: 1 })); }, [defaultStart, defaultEnd]);
    const handleViewProof = (url) => { setIsProofLoading(true); setViewingProofUrl(url); setIsProofModalOpen(true); };
    const handleClosePreviewModal = () => { setIsPreviewModalVisible(false); if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(''); setPdfFileName(''); };
    const handleTambah = () => { setEditingTransaksi(null); setIsModalOpen(true); };
    const handleEdit = (r) => { setEditingTransaksi(r); setIsModalOpen(true); };
    const handleGeneratePdf = () => { if (filteredTransaksi.length === 0) return message.warning('Data kosong'); try { const { blobUrl, fileName } = generateMutasiPdf(filteredTransaksi, { dateRange }, new Map(), SafeKategoriPemasukan, ExtendedKategoriPengeluaran); setPdfPreviewUrl(blobUrl); setPdfFileName(fileName); setIsPreviewModalVisible(true); } catch (e) { console.error(e); message.error('Gagal PDF'); } };
    const handleDownloadProof = async (url) => { if (!url) return; message.loading({ content: 'Unduh...', key: 'dl' }); try { const r = await fetch(url); const b = await r.blob(); const l = document.createElement('a'); l.href = window.URL.createObjectURL(b); l.setAttribute('download', url.split('/').pop().split('?')[0] || 'bukti'); document.body.appendChild(l); l.click(); l.remove(); message.success({ content: 'Berhasil', key: 'dl' }); } catch (e) { message.error({ content: 'Gagal', key: 'dl' }); } };
    const handleShareProof = async (url) => { if (navigator.share) { try { const r = await fetch(url); const b = await r.blob(); const f = new File([b], "bukti.jpg", { type: b.type }); await navigator.share({ files: [f], title: 'Bukti' }); } catch (e) { message.error('Gagal share'); } } else message.warning('Tidak support'); };

    const columns = useMemo(() => [
        { title: "Tanggal", dataIndex: 'tanggal', key: 'tanggal', width: 140, align: "left", render: (tgl, r) => <div>{dayjs(getTimestamp(r)).format('DD MMM YYYY')}</div>, sorter: (a, b) => getTimestamp(a) - getTimestamp(b), defaultSortOrder: 'descend' },
        { title: 'Jenis Transaksi', dataIndex: 'kategori', key: 'kategori', width: 200, render: (k, r) => { const katText = r.tipe === 'pemasukan' ? SafeKategoriPemasukan[k] || k : ExtendedKategoriPengeluaran[k] || k; return <Tag color={r.tipe === 'pemasukan' ? 'green' : 'red'} style={{ borderRadius: 8, fontSize: 11 }}>{katText || r.tipeMutasi}</Tag>; } },
        { title: 'Keterangan', dataIndex: 'keterangan', key: 'keterangan', render: (t) => <Text style={{ fontSize: 13 }}>{t}</Text> },
        { title: 'Nominal', dataIndex: 'jumlah', key: 'jumlah', align: 'right', width: 150, render: (v) => <Text strong type={v >= 0 ? 'success' : 'danger'}>{currencyFormatter(v)}</Text>, sorter: (a, b) => a.jumlah - b.jumlah },
        { title: 'Aksi', key: 'aksi', align: 'center', width: 100, render: (_, r) => (<Space><Tooltip title="Lihat Bukti"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleViewProof(r.buktiUrl)} disabled={!r.buktiUrl} /></Tooltip><Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} /></Tooltip></Space>) },
    ], [getTimestamp, SafeKategoriPemasukan, ExtendedKategoriPengeluaran]);

    const isFilterActive = filterType !== 'Semua' || selectedKategori.length > 0 || !!searchText || (!dateRange[0].isSame(defaultStart, 'day') || !dateRange[1].isSame(defaultEnd, 'day'));

    return (
        <Content style={styles.pageContainer}>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }} align="stretch">
                <Col xs={24} lg={13} style={{ display: 'flex', flexDirection: 'column' }}>
                    <Card style={styles.card} bodyStyle={{ padding: 0 }}>
                        <div style={styles.headerCompact}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={styles.iconBox('#1890ff', '#e6f7ff')}><FilterOutlined /></div>
                                <Text style={styles.headerTitle}>Filter Transaksi</Text>
                            </div>
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

            {/* 3. TABLE CARD */}
            {/* bodyStyle={{ padding: 0 }} tetap 0 agar Header full width */}
            <Card style={styles.card} bodyStyle={{ padding: 0 }}> 
                
                {/* Header Compact */}
                <div style={styles.headerCompact}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={styles.iconBox('#fa8c16', '#fff7e6')}>
                            <UnorderedListOutlined />
                        </div>
                        <Text style={styles.headerTitle}>Riwayat Transaksi</Text>
                    </div>
                    <Space>
                        <Tooltip title="Download PDF">
                            <Button icon={<DownloadOutlined />} onClick={handleGeneratePdf} disabled={filteredTransaksi.length === 0} style={{ borderRadius: 8 }} />
                        </Tooltip>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleTambah} disabled={loadingMutasi} style={{ borderRadius: 8 }}>
                            Baru
                        </Button>
                    </Space>
                </div>

                {/* --- UPDATE: WRAPPER TABEL DENGAN PADDING --- */}
                {/* Padding 16px kiri-kanan agar sejajar dengan icon header */}
                <div style={{ padding: '0 16px 16px 16px' }}>
                    <Table
                        columns={columns}
                        dataSource={filteredTransaksi}
                        loading={loadingMutasi}
                        rowKey="id"
                        size="middle"
                        scroll={{ x: 'max-content' }}
                        pagination={{ ...pagination, size: 'small', showTotal: (t) => <Text type="secondary" style={{ fontSize: 12 }}>Total {t}</Text> }}
                        onChange={handleTableChange}
                        rowClassName={getRowClassName}
                    />
                </div>
                
            </Card>

            {/* MODALS */}
            {isModalOpen && (<TransaksiForm open={isModalOpen} onCancel={() => { setIsModalOpen(false); setEditingTransaksi(null); }} initialValues={editingTransaksi} />)}
            <PdfPreviewModal visible={isPreviewModalVisible} onClose={handleClosePreviewModal} pdfBlobUrl={pdfPreviewUrl} fileName={pdfFileName} />
            <Modal open={isProofModalOpen} title="Bukti Transaksi" centered width={800} onCancel={() => setIsProofModalOpen(false)} footer={[<Button key="close" onClick={() => setIsProofModalOpen(false)} style={{ borderRadius: 8 }}>Tutup</Button>, navigator.share && (<Button key="share" icon={<ShareAltOutlined />} onClick={() => handleShareProof(viewingProofUrl)} style={{ borderRadius: 8 }}>Share</Button>), <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={() => handleDownloadProof(viewingProofUrl)} style={{ borderRadius: 8 }}>Download</Button>]}>{isProofLoading && <div style={{textAlign: 'center', padding: 20}}><Spin /></div>}{viewingProofUrl && (<div style={{ background: '#f0f2f5', borderRadius: 8, padding: 4, minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{viewingProofUrl.toLowerCase().includes('.pdf') ? (<iframe src={viewingProofUrl} style={{ width: '100%', height: '60vh', border: 'none', display: isProofLoading ? 'none' : 'block' }} title="Bukti PDF" onLoad={() => setIsProofLoading(false)} />) : (<img alt="Bukti Transaksi" style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', display: isProofLoading ? 'none' : 'block' }} src={viewingProofUrl} onLoad={() => setIsProofLoading(false)} />)}</div>)}</Modal>
        </Content>
    );
};

export default MutasiPage;