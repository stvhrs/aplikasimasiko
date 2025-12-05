import React, { useState, useMemo, useCallback } from 'react';
import {
    Layout, Card, Table, Button, Input, Space, Popconfirm, message, Spin, Tag, Row, Col, Tooltip
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, HistoryOutlined } from '@ant-design/icons';
import { ref, remove } from 'firebase/database';
import { db } from '../../api/firebase';

import { usePelangganStream } from '../../hooks/useFirebaseData';
import useDebounce from '../../hooks/useDebounce';
import PelangganForm from './components/PelangganForm';
import CustomerHistoryModal from './components/CustomerHistoryModal';

const { Content } = Layout;
const { Search } = Input;

export default function PelangganPage() {
    const { pelangganList, loadingPelanggan } = usePelangganStream();

    // --- 1. SETUP DEBOUNCE SEARCH YANG BENAR ---
    const [searchText, setSearchText] = useState('');
    
    // Delay 500ms: Filter baru jalan setengah detik setelah user BERHENTI mengetik
    const debouncedSearchText = useDebounce(searchText, 500); 

    // State Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPelanggan, setEditingPelanggan] = useState(null);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedHistoryCustomer, setSelectedHistoryCustomer] = useState(null);

    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 25,
        showSizeChanger: true,
        pageSizeOptions: ['25', '50', '100', '200'],
        showTotal: (total, range) => `${range[0]}-${range[1]} dari ${total} pelanggan`
    });

    // --- 2. LOGIC FILTERING (Berat) DIPISAHKAN KE MEMO ---
    // Variable ini hanya akan dihitung ulang jika 'debouncedSearchText' berubah
    const filteredPelanggan = useMemo(() => {
        let data = pelangganList || [];
        
        // Gunakan debouncedSearchText untuk filter, BUKAN searchText langsung
        if (debouncedSearchText) {
            const query = debouncedSearchText.toLowerCase();
            data = data.filter(p =>
                (p.nama && p.nama.toLowerCase().includes(query)) ||
                (p.telepon && p.telepon.includes(query))
            );
        }
        return data;
    }, [pelangganList, debouncedSearchText]); // Dependency array: debouncedSearchText

    // --- 3. HANDLER INPUT (Ringan) ---
    // Hanya mengupdate text field agar UI input tidak delay
    const handleSearchChange = useCallback((e) => {
        setSearchText(e.target.value);
        // Reset pagination ke halaman 1 saat user mengetik
        if (pagination.current !== 1) {
            setPagination(prev => ({ ...prev, current: 1 }));
        }
    }, [pagination.current]);

    // Handlers lainnya tetap sama...
    const handleTableChange = useCallback((paginationConfig) => {
        setPagination(paginationConfig);
    }, []);

    const handleOpenCreate = useCallback(() => {
        setEditingPelanggan(null);
        setIsModalOpen(true);
    }, []);

    const handleOpenEdit = useCallback((pelanggan) => {
        setEditingPelanggan(pelanggan);
        setIsModalOpen(true);
    }, []);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setTimeout(() => setEditingPelanggan(null), 300);
    }, []);

    const handleFormSuccess = useCallback(() => {
        handleCloseModal();
    }, [handleCloseModal]);

    const handleDelete = useCallback(async (idPelanggan) => {
        if (!idPelanggan) return;
        message.loading({ content: 'Menghapus pelanggan...', key: 'del_pel' });
        try {
            await remove(ref(db, `pelanggan/${idPelanggan}`));
            message.success({ content: 'Pelanggan berhasil dihapus', key: 'del_pel' });
        } catch (error) {
            console.error("Error deleting pelanggan:", error);
            message.error({ content: `Gagal menghapus: ${error.message}`, key: 'del_pel' });
        }
    }, []);

    const handleOpenHistory = useCallback((pelanggan) => {
        setSelectedHistoryCustomer(pelanggan);
        setIsHistoryModalOpen(true);
    }, []);

    const handleCloseHistory = useCallback(() => {
        setIsHistoryModalOpen(false);
        setTimeout(() => setSelectedHistoryCustomer(null), 300);
    }, []);

    const columns = useMemo(() => [
        {
            title: 'No.',
            key: 'index',
            width: 60,
            render: (text, record, index) => ((pagination.current - 1) * pagination.pageSize) + index + 1,
        },
        {
            title: 'Nama Pelanggan',
            dataIndex: 'nama',
            key: 'nama',
            sorter: (a, b) => (a.nama || '').localeCompare(b.nama || ''),
            ellipsis: true,
        },
        {
            title: 'Telepon',
            dataIndex: 'telepon',
            key: 'telepon',
            width: 150,
            render: (tel) => tel || '-',
        },
        {
            title: 'Status',
            dataIndex: 'isSpesial',
            key: 'isSpesial',
            align: 'center',
            width: 130,
            render: (isSpesial) => isSpesial ? <Tag color="gold">Spesial</Tag> : <Tag>Biasa</Tag>,
            filters: [{ text: 'Spesial', value: true }, { text: 'Biasa', value: false }],
            onFilter: (value, record) => !!record.isSpesial === value,
        },
        {
            title: 'Aksi',
            key: 'aksi',
            align: 'center',
            width: 180,
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="Lihat Riwayat Transaksi">
                        <Button 
                            type="default" 
                            icon={<HistoryOutlined />} 
                            onClick={() => handleOpenHistory(record)} 
                            style={{ color: '#1890ff', borderColor: '#1890ff' }}
                        />
                    </Tooltip>
                    
                    {/* <Tooltip title="Edit">
                        <Button type="link" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)} />
                    </Tooltip>

                    <Popconfirm
                        title="Hapus pelanggan?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Hapus"
                        cancelText="Batal"
                        okButtonProps={{ danger: true }}
                    >
                        <Button type="link" danger icon={<DeleteOutlined />} />
                    </Popconfirm> */}
                </Space>
            ),
        },
    ], [pagination, handleOpenEdit, handleDelete, handleOpenHistory]);

    // Indikator Loading: Aktif jika data sedang di-fetch ATAU user sedang mengetik (debounce belum selesai)
    const isSearching = searchText !== debouncedSearchText;

    return (
        <Layout>
            <Content style={{ padding: '24px', backgroundColor: '#f0f2f5' }}>
                <Card>
                    <Row justify="space-between" align="middle" gutter={[16, 16]} style={{ marginBottom: 24 }}>
                        <Col xs={24} sm={12}>
                            {/* INPUT SEARCH */}
                            <Search
                                placeholder="Cari nama atau telepon..."
                                value={searchText} // Bound ke state langsung agar responsif
                                onChange={handleSearchChange}
                                allowClear
                                loading={isSearching} // Menampilkan spinner kecil di kanan input saat debounce berjalan
                                style={{ width: '100%' }}
                            />
                        </Col>
                        <Col xs={24} sm={12} style={{ textAlign: 'right' }}>
                            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
                                Tambah Pelanggan
                            </Button>
                        </Col>
                    </Row>

                    {/* TABLE */}
                    <Spin spinning={loadingPelanggan && !pelangganList?.length}>
                        <Table
                            columns={columns}
                            dataSource={filteredPelanggan} // Bound ke hasil DEBOUNCE
                            rowKey="id"
                            pagination={pagination}
                            onChange={handleTableChange}
                            scroll={{ x: 'max-content' }}
                            rowClassName={(record, index) => (index % 2 === 0 ? 'table-row-even' : 'table-row-odd')}
                        />
                    </Spin>
                </Card>

                {/* MODALS */}
                {isModalOpen && (
                    <PelangganForm
                        key={editingPelanggan?.id || 'create'}
                        open={isModalOpen}
                        onCancel={handleCloseModal}
                        onSuccess={handleFormSuccess}
                        initialData={editingPelanggan}
                        pelangganList={pelangganList}
                    />
                )}

                <CustomerHistoryModal 
                    open={isHistoryModalOpen}
                    onCancel={handleCloseHistory}
                    pelanggan={selectedHistoryCustomer}
                />

            </Content>
        </Layout>
    );
}