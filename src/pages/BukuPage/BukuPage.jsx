import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import {
    Layout, Card, Button, Space, Typography, Row, Col, Tabs, 
    message, Grid, Spin, Input
} from 'antd';
import {
    PlusOutlined, ContainerOutlined, PrinterOutlined,
    PullRequestOutlined, ReadOutlined
} from '@ant-design/icons';

import BulkRestockModal from './components/BulkRestockModal';
import PdfPreviewModal from './components/PdfPreviewModal';
import BukuTableComponent from './components/BukuTable';
import BukuForm from './components/BukuForm';
import StokFormModal from './components/StockFormModal';
import StokHistoryTab from './components/StokHistoryTab';
import BukuActionButtons from './components/BukuActionButtons';

// Use standard hook
import { useBukuStream } from '../../hooks/useFirebaseData'; 

import useDebounce from '../../hooks/useDebounce';
import { numberFormatter, generateFilters } from '../../utils/formatters';
import { generateBukuPdfBlob } from '../../utils/pdfBuku';
import dayjs from 'dayjs';

const { Content } = Layout;
const { Title } = Typography;
const { TabPane } = Tabs;

const BukuPage = () => {
    const screens = Grid.useBreakpoint();
    
    // --- 1. STATE TAB CONTROL (KEEP ALIVE) ---
    // Agar saat pindah tab (di halaman ini), data tidak reload
    const [activeTab, setActiveTab] = useState('1');
    const [hasTab2Loaded, setHasTab2Loaded] = useState(false);

    useEffect(() => {
        if (activeTab === '2' && !hasTab2Loaded) {
            setHasTab2Loaded(true);
        }
    }, [activeTab, hasTab2Loaded]);

    // --- 2. FETCH DATA STANDARD ---
    const { bukuList, loadingBuku: initialLoading } = useBukuStream();
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isStokModalOpen, setIsStokModalOpen] = useState(false);
    const [isBulkRestockModalOpen, setIsBulkRestockModalOpen] = useState(false);
    const [editingBuku, setEditingBuku] = useState(null);
    const [stokBuku, setStokBuku] = useState(null);
    
    const [searchText, setSearchText] = useState('');
    const debouncedSearchText = useDebounce(searchText, 300);
    const [columnFilters, setColumnFilters] = useState({});

    // Pagination
    const showTotalPagination = useCallback((total, range) => {
        const totalJenis = bukuList?.length || 0;
        return `${range[0]}-${range[1]} dari ${total} (Total ${numberFormatter(totalJenis)} Jenis)`;
    }, [bukuList]);

    const [pagination, setPagination] = useState(() => ({
        current: 1,
        pageSize: 25,
        pageSizeOptions: ['25', '50', '100', '200'],
        showSizeChanger: true,
        showTotal: showTotalPagination,
    }));

    // PDF
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
    const [pdfFileName, setPdfFileName] = useState("daftar_buku.pdf");

    // Search & Filter Logic
    const deferredDebouncedSearchText = useDeferredValue(debouncedSearchText);
    const isFiltering = debouncedSearchText !== deferredDebouncedSearchText;

    const searchedBuku = useMemo(() => {
        let processedData = [...(bukuList || [])]; 
        processedData.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        if (!deferredDebouncedSearchText) return processedData;

        const lowerSearch = deferredDebouncedSearchText.toLowerCase();
        return processedData.filter(buku =>
            (buku.judul || '').toLowerCase().includes(lowerSearch) ||
            (buku.kode_buku || '').toLowerCase().includes(lowerSearch) ||
            (buku.penerbit || '').toLowerCase().includes(lowerSearch) ||
            (buku.mapel || '').toLowerCase().includes(lowerSearch)
        );
    }, [bukuList, deferredDebouncedSearchText]);

    const dataForTable = useMemo(() => {
        let processedData = [...searchedBuku];
        const activeFilterKeys = Object.keys(columnFilters).filter(
            key => columnFilters[key] && columnFilters[key].length > 0
        );
        if (activeFilterKeys.length === 0) return processedData;

        for (const key of activeFilterKeys) {
            const filterValues = columnFilters[key];
            processedData = processedData.filter(item => {
                const itemValue = String(item[key] || '-');
                return filterValues.includes(itemValue);
            });
        }
        return processedData;
    }, [searchedBuku, columnFilters]);

    // Filters
    const mapelFilters = useMemo(() => generateFilters(bukuList, 'mapel'), [bukuList]);
    const kelasFilters = useMemo(() => generateFilters(bukuList, 'kelas'), [bukuList]);
    const tahunTerbitFilters = useMemo(() => generateFilters(bukuList, 'tahunTerbit'), [bukuList]);
    const peruntukanFilters = useMemo(() => generateFilters(bukuList, 'peruntukan'), [bukuList]);
    const penerbitFilters = useMemo(() => generateFilters(bukuList, 'penerbit'), [bukuList]);
    const tipeBukuFilters = useMemo(() => generateFilters(bukuList, 'tipe_buku'), [bukuList]);

    // Summary
    const summaryData = useMemo(() => {
        if (initialLoading || !dataForTable || dataForTable.length === 0) {
            return { totalStok: 0, totalAsset: 0, totalAssetNet: 0, totalJudul: 0 };
        }
        const { totalStok, totalAsset, totalAssetNet } = dataForTable.reduce((acc, item) => {
            const stok = Number(item.stok) || 0;
            const harga = Number(item.hargaJual) || 0;
            const diskon = Number(item.diskonJual) || 0;
            let hargaNet = harga * (1 - (diskon > 0 ? diskon / 100 : 0));

            acc.totalStok += stok;
            acc.totalAsset += stok * harga;
            acc.totalAssetNet += stok * hargaNet;
            return acc;
        }, { totalStok: 0, totalAsset: 0, totalAssetNet: 0 });

        return { totalStok, totalAsset, totalAssetNet, totalJudul: dataForTable.length };
    }, [dataForTable, initialLoading]);

    useEffect(() => {
        setPagination(prev => ({ ...prev, current: 1 }));
        setColumnFilters({});
    }, [debouncedSearchText]);

    // Handlers
    const handleTableChange = useCallback((paginationConfig, filters) => {
        setPagination(paginationConfig);
        setColumnFilters(filters);
    }, []);

    const handleTambah = useCallback(() => { setEditingBuku(null); setIsModalOpen(true); }, []);
    const handleEdit = useCallback((record) => { setEditingBuku(record); setIsModalOpen(true); }, []);
    const handleTambahStok = useCallback((record) => { setStokBuku(record); setIsStokModalOpen(true); }, []);
    const handleCloseModal = useCallback(() => { setIsModalOpen(false); setEditingBuku(null); }, []);
    const handleCloseStokModal = useCallback(() => { setIsStokModalOpen(false); setStokBuku(null); }, []);
    
    const handleOpenBulkRestockModal = useCallback(() => {
        if (!bukuList || bukuList.length === 0) { message.warn("Data buku belum dimuat."); return; }
        setIsBulkRestockModalOpen(true);
    }, [bukuList]);
    const handleCloseBulkRestockModal = useCallback(() => { setIsBulkRestockModalOpen(false); }, []);

    // PDF Handler
    const handleGenerateAndShowPdf = useCallback(async () => {
        const dataToExport = dataForTable;
        if (!dataToExport?.length) { message.warn('Tidak ada data untuk PDF.'); return; }
        setIsGeneratingPdf(true);
        message.loading({ content: 'Membuat PDF...', key: 'pdfgen', duration: 0 });
        setTimeout(async () => {
            try {
                if (pdfPreviewUrl) { URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(null); }
                const pdfBlob = generateBukuPdfBlob(dataToExport);
                if (!pdfBlob || !(pdfBlob instanceof Blob) || pdfBlob.size === 0) { throw new Error("Gagal membuat PDF."); }
                const url = URL.createObjectURL(pdfBlob);
                setPdfFileName(`Daftar_Stok_Buku_${dayjs().format('YYYYMMDD_HHmm')}.pdf`);
                setPdfPreviewUrl(url);
                setIsPreviewModalVisible(true);
                message.success({ content: 'PDF siap!', key: 'pdfgen', duration: 2 });
            } catch (error) {
                console.error('PDF error:', error);
                message.error({ content: `Gagal membuat PDF: ${error.message}`, key: 'pdfgen', duration: 5 });
            } finally {
                setIsGeneratingPdf(false);
            }
        }, 50);
    }, [dataForTable, pdfPreviewUrl]);

    const handleClosePreviewModal = useCallback(() => {
        setIsPreviewModalVisible(false);
        if (pdfPreviewUrl) { URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(null); }
    }, [pdfPreviewUrl]);

    // Columns
    const columns = useMemo(() => [
        { title: 'Kode Buku', dataIndex: 'kode_buku', key: 'kode_buku', width: 130, sorter: (a, b) => (Number(a.kode_buku) || 0) - (Number(b.kode_buku) || 0) },
        { title: 'Judul Buku', dataIndex: 'judul', key: 'judul', width: 300, sorter: (a, b) => (a.judul || '').localeCompare(b.judul || '') },
        { title: 'Penerbit', dataIndex: 'penerbit', key: 'penerbit', width: 150, filters: penerbitFilters, filteredValue: columnFilters.penerbit || null, onFilter: (v, r) => r.penerbit === v, sorter: (a, b) => (a.penerbit || '').localeCompare(b.penerbit || '') },
        { title: 'Stok', dataIndex: 'stok', key: 'stok', align: 'right', width: 100, render: numberFormatter, sorter: (a, b) => (Number(a.stok) || 0) - (Number(b.stok) || 0) },
        { title: 'Hrg. Z1', dataIndex: 'hargaJual', key: 'hargaJual', align: 'right', width: 150, render: (v) => v ? `Rp ${numberFormatter(v)}` : '-', sorter: (a, b) => (Number(a.hargaJual) || 0) - (Number(b.hargaJual) || 0) },
        { title: 'Kelas', dataIndex: 'kelas', key: 'kelas', width: 100, align: 'center', filters: kelasFilters, filteredValue: columnFilters.kelas || null, sorter: (a, b) => String(a.kelas || '').localeCompare(String(b.kelas || ''), undefined, { numeric: true }) },
        { title: 'Tahun', dataIndex: 'tahunTerbit', key: 'tahunTerbit', width: 100, align: 'center', render: (v) => v || '-', filters: tahunTerbitFilters, filteredValue: columnFilters.tahunTerbit || null, sorter: (a, b) => (Number(a.tahunTerbit) || 0) - (Number(b.tahunTerbit) || 0) },
        { title: 'Aksi', key: 'aksi', align: 'center', width: 100, fixed: screens.md ? 'right' : false, render: (_, record) => (<BukuActionButtons record={record} onEdit={handleEdit} onRestock={handleTambahStok} />) },
    ], [kelasFilters, tahunTerbitFilters, penerbitFilters, columnFilters, screens.md, handleEdit, handleTambahStok]);

    const tableScrollX = useMemo(() => columns.reduce((acc, col) => acc + (col.width || 150), 0), [columns]);

    return (
        <Content style={{ padding: screens.xs ? '12px' : '24px' }}>
            <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
                <TabPane tab={<Space><ReadOutlined /> Manajemen Buku</Space>} key="1" />
                <TabPane tab={<Space><PullRequestOutlined /> Riwayat Stok</Space>} key="2" />
            </Tabs>

            {/* TAB 1: MANAJEMEN BUKU */}
            <div style={{ display: activeTab === '1' ? 'block' : 'none' }}>
                <Spin spinning={initialLoading || isFiltering} tip="Memuat data...">
                    <Card>
                        <Row justify="space-between" align="middle" gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                            <Col lg={6} md={8} sm={24} xs={24}><Title level={5} style={{ margin: 0 }}>Manajemen Data Buku</Title></Col>
                            <Col lg={18} md={16} sm={24} xs={24}>
                                <Space direction={screens.xs ? 'vertical' : 'horizontal'} style={{ width: '100%', justifyContent: 'flex-end' }}>
                                    <Input.Search placeholder="Cari Judul, Kode, Penerbit..." value={searchText} onChange={(e) => setSearchText(e.target.value)} allowClear style={{ width: screens.xs ? '100%' : 250 }} enterButton />
                                    <Space wrap>
                                        <Button onClick={handleGenerateAndShowPdf} icon={<PrinterOutlined />}>Cetak PDF</Button>
                                        <Button icon={<ContainerOutlined />} onClick={handleOpenBulkRestockModal} disabled={initialLoading || bukuList.length === 0}>{screens.xs ? 'Restock' : 'Restock Borongan'}</Button>
                                        <Button type="primary" icon={<PlusOutlined />} onClick={handleTambah} disabled={initialLoading}>Tambah Buku</Button>
                                    </Space>
                                </Space>
                            </Col>
                        </Row>
                        <BukuTableComponent columns={columns} dataSource={dataForTable} loading={initialLoading || isFiltering} isCalculating={initialLoading} pagination={pagination} summaryData={summaryData} handleTableChange={handleTableChange} tableScrollX={tableScrollX} />
                    </Card>
                </Spin>
            </div>

            {/* TAB 2: RIWAYAT STOK (Lazy Load & Keep Alive) */}
            <div style={{ display: activeTab === '2' ? 'block' : 'none' }}>
                {(activeTab === '2' || hasTab2Loaded) && (<StokHistoryTab />)}
            </div>

            {/* MODALS */}
            {isModalOpen && <BukuForm open={isModalOpen} onCancel={handleCloseModal} initialValues={editingBuku} />}
            {isStokModalOpen && <StokFormModal open={isStokModalOpen} onCancel={handleCloseStokModal} buku={stokBuku} />}
            {isPreviewModalVisible && (<PdfPreviewModal visible={isPreviewModalVisible} onClose={handleClosePreviewModal} pdfBlobUrl={pdfPreviewUrl} fileName={pdfFileName} />)}
            {isBulkRestockModalOpen && (<BulkRestockModal open={isBulkRestockModalOpen} onClose={handleCloseBulkRestockModal} bukuList={bukuList} />)}
        </Content>
    );
};

export default BukuPage;