import React, { useState, useMemo, useCallback, useDeferredValue, useTransition } from 'react';
import {
    Layout, Card, Spin, Input, Row, Col, Tag, Button, Modal,
    Dropdown, App, DatePicker, Space, Tabs, Divider, Grid, Empty, Typography
} from 'antd';
import {
    PlusOutlined, MoreOutlined, PrinterOutlined, ReadOutlined,
    PullRequestOutlined, SearchOutlined, CloseCircleOutlined,
    DownloadOutlined, ShareAltOutlined // Pastikan icon ini diimport
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

// IMPORT HOOK
import { useTransaksiJualStream } from '../../hooks/useFirebaseData';

import TagihanPelangganTab from './components/TagihanPelangganTab';
import PdfPreviewModal from '../BukuPage/components/PdfPreviewModal';
;

const { Content } = Layout;
const { Text } = Typography;
const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

// --- Helpers ---
const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);
const formatDate = (timestamp) => new Date(timestamp || 0).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const normalizeStatus = (s) => (s === 'DP' ? 'Sebagian' : s || 'N/A');

const chipStyle = { padding: '5px 16px', fontSize: '14px', border: '1px solid #d9d9d9', borderRadius: '6px', lineHeight: '1.5', cursor: 'pointer', userSelect: 'none', transition: 'all 0.3s', fontWeight: 500 };

