import React from 'react';
import { Card, Space, Typography, Row, Col, DatePicker, Input, Tag, Button } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { TipeTransaksi, KategoriPemasukan, KategoriPengeluaran } from '../../../constants';
import KategoriChips from './KategoriChips';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const chipStyle = { border: '1px solid #d9d9d9', padding: '4px 10px', borderRadius: '16px', minWidth: '130px', textAlign: 'center' };

const FilterCard = ({ filters, onFilterChange, onMultiSelectFilter, onReset, isFilterActive }) => {
    return (
        <Card style={{ height: '100%' }}>
            <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>Filter Transaksi</Title>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12}>
                        <RangePicker
                            style={{ width: '100%' }}
                            onChange={(dates) => onFilterChange('dateRange', dates)}
                            value={filters.dateRange}
                            placeholder={['Tanggal Mulai', 'Tanggal Selesai']}
                        />
                    </Col>
                    <Col xs={24} sm={12}>
                        <Input.Search
                            placeholder="Cari berdasarkan keterangan..."
                            value={filters.searchText}
                            onChange={(e) => onFilterChange('searchText', e.target.value)}
                            allowClear
                            style={{ width: '100%' }}
                        />
                    </Col>
                </Row>
                <div>
                    <Text strong>Tipe Transaksi:</Text>
                    <div style={{ marginTop: 8 }}>
                        <Space wrap>
                            <Tag.CheckableTag
                                style={chipStyle}
                                checked={filters.selectedTipe.includes(TipeTransaksi.pemasukan)}
                                onChange={() => onMultiSelectFilter('selectedTipe', TipeTransaksi.pemasukan)}
                            >
                                Pemasukan
                            </Tag.CheckableTag>
                            <Tag.CheckableTag
                                style={chipStyle}
                                checked={filters.selectedTipe.includes(TipeTransaksi.pengeluaran)}
                                onChange={() => onMultiSelectFilter('selectedTipe', TipeTransaksi.pengeluaran)}
                            >
                                Pengeluaran
                            </Tag.CheckableTag>
                        </Space>
                    </div>
                </div>
                {(filters.selectedTipe.length === 0 || filters.selectedTipe.includes(TipeTransaksi.pemasukan)) && (
                    <div>
                        <Text strong>Kategori Pemasukan:</Text>
                        <div style={{ marginTop: 8 }}>
                            <KategoriChips
                                kategoriMap={KategoriPemasukan}
                                onSelect={onMultiSelectFilter}
                                selectedKategori={filters.selectedKategori}
                            />
                        </div>
                    </div>
                )}
                {(filters.selectedTipe.length === 0 || filters.selectedTipe.includes(TipeTransaksi.pengeluaran)) && (
                    <div>
                        <Text strong>Kategori Pengeluaran:</Text>
                        <div style={{ marginTop: 8 }}>
                            <KategoriChips
                                kategoriMap={KategoriPengeluaran}
                                onSelect={onMultiSelectFilter}
                                selectedKategori={filters.selectedKategori}
                            />
                        </div>
                    </div>
                )}
                {isFilterActive && (
                    <Button icon={<SyncOutlined />} onClick={onReset} style={{ width: 'fit-content' }}>
                        Reset Filter
                    </Button>
                )}
            </Space>
        </Card>
    );
};

export default FilterCard;
