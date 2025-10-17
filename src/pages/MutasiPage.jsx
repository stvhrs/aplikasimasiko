import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Layout, Card, Table, Tag, Button, Modal, Input, Space, Typography, Row, Col,
    message, Tooltip, Empty, Grid, DatePicker, Spin
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, SyncOutlined, DownloadOutlined, ShareAltOutlined
} from '@ant-design/icons';
import { ref, onValue, push, update, remove,query, orderByChild, equalTo , } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import 'dayjs/locale/id';

import { db, storage, } from '../api/firebase';
import useDebounce from '../hooks/useDebounce';
import { TipeTransaksi, KategoriPemasukan, KategoriPengeluaran } from '../constants';

import RekapitulasiCard from './MutasiPage/components/RekapitulasiCard';
import KategoriChips from './MutasiPage/components/KategoriChips';

// Impor komponen-komponen baru
import FilterCard from './MutasiPage/components/FilterCard';
import AksiKolom from './MutasiPage/components/AksiKolom';
import BuktiModal from './MutasiPage/components/BuktiModal';
import TransaksiForm from './MutasiPage/components/TransaksiForm'; // Pastikan Anda sudah memindahkan file ini

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
    const [isSaving, setIsSaving] = useState(false);
    const [isProofModalOpen, setIsProofModalOpen] = useState(false);
    const [viewingProofUrl, setViewingProofUrl] = useState('');
    const [isProofLoading, setIsProofLoading] = useState(false);


    const screens = Grid.useBreakpoint();
    const debouncedSearchText = useDebounce(filters.searchText, 500);

    const [modal, contextHolder] = Modal.useModal();
   const [unpaidJual, setUnpaidJual] = useState([]);
const [unpaidCetak, setUnpaidCetak] = useState([]);
const [loadingInvoices, setLoadingInvoices] = useState(true);