export default function TransaksiJualPage() {
    const { message } = App.useApp();
    const screens = useBreakpoint();
    const [isPending, startTransition] = useTransition();

    // --- STATE CONFIG ---
    const defaultStart = useMemo(() => dayjs().startOf('year'), []);
    const defaultEnd = useMemo(() => dayjs(), []);
    const [dateRange, setDateRange] = useState([defaultStart, defaultEnd]);
    const [isAllTime, setIsAllTime] = useState(false);

    // Filter Params
    const filterParams = useMemo(() => {
        if (isAllTime) return { mode: 'all' };
        return {
            mode: 'range',
            startDate: dateRange?.[0] ? dateRange[0].startOf('day').valueOf() : null,
            endDate: dateRange?.[1] ? dateRange[1].endOf('day').valueOf() : null,
        };
    }, [dateRange, isAllTime]);

    // --- DATA FETCHING ---
    const { transaksiList: allTransaksi = [], loadingTransaksi } = useTransaksiJualStream(filterParams);

    // --- State UI ---
    const [searchText, setSearchText] = useState('');
    const debouncedSearchText = useDebounce(searchText, 300);
    const [selectedStatus, setSelectedStatus] = useState([]);

    const showTotalPagination = useCallback((total, range) => `${range[0]}-${range[1]} dari ${total} transaksi`, []);
    const [pagination, setPagination] = useState({
        current: 1, pageSize: 10, showSizeChanger: true, pageSizeOptions: ["10", '25', '50', '100', '200'], showTotal: showTotalPagination
    });

    // --- Modals ---
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [formMode, setFormMode] = useState('create');
    const [editingTx, setEditingTx] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedTransaksi, setSelectedTransaksi] = useState(null);

    // --- PDF State ---
    const [isTxPdfModalOpen, setIsTxPdfModalOpen] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState(''); // URL string untuk PdfPreviewModal
    const [txPdfFileName, setTxPdfFileName] = useState('laporan.pdf');
    const [isTxPdfGenerating, setIsTxPdfGenerating] = useState(false); // Untuk loading button

    // --- Filtering Logic ---
    const deferredAllTransaksi = useDeferredValue(allTransaksi);
    const deferredDebouncedSearch = useDeferredValue(debouncedSearchText);
    const deferredSelectedStatus = useDeferredValue(selectedStatus);

    const isFilterActive = useMemo(() => {
        return !!debouncedSearchText || selectedStatus.length > 0 || isAllTime || (!dateRange[0].isSame(defaultStart, 'day'));
    }, [debouncedSearchText, selectedStatus, isAllTime, dateRange, defaultStart]);

    const filteredTransaksi = useMemo(() => {
        let data = [...(deferredAllTransaksi || [])];
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
        return data.sort((a, b) => (b.tanggal || 0) - (a.tanggal || 0));
    }, [deferredAllTransaksi, deferredSelectedStatus, deferredDebouncedSearch]);

    // --- Footer & Summary ---
    const footerTotals = useMemo(() => {
        const filteredData = filteredTransaksi || [];
        const totals = filteredData.reduce(
            (acc, tx) => ({
                tagihan: acc.tagihan + Number(tx.totalTagihan || 0),
                terbayar: acc.terbayar + Number(tx.jumlahTerbayar || 0)
            }), { tagihan: 0, terbayar: 0 }
        );
        return {
            totalTagihan: totals.tagihan,
            totalTerbayar: totals.terbayar,
            totalSisa: totals.tagihan - totals.terbayar,
            totalTransaksi: filteredData.length
        };
    }, [filteredTransaksi]);

    const TabSummary = useMemo(() => {
        if (screens.xs) return null;
        return (
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', height: '100%', paddingRight: '8px' }}>
                <div style={{ textAlign: 'right' }}><Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>Total Tagihan</Text><Text strong>{formatCurrency(footerTotals.totalTagihan)}</Text></div>
                <Divider type="vertical" style={{ height: '24px' }} />
                <div style={{ textAlign: 'right' }}><Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>Terbayar</Text><Text strong style={{ color: '#3f8600' }}>{formatCurrency(footerTotals.totalTerbayar)}</Text></div>
                <Divider type="vertical" style={{ height: '24px' }} />
                <div style={{ textAlign: 'right' }}><Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>Sisa</Text><Text strong style={{ color: footerTotals.totalSisa > 0 ? '#cf1322' : '#3f8600' }}>{formatCurrency(footerTotals.totalSisa)}</Text></div>
            </div>
        );
    }, [footerTotals, screens.xs]);

    // --- Handlers ---
    const handleSearchChange = useCallback((e) => { setSearchText(e.target.value); setPagination(prev => ({ ...prev, current: 1 })); }, []);
    const handleDateChange = useCallback((dates) => { setIsAllTime(false); setDateRange(dates); setPagination(prev => ({ ...prev, current: 1 })); }, []);
    const handleToggleAllTime = useCallback((checked) => { setIsAllTime(checked); setPagination(prev => ({ ...prev, current: 1 })); }, []);
    const resetFilters = useCallback(() => { setSearchText(''); setSelectedStatus([]); setIsAllTime(false); setDateRange([defaultStart, defaultEnd]); }, [defaultStart, defaultEnd]);
    const handleTableChange = useCallback((p, f) => { setPagination(p); setSelectedStatus(f.statusPembayaran || []); }, []);

    // Modal Handlers
    const handleOpenCreate = useCallback(() => { setFormMode('create'); setEditingTx(null); setIsFormModalOpen(true); }, []);
    const handleOpenEdit = useCallback((tx) => { setFormMode('edit'); setEditingTx(tx); setIsFormModalOpen(true); }, []);
    const handleCloseFormModal = useCallback(() => { setIsFormModalOpen(false); setEditingTx(null); }, []);
    const handleFormSuccess = useCallback(() => { handleCloseFormModal(); }, [handleCloseFormModal]);
    const handleOpenDetailModal = useCallback((tx) => { setSelectedTransaksi(tx); setIsDetailModalOpen(true); }, []);
    const handleCloseDetailModal = useCallback(() => { setSelectedTransaksi(null); setIsDetailModalOpen(false); }, []);

    // --- PDF & PREVIEW HANDLERS ---

    // Fungsi helper untuk membuka modal setelah blob siap
    const openPdfModal = (blob, fileName) => {
        const url = URL.createObjectURL(blob);
        setPdfPreviewUrl(url);
        setTxPdfFileName(fileName);
        setIsTxPdfModalOpen(true);
        setIsTxPdfGenerating(false);
    };

    const handleCloseTxPdfModal = () => {
        setIsTxPdfModalOpen(false);
        if (pdfPreviewUrl) {
            URL.revokeObjectURL(pdfPreviewUrl); // Bersihkan memori
            setPdfPreviewUrl('');
        }
    };

    const handleGenerateInvoice = async (tx) => {
        message.loading({ content: 'Membuat Invoice...', key: 'pdfGen' });
        try {
            const blob = await fetch(generateInvoicePDF(tx)).then(r => r.blob());
            openPdfModal(blob, `${tx.nomorInvoice}.pdf`);
            message.success({ content: 'Invoice Siap', key: 'pdfGen' });
        } catch (e) {
            message.error({ content: 'Gagal membuat Invoice', key: 'pdfGen' });
        }
    };

    const handleGenerateNota = async (tx) => {
        message.loading({ content: 'Membuat Nota...', key: 'pdfGen' });
        try {
            const blob = await fetch(generateNotaPDF(tx)).then(r => r.blob());
            openPdfModal(blob, `Nota-${tx.nomorInvoice}.pdf`);
            message.success({ content: 'Nota Siap', key: 'pdfGen' });
        } catch (e) {
            message.error({ content: 'Gagal membuat Nota', key: 'pdfGen' });
        }
    };

    const handleGenerateReportPdf = () => {
        setIsTxPdfGenerating(true);

        // Gunakan timeout kecil agar UI sempat update status loading
        setTimeout(() => {
            try {
                const doc = new jsPDF();
                const nowStr = dayjs().format('YYYYMMDD_HHmm');
                const fileName = `Laporan_Transaksi_${nowStr}.pdf`;

                // 1. Header Laporan
                doc.setFontSize(16);
                doc.text("Laporan Transaksi Penjualan", 9, 15);

                // 2. Info Periode
                doc.setFontSize(10);
                let periodeInfo = isAllTime ? "Periode: Semua Waktu" :
                    (dateRange?.[0] ? `Periode: ${dateRange[0].format('DD MMM YYYY')} s/d ${dateRange[1].format('DD MMM YYYY')}` : "");
                doc.text(periodeInfo, 9, 22);

                // 3. Persiapan Data Tabel
                const tableColumn = ["No", "Tanggal", "No. Invoice", "Pelanggan", "Total", "Terbayar", "Sisa", "Status"];
                const tableRows = filteredTransaksi.map((tx, index) => [
                    index + 1,
                    formatDate(tx.tanggal),
                    tx.nomorInvoice,
                    tx.namaPelanggan,
                    formatCurrency(tx.totalTagihan),
                    formatCurrency(tx.jumlahTerbayar),
                    formatCurrency(tx.totalTagihan - tx.jumlahTerbayar),
                    normalizeStatus(tx.statusPembayaran)
                ]);

                // 4. Generate Tabel
                autoTable(doc, {
                    head: [tableColumn],
                    body: tableRows,
                    startY: 30,
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [22, 119, 255] },
                });

                // 5. Summary Footer
                const finalY = doc.lastAutoTable.finalY + 10;
                doc.setFontSize(10);
                doc.setFont("helvetica", "bold");
                doc.text(`Total Transaksi: ${filteredTransaksi.length}`, 9, finalY);
                doc.text(`Total Tagihan: ${formatCurrency(footerTotals.totalTagihan)}`, 9, finalY + 5);
                doc.text(`Total Terbayar: ${formatCurrency(footerTotals.totalTerbayar)}`, 9, finalY + 10);
                doc.text(`Total Sisa: ${formatCurrency(footerTotals.totalSisa)}`, 9, finalY + 15);

                // 6. Output Blob & Open Modal
                const pdfBlob = doc.output('blob');
                openPdfModal(pdfBlob, fileName);

            } catch (error) {
                console.error("Gagal membuat PDF:", error);
                message.error("Gagal membuat laporan PDF");
                setIsTxPdfGenerating(false);
            }
        }, 100);
    };

    const renderAksi = useCallback((_, record) => {
        const items = [
            { key: "detail", label: "Lihat Detail", onClick: () => handleOpenDetailModal(record) },
            { key: "edit", label: "Edit Transaksi", onClick: () => handleOpenEdit(record) },
            { type: "divider" },
            { key: "inv", label: "Generate Invoice", onClick: () => handleGenerateInvoice(record) },
            { key: "nota", label: "Generate Nota", disabled: ![ "Lunas"].includes(normalizeStatus(record?.statusPembayaran)), onClick: () => handleGenerateNota(record) },
        ];
        return <Dropdown menu={{ items }} trigger={["click"]}><Button icon={<MoreOutlined />} size="small" /></Dropdown>;
    }, [handleOpenDetailModal, handleOpenEdit]);

    const columns = useMemo(() => [
        { title: 'No.', width: 60, render: (_t, _r, idx) => ((pagination.current - 1) * pagination.pageSize) + idx + 1 },
        { title: 'Tanggal', dataIndex: 'tanggal', width: 120, render: formatDate, sorter: (a, b) => a.tanggal - b.tanggal },
        { title: 'ID', dataIndex: 'id', width: 180, render: (id, r) => <Text copyable={{ text: r.nomorInvoice }}>{r.nomorInvoice || id}</Text> },
        { title: 'Pelanggan', dataIndex: 'namaPelanggan', width: 200, sorter: (a, b) => (a.namaPelanggan || '').localeCompare(b.namaPelanggan || ''), render: (val, r) => <span>{val} {r.pelangganIsSpesial && <Tag color="gold">Spesial</Tag>}</span> },
        { title: 'Total', dataIndex: 'totalTagihan', align: 'right', width: 140, render: formatCurrency, sorter: (a, b) => a.totalTagihan - b.totalTagihan },
        { title: 'Sisa', key: 'sisa', align: 'right', width: 140,  sorter: (a, b) => {
    const sisaA = (a.totalTagihan ?? 0) - (a.jumlahTerbayar ?? 0);
    const sisaB = (b.totalTagihan ?? 0) - (b.jumlahTerbayar ?? 0);
    return sisaA - sisaB;
  }, render: (_, r) => <span style={{ color: (r.totalTagihan - r.jumlahTerbayar) > 0 ? 'red' : 'green' }}>{formatCurrency(r.totalTagihan - r.jumlahTerbayar)}</span> },
        { title: 'Status', dataIndex: 'statusPembayaran', width: 120, filters: [{ text: 'Belum', value: 'Belum' },  { text: 'Lunas', value: 'Lunas' }], filteredValue: selectedStatus.length ? selectedStatus : null, render: (s) => <Tag color={normalizeStatus(s) === 'Lunas' ? 'green' : normalizeStatus(s) === 'Belum' ? 'red' : 'orange'}>{normalizeStatus(s)}</Tag> },
        { title: 'Aksi', align: 'center', width: 80, render: renderAksi },
    ], [pagination, renderAksi, selectedStatus]);

    const tableScrollX = 1200;
    const isLoading = loadingTransaksi || isPending;

    const tabItems = [
        {
            key: '1',
            label: <Space><ReadOutlined /> Daftar Transaksi</Space>,
            children: (
                <Card bodyStyle={{ padding: screens.xs ? '12px' : '24px' }}>
                    <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 24 }}>
                        <Col xs={24} md={8} lg={6}>
                            <Input placeholder="Cari No. Invoice / Pelanggan..." prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} value={searchText} onChange={handleSearchChange} allowClear />
                        </Col>
                        <Col xs={24} md={16} lg={18}>
                            <div style={{ display: 'flex', justifyContent: screens.xs ? 'flex-start' : 'flex-end', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {isFilterActive && <Button icon={<CloseCircleOutlined />} danger type="text" size="small" onClick={resetFilters}>Reset</Button>}
                                    <Tag.CheckableTag style={{ ...chipStyle, backgroundColor: isAllTime ? '#1890ff' : 'transparent', color: isAllTime ? '#fff' : 'black' }} checked={isAllTime} onChange={handleToggleAllTime}>Semua</Tag.CheckableTag>
                                    <RangePicker format="D MMM YYYY" value={dateRange} onChange={handleDateChange} disabled={isAllTime} allowClear={false} style={{ width: 240 }} />
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {/* BUTTON LAPORAN DENGAN LOADING ANIMATION */}
                                    <Button
                                        icon={<PrinterOutlined />}
                                        onClick={handleGenerateReportPdf}
                                        disabled={!filteredTransaksi.length}
                                        loading={isTxPdfGenerating} // <-- ANIMASI LOADING DISINI
                                    >
                                        Laporan PDF
                                    </Button>
                                    <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>Tambah</Button>
                                </div>
                            </div>
                        </Col>
                    </Row>

                    <Spin spinning={isLoading} tip={isAllTime ? "Mengunduh & Memproses SEMUA data..." : "Memuat data..."} size="large" style={{ minHeight: 200 }}>
                        <TransaksiJualTableComponent columns={columns} dataSource={filteredTransaksi} loading={isLoading} pagination={pagination} handleTableChange={handleTableChange} tableScrollX={tableScrollX} rowClassName={(r, i) => (i % 2 === 0 ? 'table-row-even' : 'table-row-odd')} />
                    </Spin>
                </Card>
            )
        },
        {
            key: '2',
            label: <Space><PullRequestOutlined /> Tagihan Pelanggan</Space>,
            children: <TagihanPelangganTab allTransaksi={allTransaksi} loadingTransaksi={loadingTransaksi} dateRange={dateRange} isAllTime={isAllTime} />
        }
    ];

    return (
        <Layout>
            <Content style={{ padding: screens.xs ? '12px' : '24px', backgroundColor: '#f0f2f5' }}>
                <Tabs defaultActiveKey="1" type="card" items={tabItems} tabBarExtraContent={TabSummary} destroyInactiveTabPane={false} />

                {isFormModalOpen && (
                    <TransaksiJualForm key={editingTx?.id || 'create'} open={isFormModalOpen} onCancel={handleCloseFormModal} mode={formMode} initialTx={editingTx} onSuccess={handleFormSuccess} />
                )}

                <TransaksiJualDetailModal open={isDetailModalOpen} onCancel={handleCloseDetailModal} transaksi={selectedTransaksi} />

                {/* MODAL PDF PREVIEW IMPORTED */}
                <PdfPreviewModal
                    visible={isTxPdfModalOpen}
                    onClose={handleCloseTxPdfModal}
                    pdfBlobUrl={pdfPreviewUrl}
                    fileName={txPdfFileName}
                />
            </Content>
        </Layout>
    );
}