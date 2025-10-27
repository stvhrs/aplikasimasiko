import React, { memo } from 'react';
import { Table, Spin, Space, Tooltip, Button } from 'antd'; // Import komponen yg dibutuhkan saja
import { EyeOutlined, EditOutlined } from '@ant-design/icons'; // Import ikon

// Komponen Tabel yang di-memoize
// Menerima semua data dan callback yang diperlukan sebagai props
const MutasiTableComponent = memo(({
    columns,
    dataSource, // Data sudah difilter oleh parent
    loading,    // Loading fetch awal
    isFiltering,// Loading saat filter/search
    pagination,
    handleTableChange, // Callback onChange tabel
    // handleViewProof, // Callback ini ada di dalam columns
    // handleEdit,      // Callback ini ada di dalam columns
    // screens          // Tidak perlu screens di sini jika columns sudah diatur di parent
}) => {
 // Fungsi untuk menentukan class row (zebra striping)
    const getRowClassName = (record, index) => {
        return 'zebra-row';
    };
    return (
        <Table   rowClassName={getRowClassName}
            columns={columns}
            dataSource={dataSource}
            loading={loading || isFiltering} // Kombinasikan loading
            rowKey="id"
            size="middle"
            scroll={{ x: 'max-content' }}
            pagination={{ ...pagination, showSizeChanger: true, showTotal: (total, range) => `${range[0]}-${range[1]} dari ${total} transaksi` }}
            onChange={handleTableChange} // Teruskan handler
        />
    );
});

export default MutasiTableComponent;