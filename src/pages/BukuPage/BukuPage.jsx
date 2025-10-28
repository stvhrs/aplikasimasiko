import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import {
    Layout, Card, Table, Tag, Button, Modal, Input, Space, Typography, Row, Col, Tabs, Menu, Dropdown,
    message, Tooltip, Empty, Grid, DatePicker, Spin, Divider, App, Statistic // (UBAH) Hapus Statistic
} from 'antd';
import {
    PlusOutlined, EditOutlined, HistoryOutlined, ContainerOutlined, PrinterOutlined,
    PullRequestOutlined, ReadOutlined, EyeOutlined
} from '@ant-design/icons';

import BulkRestockModal from './components/BulkRestockModal'; // Sesuaikan path
import PdfPreviewModal from './components/PdfPreviewModal';   // Sesuaikan path
import BukuTableComponent from './components/BukuTable';       // Sesuaikan path
import BukuForm from './components/BukuForm';             // Sesuaikan path
import StokFormModal from './components/StockFormModal';     // Sesuaikan path
import StokHistoryTab from './components/StokHistoryTab';     // Sesuaikan path
import useBukuData from '../../hooks/useBukuData';         // Sesuaikan path
import useDebounce from '../../hooks/useDebounce';         // Sesuaikan path
import {
    currencyFormatter, numberFormatter, percentFormatter, generateFilters
} from '../../utils/formatters';                 // Sesuaikan path
import { generateBukuPdfBlob } from '../../utils/pdfBuku';      // Sesuaikan path
import dayjs from 'dayjs';

const { Content } = Layout;
const { Title } = Typography;
const { TabPane } = Tabs;

