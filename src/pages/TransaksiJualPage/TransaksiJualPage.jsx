// ================================
// FILE: src/pages/transaksi-jual/TransaksiJualPage.jsx
// Versi dengan optimasi anti-lag, pemisahan tabel, dan perbaikan warning
// ================================

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
    Layout, Card, Spin, Empty, Typography, Input, Row, Col, Statistic, Tag, Button, Modal,
    Dropdown, Menu, Radio, App // Hapus Table jika tidak dipakai
} from 'antd';
import {
    PlusOutlined, MoreOutlined, DownloadOutlined, ShareAltOutlined, EditOutlined // Tambah EditOutlined
} from '@ant-design/icons';
import { ref, onValue } from 'firebase/database';
import { db } from '../../api/firebase'; // Sesuaikan path

// --- Import untuk PDF Viewer ---
import { Worker, Viewer } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';
// ------------------------------

import useDebounce from '../../hooks/useDebounce'; // Sesuaikan path
import TransaksiJualForm from './components/TransaksiJualForm'; // Sesuaikan path
import TransaksiJualDetailModal from './components/TransaksiJualDetailModal'; // Sesuaikan path
import TransaksiJualTableComponent from './components/TransaksiJualTableComponent'; // <-- Impor tabel baru
import { generateInvoicePDF, generateNotaPDF } from '../../utils/pdfGenerator'; // Sesuaikan path

const { Content } = Layout;
const { Title } = Typography;
const { Search } = Input;

// --- Helpers ---
const snapshotToArray = (snapshot) => {
    const data = snapshot.val();
    return data ? Object.keys(data).map((key) => ({ id: key, ...data[key] })) : [];
};
const formatCurrency = (value) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);
const formatDate = (timestamp) =>
    new Date(timestamp || 0).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const normalizeStatus = (s) => (s === 'DP' ? 'Sebagian' : s || 'N/A');
// -------------

