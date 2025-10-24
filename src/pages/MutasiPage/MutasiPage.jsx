import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Layout, Card, Table, Tag, Button, Modal, Input, Space, Typography, Row, Col,
    message, Tooltip, Empty, Grid, DatePicker, Spin
} from 'antd';
import {
    PlusOutlined, EditOutlined, EyeOutlined, SyncOutlined, DownloadOutlined, ShareAltOutlined
} from '@ant-design/icons';
import { ref, onValue, query, orderByChild, equalTo } from 'firebase/database';
import dayjs from 'dayjs';
import 'dayjs/locale/id';

import { db } from '../../api/firebase'; // Pastikan path ini benar
import useDebounce from '../../hooks/useDebounce'; // Pastikan path ini benar
import { TipeTransaksi, KategoriPemasukan, KategoriPengeluaran } from '../../constants'; // Pastikan path ini benar

// Pastikan komponen-komponen ini ada dan di-memoize jika perlu
import RekapitulasiCard from './components/RekapitulasiCard'; // Idealnya React.memo()
import KategoriChips from './components/KategoriChips';     // Idealnya React.memo()
import TransaksiForm from './components/TransaksiForm';
import MutasiTableComponent from './components/MutasiTableComponent'; // Komponen tabel memoized

dayjs.locale('id');

const { Content } = Layout;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// --- Helper & State Awal ---
const getTimestamp = (record) => record?.tanggal || record?.tanggalBayar || 0;
const currencyFormatter = (value) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

