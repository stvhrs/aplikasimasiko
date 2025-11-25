import React, { memo } from 'react';
import { Card, Table, Typography, Row, Col, Spin } from 'antd';
// Pastikan path ini sesuai dengan struktur folder Anda
import { numberFormatter, currencyFormatter } from '../../../utils/formatters'; 

const { Title } = Typography;

const BukuTableComponent = ({
    columns,
    dataSource,
    loading,
    isCalculating,
    pagination,
    summaryData,
    handleTableChange,
    tableScrollX
}) => {
    
    // Fungsi untuk styling baris selang-seling (Zebra Striping)
    // Pastikan Anda punya CSS .zebra-row di file CSS global/module Anda
    const getRowClassName = (record, index) => {
        return index % 2 === 1 ? 'zebra-row' : '';
    };

    return (
        <>
            {/* --- BAGIAN RINGKASAN DATA (4 KOLOM) --- */}
          

            {/* --- TABEL UTAMA --- */}
            <Table
                columns={columns}
                dataSource={dataSource}
                loading={loading}
                rowKey="id" // Pastikan 'id' atau unique key lain ada di data Anda
                pagination={pagination}
                onChange={handleTableChange}
                // Hapus properti 'y' agar scroll vertikal ditangani browser (lebih ringan)
                scroll={{ x: tableScrollX }} 
                size="small"
                rowClassName={getRowClassName}
            />
        </>
    );
};

// PENTING: Gunakan memo agar tabel tidak render ulang saat Modal Stok dibuka
export default memo(BukuTableComponent);