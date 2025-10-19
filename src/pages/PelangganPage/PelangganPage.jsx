// ================================
// FILE: src/pages/pelanggan/PelangganPage.jsx
// RTDB + Ant Design v5 (Form dipisah ke komponen PelangganForm)
// ================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  Layout, Card, Table, Input, Row, Col, Tag, Button,
  Typography, Spin, Empty, Segmented, Popconfirm, Space, FloatButton, App
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

import { ref, onValue, remove } from 'firebase/database';
import { db } from '../../api/firebase'; // instance Database asli
import PelangganForm from './components/PelangganForm'; // <-- modal form dipisah

const { Content } = Layout;
const { Title, Text } = Typography;
const { Search } = Input;

// helper konversi snapshot → array
const snapshotToArray = (snapshot) => {
  const data = snapshot.val();
  return data ? Object.keys(data).map((key) => ({ id: key, ...data[key] })) : [];
};

export default function PelangganPage() {
  const { message } = App.useApp?.() ?? { message: { success: console.log, error: console.error } };

  // data & ui state
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filterSpesial, setFilterSpesial] = useState('SEMUA'); // SEMUA | SPESIAL | BIASA
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, showSizeChanger: true });

  // modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPelanggan, setSelectedPelanggan] = useState(null); // null = create, object = edit

  // stream data pelanggan
  useEffect(() => {
    setLoading(true);
    const pelangganRef = ref(db, 'pelanggan');
    const off = onValue(
      pelangganRef,
      (snap) => {
        const arr = snapshotToArray(snap).sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
        setAll(arr);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        message.error('Gagal memuat data pelanggan');
        setLoading(false);
      }
    );
    return () => off();
  }, [message]);

  // filter + search
  const dataFiltered = useMemo(() => {
    let data = all;

    if (filterSpesial === 'SPESIAL') data = data.filter((p) => !!p.isSpesial);
    if (filterSpesial === 'BIASA') data = data.filter((p) => !p.isSpesial);

    const q = (searchText || '').toLowerCase();
    if (q) data = data.filter((p) => (p.nama || '').toLowerCase().includes(q));

    return data;
  }, [all, filterSpesial, searchText]);

  // open modals
  const openCreate = () => {
    setSelectedPelanggan(null); // create mode
    setIsModalOpen(true);
  };

  const openEdit = (row) => {
    setSelectedPelanggan(row); // edit mode
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPelanggan(null);
  };

  // delete
  const onDelete = async (row) => {
    try {
      await remove(ref(db, `pelanggan/${row.id}`));
      message.success('Pelanggan dihapus');
    } catch (e) {
      console.error(e);
      message.error('Gagal menghapus pelanggan');
    }
  };

  const columns = [
    {
      title: 'No.',
      key: 'no',
      width: 70,
      align: 'center',
      render: (_t, _r, idx) => (pagination.current - 1) * pagination.pageSize + idx + 1,
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 220,
      render: (id) => <Text type="secondary">{id}</Text>,
      ellipsis: true,
    },
    {
      title: 'Nama',
      dataIndex: 'nama',
      key: 'nama',
      sorter: (a, b) => (a.nama || '').localeCompare(b.nama || ''),
      width: 260,
    },
    {
      title: 'Telepon',
      dataIndex: 'telepon',
      key: 'telepon',
      width: 160,
      render: (v) => v || '-',
    },
    {
      title: 'Spesial',
      dataIndex: 'isSpesial',
      key: 'isSpesial',
      width: 120,
      render: (val) => (val ? <Tag color="gold">Spesial</Tag> : <Tag>Biasa</Tag>),
      sorter: (a, b) => Number(!!a.isSpesial) - Number(!!b.isSpesial),
    },
    {
      title: 'Aksi',
      key: 'aksi',
      width: 190,
      render: (_, row) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Popconfirm
            title={`Hapus pelanggan "${row.nama}"?`}
            okText="Hapus"
            okButtonProps={{ danger: true }}
            onConfirm={() => onDelete(row)}
          >
            <Button danger icon={<DeleteOutlined />}>
              Hapus
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Content style={{ padding: 24 }}>
      {/* Floating add */}
      <FloatButton
        icon={<PlusOutlined />}
        type="primary"
        tooltip="Tambah Pelanggan"
        onClick={openCreate}
      />

      <Card>
        {/* Judul */}
        <Title level={4} style={{ margin: 0 }}>
          Data Pelanggan
        </Title>

        {/* Filter & Search di BAWAH judul */}
        <Row gutter={12} align="middle" style={{ marginTop: 12, marginBottom: 16 }}>
          <Col>
            <Segmented
              value={filterSpesial}
              onChange={(v) => setFilterSpesial(v)}
              options={[
                { label: 'Semua', value: 'SEMUA' },
                { label: 'Spesial', value: 'SPESIAL' },
                { label: 'Biasa', value: 'BIASA' },
              ]}
            />
          </Col>
          <Col flex="auto">
            <Search
              placeholder="Cari nama pelanggan…"
              allowClear
              onChange={(e) => setSearchText(e.target.value)}
              style={{ maxWidth: 360 }}
            />
          </Col>
        </Row>

        <Table
          loading={loading}
          dataSource={dataFiltered}
          columns={columns}
          rowKey="id"
          pagination={{
            ...pagination,
            total: dataFiltered.length,
            showSizeChanger: true,
            pageSizeOptions: ['5', '10', '20', '50'],
            showTotal: (total, range) => `${range[0]}-${range[1]} dari ${total} pelanggan`,
          }}
          onChange={(pag) => setPagination(pag)}
          scroll={{ x: 950 }}
          locale={{ emptyText: loading ? <Spin /> : <Empty description="Belum ada data pelanggan" /> }}
        />
      </Card>

      {/* Modal Create/Edit: dipisah ke PelangganForm */}
      <PelangganForm
        open={isModalOpen}
        onCancel={closeModal}
        initialValues={selectedPelanggan} // null = create, object = edit
      />
    </Content>
  );
}
