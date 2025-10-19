// ================================
// FILE: src/pages/transaksi-jual/TransaksiJualPage.jsx
// PERUBAHAN:
// - Mengganti scroll={{ x: 1200 }} menjadi scroll={{ x: 'max-content' }}
// - Membersihkan semua typo/artifact dari respons sebelumnya.
// ================================

import React, { useEffect, useState } from 'react';
import {
    Layout, Card, Spin, Empty, Typography, Table, Input, Row, Col, Statistic, Tag, Button, Modal,
    Dropdown, Menu, Radio, App
} from 'antd';
import { PlusOutlined, MoreOutlined } from '@ant-design/icons';
import { ref, onValue } from 'firebase/database';
import { db } from '../../api/firebase';

import TransaksiJualForm from './components/TransaksiJualForm';
import TransaksiJualDetailModal from './components/TransaksiJualDetailModal';
import { generateInvoicePDF, generateNotaPDF } from '../../utils/pdfGenerator';

const { Content } = Layout;
const { Title } = Typography;
const { Search } = Input;

const snapshotToArray = (snapshot) => {
    const data = snapshot.val();
    return data ? Object.keys(data).map((key) => ({ id: key, ...data[key] })) : [];
};

const formatCurrency = (value) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);

const formatDate = (timestamp) =>
    new Date(timestamp || 0).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const normalizeStatus = (s) => (s === 'DP' ? 'Sebagian' : s || 'N/A');