const MutasiPage = () => {
    const [transaksiList, setTransaksiList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFiltering, setIsFiltering] = useState(false); // Spinner saat filter/search aktif

    // --- PERBAIKAN ANTI-LAG 1: Pisahkan searchText dari filters ---
    const [searchText, setSearchText] = useState(''); // State input search langsung
    const debouncedSearchText = useDebounce(searchText, 500); // Debounce untuk filtering
    const [otherFilters, setOtherFilters] = useState({ // Filter selain search text
        dateRange: null,
        selectedTipe: [],
        selectedKategori: [],
    });
    // --- Akhir Perbaikan ---

    const showTotalPagination = useCallback((total, range) => `${range[0]}-${range[1]} dari ${total} transaksi`, []);
    const [pagination, setPagination] = useState({
        current: 1, pageSize: 10,
        showSizeChanger: true, showTotal: showTotalPagination
    });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaksi, setEditingTransaksi] = useState(null);
    const [isProofModalOpen, setIsProofModalOpen] = useState(false);
    const [viewingProofUrl, setViewingProofUrl] = useState('');
    const [isProofLoading, setIsProofLoading] = useState(false);

    const screens = Grid.useBreakpoint();

    const [unpaidJual, setUnpaidJual] = useState([]);
    const [unpaidCetak, setUnpaidCetak] = useState([]);
    const [loadingInvoices, setLoadingInvoices] = useState(true);

    // --- Effect Fetch Invoice (Tidak berubah) ---
    useEffect(() => {
         setLoadingInvoices(true);
        const snapshotToArray = (snapshot) => {
            const data = snapshot.val();
            return data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
        };

        let jualBelumBayar = []; let jualDP = [];
        let cetakBelumBayar = []; let cetakDP = [];

        const jualBBRef = query(ref(db, 'transaksiJualBuku'), orderByChild('statusPembayaran'), equalTo('Belum Bayar'));
        const jualDPRef = query(ref(db, 'transaksiJualBuku'), orderByChild('statusPembayaran'), equalTo('DP'));
        const cetakBBRef = query(ref(db, 'transaksiCetakBuku'), orderByChild('statusPembayaran'), equalTo('Belum Bayar'));
        const cetakDPRef = query(ref(db, 'transaksiCetakBuku'), orderByChild('statusPembayaran'), equalTo('DP'));

        const unsubJualBB = onValue(jualBBRef, (snapshot) => { jualBelumBayar = snapshotToArray(snapshot); setUnpaidJual([...jualBelumBayar, ...jualDP]); setLoadingInvoices(false); });
        const unsubJualDP = onValue(jualDPRef, (snapshot) => { jualDP = snapshotToArray(snapshot); setUnpaidJual([...jualBelumBayar, ...jualDP]); setLoadingInvoices(false); });
        const unsubCetakBB = onValue(cetakBBRef, (snapshot) => { cetakBelumBayar = snapshotToArray(snapshot); setUnpaidCetak([...cetakBelumBayar, ...cetakDP]); setLoadingInvoices(false); });
        const unsubCetakDP = onValue(cetakDPRef, (snapshot) => { cetakDP = snapshotToArray(snapshot); setUnpaidCetak([...cetakBelumBayar, ...cetakDP]); setLoadingInvoices(false); });

        return () => { unsubJualBB(); unsubJualDP(); unsubCetakBB(); unsubCetakDP(); };
    }, []);

    // --- Effect Fetch Mutasi (Tidak berubah) ---
    useEffect(() => {
        const transaksiRef = ref(db, 'mutasi');
        setLoading(true);
        const unsubscribeTransaksi = onValue(transaksiRef, (snapshot) => {
            const data = snapshot.val();
            const loadedTransaksi = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
            loadedTransaksi.sort((a, b) => getTimestamp(b) - getTimestamp(a));
            setTransaksiList(loadedTransaksi);
            setLoading(false);
        });
        return () => unsubscribeTransaksi();
    }, []);

    // Kalkulasi Saldo Berjalan (Tidak berubah)
    const balanceMap = useMemo(() => {
        if (!transaksiList || transaksiList.length === 0) return new Map();
        const sortedAllTx = [...transaksiList].sort((a, b) => getTimestamp(a) - getTimestamp(b));
        const map = new Map();
        let currentBalance = 0;
        for (const tx of sortedAllTx) {
            currentBalance += (tx.jumlah || 0);
            map.set(tx.id, currentBalance);
        }
        return map;
    }, [transaksiList]);

    // --- Filter Data (Inti Logika) ---
    const filteredTransaksi = useMemo(() => {
        // Aktifkan spinner setiap kali dependensi filter berubah
        setIsFiltering(true);
        return transaksiList.filter(tx => {
            const tgl = dayjs(getTimestamp(tx));
            const [startDate, endDate] = otherFilters.dateRange || [null, null]; // Gunakan otherFilters

            const inDate = !startDate || (tgl.isAfter(startDate.startOf('day')) && tgl.isBefore(endDate.endOf('day')));
            const inTipe = otherFilters.selectedTipe.length === 0 || otherFilters.selectedTipe.includes(tx.tipe); // Gunakan otherFilters
            const inKategori = otherFilters.selectedKategori.length === 0 || otherFilters.selectedKategori.includes(tx.kategori) || otherFilters.selectedKategori.includes(tx.tipeMutasi); // Gunakan otherFilters
            // Gunakan debouncedSearchText dari state terpisah
            const inSearch = debouncedSearchText === '' || String(tx.keterangan || '').toLowerCase().includes(debouncedSearchText.toLowerCase());

            return inDate && inTipe && inKategori && inSearch;
        }).map(tx => ({ ...tx, saldoSetelah: balanceMap.get(tx.id) }));

    // Dependensi: list asli, filter-filter, dan search text yang sudah di-debounce
    }, [transaksiList, otherFilters.dateRange, otherFilters.selectedTipe, otherFilters.selectedKategori, debouncedSearchText, balanceMap]);


    // --- Handlers ---

    // PERBAIKAN ANTI-LAG 2: Handler search text hanya update state searchText
    const handleSearchChange = useCallback((e) => {
        setSearchText(e.target.value);
        // Jangan set isFiltering(true) di sini, biarkan useMemo/useEffect yang handle
    }, []);

    // Handler untuk filter lain (Date, Tipe, Kategori)
    const handleOtherFilterChange = useCallback((key, value) => {
        // Aktifkan spinner karena filter akan berubah
        setIsFiltering(true);
        setOtherFilters(prev => ({ ...prev, [key]: value }));
        // Reset halaman ke 1 saat filter berubah
        setPagination(prev => ({ ...prev, current: 1 }));
    }, []);

    const handleMultiSelectFilter = useCallback((key, value) => {
        setIsFiltering(true);
        setOtherFilters(prev => {
            const currentSelection = prev[key];
            const newSelection = currentSelection.includes(value)
                ? currentSelection.filter(item => item !== value)
                : [...currentSelection, value];
            return { ...prev, [key]: newSelection };
        });
         setPagination(prev => ({ ...prev, current: 1 }));
    }, []);

    // Handler Tabel untuk Pagination & Sorting
    const handleTableChange = useCallback((paginationConfig, filters, sorter) => {
        // Aktifkan spinner hanya jika pagination berubah (sort ditangani Antd)
        if (paginationConfig.current !== pagination.current || paginationConfig.pageSize !== pagination.pageSize) {
           setIsFiltering(true);
        }
        setPagination(paginationConfig);
    }, [pagination]); // Tambahkan pagination sebagai dependensi


    const resetFilters = useCallback(() => {
        setIsFiltering(true);
        setSearchText(''); // Reset search text terpisah
        setOtherFilters({ // Reset filter lain
            dateRange: null,
            selectedTipe: [],
            selectedKategori: [],
        });
        setPagination(prev => ({ ...prev, current: 1 }));
    }, []);

    // Effect untuk mematikan spinner setelah filter selesai
    useEffect(() => {
        if (isFiltering) {
            // Kita matikan spinner setelah jeda singkat
            // Ini memberi waktu untuk kalkulasi useMemo dan re-render
            const timer = setTimeout(() => setIsFiltering(false), 350); // Sedikit lebih lama dari debounce
            return () => clearTimeout(timer);
        }
    }, [isFiltering, filteredTransaksi]); // <-- Tergantung pada hasil filter

    const isFilterActive = !!otherFilters.dateRange || otherFilters.selectedTipe.length > 0 || otherFilters.selectedKategori.length > 0 || searchText !== '';


    // --- Handlers Modal (Tetap pakai useCallback) ---
    const handleTambah = useCallback(() => { /* ... */ setEditingTransaksi(null); setIsModalOpen(true); }, []);
    const handleEdit = useCallback((record) => { /* ... */ setEditingTransaksi(record); setIsModalOpen(true); }, []);
    const handleCloseModal = useCallback(() => { /* ... */ setIsModalOpen(false); setEditingTransaksi(null); }, []);
    const handleViewProof = useCallback((url) => { /* ... */ setIsProofLoading(true); setViewingProofUrl(url); setIsProofModalOpen(true); }, []);
    const handleCloseProofModal = useCallback(() => setIsProofModalOpen(false), []);
    const handleDownloadProof = useCallback(async (url) => { /* ... (logika download) ... */ }, []);
    const handleShareProof = useCallback(async (url) => { /* ... (logika share) ... */ }, []);


    // --- Definisi Kolom Tabel (Tetap pakai useMemo dan useCallback untuk render) ---
     const renderAksi = useCallback((_, record) => (
         <Space size="middle">
             <Tooltip title={record.buktiUrl ? "Lihat Bukti" : "Tidak ada bukti"}>
                 <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewProof(record.buktiUrl)} disabled={!record.buktiUrl} />
             </Tooltip>
             <Tooltip title="Edit Transaksi">
                 <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
             </Tooltip>
         </Space>
    ), [handleViewProof, handleEdit]);

    const columns = useMemo(() => {
        const baseColumns = [
            { title: 'Tanggal', dataIndex: 'tanggal', key: 'tanggal', render: (tgl, record) => dayjs(getTimestamp(record)).format('DD MMM YYYY'), sorter: (a, b) => getTimestamp(a) - getTimestamp(b), width: 140 },
            { title: 'Jenis Transaksi', dataIndex: 'kategori', key: 'kategori', render: (kategori, record) => { /* ... (render tag) ... */ const kategoriText = record.tipe === 'pemasukan' ? KategoriPemasukan[kategori] || kategori?.replace(/_/g, ' ') : KategoriPengeluaran[kategori] || kategori?.replace(/_/g, ' '); return <Tag color={record.tipe === 'pemasukan' ? 'green' : 'red'}>{kategoriText || record.tipeMutasi}</Tag>; }, width: 200 },
            { title: 'Keterangan', dataIndex: 'keterangan', key: 'keterangan' },
            { title: 'Nominal', dataIndex: 'jumlah', key: 'jumlah', align: 'right', render: (jml, record) => <Text type={record.jumlah >= 0 ? 'success' : 'danger'}>{currencyFormatter(record.jumlah)}</Text>, sorter: (a, b) => a.jumlah - b.jumlah, width: 180 },
            { title: 'Saldo Akhir', dataIndex: 'saldoSetelah', key: 'saldoSetelah', align: 'right', render: (saldo) => (saldo !== null && saldo !== undefined) ? currencyFormatter(saldo) : <Text type="secondary">-</Text>, sorter: (a, b) => (a.saldoSetelah || 0) - (b.saldoSetelah || 0), width: 180 },
            { title: 'Aksi', key: 'aksi', align: 'center', render: renderAksi, width: 140 },
        ];
        // Sembunyikan Saldo Akhir di layar kecil
        if (!screens.md) return baseColumns.filter(col => col.key !== 'saldoSetelah');
        return baseColumns;
    }, [screens, renderAksi]); // <-- Pastikan dependensi stabil


    // --- Render JSX ---
    return (
        <Content style={{ padding: screens.xs ? '12px' : '24px', backgroundColor: '#f0f2f5' }}>
            
            <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
                <Col xs={24} lg={14}>
                    <Card style={{ height: '100%' }}>
                        <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>Filter Transaksi</Title>
                        <Space direction="vertical" size="large" style={{ width: '100%' }}>
                            <Row gutter={[16, 16]}>
                                {/* PERBAIKAN: Gunakan handler dan state yang benar */}
                                <Col xs={24} sm={12}><RangePicker style={{ width: '100%' }} onChange={(dates) => handleOtherFilterChange('dateRange', dates)} value={otherFilters.dateRange} placeholder={['Tanggal Mulai', 'Tanggal Selesai']} /></Col>
                                <Col xs={24} sm={12}>
                                    <Input.Search 
                                        placeholder="Cari berdasarkan keterangan..." 
                                        value={searchText} // <-- State input langsung
                                        onChange={handleSearchChange} // <-- Handler input langsung
                                        allowClear 
                                        style={{ width: '100%' }} 
                                        // Jangan tambahkan loading di sini, biarkan tabel yg handle
                                     />
                                 </Col>
                            </Row>
                            {/* Filter Chips (Gunakan otherFilters dan handleMultiSelectFilter) */}
                            <div>
                                <Text strong>Tipe Transaksi:</Text>
                                <div style={{ marginTop: 8 }}>
                                    <Space wrap>
                                        <Tag.CheckableTag style={chipStyle} checked={otherFilters.selectedTipe.includes(TipeTransaksi.pemasukan)} onChange={() => handleMultiSelectFilter('selectedTipe', TipeTransaksi.pemasukan)}>Pemasukan</Tag.CheckableTag>
                                        <Tag.CheckableTag style={chipStyle} checked={otherFilters.selectedTipe.includes(TipeTransaksi.pengeluaran)} onChange={() => handleMultiSelectFilter('selectedTipe', TipeTransaksi.pengeluaran)}>Pengeluaran</Tag.CheckableTag>
                                    </Space>
                                </div>
                            </div>
                            {(otherFilters.selectedTipe.length === 0 || otherFilters.selectedTipe.includes(TipeTransaksi.pemasukan)) && (
                                <div>
                                    <Text strong>Kategori Pemasukan:</Text>
                                    <div style={{ marginTop: 8 }}><KategoriChips kategoriMap={KategoriPemasukan} onSelect={handleMultiSelectFilter} selectedKategori={otherFilters.selectedKategori} /></div>
                                </div>
                            )}
                            {(otherFilters.selectedTipe.length === 0 || otherFilters.selectedTipe.includes(TipeTransaksi.pengeluaran)) && (
                                <div>
                                    <Text strong>Kategori Pengeluaran:</Text>
                                    <div style={{ marginTop: 8 }}><KategoriChips kategoriMap={KategoriPengeluaran} onSelect={handleMultiSelectFilter} selectedKategori={otherFilters.selectedKategori} /></div>
                                </div>
                            )}
                            {/* Reset Button (Gunakan isFilterActive yang sudah disesuaikan) */}
                            {isFilterActive && (<Button icon={<SyncOutlined />} onClick={resetFilters} style={{ width: 'fit-content' }}>Reset Filter</Button>)}
                        </Space>
                    </Card>
                </Col>
                <Col xs={24} lg={10}>
                    {/* Rekapitulasi Card (filteredTransaksi akan otomatis update) */}
                    {isFilterActive ? <RekapitulasiCard data={filteredTransaksi} /> : (
                         <Card style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Empty description={<Text type="secondary">Pilih filter untuk melihat rekapitulasi</Text>} />
                        </Card>
                    )}
                </Col>
            </Row>
            
            <Card>
                <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>Daftar Transaksi</Title>
                
                {/* --- Gunakan Komponen Tabel Terpisah --- */}
                <MutasiTableComponent
                    columns={columns}
                    dataSource={filteredTransaksi} // Data hasil filter utama & lainnya
                    loading={loading}             // Loading fetch awal
                    isFiltering={isFiltering}     // Loading filter/search/sort/page
                    pagination={pagination}
                    handleTableChange={handleTableChange} // Callback onChange
                />
            </Card>

            {/* Tombol Tambah FAB */}
            <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 10 }}>
                <Button type="primary" shape="round" icon={<PlusOutlined />} size="large" style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }} onClick={handleTambah}>Tambah</Button>
            </div>

            {/* Modal Form Transaksi */}
            <TransaksiForm
                open={isModalOpen}
                onCancel={handleCloseModal}
                initialValues={editingTransaksi}
                unpaidJual={unpaidJual}
                unpaidCetak={unpaidCetak}
                loadingInvoices={loadingInvoices}
            />

            {/* Modal Bukti Transaksi */}
            <Modal open={isProofModalOpen} title="Bukti Transaksi" onCancel={handleCloseProofModal} /* ... sisanya ... */ >
                 {isProofLoading && <Spin size="large" />}
                 {/* ... img/iframe ... */}
            </Modal>
        </Content>
    );
};

// Style (Tidak berubah)
const chipStyle = { border: '1px solid #d9d9d9', padding: '4px 10px', borderRadius: '16px', minWidth: '130px', textAlign: 'center' };

export default MutasiPage;