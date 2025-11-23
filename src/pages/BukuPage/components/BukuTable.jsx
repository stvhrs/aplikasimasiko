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
            <Row gutter={[16, 16]} style={{ margin: '16px 0' }}>
                
                {/* 1. Total Judul */}
                <Col xl={6} md={6} sm={12} xs={24}>
                    <Card size="small" bordered={false} style={{ backgroundColor: '#f0f2f5', width: '100%' }}>
                        <Typography.Text strong>Total Judul</Typography.Text>
                        <Title level={4} style={{ margin: 0 }}>
                            {isCalculating ? <Spin size="small" /> : numberFormatter(summaryData?.totalJudul || 0)}
                        </Title>
                    </Card>
                </Col>

                {/* 2. Total Stok */}
                <Col xl={6} md={6} sm={12} xs={24}>
                    <Card size="small" bordered={false} style={{ backgroundColor: '#f0f2f5', width: '100%' }}>
                        <Typography.Text strong>Total Stok</Typography.Text>
                        <Title level={4} style={{ margin: 0 }}>
                            {isCalculating ? <Spin size="small" /> : numberFormatter(summaryData?.totalStok || 0)}
                        </Title>
                    </Card>
                </Col>

                {/* 3. Total Aset (Harga Jual) */}
                <Col xl={6} md={6} sm={12} xs={24}>
                    <Card size="small" bordered={false} style={{ backgroundColor: '#f0f2f5', width: '100%' }}>
                        <Typography.Text strong>Total Aset (Hrg. Jual)</Typography.Text>
                        <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                            {isCalculating ? <Spin size="small" /> : currencyFormatter(summaryData?.totalAsset || 0)}
                        </Title>
                    </Card>
                </Col>

                {/* 4. Total Aset (Net setelah Diskon) */}
                <Col xl={6} md={6} sm={12} xs={24}>
                    <Card size="small" bordered={false} style={{ backgroundColor: '#f0f2f5', width: '100%' }}>
                        <Typography.Text strong>Total Aset (Net)</Typography.Text>
                        <Title level={4} style={{ margin: 0, color: '#52c41a' }}>
                            {isCalculating ? <Spin size="small" /> : currencyFormatter(summaryData?.totalAssetNet || 0)}
                        </Title>
                    </Card>
                </Col>
            </Row>

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