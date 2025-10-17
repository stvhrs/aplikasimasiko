import React, { useState, useEffect, useMemo } from 'react';
import {
    Layout, Card, Table, Tag, Button, Input, Space, Typography, Row, Col,
    Grid, Tooltip
} from 'antd';
import { PlusOutlined, EditOutlined, HistoryOutlined } from '@ant-design/icons';
import { ref, onValue } from 'firebase/database';
import { db } from '../../api/firebase'; // Sesuaikan path
import useDebounce from '../../hooks/useDebounce'; // Sesuaikan path

import BukuForm from './components/BukuForm'; // Kita akan buat file ini
import StokFormModal from './components/StockFormModal'; // Kita akan buat file ini

const { Content } = Layout;
const { Title } = Typography;

// Helper format mata uang
const currencyFormatter = (value) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

const BukuPage = () => {
    const [bukuList, setBukuList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isStokModalOpen, setIsStokModalOpen] = useState(false);
    
    const [editingBuku, setEditingBuku] = useState(null);
    const [stokBuku, setStokBuku] = useState(null); // Buku untuk modal stok

    const [searchText, setSearchText] = useState('');
    const debouncedSearchText = useDebounce(searchText, 300);
    const screens = Grid.useBreakpoint();

    // Listener data buku dari Firebase
    useEffect(() => {
        const bukuRef = ref(db, 'buku');
        setLoading(true);
        const unsubscribeBuku = onValue(bukuRef, (snapshot) => {
            const data = snapshot.val();
            const loadedBuku = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
            loadedBuku.sort((a, b) => a.judul.localeCompare(b.judul)); // Urutkan berdasarkan judul
            setBukuList(loadedBuku);
            setLoading(false);
        });
        return () => unsubscribeBuku();
    }, []);

    // Filter data berdasarkan pencarian
    const filteredBuku = useMemo(() => {
        if (!debouncedSearchText) return bukuList;
        return bukuList.filter(buku =>
            buku.judul.toLowerCase().includes(debouncedSearchText.toLowerCase()) ||
            (buku.penerbit && buku.penerbit.toLowerCase().includes(debouncedSearchText.toLowerCase())) ||
            (buku.mapel && buku.mapel.toLowerCase().includes(debouncedSearchText.toLowerCase()))
        );
    }, [bukuList, debouncedSearchText]);

    // --- Handlers ---
    const handleTambah = () => {
        setEditingBuku(null);
        setIsModalOpen(true);
    };

    const handleEdit = (record) => {
        setEditingBuku(record);
        setIsModalOpen(true);
    };

    const handleTambahStok = (record) => {
        setStokBuku(record);
        setIsStokModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingBuku(null);
    };

    const handleCloseStokModal = () => {
        setIsStokModalOpen(false);
        setStokBuku(null);
    };

    // --- Definisi Kolom Tabel ---
    const columns = useMemo(() => [
        { title: 'Judul Buku', dataIndex: 'judul', key: 'judul', sorter: (a, b) => a.judul.localeCompare(b.judul), fixed: 'left', width: 250 },
        { title: 'Stok', dataIndex: 'stok', key: 'stok', sorter: (a, b) => a.stok - b.stok, align: 'right', width: 100 },
        { title: 'Mapel/Kategori', dataIndex: 'mapel', key: 'mapel', width: 150 },
        { title: 'Kelas', dataIndex: 'kelas', key: 'kelas', render: (kelas) => kelas || '-', width: 100 },
        { title: 'Tipe', dataIndex: 'tipeBuku', key: 'tipeBuku', render: (tipe) => <Tag>{tipe}</Tag>, width: 100 },
        { title: 'Harga Jual', dataIndex: 'hargaJual', key: 'hargaJual', render: (val) => currencyFormatter(val), align: 'right', width: 150 },
        { title: 'Harga Spesial', dataIndex: 'hargaJualSpesial', key: 'hargaJualSpesial', render: (val) => currencyFormatter(val), align: 'right', width: 150 },
        { title: 'Penerbit', dataIndex: 'penerbit', key: 'penerbit', width: 200 },
        {
            title: 'Aksi',
            key: 'aksi',
            align: 'center',
            fixed: 'right',
            width: 120,
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="Edit Detail Buku">
                        <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
                    </Tooltip>
                    <Tooltip title="Tambah/Kurangi Stok">
                        <Button type="link" icon={<HistoryOutlined />} onClick={() => handleTambahStok(record)} />
                    </Tooltip>
                </Space>
            ),
        },
    ], []);

    return (
        <Content style={{ padding: screens.xs ? '12px' : '24px' }}>
            <Card>
                <Row justify="space-between" align="middle" gutter={[16, 16]}>
                    <Col>
                        <Title level={5} style={{ marginTop: 0, marginBottom: 0 }}>Manajemen Data Buku</Title>
                    </Col>
                    <Col flex="auto" style={{ maxWidth: 400 }}>
                        <Input.Search
                            placeholder="Cari Judul, Penerbit, Mapel..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            allowClear
                        />
                    </Col>
                </Row>

                <Table
                    columns={columns}
                    dataSource={filteredBuku}
                    loading={loading}
                    rowKey="id"
                    size="middle"
                    scroll={{ x: 'max-content' }}
                    pagination={{ pageSize: 15, showTotal: (total, range) => `${range[0]}-${range[1]} dari ${total} buku` }}
                    style={{ marginTop: 24 }}
                />
            </Card>

            <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 10 }}>
                <Button type="primary" shape="round" icon={<PlusOutlined />} size="large" style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }} onClick={handleTambah}>
                    Tambah Buku
                </Button>
            </div>

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