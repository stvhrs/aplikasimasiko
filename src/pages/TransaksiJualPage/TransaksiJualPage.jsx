import React, { useEffect, useState, useMemo, useCallback, useDeferredValue } from 'react';
import {
    Layout, Card, Spin, Empty, Typography, Input, Row, Col, Statistic, Tag, Button, Modal,
    Dropdown, Menu, App, DatePicker, Space, Tabs, Divider, Tooltip
} from 'antd';
import {
    PlusOutlined, MoreOutlined, DownloadOutlined, ShareAltOutlined, EditOutlined,
    PrinterOutlined, ReadOutlined, PullRequestOutlined, CalendarOutlined, SearchOutlined,
    SyncOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';

import useDebounce from '../../hooks/useDebounce';
import TransaksiJualForm from './components/TransaksiJualForm';
import TransaksiJualDetailModal from './components/TransaksiJualDetailModal';
import TransaksiJualTableComponent from './components/TransaksiJualTableComponent';
import { generateInvoicePDF, generateNotaPDF } from '../../utils/pdfGenerator';
import { useTransaksiJualData, useBukuData, usePelangganData } from '../../hooks/useTransaksiData';
import TagihanPelangganTab from './components/TagihanPelangganTab';

const { Content } = Layout;
const { Title, Text } = Typography;
const { Search } = Input;
const { RangePicker } = DatePicker;

// --- Helpers ---
const formatCurrency = (value) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);
const formatDate = (timestamp) =>
    new Date(timestamp || 0).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const normalizeStatus = (s) => (s === 'DP' ? 'Sebagian' : s || 'N/A');

// Style untuk Chip Filter
const chipStyle = {
    padding: '5px 16px',
    fontSize: '14px',
    border: '1px solid #d9d9d9',
    borderRadius: '6px',
    lineHeight: '1.5',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'all 0.3s',
    fontWeight: 500
};

