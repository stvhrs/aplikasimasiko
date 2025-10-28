// src/pages/pelanggan/PelangganPage.jsx
import React, { useState, useMemo, useCallback, useDeferredValue } from 'react';
import {
    Layout, Card, Table, Button, Input, Space, Typography, Popconfirm, message, Spin, Checkbox, Tag // Tambah Checkbox, Tag
,Row,Col} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { ref, remove } from 'firebase/database';
import { db } from '../../api/firebase'; // Sesuaikan path

// --- (PENTING) Impor Hook Singleton Pelanggan ---
// Pastikan hook ini sudah dipisah ke file terpusat, misal:
import { usePelangganData } from './useplanggandata'; // Sesuaikan path jika berbeda
// ---------------------------------------------

import useDebounce from '../../hooks/useDebounce'; // Sesuaikan path
import PelangganForm from './components/PelangganForm'; // Sesuaikan path

const { Content } = Layout;
const { Title } = Typography;
const { Search } = Input;

export default function PelangganPage() {
    // --- Gunakan Hook Singleton ---
    const { pelangganList, loadingPelanggan } = usePelangganData();
    // ----------------------------

    const [searchText, setSearchText] = useState('');
    const debouncedSearchText = useDebounce(searchText, 300);
    const deferredSearch = useDeferredValue(debouncedSearchText);
    const deferredPelangganList = useDeferredValue(pelangganList);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPelanggan, setEditingPelanggan] = useState(null); // null for create, object for edit

    const [pagination, setPagination] = useState({
        current: 1, pageSize: 25, showSizeChanger: true,        pageSizeOptions: ['25', '50', '100', '200'],

        showTotal: (total, range) => `${range[0]}-${range[1]} dari ${total} pelanggan`
    });

    const isFiltering = pelangganList !== deferredPelangganList || debouncedSearchText !== deferredSearch;

    const filteredPelanggan = useMemo(() => {
        let data = deferredPelangganList;
        if (deferredSearch) {
            const query = deferredSearch.toLowerCase();
            data = data.filter(p =>
                p.nama?.toLowerCase().includes(query) ||
                p.telepon?.includes(query) // Cari telepon tanpa case-insensitive
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
        handleCloseModal(); // Tutup modal setelah sukses
        // Data akan update otomatis via listener global
    }, [handleCloseModal]);


    const handleDelete = useCallback(async (idPelanggan) => {
        if (!idPelanggan) return;
        message.loading({ content: 'Menghapus pelanggan...', key: 'del_pel' });
        try {
            await remove(ref(db, `pelanggan/${idPelanggan}`));
            message.success({ content: 'Pelanggan berhasil dihapus', key: 'del_pel' });
            // Data list akan update otomatis via listener global
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
            sorter: (a, b) => a.nama.localeCompare(b.nama),
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
            // Filter sederhana
             filters: [ { text: 'Spesial', value: true }, { text: 'Biasa', value: false } ],
             onFilter: (value, record) => !!record.isSpesial === value,
        },
        // Tambahkan kolom lain jika perlu (Alamat, dll)
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
    ], [pagination, handleOpenEdit, handleDelete]); // Tambahkan dependensi

    return (
        <Layout>
            <Content style={{ padding: '24px', backgroundColor: '#f0f2f5' }}>
                <Title level={3} style={{ marginBottom: 24 }}>Manajemen Pelanggan</Title>
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

                    <Spin spinning={isFiltering || loadingPelanggan}>
                        <Table
                            columns={columns}
                            dataSource={filteredPelanggan}
                            rowKey="id"
                            loading={loadingPelanggan && !deferredPelangganList.length} // Loading awal saja
                            pagination={pagination}
                            onChange={handleTableChange}
                            scroll={{ x: 'max-content' }}
                            rowClassName={(record, index) => (index % 2 === 0 ? 'table-row-even' : 'table-row-odd')} // Zebra stripes
                        />
                    </Spin>
                </Card>

                {/* Modal Form Create/Edit */}
                {/* Render kondisional untuk memastikan state form fresh */}
                 {isModalOpen && (
                    <PelangganForm
                         key={editingPelanggan?.id || 'create'} // Penting untuk reset/prefill
                         open={isModalOpen}
                         onCancel={handleCloseModal}
                         onSuccess={handleFormSuccess}
                         initialData={editingPelanggan}
                         pelangganList={pelangganList} // Kirim list untuk cek duplikat
                    />
                 )}
            </Content>
        </Layout>
    );
}