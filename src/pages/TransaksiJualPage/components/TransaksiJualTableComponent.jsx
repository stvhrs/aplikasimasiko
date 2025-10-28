// ================================
// FILE: src/pages/transaksi-jual/components/TransaksiJualTableComponent.jsx
// Komponen Tabel Terpisah & Memoized
// ================================

import React, { memo } from 'react';
import { Table, Spin, Empty } from 'antd';

const TransaksiJualTableComponent = memo(({
    columns,
    dataSource,
    loading, // Loading fetch awal
    isFiltering, // Loading filter/search/page
    pagination,
    handleTableChange,
    tableScrollX
}) => {
    return (
        <Table
            loading={loading || isFiltering} // Kombinasikan loading
            dataSource={dataSource}
            columns={columns}
            rowKey="id"
            pagination={{
                ...pagination,
                total: dataSource.length, // Total harus berdasarkan data yang difilter
                showTotal: (total, range) => `${range[0]}-${range[1]} dari ${total} transaksi`,
                showSizeChanger: true,
                      pageSizeOptions: ['25', '50', '100', '200'],

            }}
            onChange={handleTableChange} // Handler untuk pagination & sort
            locale={{ emptyText: loading ? <Spin /> : <Empty description="Belum ada data transaksi" /> }}
            scroll={{ x: tableScrollX || 'max-content' }} // Gunakan scrollX dari props
            style={{ marginTop: 24 }}
            size="middle"
        />
    );
});

export default TransaksiJualTableComponent;