export default function TransaksiJualPage() {
    const { message } = App.useApp?.() ?? { message: { success: console.log, error: console.error } };

    const [allTransaksi, setAllTransaksi] = useState([]);
    const [filteredTransaksi, setFilteredTransaksi] = useState([]);
    const [loadingTransaksi, setLoadingTransaksi] = useState(true);
    const [recapData, setRecapData] = useState({ totalTagihan: 0, totalTerbayar: 0, sisaTagihan: 0 });
    const [searchText, setSearchText] = useState('');
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
    const [statusFilter, setStatusFilter] = useState(null);

    const [bukuList, setBukuList] = useState([]);
    const [pelangganList, setPelangganList] = useState([]);
    const [loadingDependencies, setLoadingDependencies] = useState(true);

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [formMode, setFormMode] = useState('create'); // 'create' | 'edit'
    const [editingTx, setEditingTx] = useState(null);

    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedTransaksi, setSelectedTransaksi] = useState(null);

    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [pdfUrl, setPdfUrl] = useState('');
    const [pdfTitle, setPdfTitle] = useState('');

    // fetch transaksi
    useEffect(() => {
        setLoadingTransaksi(true);
        const txRef = ref(db, 'transaksiJualBuku');
        const unsub = onValue(txRef, (snapshot) => {
            const data = snapshotToArray(snapshot).sort((a, b) => (b.tanggal || 0) - (a.tanggal || 0));
            setAllTransaksi(data);
            setLoadingTransaksi(false);
        });
        return () => unsub();
    }, []);

    // fetch deps
    useEffect(() => {
        setLoadingDependencies(true);
        const unsubBuku = onValue(ref(db, 'buku'), (snap) => setBukuList(snapshotToArray(snap)));
        const unsubP = onValue(ref(db, 'pelanggan'), (snap) => {
            setPelangganList(snapshotToArray(snap));
            setLoadingDependencies(false);
        });
        return () => { unsubBuku(); unsubP(); };
    }, []);

    // recap
    useEffect(() => {
        const totals = allTransaksi.reduce(
            (acc, tx) => ({ tagihan: acc.tagihan + Number(tx.totalTagihan || 0), terbayar: acc.terbayar + Number(tx.jumlahTerbayar || 0) }),
            { tagihan: 0, terbayar: 0 }
        );
        setRecapData({ totalTagihan: totals.tagihan, totalTerbayar: totals.terbayar, sisaTagihan: totals.tagihan - totals.terbayar });
    }, [allTransaksi]);

    // filter: search + status
    useEffect(() => {
        const q = (searchText || '').toLowerCase();
        let data = allTransaksi;

        if (statusFilter) {
            data = data.filter((tx) => {
                const s = tx.statusPembayaran || '';
                if (statusFilter === 'Sebagian') return s === 'Sebagian' || s === 'DP';
                return s === statusFilter;
            });
        }

        if (q) {
            data = data.filter((tx) => (tx.namaPelanggan || '').toLowerCase().includes(q));
        }

        setFilteredTransaksi(data);
    }, [searchText, statusFilter, allTransaksi]);

    const handleOpenCreate = () => { setFormMode('create'); setEditingTx(null); setIsFormModalOpen(true); };
    const handleOpenEdit = (tx) => { setFormMode('edit'); setEditingTx(tx); setIsFormModalOpen(true); };
    const handleCloseFormModal = () => { setIsFormModalOpen(false); setEditingTx(null); };

    const handleOpenDetailModal = (tx) => { setSelectedTransaksi(tx); setIsDetailModalOpen(true); };
    const handleCloseDetailModal = () => { setSelectedTransaksi(null); setIsDetailModalOpen(false); };

    const handleGenerateInvoice = (tx) => {
        setPdfTitle(`Invoice: ${tx.nomorInvoice || tx.id}`);
        const url = generateInvoicePDF(tx);
        setPdfUrl(url);
        setIsPdfModalOpen(true);
    };
    const handleGenerateNota = (tx) => {
        if (!['DP', 'Sebagian', 'Lunas'].includes(tx?.statusPembayaran)) {
            message?.error('Nota pembayaran hanya untuk transaksi berstatus DP / Sebagian / Lunas');
            return;
        }
        setPdfTitle(`Nota: ${tx.nomorInvoice || tx.id}`);
        const url = generateNotaPDF(tx);
        setPdfUrl(url);
        setIsPdfModalOpen(true);
    };

    const columns = [
        {
            title: 'No.',
            key: 'index',
            width: 60,
            render: (_t, _r, idx) => ((pagination.current - 1) * pagination.pageSize) + idx + 1,
        },
        {
            title: 'Tanggal', dataIndex: 'tanggal', key: 'tanggal', width: 140,
            render: (ts) => formatDate(ts), sorter: (a, b) => (a.tanggal || 0) - (b.tanggal || 0), defaultSortOrder: 'descend',
        },
        { title: 'ID Transaksi', dataIndex: 'id', key: 'id', width: 200, render: (id) => <small>{id}</small> },
        {
            title: 'Pelanggan', dataIndex: 'namaPelanggan', key: 'namaPelanggan', width: 240,
            sorter: (a, b) => (a.namaPelanggan || '').localeCompare(b.namaPelanggan || ''),
            render: (val, record) => (<span>{val} {record.pelangganIsSpesial ? <Tag color="gold">Spesial</Tag> : null}</span>),
        },
        { title: 'Keterangan', dataIndex: 'keterangan', key: 'keterangan', ellipsis: true, render: (v) => v || '-' },
        {
            title: 'Total Tagihan', dataIndex: 'totalTagihan', key: 'totalTagihan', align: 'right', width: 160,
            render: (val) => formatCurrency(val), sorter: (a, b) => (a.totalTagihan || 0) - (b.totalTagihan || 0),
        },
        {
            title: 'Sisa Tagihan', key: 'sisaTagihan', align: 'right', width: 160,
            render: (_, r) => {
                const sisa = (r.totalTagihan || 0) - (r.jumlahTerbayar || 0);
                return <span style={{ color: sisa > 0 ? '#cf1322' : '#3f8600', fontWeight: 600 }}>{formatCurrency(sisa)}</span>;
            },
            sorter: (a, b) => (a.totalTagihan - (a.jumlahTerbayar || 0)) - (b.totalTagihan - (b.jumlahTerbayar || 0)),
        },
        {
            title: 'Status Bayar', dataIndex: 'statusPembayaran', key: 'statusPembayaran', width: 140,
            render: (statusRaw) => {
                const status = normalizeStatus(statusRaw); // 'DP' -> 'Sebagian'
                let color = 'default';
                if (status === 'Lunas') color = 'green';
                else if (status === 'Belum Bayar') color = 'red';
                else if (status === 'Sebagian') color = 'orange';
                return <Tag color={color}>{status}</Tag>;
            },
        },
        {
            title: 'Aksi', key: 'aksi', align: 'center', width: 220, // (fixed: 'right' sudah dihapus)
            render: (_, record) => {
                const menu = (
                    <Menu>
                        <Menu.Item key="detail" onClick={() => handleOpenDetailModal(record)}>Lihat Detail</Menu.Item>
                        <Menu.Item key="edit" onClick={() => handleOpenEdit(record)}>Edit Transaksi</Menu.Item>
                        <Menu.Item key="inv" onClick={() => handleGenerateInvoice(record)}>Generate Invoice</Menu.Item>
                        <Menu.Item key="nota" onClick={() => handleGenerateNota(record)} disabled={!['DP', 'Sebagian', 'Lunas'].includes(record?.statusPembayaran)}>Generate Nota</Menu.Item>
                    </Menu>
                );
                return (
                    <Dropdown overlay={menu} trigger={["click"]}>
                        <Button icon={<MoreOutlined />} />
                    </Dropdown>
                );
            },
        },
    ];

    const paidPercent = recapData.totalTagihan > 0 ? (recapData.totalTerbayar / recapData.totalTagihan) * 100 : 0;
    const outstandingPercent = recapData.totalTagihan > 0 ? (recapData.sisaTagihan / recapData.totalTagihan) * 100 : 0;

    return (
        <Content style={{ padding: '24px' }}>
            {/* Floating primary add button */}
            <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 10 }}>
                <Button type="primary" shape="round" icon={<PlusOutlined />} size="large" style={{ boxShadow: '0 4px 12px rgba(0,0,0,.15)' }} onClick={handleOpenCreate}>
                    Tambah Transaksi
                </Button>
            </div>

            <Card>
                <Title level={4} style={{ margin: 0, marginBottom: 24 }}>Daftar Transaksi Penjualan</Title>

                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    <Col xs={24} lg={8}>
                        <Card bordered={false} style={{ backgroundColor: '#f0f2f5' }}>
                            <Statistic title="Total Tagihan (Semua)" value={recapData.totalTagihan} formatter={formatCurrency} />
                        </Card>
                    </Col>
                    <Col xs={24} lg={8}>
                        <Card bordered={false} style={{ backgroundColor: '#f0f2f5' }}>
                            <Statistic title="Total Terbayar (Semua)" value={recapData.totalTerbayar} formatter={formatCurrency} valueStyle={{ color: '#3f8600' }} suffix={`(${paidPercent.toFixed(1)}%)`} />
                        </Card>
                    </Col>
                    <Col xs={24} lg={8}>
                        <Card bordered={false} style={{ backgroundColor: '#f0f2f5' }}>
                            <Statistic title="Total Sisa Tagihan (Semua)" value={recapData.sisaTagihan} formatter={formatCurrency} valueStyle={{ color: recapData.sisaTagihan > 0 ? '#cf1322' : '#3f8600' }} suffix={`(${outstandingPercent.toFixed(1)}%)`} />
                        </Card>
                    </Col>
                </Row>

                <Search placeholder="Cari berdasarkan nama pelanggan..." onChange={(e) => setSearchText(e.target.value)} style={{ marginBottom: 16, width: '100%', maxWidth: 400 }} allowClear />

                <div style={{ marginBottom: 16 }}>
                    <Radio.Group value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <Radio.Button value={null}>Semua</Radio.Button>
                        <Radio.Button value="Belum Bayar">Belum Bayar</Radio.Button>
                        <Radio.Button value="Sebagian">Sebagian (DP)</Radio.Button>
                        <Radio.Button value="Lunas">Lunas</Radio.Button>
                    </Radio.Group>
                </div>

                <Table
                    loading={loadingTransaksi}
                    dataSource={filteredTransaksi}
                    columns={columns}
                    rowKey="id"
                    pagination={{
                        ...pagination,
                        total: filteredTransaksi.length,
                        showTotal: (total, range) => `${range[0]}-${range[1]} dari ${total} transaksi`,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50', '100'],
                    }}
                    onChange={(pag) => setPagination(pag)}
                    locale={{ emptyText: loadingTransaksi ? <Spin /> : <Empty description="Belum ada data transaksi" /> }}
                    scroll={{ x: 'max-content' }}
                />
            </Card>

            {/* CREATE / EDIT MODAL */}
            <Modal
                open={isFormModalOpen}
                onCancel={handleCloseFormModal}
                title={formMode === 'create' ? 'Buat Transaksi Penjualan Baru' : `Edit Transaksi (${editingTx?.id})`}
                width={1000}
                footer={null}
                destroyOnClose
            >
                {loadingDependencies ? (
                    <div style={{ textAlign: 'center', padding: '50px' }}>
                        <Spin size="large" />
                        <p>Memuat data buku & pelanggan...</p>
                    </div>
                ) : (
                    <TransaksiJualForm
                        mode={formMode}
                        initialTx={editingTx}
                        _ bukuList={bukuList}
                        pelangganList={pelangganList}
                        onSuccess={handleCloseFormModal}
                    />
                )}
            </Modal>

            {/* DETAIL MODAL */}
            <TransaksiJualDetailModal open={isDetailModalOpen} onCancel={handleCloseDetailModal} transaksi={selectedTransaksi} />

            {/* INLINE PDF MODAL (optional viewer) */}
            <Modal title={pdfTitle} open={isPdfModalOpen} onCancel={() => setIsPdfModalOpen(false)} footer={null} width="90%" style={{ top: 20 }} destroyOnClose>
                {pdfUrl ? (
                    <iframe src={pdfUrl} style={{ width: '100%', height: '75vh', border: 'none' }} title={pdfTitle} />
                ) : (
                    <div style={{ textAlign: 'center', padding: 50 }}><Spin /></div>
                )}
            </Modal>
        </Content>
    );
}