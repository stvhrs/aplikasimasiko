import React from "react";
// Impor 'Empty' ditambahkan di sini
import { Card, Typography, Table, Tag, Spin, Empty } from "antd";
import { usePelangganData } from "./useplanggandata"; // Pastikan path ini benar

const { Title } = Typography;

const PelangganPage = () => {
  
  const { data, loading } = usePelangganData();

  const columns = [
    { title: "ID", dataIndex: "id", key: "id" },
    { title: "Nama", dataIndex: "nama", key: "nama" },
    { title: "Telepon", dataIndex: "telepon", key: "telepon" },
    { title: "Slug Nama", dataIndex: "slugNama", key: "slugNama" },
    { title: "Created", dataIndex: "createdAt", key: "createdAt" },
    { title: "Updated", dataIndex: "updatedAt", key: "updatedAt" },
    {
      title: "Spesial",
      dataIndex: "isSpesial",
      key: "isSpesial",
      render: (v) =>
        v ? <Tag color="green">Ya</Tag> : <Tag color="default">Tidak</Tag>,
    },
  ];

  return (
    <Card style={{ margin: 20 }}>
      <Title level={3}>Daftar Pelanggan (Live, Cache, Tanpa Fetch Ulang)</Title>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
        </div>
      ) : data.length === 0 ? (
        <Empty description="Belum ada pelanggan" />
      ) : (
        <Table
          rowKey="id"
          dataSource={data}
          columns={columns}
          pagination={false}
        />
      )}
    </Card>
  );
};

export default PelangganPage;