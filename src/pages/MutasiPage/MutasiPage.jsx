import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Layout, Card, Table, Tag, Button, Modal, Input, Space, Typography, Row, Col,
    message, Tooltip, Empty, Grid, DatePicker, Spin
} from 'antd';
import {
    PlusOutlined, EditOutlined, EyeOutlined, SyncOutlined, DownloadOutlined, ShareAltOutlined
} from '@ant-design/icons';
// --- Impor Firebase Disederhanakan ---
import { ref, onValue, query, orderByChild, equalTo } from 'firebase/database';
import dayjs from 'dayjs';
import 'dayjs/locale/id';

import { db } from '../../api/firebase'; // Pastikan path ini benar
import useDebounce from '../../hooks/useDebounce'; // Pastikan path ini benar
import { TipeTransaksi, KategoriPemasukan, KategoriPengeluaran } from '../../constants'; // Pastikan path ini benar

import RekapitulasiCard from './components/RekapitulasiCard'; // Pastikan path ini benar
import KategoriChips from './components/KategoriChips'; // Pastikan path ini benar

// Impor komponen-komponen baru
// Pastikan path ini benar
import TransaksiForm from './components/TransaksiForm'; 

dayjs.locale('id');

const { Content } = Layout;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;


const MutasiPage = () => {
    const [transaksiList, setTransaksiList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFiltering, setIsFiltering] = useState(false);
    const [filters, setFilters] = useState({
        dateRange: null,
        selectedTipe: [],
        selectedKategori: [],
        searchText: '',
    });

    const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaksi, setEditingTransaksi] = useState(null);
    const [isProofModalOpen, setIsProofModalOpen] = useState(false);
    const [viewingProofUrl, setViewingProofUrl] = useState('');
    const [isProofLoading, setIsProofLoading] = useState(false);


    const screens = Grid.useBreakpoint();
    const debouncedSearchText = useDebounce(filters.searchText, 500);

    const [unpaidJual, setUnpaidJual] = useState([]);
    const [unpaidCetak, setUnpaidCetak] = useState([]);
    const [loadingInvoices, setLoadingInvoices] = useState(true);

    // --- FUNGSI HELPER UNTUK TANGGAL KONSISTEN ---
    // Fungsi helper untuk mengambil timestamp yang valid secara konsisten
    // Memberi fallback 0 jika data tanggal tidak ada/null
    const getTimestamp = (record) => record?.tanggal || record?.tanggalBayar || 0;
    // --- AKHIR FUNGSI HELPER ---

    // Effect untuk mengambil invoice yang BELUM LUNAS
    useEffect(() => {
        setLoadingInvoices(true);
        const snapshotToArray = (snapshot) => {
            const data = snapshot.val();
            return data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
        };

        let jualBelumBayar = [];
        let jualDP = [];
        let cetakBelumBayar = [];
        let cetakDP = [];

        const jualBelumBayarRef = query(ref(db, 'transaksiJualBuku'), orderByChild('statusPembayaran'), equalTo('Belum Bayar'));
        const jualDPRef = query(ref(db, 'transaksiJualBuku'), orderByChild('statusPembayaran'), equalTo('DP'));
        const cetakBelumBayarRef = query(ref(db, 'transaksiCetakBuku'), orderByChild('statusPembayaran'), equalTo('Belum Bayar'));
        const cetakDPRef = query(ref(db, 'transaksiCetakBuku'), orderByChild('statusPembayaran'), equalTo('DP'));

        const unsubJualBB = onValue(jualBelumBayarRef, (snapshot) => {
            jualBelumBayar = snapshotToArray(snapshot);
            setUnpaidJual([...jualBelumBayar, ...jualDP]);
            setLoadingInvoices(false);
        });

        const unsubJualDP = onValue(jualDPRef, (snapshot) => {
            jualDP = snapshotToArray(snapshot);
            setUnpaidJual([...jualBelumBayar, ...jualDP]);
            setLoadingInvoices(false);
        });

        const unsubCetakBB = onValue(cetakBelumBayarRef, (snapshot) => {
            cetakBelumBayar = snapshotToArray(snapshot);
            setUnpaidCetak([...cetakBelumBayar, ...cetakDP]);
            setLoadingInvoices(false);
        });

        const unsubCetakDP = onValue(cetakDPRef, (snapshot) => {
            cetakDP = snapshotToArray(snapshot);
            setUnpaidCetak([...cetakBelumBayar, ...cetakDP]);
            setLoadingInvoices(false);
        });

        return () => {
            unsubJualBB();
            unsubJualDP();
            unsubCetakBB();
            unsubCetakDP();
        };
    }, []);

    // ---- Handlers umum ----
    const handleFilterChange = (key, value) => {
        if (key === 'searchText') {
            setFilters(prev => ({ ...prev, [key]: value }));
            return;
        }
        setIsFiltering(true);
        setTimeout(() => setFilters(prev => ({ ...prev, [key]: value })), 0);
    };

    const handleMultiSelectFilter = (key, value) => {
        setIsFiltering(true);
        setTimeout(() => {
            setFilters(prev => {
                const currentSelection = prev[key];
                const newSelection = currentSelection.includes(value)
                    ? currentSelection.filter(item => item !== value)
                    : [...currentSelection, value];
                return { ...prev, [key]: newSelection };
            });
        }, 0);
    };

    const handleTableChange = (paginationConfig) => setPagination(paginationConfig);

    const resetFilters = () => {
        setIsFiltering(true);
        setTimeout(() => {
            setFilters({
                dateRange: null,
                selectedTipe: [],
                selectedKategori: [],
                searchText: '',
            });
        }, 0);
    };

    const handleViewProof = (url) => {
        setIsProofLoading(true);
        setViewingProofUrl(url);
        setIsProofModalOpen(true);
    };

    const handleDownloadProof = async (url) => {
        if (!url) return;
        message.loading({ content: 'Mengunduh file...', key: 'downloading' });
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Gagal mengambil file: ${response.statusText}. Pastikan konfigurasi CORS pada Firebase Storage sudah benar.`);
            }
            const blob = await response.blob();
            const objectUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            const fileName = url.split('/').pop().split('?')[0].split('%2F').pop() || 'bukti-transaksi';
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(objectUrl);
            message.success({ content: 'File berhasil diunduh!', key: 'downloading', duration: 2 });
        } catch (error) {
            console.error('Download error:', error);
            message.error({ content: 'Gagal mengunduh file. Periksa konsol untuk detail.', key: 'downloading', duration: 4 });
        }
    };

    const handleShareProof = async (url) => {
        if (!navigator.share) {
            message.warning('Fitur share tidak didukung di browser ini.');
            return;
        }
        message.loading({ content: 'Menyiapkan file...', key: 'sharing' });
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Gagal mengambil file untuk dibagikan.');
            const blob = await response.blob();
            const fileName = url.split('/').pop().split('?')[0].split('%2F').pop() || 'bukti-transaksi';
            const file = new File([blob], fileName, { type: blob.type });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Bukti Transaksi',
                    text: 'Berikut adalah bukti transaksi:',
                });
                message.success({ content: 'Berhasil dibagikan!', key: 'sharing', duration: 2 });
            } else {
                await navigator.share({
                    title: 'Bukti Transaksi',
                    text: 'Berikut adalah bukti transaksi:',
                    url: url,
                });
                message.success({ content: 'Tautan berhasil dibagikan!', key: 'sharing', duration: 2 });
            }
        } catch (error) {
            console.error('Share error:', error);
            if (error.name !== 'AbortError') {
                message.error({ content: 'Gagal membagikan file.', key: 'sharing', duration: 2 });
            } else {
                message.destroy('sharing');
            }
        }
    };


    // Effect untuk mengambil data mutasi
    useEffect(() => {
        const transaksiRef = ref(db, 'mutasi');
        setLoading(true);
        const unsubscribeTransaksi = onValue(transaksiRef, (snapshot) => {
            const data = snapshot.val();
            const loadedTransaksi = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
            
            // --- DIPERBARUI ---
            // Gunakan getTimestamp untuk sorting awal (b - a = terbaru dulu)
            loadedTransaksi.sort((a, b) => getTimestamp(b) - getTimestamp(a));
            // --- AKHIR PERBARUAN ---

            setTransaksiList(loadedTransaksi);
            setLoading(false);
        });
        return () => unsubscribeTransaksi();
    }, []); // Dependency array kosong, hanya run sekali saat mount

    // Memo untuk kalkulasi saldo berjalan
    const balanceMap = useMemo(() => {
        if (!transaksiList || transaksiList.length === 0) return new Map();

        // --- DIPERBARUI ---
        // Gunakan getTimestamp untuk sorting (a - b = terlama dulu)
        const sortedAllTx = [...transaksiList].sort((a, b) => getTimestamp(a) - getTimestamp(b));
        // --- AKHIR PERBARUAN ---

        const map = new Map();
        let currentBalance = 0;
        for (const tx of sortedAllTx) {
            // Gunakan `jumlah` (yang +/-) untuk kalkulasi saldo
            currentBalance += (tx.jumlah || 0); // Pastikan `jumlah` ada
            map.set(tx.id, currentBalance);
        }
        return map;
    }, [transaksiList]); // Hanya bergantung pada transaksiList

    // Memo untuk data yang difilter
    const filteredTransaksi = useMemo(() => {
        if (!transaksiList) return [];
        return transaksiList.filter(tx => {
            
            // --- DIPERBARUI ---
            const tgl = dayjs(getTimestamp(tx)); // Gunakan tanggal yang konsisten
            // --- AKHIR PERBARUAN ---
            
            const [startDate, endDate] = filters.dateRange || [null, null];
            const inDate = !startDate || (tgl.isAfter(startDate.startOf('day')) && tgl.isBefore(endDate.endOf('day')));
            const inTipe = filters.selectedTipe.length === 0 || filters.selectedTipe.includes(tx.tipe);
            // Gunakan `kategori` atau `tipeMutasi` untuk filter
            const inKategori = filters.selectedKategori.length === 0 || filters.selectedKategori.includes(tx.kategori) || filters.selectedKategori.includes(tx.tipeMutasi);
            const inSearch = debouncedSearchText === '' || String(tx.keterangan || '').toLowerCase().includes(debouncedSearchText.toLowerCase());
            return inDate && inTipe && inKategori && inSearch;
        }).map(tx => ({ ...tx, saldoSetelah: balanceMap.get(tx.id) }));
    }, [transaksiList, filters.dateRange, filters.selectedTipe, filters.selectedKategori, debouncedSearchText, balanceMap]);

    // Effect untuk loading spinner saat filter
    useEffect(() => {
        if (isFiltering) {
            const timer = setTimeout(() => setIsFiltering(false), 300);
            return () => clearTimeout(timer);
        }
    }, [filteredTransaksi, isFiltering]);

    const isFilterActive = !!filters.dateRange || filters.selectedTipe.length > 0 || filters.selectedKategori.length > 0 || filters.searchText !== '';

    // Handler untuk modal
    const handleTambah = () => {
        setEditingTransaksi(null);
        setIsModalOpen(true);
    };

    const handleEdit = useCallback((record) => {
        setEditingTransaksi(record);
        setIsModalOpen(true);
    }, []);

    const currencyFormatter = (value) =>
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

    // Memo untuk kolom tabel
    const columns = useMemo(() => {
        const baseColumns = [
            { 
                title: 'Tanggal', 
                dataIndex: 'tanggal', 
                key: 'tanggal', 
                
                // --- DIPERBARUI 'render' ---
                render: (tgl, record) => dayjs(getTimestamp(record)).format('DD MMM YYYY'), 
                
                // --- DIPERBARUI 'sorter' ---
                sorter: (a, b) => getTimestamp(a) - getTimestamp(b), 
                
                defaultSortOrder: 'descend', 
                width: 140 
            },
            { 
                title: 'Jenis Transaksi', 
                dataIndex: 'kategori', 
                key: 'kategori', 
                render: (kategori, record) => { 
                    const kategoriText = record.tipe === 'pemasukan' 
                        ? KategoriPemasukan[kategori] || kategori?.replace(/_/g, ' ') 
                        : KategoriPengeluaran[kategori] || kategori?.replace(/_/g, ' '); 
                    return <Tag color={record.tipe === 'pemasukan' ? 'green' : 'red'}>{kategoriText || record.tipeMutasi}</Tag>; 
                }, 
                width: 200 
            },
            { 
                title: 'Keterangan', 
                dataIndex: 'keterangan', 
                key: 'keterangan' 
            },
            { 
                title: 'Nominal', 
                dataIndex: 'jumlah', 
                key: 'jumlah', 
                align: 'right', 
                // --- DIPERBARUI 'render' ---
                render: (jml, record) => <Text type={record.jumlah >= 0 ? 'success' : 'danger'}>{currencyFormatter(record.jumlah)}</Text>, 
                sorter: (a, b) => a.jumlah - b.jumlah, 
                width: 180 
            },
            { 
                title: 'Saldo Akhir', 
                dataIndex: 'saldoSetelah', 
                key: 'saldoSetelah', 
                align: 'right', 
                render: (saldo) => (saldo !== null && saldo !== undefined) ? currencyFormatter(saldo) : <Text type="secondary">-</Text>, 
                sorter: (a, b) => (a.saldoSetelah || 0) - (b.saldoSetelah || 0), 
                width: 180 
            },
            {
                title: 'Aksi', 
                key: 'aksi', 
                align: 'center', 
                render: (_, record) => (
                    <Space size="middle">
                        <Tooltip title={record.buktiUrl ? "Lihat Bukti" : "Tidak ada bukti"}>
                            <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewProof(record.buktiUrl)} disabled={!record.buktiUrl} />
                        </Tooltip>
                        <Tooltip title="Edit Transaksi">
                            <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
                        </Tooltip>
                    </Space>
                ), 
                width: 140
            },
        ];
        if (!screens.md) return baseColumns.filter(col => col.key !== 'saldoSetelah');
        return baseColumns;
    }, [screens, handleEdit]); // Dependency array sudah benar

    return (
        <Content style={{ padding: screens.xs ? '12px' : '24px', backgroundColor: '#f0f2f5' }}>
            
            <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
                <Col xs={24} lg={14}>
                    <Card style={{ height: '100%' }}>
                        <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>Filter Transaksi</Title>
                        <Space direction="vertical" size="large" style={{ width: '100%' }}>
                            <Row gutter={[16, 16]}>
                                <Col xs={24} sm={12}><RangePicker style={{ width: '100%' }} onChange={(dates) => handleFilterChange('dateRange', dates)} value={filters.dateRange} placeholder={['Tanggal Mulai', 'Tanggal Selesai']} /></Col>
                                <Col xs={24} sm={12}><Input.Search placeholder="Cari berdasarkan keterangan..." value={filters.searchText} onChange={(e) => handleFilterChange('searchText', e.target.value)} allowClear style={{ width: '100%' }} /></Col>
                            </Row>
                            <div>
                                <Text strong>Tipe Transaksi:</Text>
                                <div style={{ marginTop: 8 }}>
                                    <Space wrap>
                                        <Tag.CheckableTag style={chipStyle} checked={filters.selectedTipe.includes(TipeTransaksi.pemasukan)} onChange={() => handleMultiSelectFilter('selectedTipe', TipeTransaksi.pemasukan)}>Pemasukan</Tag.CheckableTag>
                                        <Tag.CheckableTag style={chipStyle} checked={filters.selectedTipe.includes(TipeTransaksi.pengeluaran)} onChange={() => handleMultiSelectFilter('selectedTipe', TipeTransaksi.pengeluaran)}>Pengeluaran</Tag.CheckableTag>
                                    </Space>
                                </div>
                            </div>
                            {(filters.selectedTipe.length === 0 || filters.selectedTipe.includes(TipeTransaksi.pemasukan)) && (
                                <div>
                                    <Text strong>Kategori Pemasukan:</Text>
                                    <div style={{ marginTop: 8 }}><KategoriChips kategoriMap={KategoriPemasukan} onSelect={handleMultiSelectFilter} selectedKategori={filters.selectedKategori} /></div>
                                </div>
                            )}
                            {(filters.selectedTipe.length === 0 || filters.selectedTipe.includes(TipeTransaksi.pengeluaran)) && (
                                <div>
                                    <Text strong>Kategori Pengeluaran:</Text>
                                    <div style={{ marginTop: 8 }}><KategoriChips kategoriMap={KategoriPengeluaran} onSelect={handleMultiSelectFilter} selectedKategori={filters.selectedKategori} /></div>
                                </div>
                            )}
                            {isFilterActive && (<Button icon={<SyncOutlined />} onClick={resetFilters} style={{ width: 'fit-content' }}>Reset Filter</Button>)}
                        </Space>
                    </Card>
                </Col>
                <Col xs={24} lg={10}>
                    {isFilterActive ? <RekapitulasiCard data={filteredTransaksi} /> : (
                        <Card style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Empty description={<Text type="secondary">Pilih filter untuk melihat rekapitulasi</Text>} />
                        </Card>
                    )}
                </Col>
            </Row>
            
            <Card>
                <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>Daftar Transaksi</Title>
                <Table
                    columns={columns}
                    dataSource={filteredTransaksi}
                    loading={loading || isFiltering}
                    rowKey="id"
                    size="middle"
                    scroll={{ x: 'max-content' }}
                    pagination={{ ...pagination, showSizeChanger: true, showTotal: (total, range) => `${range[0]}-${range[1]} dari ${total} transaksi` }}
                    onChange={handleTableChange}
                />
            </Card>

            <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 10 }}>
                <Button type="primary" shape="round" icon={<PlusOutlined />} size="large" style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }} onClick={handleTambah}>Tambah</Button>
            </div>

            {/* --- Panggilan TransaksiForm Disederhanakan --- */}
            <TransaksiForm
                open={isModalOpen}
                onCancel={() => { setIsModalOpen(false); setEditingTransaksi(null); }}
                initialValues={editingTransaksi}
                unpaidJual={unpaidJual}
                unpaidCetak={unpaidCetak}
                loadingInvoices={loadingInvoices}
            />

            {/* --- Modal Bukti Transaksi --- */}
            <Modal
                open={isProofModalOpen}
                title="Bukti Transaksi"
                onCancel={() => setIsProofModalOpen(false)}
                footer={[
                    <Button key="close" onClick={() => setIsProofModalOpen(false)}>
                        Tutup
                    </Button>,
                    navigator.share && (
                        <Button
                            key="share"
                            icon={<ShareAltOutlined />}
                            onClick={() => handleShareProof(viewingProofUrl)}
                        >
                            Share
                        </Button>
                    ),
                    <Button
                        key="download"
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={() => handleDownloadProof(viewingProofUrl)}
                    >
                        Download
                    </Button>
                ]}
                width={800}
                bodyStyle={{ padding: '24px', textAlign: 'center', minHeight: '300px' }}
                destroyOnClose
            >
                {isProofLoading && <Spin size="large" />}
                {viewingProofUrl && (
                    viewingProofUrl.toLowerCase().includes('.pdf') ? (
                        <iframe
                            src={viewingProofUrl}
                            style={{ width: '100%', height: '65vh', border: 'none', display: isProofLoading ? 'none' : 'block' }}
                            title="Bukti PDF"
                            onLoad={() => setIsProofLoading(false)}
                        />
                    ) : (
                        <img
                            alt="Bukti Transaksi"
                            style={{ width: '100%', height: 'auto', maxHeight: '70vh', objectFit: 'contain', display: isProofLoading ? 'none' : 'block' }}
                            src={viewingProofUrl}
                            onLoad={() => setIsProofLoading(false)}
                        />
                    )
                )}
            </Modal>
        </Content>
    );
};

const chipStyle = { border: '1px solid #d9d9d9', padding: '4px 10px', borderRadius: '16px', minWidth: '130px', textAlign: 'center' };

export default MutasiPage;