const BukuPage = () => {
    // --- State ---
    const { data: bukuList, loading: initialLoading } = useBukuData();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isStokModalOpen, setIsStokModalOpen] = useState(false);
    const [isBulkRestockModalOpen, setIsBulkRestockModalOpen] = useState(false);
    const [editingBuku, setEditingBuku] = useState(null);
    const [stokBuku, setStokBuku] = useState(null);
    const [searchText, setSearchText] = useState('');
    const debouncedSearchText = useDebounce(searchText, 300);
    const screens = Grid.useBreakpoint();
    const [columnFilters, setColumnFilters] = useState({});

    // --- Pagination (PERBAIKAN STABILITAS) ---
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

    // --- PDF State (Tidak Berubah) ---
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
    const [pdfFileName, setPdfFileName] = useState("daftar_buku.pdf");

    // --- Defer Search Text & Filtering State (Tidak Berubah) ---
    const deferredDebouncedSearchText = useDeferredValue(debouncedSearchText);
    const isFiltering = debouncedSearchText !== deferredDebouncedSearchText;

    // --- Filter Buku (Hanya Search Text) ---
    const searchedBuku = useMemo(() => {
        let processedData = [...bukuList];
        processedData.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); 

        if (!deferredDebouncedSearchText) {
            return processedData;
        }

        const lowerSearch = deferredDebouncedSearchText.toLowerCase();
        return processedData.filter(buku =>
            (buku.judul || '').toLowerCase().includes(lowerSearch) ||
            (buku.kode_buku || '').toLowerCase().includes(lowerSearch) ||
            (buku.penerbit || '').toLowerCase().includes(lowerSearch) ||
            (buku.mapel || '').toLowerCase().includes(lowerSearch)
        );
    }, [bukuList, deferredDebouncedSearchText]);

    // --- Filter Buku (Gabungan Search Text + Filter Kolom) ---
    const dataForTable = useMemo(() => {
        let processedData = [...searchedBuku];

        const activeFilterKeys = Object.keys(columnFilters).filter(
            key => columnFilters[key] && columnFilters[key].length > 0
        );

        if (activeFilterKeys.length === 0) {
            return processedData; 
        }

        for (const key of activeFilterKeys) {
            const filterValues = columnFilters[key]; 
            
            processedData = processedData.filter(item => {
                if (key === 'kelas') {
                    const itemValue = String(item[key] || '-');
                    return filterValues.includes(itemValue);
                }
                
                const itemValue = item[key];
                return filterValues.includes(itemValue);
            });
        }
        
        return processedData;
    }, [searchedBuku, columnFilters]); 

    // --- Filter Options (Tidak Berubah) ---
    const mapelFilters = useMemo(() => generateFilters(bukuList, 'mapel'), [bukuList]);
    const kelasFilters = useMemo(() => generateFilters(bukuList, 'kelas'), [bukuList]);
    const spekFilters = useMemo(() => generateFilters(bukuList, 'spek'), [bukuList]);
    const peruntukanFilters = useMemo(() => generateFilters(bukuList, 'peruntukan'), [bukuList]);
    const penerbitFilters = useMemo(() => generateFilters(bukuList, 'penerbit'), [bukuList]);
    const tipeBukuFilters = useMemo(() => generateFilters(bukuList, 'tipe_buku'), [bukuList]);

    // --- (PERUBAHAN) Kalkulasi Summary (Tambahkan totalJudul) ---
    const summaryData = useMemo(() => {
        // (UBAH) Tambahkan totalJudul di return
        if (initialLoading || !dataForTable || dataForTable.length === 0) {
            return { totalStok: 0, totalAsset: 0, totalAssetNet: 0, totalJudul: 0 }; // (UBAH)
        }
        const { totalStok, totalAsset, totalAssetNet } = dataForTable.reduce((acc, item) => {
            const stok = Number(item.stok) || 0;
            const harga = Number(item.hargaJual) || 0;
            const diskon = Number(item.diskonJual) || 0; 
            
            let hargaNet = harga;
            if (diskon > 0) {
                hargaNet = hargaNet * (1 - diskon / 100); 
            }
            
            acc.totalStok += stok;
            acc.totalAsset += stok * harga; 
            acc.totalAssetNet += stok * hargaNet; 
            return acc;
        }, { totalStok: 0, totalAsset: 0, totalAssetNet: 0 });

        // (UBAH) Tambahkan totalJudul: dataForTable.length di return
        return { totalStok, totalAsset, totalAssetNet, totalJudul: dataForTable.length };
    }, [dataForTable, initialLoading]); // Dependensi ke dataForTable

    // --- Efek Reset Pagination (Tidak Berubah) ---
    useEffect(() => {
        setPagination(prev => ({ ...prev, current: 1 }));
        setColumnFilters({}); 
    }, [debouncedSearchText]);

    // --- Handle Table Change (Tidak Berubah) ---
    const handleTableChange = useCallback((paginationConfig, filters, sorter, extra) => {
        setPagination(paginationConfig);
        setColumnFilters(filters);
    }, []); 

    // --- Handler Modals (Tidak Berubah) ---
    const handleTambah = useCallback(() => { setEditingBuku(null); setIsModalOpen(true); }, []);
    const handleEdit = useCallback((record) => { setEditingBuku(record); setIsModalOpen(true); }, []);
    const handleTambahStok = useCallback((record) => { setStokBuku(record); setIsStokModalOpen(true); }, []);
    const handleCloseModal = useCallback(() => { setIsModalOpen(false); setEditingBuku(null); }, []);
    const handleCloseStokModal = useCallback(() => { setIsStokModalOpen(false); setStokBuku(null); }, []);
    const handleOpenBulkRestockModal = useCallback(() => {
         if (!bukuList || bukuList.length === 0) { message.warn("Data buku belum dimuat."); return; } setIsBulkRestockModalOpen(true);
    }, [bukuList]);
    const handleCloseBulkRestockModal = useCallback(() => { setIsBulkRestockModalOpen(false); }, []);

    // --- Handler PDF (Tidak Berubah) ---
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
        setIsPreviewModalVisible(false); if (pdfPreviewUrl) { URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(null); }
    }, [pdfPreviewUrl]);

    // --- Kolom Tabel (Tidak Berubah) ---
    const renderAksi = useCallback((_, record) => ( 
        <Space size="small">
          <Tooltip title="Edit Detail Buku"> <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} /> </Tooltip>
          <Tooltip title="Tambah/Kurangi Stok"> <Button type="link" icon={<HistoryOutlined />} onClick={() => handleTambahStok(record)} /> </Tooltip>
        </Space>
    ), [handleEdit, handleTambahStok]);

    const columns = useMemo(() => [ 
        { title: 'Kode Buku', dataIndex: 'kode_buku', key: 'kode_buku', width: 130, sorter: (a, b) => (a.kode_buku || '').localeCompare(b.kode_buku || '') },
        { title: 'Judul Buku', dataIndex: 'judul', key: 'judul', width: 300, sorter: (a, b) => (a.judul || '').localeCompare(b.judul || '') },
        { title: 'Penerbit', dataIndex: 'penerbit', key: 'penerbit', width: 150, filters: penerbitFilters, filteredValue: columnFilters.penerbit || null, onFilter: (v, r) => r.penerbit === v },
        { title: 'Stok', dataIndex: 'stok', key: 'stok', align: 'right', width: 100, render: numberFormatter, sorter: (a, b) => (Number(a.stok) || 0) - (Number(b.stok) || 0) },
        { title: 'Hrg. Z1', dataIndex: 'hargaJual', key: 'hargaJual', align: 'right', width: 150, render: currencyFormatter, sorter: (a, b) => (a.hargaJual || 0) - (b.hargaJual || 0) },
        { title: 'Diskon', dataIndex: 'diskonJual', key: 'diskonJual', align: 'right', width: 100, render: percentFormatter, sorter: (a, b) => (a.diskonJual || 0) - (b.diskonJual || 0) },
        { title: 'Mapel', dataIndex: 'mapel', key: 'mapel', width: 150, filters: mapelFilters, filteredValue: columnFilters.mapel || null, onFilter: (v, r) => r.mapel === v },
        { title: 'Kelas', dataIndex: 'kelas', key: 'kelas', width: 80, render: (v) => v || '-', filters: kelasFilters, filteredValue: columnFilters.kelas || null, onFilter: (v, r) => String(r.kelas || '-') === String(v), align: 'center' }, 
        { title: 'Tipe Buku', dataIndex: 'tipe_buku', key: 'tipe_buku', width: 150, render: (v) => v || '-', filters: tipeBukuFilters, filteredValue: columnFilters.tipe_buku || null, onFilter: (v, r) => r.tipe_buku === v }, 
        { title: 'Spek', dataIndex: 'spek', key: 'spek', width: 100, render: (v) => v ? <Tag>{v}</Tag> : '-', filters: spekFilters, filteredValue: columnFilters.spek || null, onFilter: (v, r) => r.spek === v, align: 'center' },
        { title: 'Peruntukan', dataIndex: 'peruntukan', key: 'peruntukan', width: 120, render: (v) => v || '-', filters: peruntukanFilters, filteredValue: columnFilters.peruntukan || null, onFilter: (v, r) => r.peruntukan === v },
        { title: 'Aksi', key: 'aksi', align: 'center', width: 100, render: renderAksi, fixed: screens.md ? 'right' : false },
    ], [
        mapelFilters, kelasFilters, spekFilters, peruntukanFilters, penerbitFilters, tipeBukuFilters,
        columnFilters, renderAksi, screens.md,
    ]);

    const tableScrollX = useMemo(() => columns.reduce((acc, col) => acc + (col.width || 150), 0), [columns]);

    // Row Class Name (Tidak Berubah)
    const getRowClassName = useCallback((record, index) => {
        return index % 2 === 1 ? 'ant-table-row-odd' : '';
    }, []);

    // --- Render ---
    return (
        <Content style={{ padding: screens.xs ? '12px' : '24px' }}>
            <Tabs defaultActiveKey="1" type="card">
                <TabPane tab={<Space><ReadOutlined /> Manajemen Buku</Space>} key="1">
                    {/* Spin hanya saat filter search debounce */}
                    <Spin spinning={isFiltering} tip="Memfilter data...">
                        
                        {/* --- (HAPUS) KARTU RINGKASAN DIHAPUS DARI SINI --- */}

                        <Card>
                            <Row justify="space-between" align="middle" gutter={[16, 16]} style={{ marginBottom: '24px' }}> 
                                <Col lg={6} md={8} sm={24} xs={24}>
                                    <Title level={5} style={{ margin: 0 }}>Manajemen Data Buku</Title>
                                </Col>
                                <Col lg={18} md={16} sm={24} xs={24}>
                                    <Space direction={screens.xs ? 'vertical' : 'horizontal'} 
                                        style={{ width: '100%', alignItems: screens.xs ? 'start' : 'end', justifyContent: screens.xs ? 'start' : 'end' }}>
                                        
                                        <Input.Search
                                            placeholder="Cari Judul, Kode, Penerbit..."
                                            value={searchText}
                                            onChange={(e) => setSearchText(e.target.value)}
                                            allowClear
                                            style={{ width: screens.xs ? '100%' : 250 }}
                                            enterButton
                                        />
                                        
                                        <Space wrap style={{ width: screens.xs ? '100%' : 'auto', justifyContent: screens.xs ? 'flex-start' : 'flex-end' }}>
                                                <Button onClick={handleGenerateAndShowPdf}  icon={<PrinterOutlined />}>Cetak PDF</Button>
                                            <Button icon={<ContainerOutlined />} onClick={handleOpenBulkRestockModal} disabled={initialLoading || bukuList.length === 0}>
                                                {screens.xs ? 'Restock' : 'Restock Borongan'} 
                                            </Button>
                                            <Button type="primary" icon={<PlusOutlined />} onClick={handleTambah} disabled={initialLoading}>
                                                Tambah Buku 
                                            </Button>
                                        </Space>
                                    </Space>
                                </Col>
                            </Row>

                            <BukuTableComponent
                                columns={columns}
                                dataSource={dataForTable} 
                                loading={initialLoading || isFiltering}
                                isCalculating={initialLoading} 
                                pagination={pagination}
                                summaryData={summaryData} // (PERUBAHAN) summaryData kini berisi 'totalJudul'
                                handleTableChange={handleTableChange}
                                tableScrollX={tableScrollX}
                                rowClassName={getRowClassName}
                            />
                        </Card>
                    </Spin>
                </TabPane>

                <TabPane tab={<Space><PullRequestOutlined /> Riwayat Stok</Space>} key="2">
                    <StokHistoryTab />
                </TabPane>
            </Tabs>

            {/* --- Modal --- */}
            {isModalOpen && <BukuForm open={isModalOpen} onCancel={handleCloseModal} initialValues={editingBuku} />}
            {isStokModalOpen && <StokFormModal open={isStokModalOpen} onCancel={handleCloseStokModal} buku={stokBuku} />}
            {isPreviewModalVisible && <PdfPreviewModal
                visible={isPreviewModalVisible}
                onClose={handleClosePreviewModal}
                pdfBlobUrl={pdfPreviewUrl}
                fileName={pdfFileName}
            />}
            {isBulkRestockModalOpen && (
                <BulkRestockModal
                    open={isBulkRestockModalOpen}
                    onClose={handleCloseBulkRestockModal}
                    bukuList={bukuList} 
                />
            )}
        </Content>
    );
};

export default BukuPage;