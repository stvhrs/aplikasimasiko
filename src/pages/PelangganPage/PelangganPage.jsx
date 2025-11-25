import React, { useState, useMemo, useCallback, useDeferredValue } from 'react';
import {
    Layout, Card, Table, Button, Input, Space, Typography, Popconfirm, message, Spin, Tag, Row, Col
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { ref, remove } from 'firebase/database';
import { db } from '../../api/firebase'; 

// --- IMPORT HOOK BARU DARI FILE PUSAT ---
import { usePelangganStream } from '../../hooks/useFirebaseData'; 

import useDebounce from '../../hooks/useDebounce'; 
import PelangganForm from './components/PelangganForm'; 

const { Content } = Layout;
const { Title } = Typography;
const { Search } = Input;

export default function PelangganPage() {
    // --- Gunakan Hook Singleton (Anti-Reload) ---
    const { pelangganList, loadingPelanggan } = usePelangganStream();
    // ----------------------------

    const [searchText, setSearchText] = useState('');
    const debouncedSearchText = useDebounce(searchText, 300);
    const deferredSearch = useDeferredValue(debouncedSearchText);
    const deferredPelangganList = useDeferredValue(pelangganList);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPelanggan, setEditingPelanggan] = useState(null); 

    const [pagination, setPagination] = useState({
        current: 1, 
        pageSize: 25, 
        showSizeChanger: true,        
        pageSizeOptions: ['25', '50', '100', '200'],
        showTotal: (total, range) => `${range[0]}-${range[1]} dari ${total} pelanggan`
    });

    const isFiltering = pelangganList !== deferredPelangganList || debouncedSearchText !== deferredSearch;

    const filteredPelanggan = useMemo(() => {
        // Safety check untuk deferredPelangganList (cegah undefined)
        let data = deferredPelangganList || [];
        
        if (deferredSearch) {
            const query = deferredSearch.toLowerCase();
            data = data.filter(p =>
                (p.nama && p.nama.toLowerCase().includes(query)) ||
                (p.telepon && p.telepon.includes(query)) 
            );
        }
        return data;
    }, [deferredPelangganList, deferredSearch]);

    const handleSearchChange = useCallback((e) => {
        setSearchText(e.target.value);
        setPagination(prev => ({ ...prev, current: 1 }));
    }, []);

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
        // Set editing to null *after* modal closes to prevent flicker
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
            width: 180,
            render: (tel) => tel || '-',
        },
        {
            title: 'Status Spesial',
            dataIndex: 'isSpesial',
            key: 'isSpesial',
            align: 'center',
            width: 150,
            render: (isSpesial) => isSpesial ? <Tag color="gold">Spesial</Tag> : <Tag>Biasa</Tag>,
            filters: [ { text: 'Spesial', value: true }, { text: 'Biasa', value: false } ],
            onFilter: (value, record) => !!record.isSpesial === value,
        },
        {
            title: 'Aksi',
            key: 'aksi',
            align: 'center',
            width: 120,
            render: (_, record) => (
                <Space size="middle">
                    <Button type="link" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)} />
                    <Popconfirm
                        title="Yakin ingin menghapus pelanggan ini?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Hapus"
                        cancelText="Batal"
                        okButtonProps={{ danger: true }}
                    >
                        <Button type="link" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ], [pagination, handleOpenEdit, handleDelete]);

    return (
        <Layout>
            <Content style={{ padding: '24px', backgroundColor: '#f0f2f5' }}>
                <Card>
                    <Row justify="space-between" align="middle" gutter={[16, 16]} style={{ marginBottom: 24 }}>
                        <Col xs={24} sm={12}>
                            <Search
                                placeholder="Cari nama atau telepon..."
                                value={searchText}
                                onChange={handleSearchChange}
                                allowClear
                                style={{ width: '100%' }}
                            />
                        </Col>
                        <Col xs={24} sm={12} style={{ textAlign: 'right' }}>
                            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
                                Tambah Pelanggan
                            </Button>
                        </Col>
                    </Row>

                    <Spin spinning={isFiltering || (loadingPelanggan && !deferredPelangganList?.length)}>
                        <Table
                            columns={columns}
                            dataSource={filteredPelanggan}
                            rowKey="id"
                            loading={loadingPelanggan && !deferredPelangganList?.length} 
                            pagination={pagination}
                            onChange={handleTableChange}
                            scroll={{ x: 'max-content' }}
                            rowClassName={(record, index) => (index % 2 === 0 ? 'table-row-even' : 'table-row-odd')}
                        />
                    </Spin>
                </Card>

                {/* Modal Form Create/Edit */}
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
            </Content>
        </Layout>
    );
}