import React, { useState, useMemo, useCallback } from 'react';
import { Card, Table, Input, Row, Col, Typography, DatePicker, Statistic, Button, Space, Spin } from 'antd';
import { timestampFormatter, numberFormatter } from '../../../utils/formatters'; // Impor formatters
import useBukuData from '../../../hooks/useBukuData'; // Impor hook data global
import useDebounce from '../../../hooks/useDebounce'; // Impor hook debounce
import dayjs from 'dayjs';

// --- Import Plugin Dayjs untuk Filter Tanggal ---
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
// --- ---

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const StokHistoryTab = () => {
    const { data: bukuList, loading: bukuLoading } = useBukuData(); 
    
    const [searchText, setSearchText] = useState('');
    const debouncedSearchText = useDebounce(searchText, 300);
    // --- State Baru untuk Filter Tanggal ---
    const [dateRange, setDateRange] = useState(null); 

    const allHistory = useMemo(() => {
        const combinedHistory = [];
        if (!bukuList || bukuList.length === 0) {
            return combinedHistory;
        }

        bukuList.forEach(buku => {
            if (buku.historiStok && typeof buku.historiStok === 'object') {
                Object.keys(buku.historiStok).forEach(key => {
                    combinedHistory.push({
                        id: `${buku.id}-${key}`, 
                        ...buku.historiStok[key],
                        judul: buku.historiStok[key].judul || buku.judul, 
                        kode_buku: buku.historiStok[key].kode_buku || buku.kode_buku,
                    });
                });
            }
        });

        combinedHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        // --- Limit 200 Dihapus ---
        return combinedHistory; 
    }, [bukuList]);

    const filteredHistory = useMemo(() => {
        let filteredData = [...allHistory];

        // --- 1. Filter berdasarkan Tanggal ---
        if (dateRange && dateRange[0] && dateRange[1]) {
            const [startDate, endDate] = dateRange;
            const start = startDate.startOf('day');
            const end = endDate.endOf('day');

            filteredData = filteredData.filter(item => {
                if (!item.timestamp) return false;
                const itemDate = dayjs(item.timestamp);
                return itemDate.isValid() && itemDate.isSameOrAfter(start) && itemDate.isSameOrBefore(end);
            });
        }

        // --- 2. Filter berdasarkan Teks ---
        if (debouncedSearchText) {
            const lowerSearch = debouncedSearchText.toLowerCase();
            filteredData = filteredData.filter(item =>
                (item.judul || '').toLowerCase().includes(lowerSearch) ||
                (item.kode_buku || '').toLowerCase().includes(lowerSearch) ||
                (item.keterangan || '').toLowerCase().includes(lowerSearch)
            );
        }
        
        return filteredData;
    }, [allHistory, debouncedSearchText, dateRange]);

    // --- FITUR BARU: Dashboard Ringkasan ---
    const dashboardData = useMemo(() => {
        return filteredHistory.reduce((acc, item) => {
            const perubahan = Number(item.perubahan) || 0;
            if (perubahan > 0) {
                acc.totalMasuk += perubahan;
            } else if (perubahan < 0) {
                acc.totalKeluar += perubahan; // (sudah negatif)
            }
            return acc;
        }, { totalMasuk: 0, totalKeluar: 0 });
    }, [filteredHistory]);
    // --- AKHIR FITUR BARU ---


    const historyColumns = [
        {
            title: 'Waktu', dataIndex: 'timestamp', key: 'timestamp',
            render: timestampFormatter,
            width: 150,
            fixed: 'left',
            sorter: (a, b) => (a.timestamp || 0) - (b.timestamp || 0),
            defaultSortOrder: 'descend',
        },
        { title: 'Judul Buku', dataIndex: 'judul', key: 'judul', width: 250, fixed: 'left', },
        { title: 'Kode', dataIndex: 'kode_buku', key: 'kode_buku', width: 120 },
        {
            title: 'Perubahan', dataIndex: 'perubahan', key: 'perubahan',
            align: 'right', width: 100,
            render: (val) => {
                const num = Number(val); 
                const color = num > 0 ? '#52c41a' : (num < 0 ? '#f5222d' : '#8c8c8c');
                const prefix = num > 0 ? '+' : '';
                
                return (
                    <Text strong style={{ color: color }}>
                        {prefix}{numberFormatter(val)} 
                    </Text>
                )
            },
            sorter: (a, b) => (a.perubahan || 0) - (b.perubahan || 0),
        },
        { title: 'Stok Awal', dataIndex: 'stokSebelum', key: 'stokSebelum', align: 'right', width: 100, render: numberFormatter },
        { title: 'Stok Akhir', dataIndex: 'stokSesudah', key: 'stokSesudah', align: 'right', width: 100, render: numberFormatter },
        { title: 'Keterangan', dataIndex: 'keterangan', key: 'keterangan', width: 200 },
    ];

    // Fungsi untuk menentukan class row
    const getRowClassName = (record, index) => {
        return 'zebra-row'; // Terapkan class ini ke semua baris
    };

    // Handler untuk reset filter
    const resetFilters = useCallback(() => {
        setSearchText('');
        setDateRange(null);
    }, []);

    const isFilterActive = debouncedSearchText || dateRange;

    return (
        <Spin spinning={bukuLoading} tip="Memuat data buku...">
            {/* --- FITUR BARU: Card Ringkasan --- */}
            <Card style={{ marginBottom: 16 }}>
                <Title level={5} style={{ margin: 0, marginBottom: 16 }}>Ringkasan Riwayat (Berdasarkan Filter)</Title>
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12}>
                        <Card size="small" style={{ backgroundColor: '#f6ffed', border: '1px solid #b7eb8f' }}>
                            <Statistic
                                title="Total Stok Masuk"
                                value={dashboardData.totalMasuk}
                                valueStyle={{ color: '#52c41a' }}
                                prefix="+"
                                formatter={numberFormatter}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12}>
                        <Card size="small" style={{ backgroundColor: '#fff1f0', border: '1px solid #ffccc7' }}>
                            <Statistic
                                title="Total Stok Keluar"
                                value={dashboardData.totalKeluar} // sudah negatif
                                valueStyle={{ color: '#f5222d' }}
                                formatter={numberFormatter}
                            />
                        </Card>
                    </Col>
                </Row>
            </Card>
            {/* --- AKHIR FITUR BARU --- */}

            <Card>
                <Row justify="space-between" align="middle" gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col xs={24} md={8}>
                        <Title level={5} style={{ margin: 0 }}>Riwayat Perubahan Stok</Title>
                    </Col>
                    <Col xs={24} md={16}>
                        <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
                            {isFilterActive && (
                                <Button onClick={resetFilters} type="link">
                                    Reset Filter
                                </Button>
                            )}
                            <RangePicker 
                                value={dateRange}
                                onChange={setDateRange}
                                style={{ width: 240 }}
                            />
                            <Input.Search
                                placeholder="Cari Judul, Kode, Keterangan..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                allowClear
                                style={{ width: 250 }}
                            />
                        </Space>
                    </Col>
                </Row>
                <Table
                    columns={historyColumns}
                    dataSource={filteredHistory}
                    // Loading hanya tampil saat data buku awal dimuat
                    loading={bukuLoading} 
                    rowKey="id"
                    size="small"
                    scroll={{ x: 1200, y: 'calc(100vh - 500px)' }} // Sesuaikan y jika dashboard ditambahkan
                    pagination={{ 
                        defaultPageSize: 20, 
                        showSizeChanger: true, 
                        pageSizeOptions: ['20', '50', '100', '200'],
                        showTotal: (total, range) => `${range[0]}-${range[1]} dari ${total} riwayat` 
                    }}
                    rowClassName={getRowClassName} 
                />
            </Card>
        </Spin>
    );
};

export default StokHistoryTab;