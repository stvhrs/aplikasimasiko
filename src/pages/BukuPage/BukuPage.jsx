import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import {
    Layout, Card, Table, Tag, Button, Input, Space, Typography, Row, Col,
    Grid, Tooltip, Dropdown, Menu, message, Tabs,Spin
} from 'antd';
import {
    PlusOutlined, EditOutlined, HistoryOutlined,ContainerOutlined,PrinterOutlined, // NEW: Ikon Bulk
        /* ShareAltOutlined */ PullRequestOutlined, ReadOutlined, DownloadOutlined, EyeOutlined // NEW: Ikon Preview
} from '@ant-design/icons';
import BulkRestockModal from './components/BulkRestockModal'; // <-- NEW: Impor Modal Bulk
import PdfPreviewModal from './components/PdfPreviewModal'; // NEW: Impor Modal Preview
// Impor komponen yang dipecah
import BukuTableComponent from './components/BukuTable'; // Sesuaikan path
import BukuForm from './components/BukuForm'; // Sesuaikan path
import StokFormModal from './components/StockFormModal'; // Sesuaikan path
import StokHistoryTab from './components/StokHistoryTab'; // Sesuaikan path
import useBukuData from '../../hooks/useBukuData'; // Sesuaikan path
import useDebounce from '../../hooks/useDebounce'; // Sesuaikan path
import { 
    currencyFormatter, numberFormatter, percentFormatter, generateFilters 
} from '../../utils/formatters'; // Sesuaikan path
import { generateBukuPdfBlob } from '../../utils/pdfBuku'; // NEW: Impor fungsi PDF

const { Content } = Layout;
const { Title } = Typography;
const { TabPane } = Tabs;

