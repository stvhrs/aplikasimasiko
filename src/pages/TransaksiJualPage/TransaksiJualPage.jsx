import React, { useEffect, useState, useMemo, useCallback, useDeferredValue } from 'react';
import {
    Layout, Card, Spin, Empty, Typography, Input, Row, Col, Statistic, Tag, Button, Modal,
    Dropdown, Menu, App, DatePicker, Space, Tabs
} from 'antd';
import {
    PlusOutlined, MoreOutlined, DownloadOutlined, ShareAltOutlined, EditOutlined,
    PrinterOutlined, ReadOutlined, PullRequestOutlined // Icon untuk Tab
} from '@ant-design/icons';
// Impor ref dan onValue tidak diperlukan lagi jika data diambil dari hook
// import { ref, onValue } from 'firebase/database';
// import { db } from '../../api/firebase'; // db diambil dari hook
import dayjs from 'dayjs';

// Impor PDF Generator (Hanya untuk Laporan Transaksi Tab 1)
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Import untuk PDF Viewer (Hanya untuk Laporan Transaksi Tab 1)
import { Worker, Viewer } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';

import useDebounce from '../../hooks/useDebounce'; // Sesuaikan path
import TransaksiJualForm from './components/TransaksiJualForm'; // Sesuaikan path
import TransaksiJualDetailModal from './components/TransaksiJualDetailModal'; // Sesuaikan path
import TransaksiJualTableComponent from './components/TransaksiJualTableComponent'; // Sesuaikan path
import { generateInvoicePDF, generateNotaPDF } from '../../utils/pdfGenerator'; // Sesuaikan path

// Impor hook data yang sudah ada
import { useTransaksiJualData, useBukuData, usePelangganData } from '../../hooks/useTransaksiData'; // Sesuaikan path jika hook dipisah

// Impor komponen Tab 2
import TagihanPelangganTab from './components/TagihanPelangganTab'; // Sesuaikan path

const { Content } = Layout;
const { Title } = Typography;
const { Search } = Input;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

// --- Helpers ---
const formatCurrency = (value) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);
const formatDate = (timestamp) =>
    new Date(timestamp || 0).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const normalizeStatus = (s) => (s === 'DP' ? 'Sebagian' : s || 'N/A');
// -------------


