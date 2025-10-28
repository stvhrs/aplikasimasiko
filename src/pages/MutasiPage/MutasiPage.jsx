import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import {
    Layout, Card, Table, Tag, Button, Modal, Input, Space, Typography, Row, Col,
    message, Tooltip, Empty, Grid, DatePicker, Spin, Divider
} from 'antd';
import {
    PlusOutlined, EditOutlined, EyeOutlined, SyncOutlined, DownloadOutlined, ShareAltOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import {
    currencyFormatter, numberFormatter, percentFormatter, generateFilters
} from '../../utils/formatters'; // Pastikan path ini benar
import { useMutasiData, useUnpaidInvoicesData } from './listendata'; // Pastikan path ini benar
import useDebounce from '../../hooks/useDebounce'; // Pastikan path ini benar
import { TipeTransaksi, KategoriPemasukan, KategoriPengeluaran } from '../../constants'; // Pastikan path ini benar

import { generateMutasiPdf } from '../../utils/pdfMutas'; // Pastikan path ini benar

import RekapitulasiCard from './components/RekapitulasiCard'; // Pastikan path ini benar
import KategoriChips from './components/KategoriChips'; // Pastikan path ini benar

// Impor komponen-komponen baru
import TransaksiForm from './components/TransaksiForm'; // Pastikan path ini benar
import PdfPreviewModal from '../BukuPage/components/PdfPreviewModal'; // Sesuaikan path

dayjs.locale('id');

const { Content } = Layout;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const getRowClassName = (record, index) => {
    return index % 2 === 0 ? 'table-row-even' : 'table-row-odd';
};
const chipStyle = { border: '1px solid #d9d9d9', padding: '4px 10px', borderRadius: '16px', minWidth: '130px', textAlign: 'center' };

const MutasiPage = () => {
    const { mutasiList, loadingMutasi } = useMutasiData();
    const { unpaidJual, unpaidCetak, loadingInvoices } = useUnpaidInvoicesData();
    const initialLoading = loadingMutasi || loadingInvoices;

    const [filters, setFilters] = useState({
        dateRange: null,
        selectedTipe: [],
        selectedKategori: [],
        searchText: '',
    });

    const [pagination, setPagination] = useState({ current: 1, pageSize: 25, showSizeChanger: true });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaksi, setEditingTransaksi] = useState(null);
    const [isProofModalOpen, setIsProofModalOpen] = useState(false);
    const [viewingProofUrl, setViewingProofUrl] = useState('');
    const [isProofLoading, setIsProofLoading] = useState(false);
    const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
    const [pdfFileName, setPdfFileName] = useState('');

    const screens = Grid.useBreakpoint();
    const debouncedSearchText = useDebounce(filters.searchText, 300);

    const deferredMutasiList = useDeferredValue(mutasiList);
    const deferredSearch = useDeferredValue(debouncedSearchText);
    const deferredDateRange = useDeferredValue(filters.dateRange);
    const deferredSelectedTipe = useDeferredValue(filters.selectedTipe);
    const deferredSelectedKategori = useDeferredValue(filters.selectedKategori);

    const isFiltering =
        mutasiList !== deferredMutasiList ||
        debouncedSearchText !== deferredSearch ||
        filters.dateRange !== deferredDateRange ||
        filters.selectedTipe !== deferredSelectedTipe ||
        filters.selectedKategori !== deferredSelectedKategori;

    const isFilterActive = !!filters.dateRange || filters.selectedTipe.length > 0 || filters.selectedKategori.length > 0 || !!filters.searchText;

    const getTimestamp = useCallback((record) => record?.tanggal || record?.tanggalBayar || 0, []);

    const handleFilterChange = useCallback((key, value) => {
        if (key === 'searchText') {
            setFilters(prev => ({ ...prev, [key]: value }));
            setPagination(prev => ({ ...prev, current: 1 }));
            return;
        }
        setTimeout(() => setFilters(prev => ({ ...prev, [key]: value })), 0);
        setPagination(prev => ({ ...prev, current: 1 }));
    }, []);

    const handleMultiSelectFilter = useCallback((key, value) => {
        setTimeout(() => {
            setFilters(prev => {
                const currentSelection = prev[key];
                const newSelection = currentSelection.includes(value)
                    ? currentSelection.filter(item => item !== value)
                    : [...currentSelection, value];
                return { ...prev, [key]: newSelection };
            });
        }, 0);
        setPagination(prev => ({ ...prev, current: 1 }));
    }, []);

    const handleTableChange = useCallback((paginationConfig) => {
        setPagination(paginationConfig);
    }, []);

    const resetFilters = useCallback(() => {
        setTimeout(() => {
            setFilters({
                dateRange: null,
                selectedTipe: [],
                selectedKategori: [],
                searchText: '',
            });
            setPagination(prev => ({ ...prev, current: 1 }));
        }, 0);
    }, []);

    const handleViewProof = useCallback((url) => {
         setIsProofLoading(true);
         setViewingProofUrl(url);
         setIsProofModalOpen(true);
    }, []);

    const handleDownloadProof = useCallback(async (url) => {
         if (!url) return;
         message.loading({ content: 'Mengunduh file...', key: 'downloading' });
         try {
             const response = await fetch(url);
             if (!response.ok) {
                 throw new Error(`Gagal mengambil file: ${response.statusText}. Pastikan konfigurasi CORS pada Firebase Storage sudah benar.`);
             }
             const blob = await response.blob();
             const objectUrl = window.URL.createObjectURL(blob);
             const link = document.createElement('a');
             link.href = objectUrl;
             const fileName = url.split('/').pop().split('?')[0].split('%2F').pop() || 'bukti-transaksi';
             link.setAttribute('download', fileName);
             document.body.appendChild(link);
             link.click();
             link.parentNode.removeChild(link);
             window.URL.revokeObjectURL(objectUrl);
             message.success({ content: 'File berhasil diunduh!', key: 'downloading', duration: 2 });
         } catch (error) {
             console.error('Download error:', error);
             message.error({ content: 'Gagal mengunduh file. Periksa konsol untuk detail.', key: 'downloading', duration: 4 });
         }
    }, [message]);

    const handleShareProof = useCallback(async (url) => {
         if (!navigator.share) { message.warning('Fitur share tidak didukung di browser ini.'); return; }
         message.loading({ content: 'Menyiapkan file...', key: 'sharing' });
         try {
             const response = await fetch(url);
             if (!response.ok) throw new Error('Gagal mengambil file untuk dibagikan.');
             const blob = await response.blob();
             const fileName = url.split('/').pop().split('?')[0].split('%2F').pop() || 'bukti-transaksi';
             const file = new File([blob], fileName, { type: blob.type });

             if (navigator.canShare && navigator.canShare({ files: [file] })) {
                 await navigator.share({
                     files: [file], title: 'Bukti Transaksi', text: 'Berikut adalah bukti transaksi:',
                 });
                 message.success({ content: 'Berhasil dibagikan!', key: 'sharing', duration: 2 });
             } else {
                 await navigator.share({
                     title: 'Bukti Transaksi', text: 'Berikut adalah bukti transaksi:', url: url,
                 });
                 message.success({ content: 'Tautan berhasil dibagikan!', key: 'sharing', duration: 2 });
             }
         } catch (error) {
             console.error('Share error:', error);
             if (error.name !== 'AbortError') { message.error({ content: 'Gagal membagikan file.', key: 'sharing', duration: 2 }); } else { message.destroy('sharing'); }
         }
    }, [message]);

    const handleClosePreviewModal = useCallback(() => {
         setIsPreviewModalVisible(false);
         if (pdfPreviewUrl) { URL.revokeObjectURL(pdfPreviewUrl); }
         setPdfPreviewUrl('');
         setPdfFileName('');
    }, [pdfPreviewUrl]);

    const handleTambah = useCallback(() => {
         setEditingTransaksi(null);
         setIsModalOpen(true);
    }, []);

    const handleEdit = useCallback((record) => {
         setEditingTransaksi(record);
         setIsModalOpen(true);
    }, []);

    const balanceMap = useMemo(() => {
        const listToProcess = deferredMutasiList;
        if (!listToProcess || listToProcess.length === 0) return new Map();
        const sortedAllTx = [...listToProcess].sort((a, b) => getTimestamp(a) - getTimestamp(b));
        const map = new Map();
        let currentBalance = 0;
        for (const tx of sortedAllTx) {
            currentBalance += (tx.jumlah || 0);
            map.set(tx.id, currentBalance);
        }
        return map;
    }, [deferredMutasiList, getTimestamp]);

    const filteredTransaksi = useMemo(() => {
        let data = deferredMutasiList;

        if (deferredDateRange) {
             const [startDate, endDate] = deferredDateRange;
             if(startDate && endDate){
                 const start = startDate.startOf('day');
                 const end = endDate.endOf('day');
                 data = data.filter(tx => {
                     const tgl = dayjs(getTimestamp(tx));
                     return tgl.isAfter(start) && tgl.isBefore(end);
                 });
             }
        }
        if (deferredSelectedTipe.length > 0) {
            data = data.filter(tx => deferredSelectedTipe.includes(tx.tipe));
        }
        if (deferredSelectedKategori.length > 0) {
            data = data.filter(tx => deferredSelectedKategori.includes(tx.kategori) || deferredSelectedKategori.includes(tx.tipeMutasi));
        }
        if (deferredSearch) {
             const lowerSearch = deferredSearch.toLowerCase();
             data = data.filter(tx => String(tx.keterangan || '').toLowerCase().includes(lowerSearch));
        }

        return data.map(tx => ({ ...tx, saldoSetelah: balanceMap.get(tx.id) }));

    }, [
         deferredMutasiList,
         deferredDateRange,
         deferredSelectedTipe,
         deferredSelectedKategori,
         deferredSearch,
         balanceMap,
         getTimestamp
    ]);

    const rekapDataForCard = useMemo(() => {
        const dataToProses = filteredTransaksi;

        if (!dataToProses || dataToProses.length === 0) {
            return { pemasukanEntries: [], pengeluaranEntries: [], totalPemasukan: 0, totalPengeluaran: 0, saldoAkhirFilter: 0 };
        }
        let totalPemasukan = 0; let totalPengeluaran = 0;
        const pemasukanMap = new Map(); const pengeluaranMap = new Map();
        for (const tx of dataToProses) {
             const kategoriNama = tx.tipe === 'pemasukan' ? KategoriPemasukan[tx.kategori] || tx.kategori?.replace(/_/g, ' ') || 'Pemasukan Lain' : KategoriPengeluaran[tx.kategori] || tx.kategori?.replace(/_/g, ' ') || 'Pengeluaran Lain';
            if (tx.tipe === 'pemasukan' && tx.jumlah > 0) { totalPemasukan += tx.jumlah; pemasukanMap.set(kategoriNama, (pemasukanMap.get(kategoriNama) || 0) + tx.jumlah); }
             else if (tx.tipe === 'pengeluaran' && tx.jumlah < 0) { const positiveAmount = Math.abs(tx.jumlah); totalPengeluaran += positiveAmount; pengeluaranMap.set(kategoriNama, (pengeluaranMap.get(kategoriNama) || 0) + positiveAmount); }
        }
        const pemasukanEntries = Array.from(pemasukanMap.entries()).sort((a, b) => b[1] - a[1]);
        const pengeluaranEntries = Array.from(pengeluaranMap.entries()).sort((a, b) => b[1] - a[1]);
        
        // Urutkan dulu filteredTransaksi berdasarkan tanggal descending
        const sortedFiltered = [...dataToProses].sort((a, b) => getTimestamp(b) - getTimestamp(a));
        const saldoAkhirFilter = sortedFiltered.length > 0 ? sortedFiltered[0].saldoSetelah : 0;

        return { pemasukanEntries, pengeluaranEntries, totalPemasukan, totalPengeluaran, saldoAkhirFilter };

    }, [filteredTransaksi, getTimestamp]);


    const handleGeneratePdf = useCallback(() => {
         const dataForPdf = filteredTransaksi; if (dataForPdf.length === 0) { message.warning('Tidak ada data untuk diekspor.'); return; }
         try {
             const { blobUrl, fileName } = generateMutasiPdf(
                 dataForPdf, filters, balanceMap, KategoriPemasukan, KategoriPengeluaran
             );
             setPdfPreviewUrl(blobUrl); setPdfFileName(fileName); setIsPreviewModalVisible(true);
         } catch (error) { console.error("Gagal membuat PDF:", error); message.error("Gagal membuat PDF. Periksa konsol."); }
    }, [filteredTransaksi, filters, balanceMap, message]);


    const columns = useMemo(() => {
        const baseColumns = [
             { title: 'Tanggal', dataIndex: 'tanggal', key: 'tanggal', render: (tgl, record) => dayjs(getTimestamp(record)).format('DD MMM YYYY'), sorter: (a, b) => getTimestamp(a) - getTimestamp(b), defaultSortOrder: 'descend', width: 140 },
             { title: 'Jenis Transaksi', dataIndex: 'kategori', key: 'kategori', render: (kategori, record) => { const katText = record.tipe === 'pemasukan' ? KategoriPemasukan[kategori] || kategori?.replace(/_/g, ' ') : KategoriPengeluaran[kategori] || kategori?.replace(/_/g, ' '); return <Tag color={record.tipe === 'pemasukan' ? 'green' : 'red'}>{katText || record.tipeMutasi}</Tag>; }, width: 200 },
             { title: 'Keterangan', dataIndex: 'keterangan', key: 'keterangan' },
             { title: 'Nominal', dataIndex: 'jumlah', key: 'jumlah', align: 'right', render: (jml, record) => <Text type={record.jumlah >= 0 ? 'success' : 'danger'}>{currencyFormatter(record.jumlah)}</Text>, sorter: (a, b) => a.jumlah - b.jumlah, width: 180 },
             { title: 'Saldo Akhir', dataIndex: 'saldoSetelah', key: 'saldoSetelah', align: 'right', render: (saldo) => (saldo != null) ? currencyFormatter(saldo) : <Text type="secondary">-</Text>, sorter: (a, b) => (a.saldoSetelah || 0) - (b.saldoSetelah || 0), width: 180 },
             { title: 'Aksi', key: 'aksi', align: 'center', render: (_, record) => ( <Space size="middle"> <Tooltip title={record.buktiUrl ? "Lihat Bukti" : "Tidak ada bukti"}><Button type="link" icon={<EyeOutlined />} onClick={() => handleViewProof(record.buktiUrl)} disabled={!record.buktiUrl} /></Tooltip> <Tooltip title="Edit Transaksi"><Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} /></Tooltip> </Space> ), width: 140 },
        ];
        if (!screens.md) return baseColumns.filter(col => col.key !== 'saldoSetelah');
        return baseColumns;
    }, [screens, handleEdit, getTimestamp, handleViewProof]); // Menghapus currencyFormatter dari dependencies karena sudah di-scope

    return (
        <Content style={{ padding: screens.xs ? '12px' : '24px', backgroundColor: '#f0f2f5' }}>

            {/* Bagian Filter */}
            <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
                <Col xs={24} lg={14}>
                    <Card style={{ height: '100%' }}>
                        <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>Filter Transaksi</Title>
                        <Spin spinning={isFiltering && !initialLoading} tip="Memfilter data...">
                            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                                <Row gutter={[16, 16]}>
                                    <Col xs={24} sm={12}><RangePicker style={{ width: '100%' }} onChange={(dates) => handleFilterChange('dateRange', dates)} value={filters.dateRange} placeholder={['Tanggal Mulai', 'Tanggal Selesai']} /></Col>
                                    <Col xs={24} sm={12}><Input.Search placeholder="Cari berdasarkan keterangan..." value={filters.searchText} onChange={(e) => handleFilterChange('searchText', e.target.value)} allowClear style={{ width: '100%' }} /></Col>
                                </Row>
                                
                                <Row gutter={[16, 16]}>
                                    <Col xs={24}>
                                        <Text strong>Tipe Transaksi:</Text>
                                        <div style={{ marginTop: 8 }}><Space wrap>
                                            <Tag.CheckableTag style={chipStyle} checked={filters.selectedTipe.includes(TipeTransaksi.pemasukan)} onChange={() => handleMultiSelectFilter('selectedTipe', TipeTransaksi.pemasukan)}>Pemasukan</Tag.CheckableTag>
                                            <Tag.CheckableTag style={chipStyle} checked={filters.selectedTipe.includes(TipeTransaksi.pengeluaran)} onChange={() => handleMultiSelectFilter('selectedTipe', TipeTransaksi.pengeluaran)}>Pengeluaran</Tag.CheckableTag>
                                        </Space></div>
                                    </Col>
                                    <Col xs={24}>
                                        {(filters.selectedTipe.length === 0 || filters.selectedTipe.includes(TipeTransaksi.pemasukan)) && (
                                            <div style={{ marginBottom: 16 }}>
                                                <Text strong>Kategori Pemasukan:</Text>
                                                <div style={{ marginTop: 8 }}><KategoriChips kategoriMap={KategoriPemasukan} onSelect={handleMultiSelectFilter} selectedKategori={filters.selectedKategori} /></div>
                                            </div>
                                        )}
                                        {(filters.selectedTipe.length === 0 || filters.selectedTipe.includes(TipeTransaksi.pengeluaran)) && (
                                            <div>
                                                <Text strong>Kategori Pengeluaran:</Text>
                                                <div style={{ marginTop: 8 }}><KategoriChips kategoriMap={KategoriPengeluaran} onSelect={handleMultiSelectFilter} selectedKategori={filters.selectedKategori} /></div>
                                            </div>
                                        )}
                                    </Col>
                                </Row>
                                
                                {isFilterActive && (
                                    <Button icon={<SyncOutlined />} onClick={resetFilters} style={{ width: screens.xs ? '100%' : 'fit-content' }}>Reset Filter</Button>
                                )}
                            </Space>
                        </Spin>
                    </Card>
                </Col>

                {/* Rekapitulasi Card */}
                <Col xs={24} lg={10}>
                    <RekapitulasiCard
                        rekapData={rekapDataForCard}
                        isFilterActive={isFilterActive}
                        loading={initialLoading || isFiltering}
                    />
                </Col>
            </Row>

            {/* Card Tabel */}
            <Card>
                <Row justify="space-between" align="middle" gutter={[16, 16]}>
                    <Col xs={24} sm={12} style={{ marginBottom: screens.xs ? 8 : 0 }}>
                        <Title level={5} style={{ margin: 0 }}>Daftar Transaksi</Title>
                    </Col>
                    <Col xs={24} sm={12} style={{ textAlign: screens.xs ? 'left' : 'right' }}>
                        <Space wrap>
                            <Button icon={<DownloadOutlined />} onClick={handleGeneratePdf} disabled={filteredTransaksi.length === 0 || isFiltering}>Export PDF</Button>
                            <Button type="primary" icon={<PlusOutlined />} onClick={handleTambah} disabled={initialLoading}>Tambah Mutasi</Button>
                        </Space>
                    </Col>
                </Row>
                
                <Divider style={{ margin: '16px 0' }} />

                <Table
                    columns={columns}
                    dataSource={filteredTransaksi}
                    loading={initialLoading}
                    rowKey="id"
                    size="middle"
                    scroll={{ x: 'max-content' }}
                    pagination={{ ...pagination, showTotal: (total, range) => `${range[0]}-${range[1]} dari ${total} transaksi` }}
                    onChange={handleTableChange}
                    rowClassName={getRowClassName}
                />
            </Card>


            {/************************************
             * PERBAIKAN ADA DI SINI      *
             ************************************/}
            {isModalOpen && (
                <TransaksiForm
                    open={isModalOpen}
                    onCancel={() => { setIsModalOpen(false); setEditingTransaksi(null); }}
                    initialValues={editingTransaksi} 
                    unpaidJual={unpaidJual}
                    unpaidCetak={unpaidCetak}
                    loadingInvoices={loadingInvoices}
                />
            )}
            {/************************************
             * AKHIR BAGIAN PERBAIKAN      *
             ************************************/}


            {/* Modal PDF Preview */}
            <PdfPreviewModal visible={isPreviewModalVisible} onClose={handleClosePreviewModal} pdfBlobUrl={pdfPreviewUrl} fileName={pdfFileName} />

            {/* Modal Bukti Transaksi */}
            <Modal open={isProofModalOpen} title="Bukti Transaksi" onCancel={() => setIsProofModalOpen(false)} footer={[ <Button key="close" onClick={() => setIsProofModalOpen(false)}>Tutup</Button>, navigator.share && (<Button key="share" icon={<ShareAltOutlined />} onClick={() => handleShareProof(viewingProofUrl)}>Share</Button>), <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={() => handleDownloadProof(viewingProofUrl)}>Download</Button> ]} width={800} bodyStyle={{ padding: '24px', textAlign: 'center', minHeight: '300px' }} destroyOnClose>
                 {isProofLoading && <Spin size="large" />} {viewingProofUrl && ( viewingProofUrl.toLowerCase().includes('.pdf') ? ( <iframe src={viewingProofUrl} style={{ width: '100%', height: '65vh', border: 'none', display: isProofLoading ? 'none' : 'block' }} title="Bukti PDF" onLoad={() => setIsProofLoading(false)} /> ) : ( <img alt="Bukti Transaksi" style={{ width: '100%', height: 'auto', maxHeight: '70vh', objectFit: 'contain', display: isProofLoading ? 'none' : 'block' }} src={viewingProofUrl} onLoad={() => setIsProofLoading(false)} /> ) )}
            </Modal>
        </Content>
    );
};

export default MutasiPage;