const BukuPage = () => {
    // --- State ---
    const { data: bukuList, loading: initialLoading } = useBukuData();

    const [isCalculating, setIsCalculating] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isStokModalOpen, setIsStokModalOpen] = useState(false);
    const [isBulkRestockModalOpen, setIsBulkRestockModalOpen] = useState(false);
    const [editingBuku, setEditingBuku] = useState(null);
    const [stokBuku, setStokBuku] = useState(null);
    const [searchText, setSearchText] = useState('');
    const debouncedSearchText = useDebounce(searchText, 300);
    const screens = Grid.useBreakpoint();
    const [columnFilters, setColumnFilters] = useState({});

    // --- PERBAIKAN PAGINATION & SHOW TOTAL ---
    // Definisikan showTotalPagination di dalam scope komponen agar bisa akses bukuList
    const showTotalPagination = useCallback((total, range) => {
        const totalJenis = bukuList.length;
        return `${range[0]}-${range[1]} dari ${total} (Total Jenis: ${numberFormatter(totalJenis)})`;
    }, [bukuList]); // bukuList jadi dependency

    // Gunakan showTotalPagination langsung di useState
    const [pagination, setPagination] = useState(() => ({ // <-- Gunakan fungsi initializer
        current: 1, pageSize: 15, pageSizeOptions: ['15', '50', '100', '200'],
        showSizeChanger: true,
        showTotal: showTotalPagination, // <-- Langsung set di sini
    }));

    // Hapus useEffect yang sebelumnya mencoba update showTotal di state pagination
    // useEffect(() => {
    //     setPagination(prev => ({ ...prev, showTotal: showTotalPagination }));
    // }, [showTotalPagination]);
    // --- AKHIR PERBAIKAN ---

    const [summaryData, setSummaryData] = useState({ totalStok: 0, totalAsset: 0, totalAssetNet: 0 });
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
    const [pdfFileName, setPdfFileName] = useState("daftar_buku.pdf");

    const deferredDebouncedSearchText = useDeferredValue(debouncedSearchText);
    const isFiltering = debouncedSearchText !== deferredDebouncedSearchText;

    // --- Filter, Generate Filter, Calculate Summary (Tidak berubah) ---
    const filteredBuku = useMemo(() => { /* ... */
        if (!deferredDebouncedSearchText) return bukuList;
        const lowerSearch = deferredDebouncedSearchText.toLowerCase();
        return bukuList.filter(buku =>
            (buku.judul || '').toLowerCase().includes(lowerSearch) ||
            (buku.kode_buku || '').toLowerCase().includes(lowerSearch) ||
            (buku.penerbit || '').toLowerCase().includes(lowerSearch) ||
            (buku.mapel || '').toLowerCase().includes(lowerSearch)
        );
     }, [bukuList, deferredDebouncedSearchText]);
    const mapelFilters = useMemo(() => generateFilters(bukuList, 'mapel'), [bukuList]);
    const kelasFilters = useMemo(() => generateFilters(bukuList, 'kelas'), [bukuList]);
    const spekFilters = useMemo(() => generateFilters(bukuList, 'spek'), [bukuList]);
    const peruntukanFilters = useMemo(() => generateFilters(bukuList, 'peruntukan'), [bukuList]);
    const penerbitFilters = useMemo(() => generateFilters(bukuList, 'penerbit'), [bukuList]);
    const tipeBukuFilters = useMemo(() => generateFilters(bukuList, 'tipe_buku'), [bukuList]);
    const calculateSummary = useCallback((data) => { /* ... */
        if (!data || data.length === 0) { setSummaryData({ totalStok: 0, totalAsset: 0, totalAssetNet: 0 }); return; }
        const { totalStok, totalAsset, totalAssetNet } = data.reduce((acc, item) => {
            const stok = Number(item.stok) || 0;
            const harga = Number(item.hargaJual) || 0;
            const diskon = Number(item.diskonJual) || 0;
            const diskonSpesial = Number(item.diskonJualSpesial) || 0;
            const hargaNet = harga * (1 - diskon / 100) * (1 - diskonSpesial / 100);
            acc.totalStok += stok;
            acc.totalAsset += stok * harga;
            acc.totalAssetNet += stok * hargaNet;
            return acc;
        }, { totalStok: 0, totalAsset: 0, totalAssetNet: 0 });
        setSummaryData({ totalStok, totalAsset, totalAssetNet });
     }, []);

    // --- Efek & Handler (Tidak berubah) ---
    useEffect(() => { /* ... calculate summary ... */
        setIsCalculating(true);
        calculateSummary(filteredBuku);
     }, [filteredBuku, calculateSummary]);
    useEffect(() => { /* ... isCalculating timer ... */
        if (isCalculating) {
            const timer = setTimeout(() => setIsCalculating(false), 150);
            return () => clearTimeout(timer);
        }
    }, [isCalculating, summaryData]);
    useEffect(() => { /* ... reset pagination on debounce ... */
        // Pastikan kita tidak mereset showTotal di sini
        setPagination(prev => ({ ...prev, current: 1 }));
        setColumnFilters({});
     }, [debouncedSearchText]);
    const handleTableChange = useCallback((paginationConfig, filters, sorter, extra) => { /* ... */
        setIsCalculating(true);
        // Penting: Update state pagination dengan config baru, yang sudah menyertakan showTotal terbaru
        setPagination(paginationConfig);
        setColumnFilters(filters);
        if (extra.action === 'filter' || extra.action === 'sort') {
            calculateSummary(extra.currentDataSource);
        }
     }, [calculateSummary]); // Dependency sudah benar
    const handleTambah = useCallback(() => { setEditingBuku(null); setIsModalOpen(true); }, []);
    const handleEdit = useCallback((record) => { setEditingBuku(record); setIsModalOpen(true); }, []);
    const handleTambahStok = useCallback((record) => { setStokBuku(record); setIsStokModalOpen(true); }, []);
    const handleCloseModal = useCallback(() => { setIsModalOpen(false); setEditingBuku(null); }, []);
    const handleCloseStokModal = useCallback(() => { setIsStokModalOpen(false); setStokBuku(null); }, []);
    const handleOpenBulkRestockModal = useCallback(() => { /* ... */
         if (!bukuList || bukuList.length === 0) { message.warn("Data buku belum dimuat."); return; }
        setIsBulkRestockModalOpen(true);
    }, [bukuList]);
    const handleCloseBulkRestockModal = useCallback(() => { setIsBulkRestockModalOpen(false); }, []);
    const handleGenerateAndShowPdf = useCallback(async () => { /* ... logika PDF ... */
        const dataToExport = filteredBuku;
        if (!dataToExport?.length) { message.warn('Tidak ada data u/ PDF.'); return; }
        setIsGeneratingPdf(true); message.loading({ content: 'Membuat PDF...', key: 'pdfgen', duration: 0 });
        setTimeout(async () => {
            try {
                if (pdfPreviewUrl) { URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(null); }
                const pdfBlob = generateBukuPdfBlob(dataToExport);
                if (!pdfBlob || !(pdfBlob instanceof Blob) || pdfBlob.size === 0) { throw new Error("Gagal PDF."); }
                const url = URL.createObjectURL(pdfBlob);
                setPdfFileName(`Daftar_Stok_Buku_${Date.now()}.pdf`);
                setPdfPreviewUrl(url); setIsPreviewModalVisible(true);
                message.success({ content: 'PDF siap!', key: 'pdfgen', duration: 2 });
            } catch (error) { console.error('PDF error:', error); message.error({ content: `Gagal PDF: ${error.message}`, key: 'pdfgen', duration: 5 }); }
            finally { setIsGeneratingPdf(false); message.destroy('pdfgen'); }
        }, 50);
     }, [filteredBuku, pdfPreviewUrl]);
    const handleClosePreviewModal = useCallback(() => { /* ... */
        setIsPreviewModalVisible(false);
        if (pdfPreviewUrl) { URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(null); }
     }, [pdfPreviewUrl]);

    // --- Definisi Kolom Tabel (Tidak berubah) ---
    const renderAksi = useCallback((_, record) => ( /* ... */
        <Space size="small">
             <Tooltip title="Edit Detail Buku"><Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} /></Tooltip>
             <Tooltip title="Tambah/Kurangi Stok"><Button type="link" icon={<HistoryOutlined />} onClick={() => handleTambahStok(record)} /></Tooltip>
         </Space>
    ), [handleEdit, handleTambahStok]);

    const columns = useMemo(() => [ /* ... kolom sesuai request terakhir ... */
        { title: 'Kode Buku', dataIndex: 'kode_buku', key: 'kode_buku', width: 130, sorter: (a, b) => (a.kode_buku || '').localeCompare(b.kode_buku || ''), },
        { title: 'Judul Buku', dataIndex: 'judul', key: 'judul', width: 300, sorter: (a, b) => (a.judul || '').localeCompare(b.judul || ''), },
        { title: 'Penerbit', dataIndex: 'penerbit', key: 'penerbit', width: 150, filters: penerbitFilters, filteredValue: columnFilters.penerbit || null, onFilter: (v, r) => r.penerbit === v, },
        { title: 'Stok', dataIndex: 'stok', key: 'stok', align: 'right', width: 100, render: numberFormatter, sorter: (a, b) => (Number(a.stok) || 0) - (Number(b.stok) || 0) },
        { title: 'Hrg. Z1', dataIndex: 'hargaJual', key: 'hargaJual', align: 'right', width: 150, render: currencyFormatter, sorter: (a, b) => (a.hargaJual || 0) - (b.hargaJual || 0) },
        { title: 'Diskon', dataIndex: 'diskonJual', key: 'diskonJual', align: 'right', width: 100, render: percentFormatter, sorter: (a, b) => (a.diskonJual || 0) - (b.diskonJual || 0) },
        { title: 'Mapel', dataIndex: 'mapel', key: 'mapel', width: 150, filters: mapelFilters, filteredValue: columnFilters.mapel || null, onFilter: (v, r) => r.mapel === v, },
        { title: 'Kelas', dataIndex: 'kelas', key: 'kelas', width: 80, render: (v) => v || '-', filters: kelasFilters, filteredValue: columnFilters.kelas || null, onFilter: (v, r) => r.kelas === v, align: 'center' },
        { title: 'Tipe Buku', dataIndex: 'tipe_buku', key: 'tipe_buku', width: 100, render: (v) => v || '-', filters: tipeBukuFilters, filteredValue: columnFilters.tipe_buku || null, onFilter: (v, r) => r.tipe_buku === v, },
        { title: 'Spek', dataIndex: 'spek', key: 'spek', width: 100, render: (v) => v ? <Tag>{v}</Tag> : '-', filters: spekFilters, filteredValue: columnFilters.spek || null, onFilter: (v, r) => r.spek === v, align: 'center' },
        { title: 'Peruntukan', dataIndex: 'peruntukan', key: 'peruntukan', width: 120, render: (v) => v || '-', filters: peruntukanFilters, filteredValue: columnFilters.peruntukan || null, onFilter: (v, r) => r.peruntukan === v, },
        { title: 'Aksi', key: 'aksi', align: 'center', width: 100, render: renderAksi, fixed: screens.md ? 'right' : false },
    ], [
        mapelFilters, kelasFilters, spekFilters, peruntukanFilters, penerbitFilters, tipeBukuFilters,
        columnFilters,
        renderAksi,
        screens.md,
        // Hapus pagination dari dependency
    ]);

    const tableScrollX = useMemo(() => columns.reduce((acc, col) => acc + (col.width || 150), 0), [columns]);

    // Menu dropdown PDF (Tidak berubah)
    const pdfActionMenu = ( /* ... menu item ... */
        <Menu>
            <Menu.Item key="previewPdf" icon={<EyeOutlined />} onClick={handleGenerateAndShowPdf} disabled={isGeneratingPdf} >
                {isGeneratingPdf ? 'Membuat PDF...' : 'Pratinjau PDF'}
            </Menu.Item>
        </Menu>
     );

    // --- Render JSX (Tidak berubah) ---
    return (
        <Content style={{ padding: screens.xs ? '12px' : '24px' }}>
            {/* ... (Tabs, TabPane "Manajemen Buku", Spin, Card, Row, Col, Space, Input.Search, Dropdown, Button) ... */}
              <Tabs defaultActiveKey="1" type="card">
                <TabPane tab={<Space><ReadOutlined /> Manajemen Buku</Space>} key="1" >
                    <Spin spinning={isFiltering} tip="Memfilter data...">
                        <Card>
                            <Row justify="space-between" align="middle" gutter={[16, 16]}>
                                <Col lg={6} md={8} sm={24} xs={24}>
                                    <Title level={5} style={{ margin: 0 }}>Manajemen Data Buku</Title>
                                </Col>
                                <Col lg={18} md={16} sm={24} xs={24}>
                                    <Space direction={screens.xs ? 'vertical' : 'horizontal'} style={{ width: '100%', justifyContent: 'end' }}>
                                        <Input.Search
                                            placeholder="Cari Judul, Kode, Penerbit..."
                                            value={searchText}
                                            onChange={(e) => setSearchText(e.target.value)}
                                            allowClear
                                            style={{ width: screens.xs ? '100%' : 200 }}
                                        />
                                        <Space wrap>
                                            <Dropdown overlay={pdfActionMenu} placement="bottomRight">
                                                <Button icon={<PrinterOutlined />}> Opsi PDF </Button>
                                            </Dropdown>
                                            <Button icon={<ContainerOutlined />} onClick={handleOpenBulkRestockModal} disabled={initialLoading} >
                                                Restock Borongan
                                            </Button>
                                            <Button type="primary" icon={<PlusOutlined />} onClick={handleTambah}>
                                                {!screens.xs && 'Tambah Buku'}
                                            </Button>
                                        </Space>
                                    </Space>
                                </Col>
                            </Row>

                            <BukuTableComponent
                                columns={columns}
                                dataSource={filteredBuku}
                                loading={initialLoading}
                                isCalculating={isCalculating}
                                pagination={pagination} // <-- Kirim state pagination terbaru
                                summaryData={summaryData}
                                handleTableChange={handleTableChange}
                                tableScrollX={tableScrollX}
                            />
                        </Card>
                    </Spin>
                </TabPane>
                {/* ... (TabPane Riwayat Stok) ... */}
                 <TabPane tab={<Space><PullRequestOutlined /> Riwayat Stok</Space>} key="2" >
                    <StokHistoryTab />
                </TabPane>
            </Tabs>

            {/* --- Modal-modal --- */}
            <BukuForm open={isModalOpen} onCancel={handleCloseModal} initialValues={editingBuku} />
            <StokFormModal open={isStokModalOpen} onCancel={handleCloseStokModal} buku={stokBuku} />
            <PdfPreviewModal
                visible={isPreviewModalVisible}
                onClose={handleClosePreviewModal}
                pdfBlobUrl={pdfPreviewUrl}
                fileName={pdfFileName}
            />
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