export default function TransaksiJualPage() {
    const { message } = App.useApp();

    // ========================================================================
    // 1. STATE & FILTER CONFIGURATION
    // ========================================================================

    const defaultStart = dayjs().startOf('year');
    const defaultEnd = dayjs();

    const [dateRange, setDateRange] = useState([defaultStart, defaultEnd]);
    const [isAllTime, setIsAllTime] = useState(false);

    // Filter Params (Server Side)
    const filterParams = useMemo(() => {
        if (isAllTime) {
            return { mode: 'all' };
        }
        return {
            mode: 'range',
            startDate: dateRange?.[0] ? dateRange[0].startOf('day').valueOf() : null,
            endDate: dateRange?.[1] ? dateRange[1].endOf('day').valueOf() : null,
        };
    }, [dateRange, isAllTime]);

    // ========================================================================
    // 2. DATA FETCHING
    // ========================================================================
    
    // SAFETY CHECK: Berikan default value {} jika hook mengembalikan null/undefined
    const { data: allTransaksi = [], loading: loadingTransaksi, refresh: refreshTransaksi } = useTransaksiJualData(filterParams) || {};
    
    const { data: bukuList, loading: loadingBuku } = useBukuData();
    const { data: pelangganList, loading: loadingPelanggan } = usePelangganData();
    const loadingDependencies = loadingBuku || loadingPelanggan;

    // --- State UI Lainnya ---
    const [searchText, setSearchText] = useState('');
    const debouncedSearchText = useDebounce(searchText, 300);
    
    // State Filter Status (Dikontrol oleh Tabel)
    const [selectedStatus, setSelectedStatus] = useState([]);

    // Pagination
    const showTotalPagination = useCallback((total, range) => `${range[0]}-${range[1]} dari ${total} transaksi`, []);
    const [pagination, setPagination] = useState({
        current: 1, pageSize: 10, showSizeChanger: true, pageSizeOptions: ["10",'25', '50', '100', '200'], showTotal: showTotalPagination
    });

    // --- State Modal ---
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [formMode, setFormMode] = useState('create');
    const [editingTx, setEditingTx] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedTransaksi, setSelectedTransaksi] = useState(null);
    const [isTxPdfModalOpen, setIsTxPdfModalOpen] = useState(false);
    const [txPdfBlob, setTxPdfBlob] = useState(null);
    const [txPdfTitle, setTxPdfTitle] = useState('');
    const [isTxPdfGenerating, setIsTxPdfGenerating] = useState(false);
    const [txPdfFileName, setTxPdfFileName] = useState('laporan_transaksi.pdf');

    // --- Defer State ---
    const deferredAllTransaksi = useDeferredValue(allTransaksi);
    const deferredDebouncedSearch = useDeferredValue(debouncedSearchText);
    const deferredSelectedStatus = useDeferredValue(selectedStatus);

    // ========================================================================
    // 3. CLIENT SIDE FILTERING (Hanya Mempengaruhi Tampilan TABEL)
    // ========================================================================
    const filteredTransaksi = useMemo(() => {
        // SAFETY CHECK: Gunakan fallback array kosong []
        let data = [...(deferredAllTransaksi || [])];

        // Filter Status (Dipicu oleh Header Tabel)
        if (deferredSelectedStatus.length > 0) {
            data = data.filter((tx) => deferredSelectedStatus.includes(normalizeStatus(tx.statusPembayaran)));
        }

        // Filter Search Text
        if (deferredDebouncedSearch) {
            const q = deferredDebouncedSearch.toLowerCase();
            data = data.filter((tx) =>
                (tx.nomorInvoice || '').toLowerCase().includes(q) ||
                (tx.namaPelanggan || '').toLowerCase().includes(q) ||
                (tx.keterangan || '').toLowerCase().includes(q)
            );
        }

        return data.sort((a, b) => (b.tanggal || 0) - (a.tanggal || 0));

    }, [deferredAllTransaksi, deferredSelectedStatus, deferredDebouncedSearch]);

    // ========================================================================
    // 4. KALKULASI RINGKASAN (Tidak Terpengaruh Filter Tabel)
    // ========================================================================
    const recapData = useMemo(() => {
        // Gunakan deferredAllTransaksi (Data Mentah) dengan safety check
        const dataToRecap = deferredAllTransaksi || []; 

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
            isFilterActive: !!deferredDebouncedSearch || deferredSelectedStatus.length > 0 || !isAllTime
        };
    }, [deferredAllTransaksi, deferredDebouncedSearch, deferredSelectedStatus, isAllTime]);

    // ========================================================================
    // 5. KALKULASI UNTUK FOOTER TABEL (Terpengaruh Filter Tabel)
    // ========================================================================
    const footerTotals = useMemo(() => {
        // Gunakan filteredTransaksi yang sudah terpengaruh oleh semua filter
        const filteredData = filteredTransaksi || [];
        
        const totals = filteredData.reduce(
            (acc, tx) => ({
                tagihan: acc.tagihan + Number(tx.totalTagihan || 0),
                terbayar: acc.terbayar + Number(tx.jumlahTerbayar || 0)
            }),
            { tagihan: 0, terbayar: 0 }
        );
        
        return {
            totalTagihan: totals.tagihan,
            totalTerbayar: totals.terbayar,
            totalSisa: totals.tagihan - totals.terbayar,
            totalTransaksi: filteredData.length
        };
    }, [filteredTransaksi]);

    // Komponen Footer untuk Tabel
    const TableFooter = () => (
        <div style={{ 
            padding: '16px', 
            backgroundColor: '#fafafa', 
            borderTop: '1px solid #e8e8e8',
            marginTop: '16px',
            borderRadius: '0 0 8px 8px'
        }}>
            <Row justify="space-between" align="middle">
                <Col>
                    <Text strong>
                        Menampilkan {footerTotals.totalTransaksi} transaksi
                        {(deferredDebouncedSearch || deferredSelectedStatus.length > 0) && " (setelah filter)"}
                    </Text>
                </Col>
                <Col>
                    <Space size="large">
                        <Statistic 
                            title="Total Tagihan" 
                            value={footerTotals.totalTagihan} 
                            formatter={formatCurrency}
                            valueStyle={{ fontSize: '16px', fontWeight: 600 }}
                        />
                        <Statistic 
                            title="Total Terbayar" 
                            value={footerTotals.totalTerbayar} 
                            formatter={formatCurrency}
                            valueStyle={{ fontSize: '16px', fontWeight: 600, color: '#3f8600' }}
                        />
                        <Statistic 
                            title="Total Sisa" 
                            value={footerTotals.totalSisa} 
                            formatter={formatCurrency}
                            valueStyle={{ 
                                fontSize: '16px', 
                                fontWeight: 600, 
                                color: footerTotals.totalSisa > 0 ? '#cf1322' : '#3f8600' 
                            }}
                        />
                    </Space>
                </Col>
            </Row>
            
            {/* Progress Bar Visualisasi */}
            {footerTotals.totalTagihan > 0 && (
                <div style={{ marginTop: '12px' }}>
                    <Row gutter={8} align="middle">
                        <Col flex="none">
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                Rasio Pembayaran:
                            </Text>
                        </Col>
                        <Col flex="auto">
                            <div style={{ 
                                display: 'flex', 
                                height: '8px', 
                                backgroundColor: '#f0f0f0', 
                                borderRadius: '4px',
                                overflow: 'hidden'
                            }}>
                                <div 
                                    style={{ 
                                        flex: `${(footerTotals.totalTerbayar / footerTotals.totalTagihan) * 100}%`,
                                        backgroundColor: '#52c41a',
                                        transition: 'all 0.3s'
                                    }} 
                                    title={`Terbayar: ${((footerTotals.totalTerbayar / footerTotals.totalTagihan) * 100).toFixed(1)}%`}
                                />
                                <div 
                                    style={{ 
                                        flex: `${(footerTotals.totalSisa / footerTotals.totalTagihan) * 100}%`,
                                        backgroundColor: '#ff4d4f',
                                        transition: 'all 0.3s'
                                    }} 
                                    title={`Sisa: ${((footerTotals.totalSisa / footerTotals.totalTagihan) * 100).toFixed(1)}%`}
                                />
                            </div>
                        </Col>
                        <Col flex="none">
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                {((footerTotals.totalTerbayar / footerTotals.totalTagihan) * 100).toFixed(1)}% Terbayar
                            </Text>
                        </Col>
                    </Row>
                </div>
            )}
        </div>
    );

    // ========================================================================
    // 6. HANDLERS
    // ========================================================================
    const handleSearchChange = useCallback((e) => { setSearchText(e.target.value); setPagination(prev => ({ ...prev, current: 1 })); }, []);

    const handleDateChange = useCallback((dates) => {
        setIsAllTime(false);
        setDateRange(dates);
        setPagination(prev => ({ ...prev, current: 1 }));
    }, []);

    const handleToggleAllTime = useCallback((checked) => {
        setIsAllTime(checked);
        setPagination(prev => ({ ...prev, current: 1 }));
    }, []);

    const resetFilters = useCallback(() => {
        setSearchText('');
        setSelectedStatus([]); 
        setIsAllTime(false);
        setDateRange([dayjs().startOf('year'), dayjs()]);
        setPagination(prev => ({ ...prev, current: 1 }));
    }, []);

    const handleTableChange = useCallback((pagination, filters, sorter) => {
        setPagination(pagination);
        if (filters.statusPembayaran) {
            setSelectedStatus(filters.statusPembayaran);
        } else {
            setSelectedStatus([]);
        }
    }, []);

    const handleRefresh = useCallback(() => {
        if (refreshTransaksi) {
            refreshTransaksi();
            message.success('Data diperbarui');
        }
    }, [refreshTransaksi, message]);

    // ... Modal & PDF Handlers ...
    const handleOpenCreate = useCallback(() => { setFormMode('create'); setEditingTx(null); setIsFormModalOpen(true); }, []);
    const handleOpenEdit = useCallback((tx) => { setFormMode('edit'); setEditingTx(tx); setIsFormModalOpen(true); }, []);
    const handleCloseFormModal = useCallback(() => { setIsFormModalOpen(false); setEditingTx(null); }, []);
    const handleFormSuccess = useCallback(() => { 
        handleCloseFormModal(); 
        if(refreshTransaksi) refreshTransaksi(); 
    }, [handleCloseFormModal, refreshTransaksi]);

    const handleOpenDetailModal = useCallback((tx) => { setSelectedTransaksi(tx); setIsDetailModalOpen(true); }, []);
    const handleCloseDetailModal = useCallback(() => { setSelectedTransaksi(null); setIsDetailModalOpen(false); }, []);
    const handleCloseTxPdfModal = useCallback(() => { setIsTxPdfModalOpen(false); setIsTxPdfGenerating(false); setTxPdfBlob(null); setTxPdfTitle(''); }, []);
    
    const handleGenerateInvoice = useCallback(async (tx) => { const fileName = tx.nomorInvoice || tx.id; setTxPdfTitle(`Invoice: ${fileName}`); setTxPdfFileName(fileName); setIsTxPdfGenerating(true); setIsTxPdfModalOpen(true); setTxPdfBlob(null); try { const dataUri = generateInvoicePDF(tx); const blob = await fetch(dataUri).then(r => r.blob()); setTxPdfBlob(blob); } catch (err) { message.error('Gagal membuat PDF invoice.'); setIsTxPdfModalOpen(false); } finally { setIsTxPdfGenerating(false); } }, [message]);
    const handleGenerateNota = useCallback(async (tx) => { const statusNormal = normalizeStatus(tx?.statusPembayaran); if (!['Sebagian', 'Lunas'].includes(statusNormal)) { message.error('Nota hanya untuk status Sebagian atau Lunas'); return; } const baseId = tx.nomorInvoice || tx.id; const fileName = baseId.replace(/^INV-/i, 'NT-'); setTxPdfTitle(`Nota: ${baseId}`); setTxPdfFileName(fileName); setIsTxPdfGenerating(true); setIsTxPdfModalOpen(true); setTxPdfBlob(null); try { const dataUri = generateNotaPDF(tx); const blob = await fetch(dataUri).then(r => r.blob()); setTxPdfBlob(blob); } catch (err) { message.error('Gagal membuat PDF nota.'); setIsTxPdfModalOpen(false); } finally { setIsTxPdfGenerating(false); } }, [message]);
    const handleDownloadTxPdf = useCallback(async () => { if (!txPdfBlob) return; message.loading({ content: 'Mengunduh...', key: 'pdfdl_tx', duration: 0 }); try { const url = URL.createObjectURL(txPdfBlob); const link = document.createElement('a'); link.href = url; const fn = `${txPdfFileName.replace(/[\/:]/g, '_') || 'download'}.pdf`; link.setAttribute('download', fn); document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); message.success({ content: 'Unduhan dimulai!', key: 'pdfdl_tx', duration: 2 }); } catch (err) { message.error({ content: `Gagal mengunduh: ${err.message}`, key: 'pdfdl_tx', duration: 3 }); } }, [txPdfBlob, txPdfFileName, message]);
    const handleShareTxPdf = useCallback(async () => { if (!navigator.share) { message.error('Fitur share tidak didukung.'); return; } if (!txPdfBlob) return; const fn = `${txPdfFileName.replace(/[\/:]/g, '_') || 'file'}.pdf`; const file = new File([txPdfBlob], fn, { type: 'application/pdf' }); const shareData = { title: txPdfTitle, text: `File PDF: ${txPdfTitle}`, files: [file] }; if (navigator.canShare && navigator.canShare(shareData)) { try { await navigator.share(shareData); message.success('Berhasil dibagikan!'); } catch (err) { if (err.name !== 'AbortError') message.error(`Gagal: ${err.message}`); } } else { message.warn('Tidak didukung.'); } }, [txPdfBlob, txPdfTitle, txPdfFileName, message]);
    
    const handleGenerateReportPdf = useCallback(async () => {
        if (filteredTransaksi.length === 0) { message.warning('Tidak ada data.'); return; }
        const title = 'Laporan Transaksi Penjualan'; setTxPdfTitle(title); setIsTxPdfGenerating(true); setIsTxPdfModalOpen(true); setTxPdfBlob(null);
        const formattedDate = dayjs().locale('id').format('MMMM_DD'); setTxPdfFileName(`Laporan_Penjualan_${formattedDate}`);
        setTimeout(async () => {
            try {
                const doc = new jsPDF();
                let startY = 36; doc.setFontSize(18); doc.text(title, 14, 22); doc.setFontSize(10);
                const filterInfo = [];
                if (isAllTime) filterInfo.push('Periode: Semua Waktu');
                else if (dateRange) filterInfo.push(`Tgl: ${dateRange[0].format('DD/MM/YY')} - ${dateRange[1].format('DD/MM/YY')}`);
                if (deferredSelectedStatus.length > 0) filterInfo.push(`Status: ${deferredSelectedStatus.join(', ')}`);
                if (deferredDebouncedSearch) filterInfo.push(`Cari: "${deferredDebouncedSearch}"`);
                if (filterInfo.length > 0) doc.text(`Filter Aktif: ${filterInfo.join(' | ')}`, 14, 28);
                else doc.text('Filter Aktif: Menampilkan Semua', 14, 28);
                
                // Header Ringkasan di PDF (Optional, sesuaikan kebutuhan)
                autoTable(doc, { startY: startY, body: [['Total Tagihan', formatCurrency(recapData.totalTagihan)], ['Total Terbayar', formatCurrency(recapData.totalTerbayar)], ['Total Sisa Tagihan', formatCurrency(recapData.sisaTagihan)]], theme: 'grid', styles: { fontSize: 10, cellPadding: 2 }, columnStyles: { 0: { fontStyle: 'bold', halign: 'right' }, 1: { halign: 'right' } }, didDrawCell: (data) => { if (data.section === 'body') { if (data.row.index === 1) data.cell.styles.textColor = [40, 167, 69]; if (data.row.index === 2) data.cell.styles.textColor = [220, 53, 69]; } } });
                
                const tableHead = ['Tanggal', 'ID Transaksi', 'Pelanggan', 'Total Tagihan', 'Sisa', 'Status'];
                const tableBody = filteredTransaksi.map(tx => { const sisa = (tx.totalTagihan || 0) - (tx.jumlahTerbayar || 0); return [formatDate(tx.tanggal), tx.nomorInvoice || tx.id, tx.namaPelanggan || '-', formatCurrency(tx.totalTagihan), formatCurrency(sisa), normalizeStatus(tx.statusPembayaran)]; });
                autoTable(doc, { head: [tableHead], body: tableBody, startY: doc.lastAutoTable.finalY + 10, theme: 'striped', headStyles: { fillColor: [41, 128, 185] }, styles: { fontSize: 8, cellPadding: 2 }, columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } }, foot: [['', '', 'TOTAL', formatCurrency(recapData.totalTagihan), formatCurrency(recapData.sisaTagihan), '']], footStyles: { fontStyle: 'bold', halign: 'right', fillColor: [230, 230, 230], textColor: 0 } });
                setTxPdfBlob(doc.output('blob'));
            } catch (err) { message.error('Gagal membuat PDF Laporan.'); setIsTxPdfModalOpen(false); } finally { setIsTxPdfGenerating(false); }
        }, 50);
    }, [filteredTransaksi, recapData, dateRange, isAllTime, deferredSelectedStatus, deferredDebouncedSearch, message]);

    // --- Columns ---
    const renderAksi = useCallback((_, record) => {
        const items = [
            { key: "detail", label: "Lihat Detail", onClick: () => handleOpenDetailModal(record) },
            { key: "edit", label: "Edit Transaksi", onClick: () => handleOpenEdit(record) },
            { type: "divider" },
            { key: "inv", label: "Generate Invoice", onClick: () => handleGenerateInvoice(record) },
            { key: "nota", label: "Generate Nota", disabled: !["Sebagian", "Lunas"].includes(normalizeStatus(record?.statusPembayaran)), onClick: () => handleGenerateNota(record) },
        ];
        return (
            <Dropdown menu={{ items }} trigger={["click"]} placement="bottomRight">
                <a onClick={e => e.preventDefault()}> <Button icon={<MoreOutlined />} size="small" /> </a>
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
        { 
            title: 'Status Bayar', 
            dataIndex: 'statusPembayaran', 
            key: 'statusPembayaran', 
            width: 140, 
            filters: [
                { text: 'Belum Bayar', value: 'Belum Bayar' },
                { text: 'DP (Sebagian)', value: 'Sebagian' },
                { text: 'Lunas', value: 'Lunas' },
            ],
            filteredValue: selectedStatus.length > 0 ? selectedStatus : null,
            render: (statusRaw) => { 
                const status = normalizeStatus(statusRaw); 
                let color = 'default'; 
                if (status === 'Lunas') color = 'green'; 
                else if (status === 'Belum Bayar') color = 'red'; 
                else if (status === 'Sebagian') color = 'orange'; 
                return <Tag color={color}>{status}</Tag>; 
            } 
        },
        { title: 'Aksi', key: 'aksi', align: 'center', width: 100, render: renderAksi },
    ], [pagination, renderAksi, selectedStatus]);

    const tableScrollX = useMemo(() => columns.reduce((acc, col) => acc + (col.width || 150), 0), [columns]);
    const paidPercent = recapData.totalTagihan > 0 ? (recapData.totalTerbayar / recapData.totalTagihan) * 100 : 0;
    const outstandingPercent = recapData.totalTagihan > 0 ? (recapData.sisaTagihan / recapData.totalTagihan) * 100 : 0;
    const dateTitle = isAllTime ? '(Semua Waktu)' : `(${dateRange?.[0]?.format('D MMM YYYY')} - ${dateRange?.[1]?.format('D MMM YYYY')})`;

    const tabItems = [
        {
            key: '1',
            label: <Space><ReadOutlined /> Daftar Transaksi</Space>,
            children: (
                <>
                    <Card style={{ marginBottom: 24 }}>
                        <Title level={4} style={{ margin: 0, marginBottom: 24 }}>
                            Ringkasan Transaksi {dateTitle}
                        </Title>
                        <Row gutter={[16, 16]}>
                            <Col xs={24} lg={8}><Card variant="borderless" style={{ backgroundColor: '#f0f2f5' }}><Statistic title="Total Tagihan" value={recapData.totalTagihan} formatter={formatCurrency} /></Card></Col>
                            <Col xs={24} lg={8}><Card variant="borderless" style={{ backgroundColor: '#f0f2f5' }}><Statistic title="Total Terbayar" value={recapData.totalTerbayar} formatter={formatCurrency} valueStyle={{ color: '#3f8600' }} suffix={`(${paidPercent.toFixed(1)}%)`} /></Card></Col>
                            <Col xs={24} lg={8}><Card variant="borderless" style={{ backgroundColor: '#f0f2f5' }}><Statistic title="Total Sisa" value={recapData.sisaTagihan} formatter={formatCurrency} valueStyle={{ color: recapData.sisaTagihan > 0 ? '#cf1322' : '#3f8600' }} suffix={`(${outstandingPercent.toFixed(1)}%)`} /></Card></Col>
                        </Row>
                    </Card>

                    <Card>
                        <Row justify="space-between" align="middle" gutter={[16, 16]} style={{ marginBottom: 20 }}>
                            <Col><Title level={4} style={{ margin: 0 }}>Daftar Transaksi</Title></Col>
                            <Col>
                                <Space>
                                    <Tooltip title="Muat Ulang Data dari Server">
                                        <Button icon={<SyncOutlined />} onClick={handleRefresh} disabled={loadingTransaksi} loading={loadingTransaksi}>Refresh</Button>
                                    </Tooltip>
                                    <Button icon={<PrinterOutlined />} onClick={handleGenerateReportPdf} disabled={filteredTransaksi.length === 0 || isTxPdfGenerating} loading={isTxPdfGenerating}>Cetak PDF</Button>
                                    <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate} disabled={loadingDependencies}>Tambah Transaksi</Button>
                                </Space>
                            </Col>
                        </Row>

                        <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 24 }}>
                            <Col xs={24} md={10} lg={8}>
                                <Input 
                                    placeholder="Cari No. Invoice / Pelanggan..." 
                                    prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                                    value={searchText} 
                                    onChange={handleSearchChange} 
                                    allowClear 
                                    style={{ width: '100%' }} 
                                />
                            </Col>
                            <Col xs={24} md={14} lg={16}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <Text type="secondary" style={{ marginRight: 4 }}>Periode:</Text>
                                    <Tag.CheckableTag
                                        style={{
                                            ...chipStyle,
                                            backgroundColor: isAllTime ? '#1890ff' : 'transparent',
                                            color: isAllTime ? '#fff' : 'rgba(0, 0, 0, 0.85)',
                                            borderColor: isAllTime ? '#1890ff' : '#d9d9d9',
                                            height: '32px',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}
                                        checked={isAllTime}
                                        onChange={handleToggleAllTime}
                                    >
                                        Semua Waktu
                                    </Tag.CheckableTag>
                                    <RangePicker
                                        format="D MMM YYYY"
                                        value={dateRange}
                                        onChange={handleDateChange}
                                        style={{ width: '240px', opacity: isAllTime ? 0.5 : 1, borderRadius: '6px' }}
                                        disabled={isAllTime}
                                        allowClear={false}
                                    />
                                </div>
                            </Col>
                        </Row>
                        
                        {recapData.isFilterActive && (
                            <Row style={{ marginBottom: 16 }}>
                                <Col>
                                    <Button type="link" size="small" onClick={resetFilters} style={{ paddingLeft: 0 }}>
                                        Reset Semua Filter
                                    </Button>
                                </Col>
                            </Row>
                        )}

                        <Spin spinning={loadingTransaksi} tip={isAllTime ? "Memuat SEMUA data..." : "Memuat data range..."}>
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
                            {/* Tambahkan Footer di bawah tabel */}
                            <TableFooter />
                        </Spin>
                    </Card>
                </>
            )
        },
        {
            key: '2',
            label: <Space><PullRequestOutlined /> Tagihan per Pelanggan</Space>,
            children: (
                <TagihanPelangganTab
                    allTransaksi={allTransaksi || []} // SAFETY CHECK DISINI JUGA
                    loadingTransaksi={loadingTransaksi}
                    dateRange={dateRange}
                    isAllTime={isAllTime}
                />
            )
        }
    ];

    return (
        <Layout>
            <Content style={{ padding: '24px', backgroundColor: '#f0f2f5' }}>
                <Tabs 
                    defaultActiveKey="1" 
                    type="card" 
                    items={tabItems} 
                    destroyInactiveTabPane={false} 
                />

                {/* --- MODALS --- */}
                {isFormModalOpen && (<TransaksiJualForm key={editingTx?.id || 'create'} open={isFormModalOpen} onCancel={handleCloseFormModal} mode={formMode} initialTx={editingTx} bukuList={bukuList} pelangganList={pelangganList} onSuccess={handleFormSuccess} loadingDependencies={loadingDependencies} />)}
                <TransaksiJualDetailModal open={isDetailModalOpen} onCancel={handleCloseDetailModal} transaksi={selectedTransaksi} />
                <Modal title={txPdfTitle} open={isTxPdfModalOpen} onCancel={handleCloseTxPdfModal} width="95vw" style={{ top: 20 }} destroyOnClose footer={[<Button key="close" onClick={handleCloseTxPdfModal}>Tutup</Button>, navigator.share && (<Button key="share" icon={<ShareAltOutlined />} onClick={handleShareTxPdf} disabled={isTxPdfGenerating || !txPdfBlob}>Bagikan File</Button>), <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={handleDownloadTxPdf} disabled={isTxPdfGenerating || !txPdfBlob}>Unduh</Button>]} bodyStyle={{ padding: 0, height: 'calc(100vh - 150px)', position: 'relative' }} > {isTxPdfGenerating && (<div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.7)', zIndex: 10 }}> <Spin size="large" tip="Membuat file PDF..." /> </div>)} {!isTxPdfGenerating && txPdfBlob ? (<div style={{ height: '100%', width: '100%', overflow: 'auto' }}> <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js"> <Viewer key={txPdfFileName || txPdfTitle} fileUrl={URL.createObjectURL(txPdfBlob)} /> </Worker> </div>) : (!isTxPdfGenerating && (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Empty description="Gagal memuat PDF atau PDF belum dibuat." /></div>))} </Modal>
            </Content>
        </Layout>
    );
}