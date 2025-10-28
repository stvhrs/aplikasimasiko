import React from 'react';
import { Card, Table, Typography, Row, Col, Spin } from 'antd';
import { numberFormatter, currencyFormatter } from '../../../utils/formatters'; // Sesuaikan path

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
    // Fungsi untuk menentukan class row (zebra striping)
    const getRowClassName = (record, index) => {
        return 'zebra-row';
    };

    return (
        <>
            {/* Row Summary */}
            {/* --- UBAH: Layout diubah untuk 4 kolom --- */}
            <Row gutter={[16, 16]} style={{ margin: '16px 0' }}>

                {/* --- TAMBAHAN BARU: Total Judul --- */}
                <Col xl={6} md={6} sm={12} xs={24}>
                    <Card size="small" bordered={false} style={{ backgroundColor: '#f0f2f5', width: '100%' }}>
                        <Typography.Text strong>Total Judul</Typography.Text>
                        <Title level={4} style={{ margin: 0 }}>
                            {isCalculating ? <Spin size="small" /> : numberFormatter(summaryData.totalJudul)}
                        </Title>
                    </Card>
                </Col>
                {/* --- AKHIR TAMBAHAN --- */}

                {/* --- UBAH: Span diubah dari 8 menjadi 6 --- */}
                <Col xl={6} md={6} sm={12} xs={24}>
                    <Card size="small" bordered={false} style={{ backgroundColor: '#f0f2f5', width: '100%' }}>
                        <Typography.Text strong>Total Stok</Typography.Text>
                        <Title level={4} style={{ margin: 0 }}>
                            {isCalculating ? <Spin size="small" /> : numberFormatter(summaryData.totalStok)}
                        </Title>
                    </Card>
                </Col>
                
                {/* --- UBAH: Span diubah dari 8 menjadi 6 --- */}
                <Col xl={6} md={6} sm={12} xs={24}>
                     <Card size="small" bordered={false} style={{ backgroundColor: '#f0f2f5', width: '100%' }}>
                        <Typography.Text strong>Total Aset (Hrg. Jual)</Typography.Text>
                        <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                            {isCalculating ? <Spin size="small" /> : currencyFormatter(summaryData.totalAsset)}
                        </Title>
                    </Card>
                </Col>
                
                {/* --- UBAH: Span diubah dari 8 menjadi 6 --- */}
                <Col xl={6} md={6} sm={12} xs={24}>
                     <Card size="small" bordered={false} style={{ backgroundColor: '#f0f2f5', width: '100%' }}>
                        <Typography.Text strong>Total Aset (Net)</Typography.Text>
                        <Title level={4} style={{ margin: 0, color: '#52c41a' }}>
                            {isCalculating ? <Spin size="small" /> : currencyFormatter(summaryData.totalAssetNet)}
                        </Title>
                    </Card>
                </Col>
            </Row>

            <Table
                columns={columns}
                dataSource={dataSource}
                loading={loading}
                rowKey="id"
                pagination={pagination}
                onChange={handleTableChange}
                // --- PERUBAHAN SCROLL ---
                // Hapus properti 'y' untuk menghilangkan scroll vertikal internal
                scroll={{ x: tableScrollX }}
                // --- AKHIR PERUBAHAN ---
                size="small"
                
                rowClassName={getRowClassName}
            />
        </>
    );
};

export default BukuTableComponent;