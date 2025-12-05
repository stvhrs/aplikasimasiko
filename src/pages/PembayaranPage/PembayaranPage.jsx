import React, { useState, useMemo, useDeferredValue } from 'react';
import {
    Layout, Card, Table, Button, Input, Space, Typography, 
    Row, Col, message, Tooltip, DatePicker, Tag
} from 'antd';
import {
    PlusOutlined, EditOutlined, EyeOutlined, 
    PrinterOutlined, SearchOutlined, LoadingOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/id';

// UTILS & HOOKS
import { currencyFormatter } from '../../utils/formatters'; 
import { usePembayaranStream } from '../../hooks/useFirebaseData'; 
import useDebounce from '../../hooks/useDebounce';
import { generateNotaPembayaranPDF } from '../../utils/notamutasipembayaran'; 

// COMPONENTS
import PembayaranForm from './components/PembayaranForm';
import PdfPreviewModal from '../BukuPage/components/PdfPreviewModal';

dayjs.locale('id');
const { Content } = Layout;
const { Text } = Typography;
const { RangePicker } = DatePicker;

// --- STYLING ---
const styles = {
    pageContainer: { padding: '24px', backgroundColor: '#f0f5ff', minHeight: '100vh' }, 
    card: { borderRadius: 8, border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', background: '#fff' },
    headerTitle: { fontSize: 16, fontWeight: 600, color: '#1d39c4' }, 
};

const PembayaranPage = () => {
    // --- STATE ---
    // Default 1 tahun agar data lama juga terambil
    const [dateRange, setDateRange] = useState([dayjs().startOf('year'), dayjs().endOf('day')]);
    const [searchText, setSearchText] = useState('');
    const [printingId, setPrintingId] = useState(null); // Loading state khusus tombol print
    
    // --- DATA FETCHING (STREAM) ---
    // Menggunakan default value [] dan false agar aman dari error undefined
    const { pembayaranList = [], loadingPembayaran = false } = usePembayaranStream(dateRange);

    // --- MODALS STATE ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPembayaran, setEditingPembayaran] = useState(null);
    const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
    const [pdfFileName, setPdfFileName] = useState('');

    // --- HOOKS ---
    const debouncedSearchText = useDebounce(searchText, 300);
    const deferredSearch = useDeferredValue(debouncedSearchText);
    const isSearching = searchText !== debouncedSearchText;

    // --- FILTER LOGIC ---
    const filteredData = useMemo(() => {
        // Safe Copy
        let data = [...(pembayaranList || [])];

        // CATATAN: Filter kategori dihapus agar data pasti muncul.
        // Jika ingin spesifik, uncomment baris bawah dan pastikan penulisan di DB persis sama.
        // data = data.filter(tx => tx.kategori === 'Penjualan Buku');

        if (deferredSearch) {
            const q = deferredSearch.toLowerCase();
            data = data.filter(tx => 
                (tx.id || '').toLowerCase().includes(q) ||
                (tx.keterangan || '').toLowerCase().includes(q) ||
                (tx.namaPelanggan || '').toLowerCase().includes(q) ||
                (tx.nomorInvoice || '').toLowerCase().includes(q) ||
                (tx.detailAlokasi && Object.values(tx.detailAlokasi).some(d => d.noInvoice?.toLowerCase().includes(q)))
            );
        }

        // Default sort by tanggal terbaru
        data.sort((a, b) => b.tanggal - a.tanggal);
        return data;
    }, [pembayaranList, deferredSearch]); 

    // --- HANDLERS ---
    const handleTambah = () => { setEditingPembayaran(null); setIsModalOpen(true); };
    const handleEdit = (record) => { setEditingPembayaran({ ...record }); setIsModalOpen(true); };
    
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setTimeout(() => setEditingPembayaran(null), 300);
    };

    const handlePrintTransaction = async (record) => {
        setPrintingId(record.id); 
        setTimeout(() => {
            try {
                const dataToPrint = {
                    ...record,
                    id: record.id,
                    listInvoices: record.detailAlokasi ? Object.values(record.detailAlokasi) : [{
                        noInvoice: record.nomorInvoice || record.idTransaksi || '-',
                        keterangan: record.keterangan || 'Pembayaran',
                        jumlahBayar: record.jumlah
                    }]
                };
    
                const pdfData = generateNotaPembayaranPDF(dataToPrint);
                setPdfPreviewUrl(pdfData);
                setPdfFileName(`Nota_Pembayaran_${record.id}.pdf`);
                setIsPreviewModalVisible(true);
            } catch (error) {
                console.error("Gagal generate PDF:", error);
                message.error("Gagal membuat PDF");
            } finally {
                setPrintingId(null); 
            }
        }, 100);
    };

    const handleClosePreviewModal = () => { 
        setIsPreviewModalVisible(false); 
        if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl); 
        setPdfPreviewUrl(''); 
    };

    const handleViewProof = (url) => { if (url) window.open(url, '_blank'); };

    // --- TABLE COLUMNS (UPDATED: Tanggal Kiri & Semua Sortable) ---
    const columns = [
        { 
            title: "Tanggal", 
            dataIndex: 'tanggal', 
            key: 'tanggal', 
            width: 120,
            fixed: 'left', // Opsional: Agar tanggal tetap terlihat saat scroll ke kanan
            render: (t) => dayjs(t).format('DD MMM YYYY'),
            sorter: (a, b) => a.tanggal - b.tanggal, // Sortir Tanggal
            defaultSortOrder: 'descend', // Default urutan terbaru
        },
        { 
            title: "ID Pembayaran", 
            dataIndex: 'id', 
            key: 'id', 
            width: 150,
            render: (text) => <Text copyable style={{fontSize: 12}}>{text}</Text>,
            sorter: (a, b) => (a.id || '').localeCompare(b.id || ''), // Sortir String
        },
        { 
            title: "ID Transaksi / Invoice", 
            key: 'idTransaksi', 
            width: 170,
            render: (_, r) => {
                let inv = r.nomorInvoice;
                if (!inv && r.detailAlokasi) {
                    inv = Object.values(r.detailAlokasi).map(d => d.noInvoice).join(', ');
                }
                return <Tag color="blue">{inv || r.idTransaksi || '-'}</Tag>;
            },
            sorter: (a, b) => {
                const valA = a.nomorInvoice || a.idTransaksi || '';
                const valB = b.nomorInvoice || b.idTransaksi || '';
                return valA.localeCompare(valB);
            }
        },
        { 
            title: "Nama Pelanggan", 
            dataIndex: 'namaPelanggan', 
            key: 'namaPelanggan',
            width: 180,
            render: (text) => <Text strong>{text || 'Umum'}</Text>,
            sorter: (a, b) => (a.namaPelanggan || '').localeCompare(b.namaPelanggan || ''), // Sortir Nama
        },
        { 
            title: "Keterangan", 
            dataIndex: 'keterangan', 
            key: 'keterangan',
            render: (text) => <div style={{ fontSize: 13, color: '#595959' }}>{text || '-'}</div>,
            sorter: (a, b) => (a.keterangan || '').localeCompare(b.keterangan || ''), // Sortir Keterangan
        },
        { 
            title: "Nominal", 
            dataIndex: 'jumlah', 
            key: 'jumlah', 
            align: 'right', 
            width: 150, 
            render: (val) => <Text strong style={{ color: '#3f8600' }}>{currencyFormatter(val)}</Text>,
            sorter: (a, b) => (a.jumlah || 0) - (b.jumlah || 0), // Sortir Angka
        },
        { 
            title: 'Aksi', 
            key: 'aksi', 
            align: 'center', 
            width: 130, 
            fixed: 'right',
            render: (_, r) => (
                <Space>
                    <Tooltip title="Cetak Nota">
                        <Button 
                            type="text" 
                            icon={printingId === r.id ? <LoadingOutlined /> : <PrinterOutlined />} 
                            onClick={() => handlePrintTransaction(r)}
                            disabled={printingId !== null && printingId !== r.id} 
                        />
                    </Tooltip>
                    <Tooltip title="Lihat Bukti">
                        <Button type="text" icon={<EyeOutlined />} onClick={() => handleViewProof(r.buktiUrl)} disabled={!r.buktiUrl} />
                    </Tooltip>
                    <Tooltip title="Edit">
                        <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(r)} />
                    </Tooltip>
                </Space>
            ) 
        },
    ];

    return (
        <Content style={styles.pageContainer}>
            <Card style={styles.card}>
                <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 20 }}>
                    <Col xs={24} md={6}>
                        <Text style={styles.headerTitle}>Riwayat Pembayaran Buku</Text>
                    </Col>
                    <Col xs={24} md={18} style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                        <RangePicker 
                            style={{ width: 260 }} 
                            onChange={(d) => d && setDateRange(d)} 
                            value={dateRange} 
                            format="DD MMM YYYY" 
                            allowClear={false} 
                        />
                        <Input 
                            placeholder="Cari ID, Pelanggan..." 
                            suffix={isSearching ? <LoadingOutlined style={{ color: 'rgba(0,0,0,.25)' }} /> : <SearchOutlined style={{ color: 'rgba(0,0,0,.25)' }} />} 
                            style={{ width: 240 }} 
                            onChange={(e) => setSearchText(e.target.value)} 
                            allowClear
                        />
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleTambah}>
                            Input Pembayaran
                        </Button>
                    </Col>
                </Row>

                <Table 
                    columns={columns} 
                    dataSource={filteredData} 
                    loading={loadingPembayaran} 
                    rowKey="id" 
                    size="middle"
                    scroll={{ x: 1200 }} // Scroll diperlebar sedikit agar kolom tanggal fixed terlihat nyaman
                    pagination={{ 
                        defaultPageSize: 10, 
                        showTotal: (total) => `Total ${total} Transaksi`,
                        showSizeChanger: true
                    }} 
                />
            </Card>

            {isModalOpen && (
                <PembayaranForm 
                    key={editingPembayaran ? editingPembayaran.id : 'create-new'} 
                    open={isModalOpen} 
                    onCancel={handleCloseModal} 
                    initialValues={editingPembayaran} 
                />
            )}
            
            <PdfPreviewModal 
                visible={isPreviewModalVisible} 
                onClose={handleClosePreviewModal} 
                pdfBlobUrl={pdfPreviewUrl} 
                fileName={pdfFileName} 
            />
        </Content>
    );
};

export default PembayaranPage;