export default function TransaksiJualPage() {
    const { message } = App.useApp();

    // --- Data Global via Hooks ---
    const { data: allTransaksi, loading: loadingTransaksi } = useTransaksiJualData();
    const { data: bukuList, loading: loadingBuku } = useBukuData(); // Ubah nama variabel jika perlu
    const { data: pelangganList, loading: loadingPelanggan } = usePelangganData(); // Ubah nama variabel jika perlu
    const loadingDependencies = loadingBuku || loadingPelanggan;

    // --- State untuk TAB 1: Daftar Transaksi ---
    const [searchText, setSearchText] = useState('');
    const debouncedSearchText = useDebounce(searchText, 300);
    const [selectedStatus, setSelectedStatus] = useState([]);
    const [dateRange, setDateRange] = useState(null);
    const showTotalPagination = useCallback((total, range) => `${range[0]}-${range[1]} dari ${total} transaksi`, []);
    const [pagination, setPagination] = useState({
        current: 1, pageSize: 10, // Default PageSize untuk Tab 1
        showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'],
        showTotal: showTotalPagination
    });

    // --- State Modal (Global - Hanya untuk Form, Detail, dan PDF Laporan Transaksi) ---
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [formMode, setFormMode] = useState('create');
    const [editingTx, setEditingTx] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedTransaksi, setSelectedTransaksi] = useState(null);
    // State PDF Modal untuk Laporan Transaksi (Tab 1)
    const [isTxPdfModalOpen, setIsTxPdfModalOpen] = useState(false);
    const [txPdfBlob, setTxPdfBlob] = useState(null);
    const [txPdfTitle, setTxPdfTitle] = useState('');
    const [isTxPdfGenerating, setIsTxPdfGenerating] = useState(false);
    const [txPdfFileName, setTxPdfFileName] = useState('laporan_transaksi.pdf');


    // --- Defer State (TAB 1) ---
    const deferredAllTransaksi = useDeferredValue(allTransaksi);
    const deferredDebouncedSearch = useDeferredValue(debouncedSearchText);
    const deferredSelectedStatus = useDeferredValue(selectedStatus);
    const deferredDateRange = useDeferredValue(dateRange);

    // Cek jika filter TAB 1 aktif
    const isFilterActive = useMemo(() => {
        return !!deferredDebouncedSearch || deferredSelectedStatus.length > 0 || !!deferredDateRange;
    }, [deferredDebouncedSearch, deferredSelectedStatus, deferredDateRange]);

    // --- Filter Data (TAB 1) ---
    const filteredTransaksi = useMemo(() => {
        let data = [...deferredAllTransaksi]; // Salin array

        if (deferredDateRange) {
            const [startDate, endDate] = deferredDateRange;
            if (startDate && endDate) {
                const start = startDate.startOf('day');
                const end = endDate.endOf('day');
                data = data.filter((tx) => {
                    const txDate = dayjs(tx.tanggal);
                    // Handle invalid dates & ensure inclusivity
                    return tx.tanggal && txDate.isValid() && txDate.isAfter(start.subtract(1, 'second')) && txDate.isBefore(end.add(1, 'second'));
                });
            }
        }

        if (deferredSelectedStatus.length > 0) {
            data = data.filter((tx) => deferredSelectedStatus.includes(normalizeStatus(tx.statusPembayaran)));
        }

        if (deferredDebouncedSearch) {
            const q = deferredDebouncedSearch.toLowerCase();
            data = data.filter((tx) =>
                (tx.nomorInvoice || '').toLowerCase().includes(q) ||
                (tx.namaPelanggan || '').toLowerCase().includes(q) ||
                (tx.keterangan || '').toLowerCase().includes(q)
            );
        }

        // Default sort (terbaru dulu berdasarkan tanggal transaksi)
        // Lakukan sort *setelah* filter
        return data.sort((a, b) => (b.tanggal || 0) - (a.tanggal || 0));

    }, [deferredAllTransaksi, deferredSelectedStatus, deferredDebouncedSearch, deferredDateRange]);

    // Cek jika sedang proses filtering (TAB 1)
    const isFiltering =
        allTransaksi !== deferredAllTransaksi ||
        debouncedSearchText !== deferredDebouncedSearch ||
        selectedStatus !== deferredSelectedStatus ||
        dateRange !== deferredDateRange;

    // --- Kalkulasi Rekap (TAB 1) ---
    const recapData = useMemo(() => {
        const dataToRecap = filteredTransaksi;
        const totals = dataToRecap.reduce(
            (acc, tx) => ({
                tagihan: acc.tagihan + Number(tx.totalTagihan || 0),
                terbayar: acc.terbayar + Number(tx.jumlahTerbayar || 0)
            }),
            { tagihan: 0, terbayar: 0 }
        );
        return {
            totalTagihan: totals.tagihan,
            totalTerbayar: totals.terbayar,
            sisaTagihan: totals.tagihan - totals.terbayar,
            isFilterActive: isFilterActive
        };
    }, [filteredTransaksi, isFilterActive]);


    // --- Handlers (TAB 1) ---
    const handleSearchChange = useCallback((e) => { setSearchText(e.target.value); setPagination(prev => ({ ...prev, current: 1 })); }, []);
    const handleDateChange = useCallback((dates) => { setDateRange(dates); setPagination(prev => ({ ...prev, current: 1 })); }, []);
    const handleStatusToggle = useCallback((status) => { setSelectedStatus(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]); setPagination(prev => ({ ...prev, current: 1 })); }, []);
    const resetFilters = useCallback(() => { setSearchText(''); setSelectedStatus([]); setDateRange(null); setPagination(prev => ({ ...prev, current: 1 })); }, []);
    const handleTableChange = useCallback((paginationConfig) => { setPagination(paginationConfig); }, []); // Sorting utama ditangani di useMemo


    // --- Handlers Modal (Global) ---
    const handleOpenCreate = useCallback(() => { setFormMode('create'); setEditingTx(null); setIsFormModalOpen(true); }, []);
    const handleOpenEdit = useCallback((tx) => { setFormMode('edit'); setEditingTx(tx); setIsFormModalOpen(true); }, []);
    const handleCloseFormModal = useCallback(() => { setIsFormModalOpen(false); setEditingTx(null); }, []);
    const handleFormSuccess = useCallback(() => {
        handleCloseFormModal();
    }, [handleCloseFormModal]);
    const handleOpenDetailModal = useCallback((tx) => { setSelectedTransaksi(tx); setIsDetailModalOpen(true); }, []);
    const handleCloseDetailModal = useCallback(() => { setSelectedTransaksi(null); setIsDetailModalOpen(false); }, []);

    // --- Handlers PDF (Global - Khusus Modal Tab 1) ---
    const handleCloseTxPdfModal = useCallback(() => { setIsTxPdfModalOpen(false); setIsTxPdfGenerating(false); setTxPdfBlob(null); setTxPdfTitle(''); }, []);
    const handleGenerateInvoice = useCallback(async (tx) => {
        setTxPdfTitle(`Invoice: ${tx.nomorInvoice || tx.id}`);
        setIsTxPdfGenerating(true);
        setIsTxPdfModalOpen(true); // Buka modal laporan (Tab 1)
        setTxPdfBlob(null);
        try {
            const dataUri = generateInvoicePDF(tx); // Asumsi fungsi ini mengembalikan data URI
            const blob = await fetch(dataUri).then(r => r.blob());
            setTxPdfBlob(blob);
        } catch (err) {
            console.error("Gagal generate invoice PDF:", err);
            message.error('Gagal membuat PDF invoice.');
            setIsTxPdfModalOpen(false); // Tutup modal jika gagal
        } finally {
            setIsTxPdfGenerating(false);
        }
     }, [message]);

    const handleGenerateNota = useCallback(async (tx) => {
        const statusNormal = normalizeStatus(tx?.statusPembayaran);
        if (!['Sebagian', 'Lunas'].includes(statusNormal)) {
            message.error('Nota hanya untuk status Sebagian atau Lunas');
            return;
        }
        setTxPdfTitle(`Nota: ${tx.nomorInvoice || tx.id}`);
        setIsTxPdfGenerating(true);
        setIsTxPdfModalOpen(true); // Buka modal laporan (Tab 1)
        setTxPdfBlob(null);
        try {
            const dataUri = generateNotaPDF(tx); // Asumsi fungsi ini mengembalikan data URI
            const blob = await fetch(dataUri).then(r => r.blob());
            setTxPdfBlob(blob);
        } catch (err) {
            console.error("Gagal generate nota PDF:", err);
            message.error('Gagal membuat PDF nota.');
            setIsTxPdfModalOpen(false); // Tutup modal jika gagal
        } finally {
            setIsTxPdfGenerating(false);
        }
     }, [message]);

    const handleDownloadTxPdf = useCallback(async () => {
        if (!txPdfBlob) return;
        message.loading({ content: 'Mengunduh...', key: 'pdfdl_tx', duration: 0 });
        try {
            const url = URL.createObjectURL(txPdfBlob);
            const link = document.createElement('a');
            link.href = url;
            // Gunakan txPdfFileName yang sudah diset
            const fn = `${txPdfFileName.replace(/[\/:]/g, '_') || 'download'}.pdf`;
            link.setAttribute('download', fn);
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            message.success({ content: 'Unduhan dimulai!', key: 'pdfdl_tx', duration: 2 });
        } catch (err) {
            message.error({ content: `Gagal mengunduh: ${err.message}`, key: 'pdfdl_tx', duration: 3 });
        }
    }, [txPdfBlob, txPdfFileName, message]);

    const handleShareTxPdf = useCallback(async () => {
        if (!navigator.share) { message.error('Fitur share tidak didukung di browser ini.'); return; }
        if (!txPdfBlob) return;
        // Gunakan txPdfFileName yang sudah diset
        const fn = `${txPdfFileName.replace(/[\/:]/g, '_') || 'file'}.pdf`;
        const file = new File([txPdfBlob], fn, { type: 'application/pdf' });
        const shareData = { title: txPdfTitle, text: `File PDF: ${txPdfTitle}`, files: [file] };
        if (navigator.canShare && navigator.canShare(shareData)) {
            try {
                await navigator.share(shareData);
                message.success('Berhasil dibagikan!');
            } catch (err) {
                if (err.name !== 'AbortError') message.error(`Gagal berbagi: ${err.message}`);
            }
        } else {
            message.warn('Berbagi file PDF tidak didukung.');
        }
    }, [txPdfBlob, txPdfTitle, txPdfFileName, message]);


    // --- Handler Cetak PDF Laporan (TAB 1) ---
    const handleGenerateReportPdf = useCallback(async () => {
        if (filteredTransaksi.length === 0) {
            message.warning('Tidak ada data transaksi untuk dicetak pada filter ini.');
            return;
        }

        const title = 'Laporan Transaksi Penjualan';
        setTxPdfTitle(title);
        setIsTxPdfGenerating(true);
        setIsTxPdfModalOpen(true);
        setTxPdfBlob(null);
        setTxPdfFileName(`Laporan_Transaksi_${dayjs().format('YYYYMMDD')}.pdf`);

        setTimeout(async () => { // Generate di background
            try {
                const doc = new jsPDF();
                let startY = 36; doc.setFontSize(18); doc.text(title, 14, 22); doc.setFontSize(10);
                const filterInfo = []; if (deferredDateRange) filterInfo.push(`Tgl: ${deferredDateRange[0].format('DD/MM/YY')} - ${deferredDateRange[1].format('DD/MM/YY')}`); if (deferredSelectedStatus.length > 0) filterInfo.push(`Status: ${deferredSelectedStatus.join(', ')}`); if (deferredDebouncedSearch) filterInfo.push(`Cari: "${deferredDebouncedSearch}"`);
                if (filterInfo.length > 0) doc.text(`Filter Aktif: ${filterInfo.join(' | ')}`, 14, 30); else { doc.text('Filter Aktif: Menampilkan Semua', 14, 30); startY = 30; }
                autoTable(doc, { startY: startY, body: [['Total Tagihan', formatCurrency(recapData.totalTagihan)], ['Total Terbayar', formatCurrency(recapData.totalTerbayar)], ['Total Sisa Tagihan', formatCurrency(recapData.sisaTagihan)]], theme: 'grid', styles: { fontSize: 10, cellPadding: 2 }, columnStyles: { 0: { fontStyle: 'bold', halign: 'right' }, 1: { halign: 'right' } }, didDrawCell: (data) => { if (data.section === 'body') { if (data.row.index === 1) data.cell.styles.textColor = [40, 167, 69]; if (data.row.index === 2) data.cell.styles.textColor = [220, 53, 69]; } } });
                const tableHead = ['Tanggal', 'ID Transaksi', 'Pelanggan', 'Total Tagihan', 'Sisa Tagihan', 'Status']; const tableBody = filteredTransaksi.map(tx => { const sisa = (tx.totalTagihan || 0) - (tx.jumlahTerbayar || 0); return [formatDate(tx.tanggal), tx.nomorInvoice || tx.id, tx.namaPelanggan || '-', formatCurrency(tx.totalTagihan), formatCurrency(sisa), normalizeStatus(tx.statusPembayaran)]; });
                autoTable(doc, { head: [tableHead], body: tableBody, startY: doc.lastAutoTable.finalY + 10, theme: 'striped', headStyles: { fillColor: [41, 128, 185] }, styles: { fontSize: 8, cellPadding: 2 }, columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } }, foot: [['', '', 'TOTAL', formatCurrency(recapData.totalTagihan), formatCurrency(recapData.sisaTagihan), '']], footStyles: { fontStyle: 'bold', halign: 'right', fillColor: [230, 230, 230], textColor: 0 } });

                setTxPdfBlob(doc.output('blob'));
            } catch (err) {
                console.error("Gagal generate PDF Laporan Transaksi:", err);
                message.error('Gagal membuat PDF Laporan.');
                setIsTxPdfModalOpen(false);
            } finally {
                setIsTxPdfGenerating(false);
            }
        }, 50);

    }, [filteredTransaksi, recapData, deferredDateRange, deferredSelectedStatus, deferredDebouncedSearch, message]);


    // --- Definisi Kolom Tabel (TAB 1) ---

