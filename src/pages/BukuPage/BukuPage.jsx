import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Layout, Card, Table, Tag, Button, Input, Space, Typography, Row, Col,
    Grid, Tooltip
} from 'antd'; // Hapus Table jika hanya dipakai di child
import { PlusOutlined, EditOutlined, HistoryOutlined } from '@ant-design/icons'; // Pindahkan EditOutlined, HistoryOutlined ke child jika hanya dipakai di sana
import { ref, onValue } from 'firebase/database';
import { db } from '../../api/firebase'; // Sesuaikan path
import useDebounce from '../../hooks/useDebounce'; // Sesuaikan path

// Pastikan komponen-komponen ini ada di path yang benar
import BukuForm from './components/BukuForm';
import StokFormModal from './components/StockFormModal';
import BukuTableComponent from './components/BukuTableComponent'; // <-- Impor komponen baru

const { Content } = Layout;
const { Title } = Typography;

// Helper (tetap di sini atau pindah ke file utils)
const currencyFormatter = (value) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);
const numberFormatter = (value) =>
    new Intl.NumberFormat('id-ID').format(value || 0);
const percentFormatter = (value) => `${value || 0}%`;
const generateFilters = (data, key) => {
    if (!data || data.length === 0) return [];
    const uniqueValues = [...new Set(data.map(item => item[key]).filter(Boolean))];
    uniqueValues.sort();
    return uniqueValues.map(value => ({ text: String(value), value: value }));
};