export default function TransaksiJualPage() {
    const { message } = App.useApp(); // Hook message Antd

    const [allTransaksi, setAllTransaksi] = useState([]);
    const [loadingTransaksi, setLoadingTransaksi] = useState(true); // Fetch awal
    const [isFiltering, setIsFiltering] = useState(false); // Spinner filter/search/page

    // State Filter & Search
    const [searchText, setSearchText] = useState(''); // State input search
    const debouncedSearchText = useDebounce(searchText, 300); // Debounce untuk filter
    const [statusFilter, setStatusFilter] = useState(null); // Filter status

    const showTotalPagination = useCallback((total, range) => `${range[0]}-${range[1]} dari ${total} transaksi`, []);
    const [pagination, setPagination] = useState({
        current: 1, pageSize: 10,
        showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'],
        showTotal: showTotalPagination
    });

    // Data Dependencies (Buku & Pelanggan)
    const [bukuList, setBukuList] = useState([]);
    const [pelangganList, setPelangganList] = useState([]);
    const [loadingDependencies, setLoadingDependencies] = useState(true);

    // State Modal Form
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [formMode, setFormMode] = useState('create');
    const [editingTx, setEditingTx] = useState(null);

    // State Modal Detail
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedTransaksi, setSelectedTransaksi] = useState(null);

    // State Modal PDF
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [pdfBlob, setPdfBlob] = useState(null);
    const [pdfTitle, setPdfTitle] = useState('');
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);

    // --- Fetch Transaksi ---
    useEffect(() => {
        setLoadingTransaksi(true);
        const txRef = ref(db, 'transaksiJualBuku');
        const unsub = onValue(txRef, (snapshot) => {
            const data = snapshotToArray(snapshot).sort((a, b) => (b.tanggal || 0) - (a.tanggal || 0));
            setAllTransaksi(data);
            setLoadingTransaksi(false);
        }, (error) => {
            console.error("Firebase error (transaksi):", error);
            message.error("Gagal memuat data transaksi.");
            setLoadingTransaksi(false);
        });
        return () => unsub();
    }, []);

    // --- Fetch Dependencies (Buku & Pelanggan) ---
    useEffect(() => {
        setLoadingDependencies(true);
        let bukuUnsub, pelangganUnsub;
        const loadDeps = async () => {
            try {
                const bukuPromise = new Promise((resolve) => {
                    bukuUnsub = onValue(ref(db, 'buku'), (snap) => resolve(snapshotToArray(snap)), (err) => resolve([])); // fallback empty array on error
                });
                const pelangganPromise = new Promise((resolve) => {
                     pelangganUnsub = onValue(ref(db, 'pelanggan'), (snap) => resolve(snapshotToArray(snap)), (err) => resolve([])); // fallback empty array on error
                });
                const [bukuData, pelangganData] = await Promise.all([bukuPromise, pelangganPromise]);
                setBukuList(bukuData);
                setPelangganList(pelangganData);
            } catch (error) {
                 console.error("Gagal fetch dependencies:", error);
                 message.error("Gagal memuat data buku/pelanggan.");
            } finally {
                setLoadingDependencies(false);
            }
        };
        loadDeps();
        // Cleanup
        return () => {
             if (bukuUnsub) bukuUnsub();
             if (pelangganUnsub) pelangganUnsub();
        };
    }, []);

    // --- Filter Data ---
    const filteredTransaksi = useMemo(() => {
        // Aktifkan spinner saat filter/search berubah
        setIsFiltering(true);
        let data = allTransaksi;

        // Filter by Status
        if (statusFilter) {
            data = data.filter((tx) => {
                const s = tx.statusPembayaran || '';
                if (statusFilter === 'Sebagian') return s === 'Sebagian' || s === 'DP';
                return s === statusFilter;
            });
        }

        // Filter by Search Text (Debounced)
        if (debouncedSearchText) {
            const q = debouncedSearchText.toLowerCase();
            data = data.filter((tx) =>
                (tx.nomorInvoice || '').toLowerCase().includes(q) || // Tambah search by invoice
                (tx.namaPelanggan || '').toLowerCase().includes(q) ||
                (tx.keterangan || '').toLowerCase().includes(q)
            );
        }

        return data;
    }, [allTransaksi, statusFilter, debouncedSearchText]); // Dependensi


    // --- Efek untuk mematikan spinner setelah filter ---
    useEffect(() => {
        if (isFiltering) {
            const timer = setTimeout(() => setIsFiltering(false), 350); // Jeda spinner
            return () => clearTimeout(timer);
        }
    }, [isFiltering, filteredTransaksi]); // Tergantung hasil filter

    // --- Kalkulasi Rekap (hanya dari data filter aktif) ---
    // Diubah agar hanya kalkulasi saat filteredTransaksi berubah
    const recapData = useMemo(() => {
        const dataToRecap = isFiltering ? filteredTransaksi : allTransaksi; // Gunakan data filter jika aktif
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
            sisaTagihan: totals.tagihan - totals.terbayar
        };
    }, [filteredTransaksi, allTransaksi, isFiltering]); // Tambah isFiltering


    // --- Handlers ---
    const handleSearchChange = useCallback((e) => {
        setSearchText(e.target.value); // Update input state langsung
        // isFiltering akan diaktifkan oleh useMemo filteredTransaksi
        setPagination(prev => ({ ...prev, current: 1 })); // Reset page saat search
    }, []);

    const handleStatusFilterChange = useCallback((e) => {
        setStatusFilter(e.target.value); // Update filter status
        setIsFiltering(true); // Aktifkan spinner
        setPagination(prev => ({ ...prev, current: 1 })); // Reset page saat filter
    }, []);

    // Handler untuk pagination & sort dari tabel
    const handleTableChange = useCallback((paginationConfig, filters, sorter) => {
        // Hanya aktifkan spinner jika pagination berubah
         if (paginationConfig.current !== pagination.current || paginationConfig.pageSize !== pagination.pageSize) {
           setIsFiltering(true);
        }
        setPagination(paginationConfig);
        // Note: Sorting ditangani oleh Ant Table, tidak perlu state terpisah di sini
    }, [pagination]); // Dependensi pagination

    // Handlers Modal Form
    const handleOpenCreate = useCallback(() => { setFormMode('create'); setEditingTx(null); setIsFormModalOpen(true); }, []);
    const handleOpenEdit = useCallback((tx) => { setFormMode('edit'); setEditingTx(tx); setIsFormModalOpen(true); }, []);
    const handleCloseFormModal = useCallback(() => { setIsFormModalOpen(false); setEditingTx(null); }, []);
    const handleFormSuccess = useCallback(() => { handleCloseFormModal(); /* onValue handle update data */ }, [handleCloseFormModal]);

    // Handlers Modal Detail
    const handleOpenDetailModal = useCallback((tx) => { setSelectedTransaksi(tx); setIsDetailModalOpen(true); }, []);
    const handleCloseDetailModal = useCallback(() => { setSelectedTransaksi(null); setIsDetailModalOpen(false); }, []);

    // --- Handlers PDF (Tetap pakai useCallback) ---
    const handleClosePdfModal = useCallback(() => { /* ... (seperti sebelumnya) ... */ setIsPdfModalOpen(false); setIsPdfGenerating(false); setPdfBlob(null); setPdfTitle(''); }, []);
    const handleGenerateInvoice = useCallback(async (tx) => { /* ... (seperti sebelumnya) ... */ setPdfTitle(`Invoice: ${tx.nomorInvoice || tx.id}`); setIsPdfGenerating(true); setIsPdfModalOpen(true); setPdfBlob(null); try { const dataUri = generateInvoicePDF(tx); const blob = await fetch(dataUri).then(r => r.blob()); setPdfBlob(blob); } catch (err) { console.error("Gagal generate invoice:", err); message.error('Gagal PDF invoice.'); setIsPdfModalOpen(false); } finally { setIsPdfGenerating(false); } }, [message]);
    const handleGenerateNota = useCallback(async (tx) => { /* ... (seperti sebelumnya) ... */ if (!['DP', 'Sebagian', 'Lunas'].includes(tx?.statusPembayaran)) { message.error('Nota hanya untuk status DP/Sebagian/Lunas'); return; } setPdfTitle(`Nota: ${tx.nomorInvoice || tx.id}`); setIsPdfGenerating(true); setIsPdfModalOpen(true); setPdfBlob(null); try { const dataUri = generateNotaPDF(tx); const blob = await fetch(dataUri).then(r => r.blob()); setPdfBlob(blob); } catch (err) { console.error("Gagal generate nota:", err); message.error('Gagal PDF nota.'); setIsPdfModalOpen(false); } finally { setIsPdfGenerating(false); } }, [message]);
    const handleDownloadPdf = useCallback(async () => { /* ... (seperti sebelumnya) ... */ if (!pdfBlob) return; message.loading({ content: 'Download...', key: 'pdfdl' }); try { const url = URL.createObjectURL(pdfBlob); const link = document.createElement('a'); link.href = url; const fn = `${pdfTitle.replace(/ /g, '_') || 'download'}.pdf`; link.setAttribute('download', fn); document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); message.success({ content: 'Download!', key: 'pdfdl', duration: 2 }); } catch (err) { message.error({ content: `Gagal: ${err.message}`, key: 'pdfdl', duration: 3 }); } }, [pdfBlob, pdfTitle, message]);
    const handleSharePdf = useCallback(async () => { /* ... (seperti sebelumnya) ... */ if (!navigator.share) { message.error('Share tidak didukung.'); return; } if (!pdfBlob) return; const fn = `${pdfTitle.replace(/ /g, '_') || 'file'}.pdf`; const file = new File([pdfBlob], fn, { type: 'application/pdf' }); const shareData = { title: pdfTitle, text: `File: ${pdfTitle}`, files: [file] }; if (navigator.canShare && navigator.canShare(shareData)) { try { await navigator.share(shareData); message.success('Dibagikan!'); } catch (err) { if (err.name !== 'AbortError') message.error(`Gagal: ${err.message}`); } } else { message.warn('Share file tidak didukung.'); } }, [pdfBlob, pdfTitle, message]);


    // --- Definisi Kolom Tabel (Pakai useCallback untuk Aksi) ---
     const renderAksi = useCallback((_, record) => {
         const menu = (
             <Menu>
                 <Menu.Item key="detail" onClick={() => handleOpenDetailModal(record)}>Lihat Detail</Menu.Item>
                 <Menu.Item key="edit" onClick={() => handleOpenEdit(record)}>Edit Transaksi</Menu.Item>
                 <Menu.Divider />
                 <Menu.Item key="inv" onClick={() => handleGenerateInvoice(record)}>Generate Invoice</Menu.Item>
                 <Menu.Item key="nota" onClick={() => handleGenerateNota(record)} disabled={!['DP', 'Sebagian', 'Lunas'].includes(record?.statusPembayaran)}>Generate Nota</Menu.Item>
             </Menu>
         );
         return (
             <Dropdown overlay={menu} trigger={["click"]}>
                 <Button icon={<MoreOutlined />} />
             </Dropdown>
         );
     }, [handleOpenDetailModal, handleOpenEdit, handleGenerateInvoice, handleGenerateNota]); // <-- Dependensi stabil

    const columns = useMemo(() => [
        { title: 'No.', key: 'index', width: 60, render: (_t, _r, idx) => ((pagination.current - 1) * pagination.pageSize) + idx + 1 },
        { title: 'Tanggal', dataIndex: 'tanggal', key: 'tanggal', width: 140, render: formatDate, sorter: (a, b) => (a.tanggal || 0) - (b.tanggal || 0), /* defaultSortOrder: 'descend' // Biar Antd yg handle state sort */ },
        { title: 'ID Transaksi', dataIndex: 'id', key: 'id', width: 200, render: (id) => <small>{id}</small> },
        { title: 'Pelanggan', dataIndex: 'namaPelanggan', key: 'namaPelanggan', width: 240, sorter: (a, b) => (a.namaPelanggan || '').localeCompare(b.namaPelanggan || ''), render: (val, record) => (<span>{val} {record.pelangganIsSpesial ? <Tag color="gold">Spesial</Tag> : null}</span>) },
        { title: 'Keterangan', dataIndex: 'keterangan', key: 'keterangan', ellipsis: true, render: (v) => v || '-' },
        { title: 'Total Tagihan', dataIndex: 'totalTagihan', key: 'totalTagihan', align: 'right', width: 160, render: formatCurrency, sorter: (a, b) => (a.totalTagihan || 0) - (b.totalTagihan || 0) },
        { title: 'Sisa Tagihan', key: 'sisaTagihan', align: 'right', width: 160, render: (_, r) => { const sisa = (r.totalTagihan || 0) - (r.jumlahTerbayar || 0); return <span style={{ color: sisa > 0 ? '#cf1322' : '#3f8600', fontWeight: 600 }}>{formatCurrency(sisa)}</span>; }, sorter: (a, b) => (a.totalTagihan - (a.jumlahTerbayar || 0)) - (b.totalTagihan - (b.jumlahTerbayar || 0)) },
        { title: 'Status Bayar', dataIndex: 'statusPembayaran', key: 'statusPembayaran', width: 140, render: (statusRaw) => { const status = normalizeStatus(statusRaw); let color = 'default'; if (status === 'Lunas') color = 'green'; else if (status === 'Belum Bayar') color = 'red'; else if (status === 'Sebagian') color = 'orange'; return <Tag color={color}>{status}</Tag>; } },
        { title: 'Aksi', key: 'aksi', align: 'center', width: 100, /*width disesuaikan*/ render: renderAksi }, // Lebar disesuaikan
    ], [pagination, renderAksi]); // Tambah pagination sebagai dependensi untuk nomor urut

    const tableScrollX = useMemo(() => columns.reduce((acc, col) => acc + (col.width || 150), 0), [columns]);

    // Kalkulasi Persentase Recap
    const paidPercent = recapData.totalTagihan > 0 ? (recapData.totalTerbayar / recapData.totalTagihan) * 100 : 0;
    const outstandingPercent = recapData.totalTagihan > 0 ? (recapData.sisaTagihan / recapData.totalTagihan) * 100 : 0;

    // --- Render JSX ---
    return (
        <Layout> {/* Tambahkan Layout jika belum ada */}
             <Content style={{ padding: '24px', backgroundColor: '#f0f2f5' }}> {/* Sesuaikan padding & background */}
                {/* Tombol Tambah FAB */}
                <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 10 }}>
                    <Button type="primary" shape="round" icon={<PlusOutlined />} size="large" style={{ boxShadow: '0 4px 12px rgba(0,0,0,.15)' }} onClick={handleOpenCreate}>
                        Tambah Transaksi
                    </Button>
                </div>

                <Card style={{ marginBottom: 24 }}> {/* Tambahkan margin bawah */}
                    <Title level={4} style={{ margin: 0, marginBottom: 24 }}>Ringkasan Transaksi Penjualan</Title>
                    <Row gutter={[16, 16]}>
                        <Col xs={24} lg={8}>
                            {/* PERBAIKAN WARNING: bordered={false} -> variant="borderless" */}
                            <Card variant="borderless" style={{ backgroundColor: '#f0f2f5' }}>
                                <Statistic title={`Total Tagihan (${isFiltering ? 'Filter Aktif' : 'Semua'})`} value={recapData.totalTagihan} formatter={formatCurrency} />
                            </Card>
                        </Col>
                        <Col xs={24} lg={8}>
                             <Card variant="borderless" style={{ backgroundColor: '#f0f2f5' }}>
                                <Statistic title={`Total Terbayar (${isFiltering ? 'Filter Aktif' : 'Semua'})`} value={recapData.totalTerbayar} formatter={formatCurrency} valueStyle={{ color: '#3f8600' }} suffix={`(${paidPercent.toFixed(1)}%)`} />
                            </Card>
                        </Col>
                        <Col xs={24} lg={8}>
                             <Card variant="borderless" style={{ backgroundColor: '#f0f2f5' }}>
                                <Statistic title={`Total Sisa (${isFiltering ? 'Filter Aktif' : 'Semua'})`} value={recapData.sisaTagihan} formatter={formatCurrency} valueStyle={{ color: recapData.sisaTagihan > 0 ? '#cf1322' : '#3f8600' }} suffix={`(${outstandingPercent.toFixed(1)}%)`} />
                            </Card>
                        </Col>
                    </Row>
                </Card>

                <Card>
                    <Row justify="space-between" align="middle" gutter={[16, 16]} style={{ marginBottom: 16 }}>
                         <Col xs={24} sm={12} md={8}>
                             <Title level={5} style={{ margin: 0 }}>Daftar Transaksi</Title>
                         </Col>
                         <Col xs={24} sm={12} md={8}>
                             <Search
                                placeholder="Cari No. Invoice, Pelanggan..."
                                value={searchText} // State input
                                onChange={handleSearchChange} // Handler input
                                allowClear
                                style={{ width: '100%' }}
                             />
                         </Col>
                         <Col xs={24} md={8} style={{ textAlign: 'right' }}>
                             <Radio.Group value={statusFilter} onChange={handleStatusFilterChange}>
                                 <Radio.Button value={null}>Semua</Radio.Button>
                                 <Radio.Button value="Belum Bayar">Belum</Radio.Button>
                                 <Radio.Button value="Sebagian">DP</Radio.Button>
                                 <Radio.Button value="Lunas">Lunas</Radio.Button>
                             </Radio.Group>
                         </Col>
                    </Row>

                    {/* --- Gunakan Komponen Tabel Terpisah --- */}
                    <TransaksiJualTableComponent
                        columns={columns}
                        dataSource={filteredTransaksi}
                        loading={loadingTransaksi} // Hanya loading fetch awal
                        isFiltering={isFiltering} // Loading filter/search/page
                        pagination={pagination}
                        handleTableChange={handleTableChange}
                        tableScrollX={tableScrollX}
                    />
                </Card>

                {/* --- Modal Form Create/Edit --- */}
                 {/* Render kondisional agar state di dalamnya fresh saat dibuka */}
                 {isFormModalOpen && (
                    <TransaksiJualForm
                        key={editingTx?.id || 'create'} // Penting untuk reset form
                        open={isFormModalOpen}
                        onCancel={handleCloseFormModal}
                        mode={formMode}
                        initialTx={editingTx}
                        bukuList={bukuList}
                        pelangganList={pelangganList}
                        onSuccess={handleFormSuccess}
                        // Kirim loading dependencies agar form bisa disable tombol jika data belum siap
                        loadingDependencies={loadingDependencies}
                    />
                 )}


                {/* --- Modal Detail --- */}
                <TransaksiJualDetailModal
                    open={isDetailModalOpen}
                    onCancel={handleCloseDetailModal}
                    transaksi={selectedTransaksi}
                />

                {/* --- Modal PDF --- */}
                <Modal
                    title={pdfTitle} open={isPdfModalOpen} onCancel={handleClosePdfModal}
                    width="100vw" style={{ top: 0, padding: 0, margin: 0, maxWidth: '100vw' }}
                    destroyOnClose
                    footer={[
                        <Button key="close" onClick={handleClosePdfModal}>Tutup</Button>,
                        navigator.share && (<Button key="share" icon={<ShareAltOutlined />} onClick={handleSharePdf} disabled={isPdfGenerating || !pdfBlob}>Share File</Button>),
                        <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={handleDownloadPdf} disabled={isPdfGenerating || !pdfBlob}>Download</Button>
                    ]}
                    bodyStyle={{ padding: 0, height: 'calc(100vh - 55px - 53px)', position: 'relative' }}
                >
                    {isPdfGenerating && (
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.7)', zIndex: 10 }}>
                            <Spin size="large" tip="Membuat file PDF..." />
                        </div>
                    )}
                    {!isPdfGenerating && pdfBlob ? (
                        <div style={{ height: '100%', width: '100%', overflow: 'auto' }}>
                            <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
                                <Viewer key={pdfTitle} fileUrl={URL.createObjectURL(pdfBlob)} />
                            </Worker>
                        </div>
                    ) : (
                        !isPdfGenerating && (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}><Empty description="Gagal memuat PDF" /></div>)
                    )}
                </Modal>
            </Content>
        </Layout> // Akhir Layout
    );
}