const renderAksi = useCallback((_, record) => {
    const items = [
        {
            key: "detail",
            label: "Lihat Detail",
            onClick: () => handleOpenDetailModal(record),
        },
        {
            key: "edit",
            label: "Edit Transaksi",
            onClick: () => handleOpenEdit(record),
        },
        {
            type: "divider",
        },
        {
            key: "inv",
            label: "Generate Invoice",
            onClick: () => handleGenerateInvoice(record),
        },
        {
            key: "nota",
            label: "Generate Nota",
            disabled: !["Sebagian", "Lunas"].includes(normalizeStatus(record?.statusPembayaran)),
            onClick: () => handleGenerateNota(record),
        },
    ];

    return (
        <Dropdown
            menu={{ items }}
            trigger={["click"]}
            placement="bottomRight"
        >
            {/* PERBAIKAN: Bungkus Button dengan <a> sebagai trigger yang valid */}
            <a onClick={e => e.preventDefault()}>
                <Button icon={<MoreOutlined />} size="small" />
            </a>
        </Dropdown>
    );
}, [handleOpenDetailModal, handleOpenEdit, handleGenerateInvoice, handleGenerateNota]);
    const columns = useMemo(() => [
        { title: 'No.', key: 'index', width: 60, render: (_t, _r, idx) => ((pagination.current - 1) * pagination.pageSize) + idx + 1 },
        { title: 'Tanggal', dataIndex: 'tanggal', key: 'tanggal', width: 140, render: formatDate, sorter: (a, b) => (a.tanggal || 0) - (b.tanggal || 0) },
        { title: 'ID Transaksi', dataIndex: 'id', key: 'id', width: 200, render: (id) => <small>{id}</small> },
        { title: 'Pelanggan', dataIndex: 'namaPelanggan', key: 'namaPelanggan', width: 240, sorter: (a, b) => (a.namaPelanggan || '').localeCompare(b.namaPelanggan || ''), render: (val, record) => (<span>{val} {record.pelangganIsSpesial ? <Tag color="gold">Spesial</Tag> : null}</span>) },
        { title: 'Keterangan', dataIndex: 'keterangan', key: 'keterangan', ellipsis: true, render: (v) => v || '-' },
        { title: 'Total Tagihan', dataIndex: 'totalTagihan', key: 'totalTagihan', align: 'right', width: 160, render: formatCurrency, sorter: (a, b) => (a.totalTagihan || 0) - (b.totalTagihan || 0) },
        { title: 'Sisa Tagihan', key: 'sisaTagihan', align: 'right', width: 160, render: (_, r) => { const sisa = (r.totalTagihan || 0) - (r.jumlahTerbayar || 0); return <span style={{ color: sisa > 0 ? '#cf1322' : '#3f8600', fontWeight: 600 }}>{formatCurrency(sisa)}</span>; }, sorter: (a, b) => ((a.totalTagihan || 0) - (a.jumlahTerbayar || 0)) - ((b.totalTagihan || 0) - (b.jumlahTerbayar || 0)) },
        { title: 'Status Bayar', dataIndex: 'statusPembayaran', key: 'statusPembayaran', width: 140, render: (statusRaw) => { const status = normalizeStatus(statusRaw); let color = 'default'; if (status === 'Lunas') color = 'green'; else if (status === 'Belum Bayar') color = 'red'; else if (status === 'Sebagian') color = 'orange'; return <Tag color={color}>{status}</Tag>; } },
        { title: 'Aksi', key: 'aksi', align: 'center', width: 100, render: renderAksi },
    ], [pagination, renderAksi]); // Pastikan renderAksi ada di dependensi

    const tableScrollX = useMemo(() => columns.reduce((acc, col) => acc + (col.width || 150), 0), [columns]);

    // Kalkulasi Persentase Recap (TAB 1)
    const paidPercent = recapData.totalTagihan > 0 ? (recapData.totalTerbayar / recapData.totalTagihan) * 100 : 0;
    const outstandingPercent = recapData.totalTagihan > 0 ? (recapData.sisaTagihan / recapData.totalTagihan) * 100 : 0;

    // --- Render JSX ---
    return (
        <Layout>
             <Content style={{ padding: '24px', backgroundColor: '#f0f2f5' }}>

                {/* --- Struktur Tabs Utama --- */}
                <Tabs defaultActiveKey="1" type="card">

                    {/* =================================================================== */}
                    {/* ---                         TAB 1: DAFTAR TRANSAKSI               --- */}
                    {/* =================================================================== */}
                    <TabPane tab={<Space><ReadOutlined /> Daftar Transaksi</Space>} key="1">
                        {/* Card Recap */}
                        <Card style={{ marginBottom: 24 }}>
                           <Title level={4} style={{ margin: 0, marginBottom: 24 }}>Ringkasan Transaksi (Berdasarkan Filter)</Title>
                            <Row gutter={[16, 16]}>
                                <Col xs={24} lg={8}><Card variant="borderless" style={{ backgroundColor: '#f0f2f5' }}><Statistic title={`Total Tagihan (${recapData.isFilterActive ? 'Filter Aktif' : 'Semua'})`} value={recapData.totalTagihan} formatter={formatCurrency} /></Card></Col>
                                <Col xs={24} lg={8}><Card variant="borderless" style={{ backgroundColor: '#f0f2f5' }}><Statistic title={`Total Terbayar (${recapData.isFilterActive ? 'Filter Aktif' : 'Semua'})`} value={recapData.totalTerbayar} formatter={formatCurrency} valueStyle={{ color: '#3f8600' }} suffix={`(${paidPercent.toFixed(1)}%)`} /></Card></Col>
                                <Col xs={24} lg={8}><Card variant="borderless" style={{ backgroundColor: '#f0f2f5' }}><Statistic title={`Total Sisa (${recapData.isFilterActive ? 'Filter Aktif' : 'Semua'})`} value={recapData.sisaTagihan} formatter={formatCurrency} valueStyle={{ color: recapData.sisaTagihan > 0 ? '#cf1322' : '#3f8600' }} suffix={`(${outstandingPercent.toFixed(1)}%)`} /></Card></Col>
                            </Row>
                        </Card>
                        {/* Card Tabel Transaksi */}
                        <Card>
                            {/* --- PERBAIKAN: Custom Header (Judul dan Tombol) --- */}
                            <Row justify="space-between" align="middle" gutter={[16, 16]} style={{ marginBottom: 16 }}>
                                <Col xs={24} sm={12}>
                                    <Title level={5} style={{ margin: 0 }}>Daftar Transaksi</Title>
                                </Col>
                                <Col xs={24} sm={12} style={{ textAlign: 'right' }}> {/* Atur textAlign ke kanan untuk desktop */}
                                    <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
                                        <Button icon={<PrinterOutlined />} onClick={handleGenerateReportPdf} disabled={isFiltering || filteredTransaksi.length === 0 || isTxPdfGenerating} loading={isTxPdfGenerating}> Cetak PDF (Filter) </Button>
                                        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate} disabled={loadingDependencies}> Tambah Transaksi </Button>
                                    </Space>
                                </Col>
                            </Row>
                            {/* --- AKHIR PERBAIKAN CUSTOM HEADER --- */}
                            
                            {/* Filter */}
                            <Row justify="space-between" align="middle" gutter={[16, 16]} style={{ marginBottom: 16 }}>
                                <Col xs={24} sm={12} md={12}><Search placeholder="Cari No. Invoice, Pelanggan..." value={searchText} onChange={handleSearchChange} allowClear style={{ width: '100%' }} /></Col>
                                <Col xs={24} sm={12} md={12}><RangePicker value={dateRange} onChange={handleDateChange} style={{ width: '100%' }} placeholder={['Tgl Mulai', 'Tgl Selesai']} /></Col>
                            </Row>
                            <Row justify="end" style={{ marginBottom: 24 }}>
                                <Col><Space wrap>
                                    <Tag.CheckableTag style={chipStyle} checked={selectedStatus.includes('Belum Bayar')} onChange={() => handleStatusToggle('Belum Bayar')}>Belum Bayar</Tag.CheckableTag>
                                    <Tag.CheckableTag style={chipStyle} checked={selectedStatus.includes('Sebagian')} onChange={() => handleStatusToggle('Sebagian')}>DP (Sebagian)</Tag.CheckableTag>
                                    <Tag.CheckableTag style={chipStyle} checked={selectedStatus.includes('Lunas')} onChange={() => handleStatusToggle('Lunas')}>Lunas</Tag.CheckableTag>
                                    {isFilterActive && ( <Button type="link" size="small" onClick={resetFilters}> Reset Filter </Button> )}
                                </Space></Col>
                            </Row>
                            {/* Tabel */}
                            <Spin spinning={isFiltering} tip="Memfilter data...">
                                <TransaksiJualTableComponent
                                    columns={columns}
                                    dataSource={filteredTransaksi}
                                    loading={loadingTransaksi || loadingDependencies}
                                    isFiltering={false}
                                    pagination={pagination}
                                    handleTableChange={handleTableChange}
                                    tableScrollX={tableScrollX}
                                    rowClassName={(r, i) => (i % 2 === 0 ? 'table-row-even' : 'table-row-odd')}
                                />
                            </Spin>
                        </Card>
                    </TabPane>

                    {/* =================================================================== */}
                    {/* ---                 TAB 2: TAGIHAN PER PELANGGAN                --- */}
                    {/* =================================================================== */}
                    <TabPane tab={<Space><PullRequestOutlined /> Tagihan per Pelanggan</Space>} key="2">
                        {/* Render komponen terpisah */}
                        <TagihanPelangganTab
                            allTransaksi={allTransaksi}
                            loadingTransaksi={loadingTransaksi}
                        />
                    </TabPane>

                </Tabs>

                {/* =================================================================== */}
                {/* ---                  MODAL (DILUAR TABS)                      --- */}
                {/* =================================================================== */}

                {/* Modal Form Create/Edit */}
                 {isFormModalOpen && (
                     <TransaksiJualForm
                         key={editingTx?.id || 'create'}
                         open={isFormModalOpen}
                         onCancel={handleCloseFormModal}
                         mode={formMode}
                         initialTx={editingTx}
                         bukuList={bukuList} // Pastikan bukuList terkirim
                         pelangganList={pelangganList} // Pastikan pelangganList terkirim
                         onSuccess={handleFormSuccess}
                         loadingDependencies={loadingDependencies}
                     />
                 )}

                {/* Modal Detail */}
                <TransaksiJualDetailModal
                    open={isDetailModalOpen}
                    onCancel={handleCloseDetailModal}
                    transaksi={selectedTransaksi}
                />

                {/* Modal PDF (Hanya untuk Laporan Transaksi Tab 1, Invoice, Nota) */}
                <Modal
                    title={txPdfTitle}
                    open={isTxPdfModalOpen}
                    onCancel={handleCloseTxPdfModal}
                    width="95vw" style={{ top: 20 }}
                    destroyOnClose
                    footer={[
                        <Button key="close" onClick={handleCloseTxPdfModal}>Tutup</Button>,
                        navigator.share && (<Button key="share" icon={<ShareAltOutlined />} onClick={handleShareTxPdf} disabled={isTxPdfGenerating || !txPdfBlob}>Bagikan File</Button>),
                        <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={handleDownloadTxPdf} disabled={isTxPdfGenerating || !txPdfBlob}>Unduh</Button>
                    ]}
                    bodyStyle={{ padding: 0, height: 'calc(100vh - 150px)', position: 'relative' }}
                >
                    {isTxPdfGenerating && (
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.7)', zIndex: 10 }}>
                            <Spin size="large" tip="Membuat file PDF..." />
                        </div>
                    )}
                    {!isTxPdfGenerating && txPdfBlob ? (
                        <div style={{ height: '100%', width: '100%', overflow: 'auto' }}>
                            <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
                                {/* Gunakan txPdfFileName atau title sebagai key */}
                                <Viewer key={txPdfFileName || txPdfTitle} fileUrl={URL.createObjectURL(txPdfBlob)} />
                            </Worker>
                        </div>
                    ) : (
                        !isTxPdfGenerating && (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}><Empty description="Gagal memuat PDF atau PDF belum dibuat." /></div>)
                    )}
                </Modal>
             </Content>
         </Layout>
    );
}

// Style untuk Chip Filter
const chipStyle = {
    padding: '4px 12px',
    fontSize: '14px',
    border: '1px solid #d9d9d9',
    borderRadius: '16px',
    lineHeight: '1.5',
};

// CSS untuk Zebra Stripes (Pastikan ada di CSS global)
/*
.table-row-odd td { background-color: #fafafa !important; }
.table-row-even td { background-color: #ffffff !important; }
*/
