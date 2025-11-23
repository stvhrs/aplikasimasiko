import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Table, Input, Row, Col, Typography, DatePicker, Statistic, Button, Space, Spin, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

// --- FIREBASE IMPORTS ---
import { getDatabase, ref, query, orderByChild, startAt, endAt, get } from "firebase/database";

// Utils
import { timestampFormatter, numberFormatter } from '../../../utils/formatters'; 
import useDebounce from '../../../hooks/useDebounce'; 

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const StokHistoryTab = () => {
    // --- 1. STATE DEFAULT DATE: 1 Bulan Lalu s/d Akhir Bulan Ini ---
    const [dateRange, setDateRange] = useState([
        dayjs().subtract(1, 'month').startOf('month'), 
        dayjs().endOf('month')
    ]);

    // State Data
    const [historyData, setHistoryData] = useState([]);
    const [loading, setLoading] = useState(false); // State loading manual

    // State Filter UI
    const [searchText, setSearchText] = useState('');
    const debouncedSearchText = useDebounce(searchText, 300);
    const [selectedPenerbit, setSelectedPenerbit] = useState(undefined);

    // --- 2. FETCH DATA FUNCTION (Langsung ke Firebase) ---
    const fetchHistoryData = useCallback(async () => {
        if (!dateRange || dateRange.length !== 2) return;

        setLoading(true);
        try {
            // Konversi dayjs ke timestamp ms
            const startTimestamp = dateRange[0].startOf('day').valueOf();
            const endTimestamp = dateRange[1].endOf('day').valueOf();

            const db = getDatabase();
            const historiRef = ref(db, 'historiStok'); 

            // Query: Ambil data di rentang waktu tersebut
            const historiQuery = query(
                historiRef, 
                orderByChild('timestamp'), 
                startAt(startTimestamp), 
                endAt(endTimestamp)
            );

            const snapshot = await get(historiQuery);

            if (snapshot.exists()) {
                const rawData = snapshot.val();
                // Konversi Object ke Array
                const formattedData = Object.keys(rawData).map(key => ({
                    id: key,
                    ...rawData[key]
                }));
                
                // Sort descending (terbaru diatas)
                formattedData.sort((a, b) => b.timestamp - a.timestamp);
                
                setHistoryData(formattedData);
            } else {
                setHistoryData([]);
            }
        } catch (error) {
            console.error("Error fetch history:", error);
            message.error("Gagal memuat riwayat stok");
        } finally {
            setLoading(false);
        }
    }, [dateRange]);

    // Fetch otomatis saat dateRange berubah
    useEffect(() => {
        fetchHistoryData();
    }, [fetchHistoryData]);

    // --- 3. FILTERING CLIENT SIDE (Penerbit & Search Text) ---
    // Note: Filter Tanggal sudah dilakukan di level Database (fetchHistoryData)
    
    // List Penerbit Unik untuk Filter Kolom
    const penerbitList = useMemo(() => {
        const allPenerbit = historyData
            .map(item => item.penerbit)
            .filter(Boolean);
        return [...new Set(allPenerbit)].sort();
    }, [historyData]);

    const filteredHistory = useMemo(() => {
        let data = [...historyData];

        // Filter Penerbit
        if (selectedPenerbit) {
            data = data.filter(item => item.penerbit === selectedPenerbit);
        }

        // Filter Search Text
        if (debouncedSearchText) {
            const lowerSearch = debouncedSearchText.toLowerCase();
            data = data.filter(item =>
                (item.judul || '').toLowerCase().includes(lowerSearch) ||
                (item.kode_buku || '').toLowerCase().includes(lowerSearch) ||
                (item.penerbit || '').toLowerCase().includes(lowerSearch) ||
                (item.keterangan || '').toLowerCase().includes(lowerSearch)
            );
        }
        
        return data;
    }, [historyData, debouncedSearchText, selectedPenerbit]);

    // --- 4. DASHBOARD RINGKASAN ---
    const dashboardData = useMemo(() => {
        return filteredHistory.reduce((acc, item) => {
            // Asumsi field di DB adalah 'perubahan' (angka positif/negatif)
            // Atau jika fieldnya 'qty' dan 'tipe', sesuaikan logika ini
            const perubahan = Number(item.perubahan) || 0; 
            
            if (perubahan > 0) {
                acc.totalMasuk += perubahan;
            } else if (perubahan < 0) {
                acc.totalKeluar += perubahan; 
            }
            return acc;
        }, { totalMasuk: 0, totalKeluar: 0 });
    }, [filteredHistory]);

    // Handler Table Change
    const handleTableChange = (pagination, filters, sorter) => {
        const penerbitFilterValue = filters.penerbit;
        if (penerbitFilterValue && penerbitFilterValue.length > 0) {
            setSelectedPenerbit(penerbitFilterValue[0]);
        } else {
            setSelectedPenerbit(undefined);
        }
    };

    // Handler Reset
    const resetFilters = () => {
        setSearchText('');
        // Kita reset tanggal ke default awal (1 bulan lalu) atau biarkan saja
        setDateRange([dayjs().subtract(1, 'month').startOf('month'), dayjs().endOf('month')]);
        setSelectedPenerbit(undefined);
    };

    // Definisi Kolom
    const historyColumns = [
        {
            title: 'Waktu', dataIndex: 'timestamp', key: 'timestamp',
            render: timestampFormatter,
            width: 150,
            fixed: 'left',
            sorter: (a, b) => (a.timestamp || 0) - (b.timestamp || 0),
        },
        { title: 'Judul Buku', dataIndex: 'judul', key: 'judul', width: 250, fixed: 'left', },
        { title: 'Kode', dataIndex: 'kode_buku', key: 'kode_buku', width: 120 },
        { 
            title: 'Penerbit', 
            dataIndex: 'penerbit', 
            key: 'penerbit', 
            width: 150,
            filters: penerbitList.map(penerbit => ({
                text: penerbit,
                value: penerbit,
            })),
            filteredValue: selectedPenerbit ? [selectedPenerbit] : null,
            filterMultiple: false, 
            sorter: (a, b) => (a.penerbit || '').localeCompare(b.penerbit || ''),
        },
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

    const isFilterActive = debouncedSearchText || selectedPenerbit;

    return (
        <Spin spinning={loading} tip="Memuat data dari server...">
            {/* --- Card Ringkasan --- */}
            <Card style={{ marginBottom: 16 }}>
                <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                    <Col>
                         <Title level={5} style={{ margin: 0 }}>Ringkasan Periode Ini</Title>
                    </Col>
                    <Col>
                         <Button icon={<ReloadOutlined />} onClick={fetchHistoryData} loading={loading}>Refresh Data</Button>
                    </Col>
                </Row>
                
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
                                value={dashboardData.totalKeluar} 
                                valueStyle={{ color: '#f5222d' }}
                                formatter={numberFormatter}
                            />
                        </Card>
                    </Col>
                </Row>
            </Card>

            {/* --- Table Section --- */}
            <Card>
                <Row justify="space-between" align="middle" gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col xs={24} md={8}>
                        <Title level={5} style={{ margin: 0 }}>Riwayat Perubahan Stok</Title>
                    </Col>
                    <Col xs={24} md={16}>
                        <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <RangePicker 
                                value={dateRange}
                                onChange={(dates) => setDateRange(dates)}
                                allowClear={false}
                                format="DD MMM YYYY"
                                style={{ width: 240 }}
                            />
                            
                            <Input.Search
                                placeholder="Cari Judul, Kode..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                allowClear
                                style={{ width: 200 }}
                            />
                             {isFilterActive && (
                                <Button onClick={resetFilters} type="link" danger>
                                    Reset Filter
                                </Button>
                            )}
                        </Space>
                    </Col>
                </Row>
                
                <Table
                    columns={historyColumns}
                    dataSource={filteredHistory}
                    loading={loading} 
                    rowKey="id"
                    size="small"
                    scroll={{ x: 1300, y: 'calc(100vh - 500px)' }}
                    pagination={{ 
                        defaultPageSize: 20, 
                        showSizeChanger: true, 
                        pageSizeOptions: ['20', '50', '100', '200'],
                        showTotal: (total, range) => `${range[0]}-${range[1]} dari ${total} riwayat` 
                    }}
                    rowClassName={() => 'zebra-row'} 
                    onChange={handleTableChange}
                />
            </Card>
        </Spin>
    );
};

export default StokHistoryTab;