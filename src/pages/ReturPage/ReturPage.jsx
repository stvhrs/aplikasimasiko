import React, { useState, useMemo, useDeferredValue } from 'react';
import {
    Layout, Card, Table, Button, Input, Space, Typography, 
    Row, Col, message, Tooltip, DatePicker, Tag
} from 'antd';
import {
    PlusOutlined, EditOutlined, EyeOutlined, 
    PrinterOutlined, SearchOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/id';

// UTILS & HOOKS
import { currencyFormatter } from '../../utils/formatters'; 
import { useReturStream } from '../../hooks/useFirebaseData'; 
import useDebounce from '../../hooks/useDebounce';
import { generateNotaReturPDF } from '../../utils/notaretur'; 

// COMPONENTS
import ReturForm from './components/ReturForm';
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

const ReturPage = () => {
    // --- STATE ---
    const [dateRange, setDateRange] = useState([dayjs().startOf('year'), dayjs().endOf('day')]);
    const [searchText, setSearchText] = useState('');
    
    // --- DATA FETCHING ---
    const { returList = [], loadingRetur = false } = useReturStream(dateRange);

    // --- MODALS STATE ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRetur, setEditingRetur] = useState(null);
    const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
    const [pdfFileName, setPdfFileName] = useState('');

    // --- HOOKS ---
    const debouncedSearchText = useDebounce(searchText, 300);
    const deferredSearch = useDeferredValue(debouncedSearchText);

    // --- FILTER LOGIC ---
    const filteredData = useMemo(() => {
        let data = [...(returList || [])];

        if (deferredSearch) {
            const q = deferredSearch.toLowerCase();
            data = data.filter(tx => 
                (tx.id || '').toLowerCase().includes(q) ||
                (tx.keterangan || '').toLowerCase().includes(q) ||
                (tx.refId || '').toLowerCase().includes(q) ||
                (tx.namaPelanggan || '').toLowerCase().includes(q)
            );
        }

        // Default sort: Tanggal Terbaru
        data.sort((a, b) => b.timestamp - a.timestamp);
        return data;
    }, [returList, deferredSearch]);

    // --- HANDLERS ---
    const handleTambah = () => { setEditingRetur(null); setIsModalOpen(true); };
    const handleEdit = (record) => { setEditingRetur({ ...record }); setIsModalOpen(true); };
    
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setTimeout(() => setEditingRetur(null), 300);
    };

    // --- PDF / PRINT ---
    const handlePrintTransaction = (record) => {
        try {
            const rawItems = record.items || record.detailItems || record.listBuku;
            let itemsToPrint = [];

            if (Array.isArray(rawItems) && rawItems.length > 0) {
                itemsToPrint = rawItems;
            } else {
                itemsToPrint = [{
                    judulBuku: record.judul || 'Retur Barang',
                    qty: record.perubahan,
                    hargaSatuan: 0, 
                    subtotal: record.totalHarga || record.jumlah || 0
                }];
            }

            const dataToPrint = {
                ...record,
                id: record.id, 
                nomorInvoice: record.refId, 
                tanggal: record.timestamp,
                itemsReturDetail: itemsToPrint,
                keterangan: record.keterangan
            };

            const pdfData = generateNotaReturPDF(dataToPrint);
            setPdfPreviewUrl(pdfData);
            setPdfFileName(`Bukti_Retur_${record.id}.pdf`);
            setIsPreviewModalVisible(true);
        } catch (error) {
            console.error("Gagal generate PDF:", error);
            message.error("Gagal membuat PDF");
        }
    };

    const handleClosePreviewModal = () => { 
        setIsPreviewModalVisible(false); 
        if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl); 
        setPdfPreviewUrl(''); 
    };

    const handleViewProof = (url) => { if (url) window.open(url, '_blank'); };

    // --- TABLE COLUMNS ---
    const columns = [
        { 
            title: "Tanggal", 
            dataIndex: 'timestamp', 
            key: 'timestamp', 
            width: 120, 
            fixed: 'left',
            render: (t) => dayjs(t).format('DD MMM YYYY'),
            sorter: (a, b) => a.timestamp - b.timestamp,
        },
        { 
            title: "ID Retur", 
            dataIndex: 'id', 
            key: 'id', 
            width: 140,
            render: (text) => <Text copyable style={{fontSize: 12}}>{text}</Text>,
            sorter: (a, b) => (a.id || '').localeCompare(b.id || ''),
        },
        { 
            title: "ID Transaksi", 
            dataIndex: 'refId', 
            key: 'refId',
            width: 160,
            render: (text) => <Tag color="blue">{text || 'Non-Invoice'}</Tag>,
            sorter: (a, b) => (a.refId || '').localeCompare(b.refId || ''),
        },
        { 
            title: "Nama Pelanggan", 
            dataIndex: 'namaPelanggan', 
            key: 'namaPelanggan',
            width: 180,
            render: (text) => <Text strong>{text || 'Umum'}</Text>,
            sorter: (a, b) => (a.namaPelanggan || '').localeCompare(b.namaPelanggan || ''),
        },
        { 
            title: "Keterangan", 
            dataIndex: 'keterangan', 
            key: 'keterangan',
            render: (text) => <div style={{ fontSize: 13, color: '#595959' }}>{text || '-'}</div>
        },
        { 
            title: "Nominal", 
            dataIndex: 'jumlahKeluar', 
            key: 'jumlahKeluar', 
            align: 'right', 
            width: 140, 
            render: (val) => <Text>{currencyFormatter(val)}</Text>,
            sorter: (a, b) => (a.jumlahKeluar || 0) - (b.jumlahKeluar || 0),
        },
        { 
            title: "Qty Masuk", 
            dataIndex: 'perubahan', 
            key: 'perubahan', 
            align: 'right', 
            width: 110, 
            render: (val) => <Text strong style={{ color: '#3f8600' }}>+{val}</Text> 
        },
        { 
            title: 'Aksi', 
            key: 'aksi', 
            align: 'center', 
            width: 130, 
            fixed: 'right',
            render: (_, r) => (
                <Space>
                    <Tooltip title="Cetak Bukti">
                        <Button type="text" icon={<PrinterOutlined />} onClick={() => handlePrintTransaction(r)} />
                    </Tooltip>
                    
                    {/* UPDATED: Tombol Lihat Bukti selalu muncul, tapi disabled jika kosong */}
                    <Tooltip title="Lihat Bukti Foto">
                        <Button 
                            type="text" 
                            icon={<EyeOutlined />} 
                            onClick={() => handleViewProof(r.buktiUrl)} 
                            disabled={!r.buktiUrl} // Disabled jika tidak ada URL
                        />
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
                        <Text style={styles.headerTitle}>Riwayat Retur Buku</Text>
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
                            placeholder="Cari ID, Pelanggan, Keterangan..." 
                            prefix={<SearchOutlined />} 
                            style={{ width: 260 }} 
                            onChange={(e) => setSearchText(e.target.value)} 
                            allowClear
                        />
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleTambah}>
                            Input Retur
                        </Button>
                    </Col>
                </Row>

                <Table 
                    columns={columns} 
                    dataSource={filteredData} 
                    loading={loadingRetur} 
                    rowKey="id" 
                    size="middle"
                    scroll={{ x: 1200 }} 
                    pagination={{ 
                        defaultPageSize: 10, 
                        showTotal: (total) => `Total ${total} Item Retur`,
                        showSizeChanger: true
                    }} 
                />
            </Card>

            {isModalOpen && (
                <ReturForm 
                    key={editingRetur ? editingRetur.id : 'create-new-retur'} 
                    open={isModalOpen} 
                    onCancel={handleCloseModal} 
                    initialValues={editingRetur} 
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

export default ReturPage;