const BukuPage = () => {
    const [bukuList, setBukuList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCalculating, setIsCalculating] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isStokModalOpen, setIsStokModalOpen] = useState(false);

    const [editingBuku, setEditingBuku] = useState(null);
    const [stokBuku, setStokBuku] = useState(null);

    const [searchText, setSearchText] = useState('');
    const debouncedSearchText = useDebounce(searchText, 300);
    const screens = Grid.useBreakpoint();

    const [columnFilters, setColumnFilters] = useState({});
    const showTotalPagination = useCallback((total, range) => `${range[0]}-${range[1]} dari ${total} buku`, []);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 15,
        pageSizeOptions: ['15', '50', '100', '200'],
        showSizeChanger: true,
        showTotal: showTotalPagination,
    });
    const [summaryData, setSummaryData] = useState({ totalStok: 0, totalAsset: 0 });

    // Listener data buku dari Firebase
    useEffect(() => {
        const bukuRef = ref(db, 'buku');
        setLoading(true);
        const unsubscribeBuku = onValue(bukuRef, (snapshot) => {
            const data = snapshot.val();
            const loadedBuku = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
            loadedBuku.sort((a, b) => a.judul.localeCompare(b.judul));
            setBukuList(loadedBuku);
            setLoading(false);
        });
        return () => unsubscribeBuku();
    }, []);

    // Filter data berdasarkan pencarian (Main Search Bar)
    const filteredBuku = useMemo(() => {
        // Penting: Filter utama HANYA berdasarkan debouncedSearchText
        // Filter kolom akan diterapkan oleh <Table> secara internal
        if (!debouncedSearchText) return bukuList;
        const lowerSearch = debouncedSearchText.toLowerCase();
        return bukuList.filter(buku =>
            buku.judul.toLowerCase().includes(lowerSearch) ||
            (buku.kode_buku && buku.kode_buku.toLowerCase().includes(lowerSearch)) ||
            (buku.penerbit && buku.penerbit.toLowerCase().includes(lowerSearch)) ||
            (buku.mapel && buku.mapel.toLowerCase().includes(lowerSearch))
        );
    }, [bukuList, debouncedSearchText]);


    // Generate Filter Options (Tidak berubah)
    const mapelFilters = useMemo(() => generateFilters(bukuList, 'mapel'), [bukuList]);
    const kelasFilters = useMemo(() => generateFilters(bukuList, 'kelas'), [bukuList]);
    const spekFilters = useMemo(() => generateFilters(bukuList, 'spek'), [bukuList]);
    const peruntukanFilters = useMemo(() => generateFilters(bukuList, 'peruntukan'), [bukuList]);
    const penerbitFilters = useMemo(() => generateFilters(bukuList, 'penerbit'), [bukuList]);


    // Fungsi Kalkulasi Summary
    const calculateSummary = useCallback((data) => {
        if (!data || data.length === 0) {
            setSummaryData({ totalStok: 0, totalAsset: 0 });
            return;
        }
        const { totalStok, totalAsset } = data.reduce((acc, item) => {
            const stok = Number(item.stok) || 0;
            const harga = Number(item.hargaJual) || 0;
            acc.totalStok += stok;
            acc.totalAsset += stok * harga;
            return acc;
        }, { totalStok: 0, totalAsset: 0 });
        setSummaryData({ totalStok, totalAsset });
    }, []);


    // Effect untuk kalkulasi awal dan saat search utama berubah
    useEffect(() => {
        setIsCalculating(true);
        calculateSummary(filteredBuku);
        // Reset pagination & filter kolom HANYA saat search utama berubah
        setPagination(prev => ({ ...prev, current: 1 }));
        setColumnFilters({}); // Reset filter kolom saat search utama berubah
    }, [filteredBuku, calculateSummary]);


    // Effect untuk mematikan spinner
    useEffect(() => {
        if (isCalculating) {
            const timer = setTimeout(() => setIsCalculating(false), 200);
            return () => clearTimeout(timer);
        }
    }, [isCalculating, summaryData]);


    // Handler Utama Perubahan Tabel (Filter Kolom, Sort, Pagination)
    const handleTableChange = useCallback((pagination, filters, sorter, extra) => {
        setIsCalculating(true); // Tampilkan spinner
        setPagination(pagination);
        setColumnFilters(filters);
        // Kalkulasi summary berdasarkan data YANG SUDAH DIFILTER oleh Tabel
        calculateSummary(extra.currentDataSource);
    }, [calculateSummary]);


    // --- Handlers Modal ---
    const handleTambah = useCallback(() => { // Gunakan useCallback
        setEditingBuku(null);
        setIsModalOpen(true);
    }, []);
    const handleEdit = useCallback((record) => {
        setEditingBuku(record);
        setIsModalOpen(true);
    }, []);
    const handleTambahStok = useCallback((record) => {
        setStokBuku(record);
        setIsStokModalOpen(true);
    }, []);
    const handleCloseModal = useCallback(() => { // Gunakan useCallback
        setIsModalOpen(false);
        setEditingBuku(null);
    }, []);
    const handleCloseStokModal = useCallback(() => { // Gunakan useCallback
        setIsStokModalOpen(false);
        setStokBuku(null);
    }, []);


    // --- Definisi Kolom Tabel (Pindahkan ke sini agar stabil) ---
    // Gunakan useCallback pada render Aksi agar kolom stabil
    const renderAksi = useCallback((_, record) => (
        <Space size="small">
            <Tooltip title="Edit Detail Buku">
                <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
            </Tooltip>
            <Tooltip title="Tambah/Kurangi Stok">
                <Button type="link" icon={<HistoryOutlined />} onClick={() => handleTambahStok(record)} />
            </Tooltip>
        </Space>
    ), [handleEdit, handleTambahStok]); // <-- Dependensi stabil

    const columns = useMemo(() => [
        { title: 'Kode', dataIndex: 'kode_buku', key: 'kode_buku', sorter: (a, b) => (a.kode_buku || '').localeCompare(b.kode_buku || ''), width: 100 },
        { title: 'Judul Buku', dataIndex: 'judul', key: 'judul', sorter: (a, b) => a.judul.localeCompare(b.judul), width: 250 },
        { title: 'Stok', dataIndex: 'stok', key: 'stok', sorter: (a, b) => (a.stok || 0) - (b.stok || 0), align: 'right', width: 100 },
        {
            title: 'Mapel', dataIndex: 'mapel', key: 'mapel', width: 150,
            filters: mapelFilters, filteredValue: columnFilters.mapel || null, onFilter: (value, record) => record.mapel === value,
        },
        {
            title: 'Kelas', dataIndex: 'kelas', key: 'kelas', render: (kelas) => kelas || '-', width: 80,
            filters: kelasFilters, filteredValue: columnFilters.kelas || null, onFilter: (value, record) => record.kelas === value,
        },
        {
            title: 'Spek', dataIndex: 'spek', key: 'spek', render: (spek) => spek ? <Tag>{spek}</Tag> : '-', width: 100,
            filters: spekFilters, filteredValue: columnFilters.spek || null, onFilter: (value, record) => record.spek === value,
        },
        {
            title: 'Peruntukan', dataIndex: 'peruntukan', key: 'peruntukan', render: (val) => val || '-', width: 100,
            filters: peruntukanFilters, filteredValue: columnFilters.peruntukan || null, onFilter: (value, record) => record.peruntukan === value,
        },
        { title: 'Harga Jual', dataIndex: 'hargaJual', key: 'hargaJual', render: (val) => currencyFormatter(val), align: 'right', width: 150 },
        { title: 'Diskon Jual', dataIndex: 'diskonJual', key: 'diskonJual', render: (val) => percentFormatter(val), align: 'right', width: 120 },
        { title: 'Diskon Spesial', dataIndex: 'diskonJualSpesial', key: 'diskonJualSpesial', render: (val) => percentFormatter(val), align: 'right', width: 120 },
        {
            title: 'Penerbit', dataIndex: 'penerbit', key: 'penerbit', width: 150,
            filters: penerbitFilters, filteredValue: columnFilters.penerbit || null, onFilter: (value, record) => record.penerbit === value,
        },
        { title: 'Aksi', key: 'aksi', align: 'center', width: 120, render: renderAksi }, // <-- Gunakan render Aksi yg stabil
    ], [mapelFilters, kelasFilters, spekFilters, peruntukanFilters, penerbitFilters, columnFilters, renderAksi]); // <-- Tambahkan dependensi stabil

    const tableScrollX = useMemo(() => columns.reduce((acc, col) => acc + (col.width || 150), 0), [columns]);


    return (
        <Content style={{ padding: screens.xs ? '12px' : '24px' }}>
            <Card>
                <Row justify="space-between" align="middle" gutter={[16, 16]}>
                    <Col>
                        <Title level={5} style={{ marginTop: 0, marginBottom: 0 }}>Manajemen Data Buku</Title>
                    </Col>
                    <Col flex="auto">
                        <Space.Compact style={{ width: '100%', maxWidth: 500, float: 'right' }}>
                            <Input.Search
                                placeholder="Cari Judul, Kode, Penerbit..."
                                value={searchText}
                                // Input onChange TIDAK perlu debounce, hanya update state biasa
                                onChange={(e) => setSearchText(e.target.value)}
                                allowClear
                            />
                            <Button type="primary" icon={<PlusOutlined />} onClick={handleTambah}>
                                {!screens.xs && 'Tambah Buku'}
                            </Button>
                        </Space.Compact>
                    </Col>
                </Row>

                {/* --- Gunakan Komponen Tabel Baru --- */}
                <BukuTableComponent
                    columns={columns}
                    dataSource={filteredBuku} // Data dari search utama
                    loading={loading}
                    isCalculating={isCalculating} // Loading kalkulasi/filter
                    pagination={pagination}
                    summaryData={summaryData}
                    handleTableChange={handleTableChange} // Callback untuk filter kolom, sort, pagination
                    tableScrollX={tableScrollX}
                    handleEdit={handleEdit}
                    handleTambahStok={handleTambahStok}
                />
            </Card>

            {/* --- Modal-modal --- */}
            <BukuForm
                open={isModalOpen}
                onCancel={handleCloseModal}
                initialValues={editingBuku}
            />

            <StokFormModal
                open={isStokModalOpen}
                onCancel={handleCloseStokModal}
                buku={stokBuku}
            />
        </Content>
    );
};

export default BukuPage;