// Effect untuk mengambil invoice yang BELUM LUNAS
useEffect(() => {
  setLoadingInvoices(true);

  // Fungsi helper untuk mengubah snapshot RTDB menjadi array
  const snapshotToArray = (snapshot) => {
    const data = snapshot.val();
    return data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
  };

  // Variabel sementara untuk menampung hasil
  let jualBelumBayar = [];
  let jualDP = [];
  let cetakBelumBayar = [];
  let cetakDP = [];

  // Definisikan Query
  const jualBelumBayarRef = query(ref(db, 'transaksiJualBuku'), orderByChild('statusPembayaran'), equalTo('Belum Bayar'));
  const jualDPRef = query(ref(db, 'transaksiJualBuku'), orderByChild('statusPembayaran'), equalTo('DP'));
  const cetakBelumBayarRef = query(ref(db, 'transaksiCetakBuku'), orderByChild('statusPembayaran'), equalTo('Belum Bayar'));
  const cetakDPRef = query(ref(db, 'transaksiCetakBuku'), orderByChild('statusPembayaran'), equalTo('DP'));

  // Buat 4 listener
  const unsubJualBB = onValue(jualBelumBayarRef, (snapshot) => {
    jualBelumBayar = snapshotToArray(snapshot);
    setUnpaidJual([...jualBelumBayar, ...jualDP]); // Gabungkan hasil
    setLoadingInvoices(false);
  });

  const unsubJualDP = onValue(jualDPRef, (snapshot) => {
    jualDP = snapshotToArray(snapshot);
    setUnpaidJual([...jualBelumBayar, ...jualDP]); // Gabungkan hasil
    setLoadingInvoices(false);
  });

  const unsubCetakBB = onValue(cetakBelumBayarRef, (snapshot) => {
    cetakBelumBayar = snapshotToArray(snapshot);
    setUnpaidCetak([...cetakBelumBayar, ...cetakDP]); // Gabungkan hasil
    setLoadingInvoices(false);
  });

  const unsubCetakDP = onValue(cetakDPRef, (snapshot) => {
    cetakDP = snapshotToArray(snapshot);
    setUnpaidCetak([...cetakBelumBayar, ...cetakDP]); // Gabungkan hasil
    setLoadingInvoices(false);
  });

  // Cleanup listeners saat komponen unmount
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


    useEffect(() => {
        const transaksiRef = ref(db, 'mutasi');
        setLoading(true);
        const unsubscribeTransaksi = onValue(transaksiRef, (snapshot) => {
            const data = snapshot.val();
            const loadedTransaksi = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
            loadedTransaksi.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
            setTransaksiList(loadedTransaksi);
            setLoading(false);
        });
        return () => unsubscribeTransaksi();
    }, []);

    const balanceMap = useMemo(() => {
        if (!transaksiList || transaksiList.length === 0) return new Map();
        const sortedAllTx = [...transaksiList].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
        const map = new Map();
        let currentBalance = 0;
        for (const tx of sortedAllTx) {
            currentBalance += tx.jumlah;
            map.set(tx.id, currentBalance);
        }
        return map;
    }, [transaksiList]);

    const filteredTransaksi = useMemo(() => {
        if (!transaksiList) return [];
        return transaksiList.filter(tx => {
            const tgl = dayjs(tx.tanggal);
            const [startDate, endDate] = filters.dateRange || [null, null];
            const inDate = !startDate || (tgl.isAfter(startDate.startOf('day')) && tgl.isBefore(endDate.endOf('day')));
            const inTipe = filters.selectedTipe.length === 0 || filters.selectedTipe.includes(tx.tipe);
            const inKategori = filters.selectedKategori.length === 0 || filters.selectedKategori.includes(tx.kategori);
            const inSearch = debouncedSearchText === '' || String(tx.keterangan || '').toLowerCase().includes(debouncedSearchText.toLowerCase());
            return inDate && inTipe && inKategori && inSearch;
        }).map(tx => ({ ...tx, saldoSetelah: balanceMap.get(tx.id) }));
    }, [transaksiList, filters.dateRange, filters.selectedTipe, filters.selectedKategori, debouncedSearchText, balanceMap]);

    useEffect(() => {
        if (isFiltering) {
            const timer = setTimeout(() => setIsFiltering(false), 300);
            return () => clearTimeout(timer);
        }
    }, [filteredTransaksi, isFiltering]);

    const isFilterActive = !!filters.dateRange || filters.selectedTipe.length > 0 || filters.selectedKategori.length > 0 || filters.searchText !== '';

    const handleTambah = () => {
        setEditingTransaksi(null);
        setIsModalOpen(true);
    };

    const handleEdit = useCallback((record) => {
        setEditingTransaksi(record);
        setIsModalOpen(true);
    }, []);

    const handleDelete = useCallback((id) => {
        modal.confirm({
            title: 'Konfirmasi Hapus',
            content: 'Apakah Anda yakin ingin menghapus transaksi ini?',
            okText: 'Hapus',
            okType: 'danger',
            cancelText: 'Batal',
            onOk: async () => {
                try {
                    await remove(ref(db, `mutasi/${id}`));
                    message.success('Transaksi berhasil dihapus');
                } catch (error) {
                    console.error("Gagal menghapus:", error);
                    message.error('Gagal menghapus transaksi');
                }
            },
        });
    }, [modal]);
    const handleFinishForm = async (values) => {
  setIsSaving(true);
  message.loading({ content: 'Menyimpan...', key: 'saving' });

  const DB_PATH = 'mutasi';

  const { bukti, ...dataLain } = values;
  const buktiFile = (bukti && bukti.length > 0 && bukti[0].originFileObj)
    ? bukti[0].originFileObj
    : null;

  let buktiUrl = editingTransaksi?.buktiUrl || null;

  try {
    if (buktiFile) {
      const safeKeterangan = dataLain.keterangan
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50);

      const originalExt = buktiFile.name.split('.').pop();
      const fileName = `${safeKeterangan}-${uuidv4()}.${originalExt}`;
      const fileRef = storageRef(storage, `bukti_mutasi/${fileName}`);

      await uploadBytes(fileRef, buktiFile, { contentType: buktiFile.type });
      buktiUrl = await getDownloadURL(fileRef);
    }

    let dataToSave = {};
    if (dataLain.idTransaksi) {
      // pembayaran invoice
      dataToSave = {
        idTransaksi: dataLain.idTransaksi,
        tipeTransaksi: dataLain.tipeTransaksi, // 'jual' | 'cetak'
        jumlahBayar: Number(dataLain.jumlah),
        tanggalBayar: dataLain.tanggal.valueOf(),
        tipeMutasi: dataLain.tipeMutasi,
        keterangan: dataLain.keterangan,
        buktiUrl,
      };
    } else {
      // mutasi umum
      const jumlah = dataLain.tipe === TipeTransaksi.pengeluaran
        ? -Math.abs(Number(dataLain.jumlah))
        : Number(dataLain.jumlah);

      dataToSave = {
        jumlah,
        kategori: dataLain.kategori,
        keterangan: dataLain.keterangan,
        tanggal: dataLain.tanggal.valueOf(),
        tipe: dataLain.tipe,
        buktiUrl,
      };
    }

    if (editingTransaksi) {
      // ⬇️ JANGAN pakai nama 'ref' di sini
      const txRef = ref(db, `${DB_PATH}/${editingTransaksi.id}`);
      await update(txRef, dataToSave);
      message.success({ content: 'Mutasi berhasil diperbarui', key: 'saving', duration: 2 });
    } else {
      const listRef = ref(db, DB_PATH);
      await push(listRef, dataToSave);
      message.success({ content: 'Mutasi berhasil ditambahkan', key: 'saving', duration: 2 });
    }

    setIsModalOpen(false);
    setEditingTransaksi(null);
  } catch (error) {
    console.error("Error saving transaction: ", error);
    message.error({ content: 'Terjadi kesalahan saat menyimpan data', key: 'saving', duration: 4 });
  } finally {
    setIsSaving(false);
  }
};

    const currencyFormatter = (value) =>
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

    const columns = useMemo(() => {
        const baseColumns = [
            { title: 'Tanggal', dataIndex: 'tanggal', key: 'tanggal', render: (tgl) => dayjs(tgl).format('DD MMM YYYY'), sorter: (a, b) => a.tanggal - b.tanggal, defaultSortOrder: 'descend', width: 140 },
            { title: 'Jenis Transaksi', dataIndex: 'kategori', key: 'kategori', render: (kategori, record) => { const kategoriText = record.tipe === 'pemasukan' ? KategoriPemasukan[kategori] || kategori.replace(/_/g, ' ') : KategoriPengeluaran[kategori] || kategori.replace(/_/g, ' '); return <Tag color={record.tipe === 'pemasukan' ? 'green' : 'red'}>{kategoriText}</Tag>; }, width: 200 },
            { title: 'Keterangan', dataIndex: 'keterangan', key: 'keterangan' },
            { title: 'Nominal', dataIndex: 'jumlah', key: 'jumlah', align: 'right', render: (jml) => <Text type={jml >= 0 ? 'success' : 'danger'}>{currencyFormatter(jml)}</Text>, sorter: (a, b) => a.jumlah - b.jumlah, width: 180 },
            { title: 'Saldo Akhir', dataIndex: 'saldoSetelah', key: 'saldoSetelah', align: 'right', render: (saldo) => (saldo !== null && saldo !== undefined) ? currencyFormatter(saldo) : <Text type="secondary">-</Text>, sorter: (a, b) => (a.saldoSetelah || 0) - (b.saldoSetelah || 0), width: 180 },
            { title: 'Aksi', key: 'aksi', align: 'center', render: (_, record) => (<Space size="middle"> <Tooltip title={record.buktiUrl ? "Lihat Bukti" : "Tidak ada bukti"}> <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewProof(record.buktiUrl)} disabled={!record.buktiUrl} /> </Tooltip> <Tooltip title="Edit Transaksi"> <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} /> </Tooltip> <Tooltip title="Hapus Transaksi"> <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} /> </Tooltip> </Space>), width: 140 },
        ];
        if (!screens.md) return baseColumns.filter(col => col.key !== 'saldoSetelah');
        return baseColumns;
    }, [screens, handleEdit, handleDelete]);

    return (
        <Content style={{ padding: screens.xs ? '12px' : '24px', backgroundColor: '#f0f2f5' }}>
            {contextHolder}
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
           <TransaksiForm
  open={isModalOpen}
  onCancel={() => { setIsModalOpen(false); setEditingTransaksi(null); }}
  onFinish={handleFinishForm}
  initialValues={editingTransaksi}
  loading={isSaving}

  // --- TAMBAHKAN PROPS INI ---
  unpaidJual={unpaidJual}
  unpaidCetak={unpaidCetak}
  loadingInvoices={loadingInvoices}
/>
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

