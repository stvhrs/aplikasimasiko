import React, { useState, useMemo, useCallback } from 'react';
// (UBAH) Hapus 'Select' jika tidak dipakai, tapi kita biarkan untuk filter kolom
import { Card, Table, Input, Row, Col, Typography, DatePicker, Statistic, Button, Space, Spin, Select } from 'antd';
import { timestampFormatter, numberFormatter } from '../../../utils/formatters'; 
// --- (UBAH) Hapus hook lama ---
// import useBukuData from '../../../hooks/useBukuData'; 
// --- (UBAH) Impor hook singleton baru ---
import useSyncStokHistory from '../../../hooks/useSyncStokHistory.js';
import useDebounce from '../../../hooks/useDebounce'; 
import dayjs from 'dayjs';

import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const StokHistoryTab = () => {
    // --- (UBAH) Gunakan hook singleton baru ---
    // 'allHistory' sekarang adalah data stream yang sudah jadi (flat array)
    // 'historyLoading' hanya akan 'true' saat aplikasi pertama kali dimuat
    const { data: allHistory, loading: historyLoading } = useSyncStokHistory();
    
    const [searchText, setSearchText] = useState('');
    const debouncedSearchText = useDebounce(searchText, 300);
    const [dateRange, setDateRange] = useState(null); 
    // --- State baru untuk filter kolom 'Penerbit' ---
    const [selectedPenerbit, setSelectedPenerbit] = useState(undefined);

    // --- (UBAH) Hapus 'allHistory' useMemo ---
    // Logika ini tidak diperlukan lagi karena hook 'useSyncStokHistory'
    // sudah menyediakan 'allHistory' sebagai array yang datar dan terurut.

    // --- (BARU) Daftar penerbit unik untuk filter kolom ---
    const penerbitList = useMemo(() => {
        const allPenerbit = allHistory
            .map(item => item.penerbit)
            .filter(Boolean); // Hapus nilai null/undefined
        return [...new Set(allPenerbit)].sort();
    }, [allHistory]);


    const filteredHistory = useMemo(() => {
        let filteredData = [...allHistory]; // Mulai dari data stream

        // --- 1. Filter Tanggal (Tidak Berubah) ---
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

        // --- (BARU) 2. Filter Penerbit (dari state filter kolom) ---
        if (selectedPenerbit) {
            filteredData = filteredData.filter(item => item.penerbit === selectedPenerbit);
        }

        // --- 3. Filter Teks (Tidak Berubah) ---
        if (debouncedSearchText) {
            const lowerSearch = debouncedSearchText.toLowerCase();
            filteredData = filteredData.filter(item =>
                (item.judul || '').toLowerCase().includes(lowerSearch) ||
                (item.kode_buku || '').toLowerCase().includes(lowerSearch) ||
                (item.penerbit || '').toLowerCase().includes(lowerSearch) ||
                (item.keterangan || '').toLowerCase().includes(lowerSearch)
            );
        }
        
        return filteredData;
    // (UBAH) Tambahkan 'selectedPenerbit' ke dependensi
    }, [allHistory, debouncedSearchText, dateRange, selectedPenerbit]);

    // Dashboard Ringkasan (Tidak Berubah)
    // Akan otomatis update berdasarkan 'filteredHistory'
    const dashboardData = useMemo(() => {
        return filteredHistory.reduce((acc, item) => {
            const perubahan = Number(item.perubahan) || 0;
            if (perubahan > 0) {
                acc.totalMasuk += perubahan;
            } else if (perubahan < 0) {
                acc.totalKeluar += perubahan; 
            }
            return acc;
        }, { totalMasuk: 0, totalKeluar: 0 });
    }, [filteredHistory]);


    // --- (BARU) Handler untuk filter kolom tabel ---
    const handleTableChange = (pagination, filters, sorter) => {
        const penerbitFilterValue = filters.penerbit;

        if (penerbitFilterValue && penerbitFilterValue.length > 0) {
            // Karena filterMultiple: false, kita ambil yg pertama
            setSelectedPenerbit(penerbitFilterValue[0]);
        } else {
            // Jika filter dikosongkan (di-reset)
            setSelectedPenerbit(undefined);
        }
    };

    // --- Definisi Kolom (Diupdate dengan filter penerbit) ---
    const historyColumns = [
        {
            title: 'Waktu', dataIndex: 'timestamp', key: 'timestamp',
            render: timestampFormatter,
            width: 150,
            fixed: 'left',
            sorter: (a, b) => (a.timestamp || 0) - (b.timestamp || 0),
            // Hapus defaultSortOrder, data sudah di-sort dari store
        },
        { title: 'Judul Buku', dataIndex: 'judul', key: 'judul', width: 250, fixed: 'left', },
        { title: 'Kode', dataIndex: 'kode_buku', key: 'kode_buku', width: 120 },
        { 
            title: 'Penerbit', 
            dataIndex: 'penerbit', 
            key: 'penerbit', 
            width: 150,
            // --- (BARU) Tambahkan filter bawaan kolom ---
            filters: penerbitList.map(penerbit => ({
                text: penerbit,
                value: penerbit,
            })),
            // Kontrol nilainya menggunakan state
            filteredValue: selectedPenerbit ? [selectedPenerbit] : null,
            // Paksa hanya bisa 1 pilihan
            filterMultiple: false, 
            // onFilter tidak perlu, filtering ditangani 'filteredHistory'
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

    const getRowClassName = (record, index) => {
        return 'zebra-row'; 
    };

    // Handler reset filter (diupdate)
    const resetFilters = useCallback(() => {
        setSearchText('');
        setDateRange(null);
        setSelectedPenerbit(undefined); // (UBAH) Reset filter penerbit juga
    }, []);

    // (UBAH) Tambahkan 'selectedPenerbit'
    const isFilterActive = debouncedSearchText || dateRange || selectedPenerbit;

    return (
        // --- (UBAH) Ganti 'bukuLoading' menjadi 'historyLoading' ---
        <Spin spinning={historyLoading} tip="Memuat data riwayat...">
            {/* --- Card Ringkasan (Tidak Berubah) --- */}
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
                                value={dashboardData.totalKeluar} 
                                valueStyle={{ color: '#f5222d' }}
                                formatter={numberFormatter}
                            />
                        </Card>
                    </Col>
                </Row>
            </Card>
            {/* --- --- */}

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
                            {/* Filter <Select> penerbit sudah tidak di sini,
                                 tapi terintegrasi di dalam kolom tabel */}
                            <Input.Search
                                placeholder="Cari Judul, Kode, Penerbit..."
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
                    // --- (UBAH) Gunakan 'historyLoading' ---
                    loading={historyLoading} 
                    rowKey="id"
                    size="small"
                    scroll={{ x: 1350, y: 'calc(100vh - 500px)' }}
                    pagination={{ 
                        defaultPageSize: 20, 
                        showSizeChanger: true, 
                        pageSizeOptions: ['20', '50', '100', '200'],
                        showTotal: (total, range) => `${range[0]}-${range[1]} dari ${total} riwayat` 
                    }}
                    rowClassName={getRowClassName} 
                    // --- (BARU) Hubungkan handler perubahan tabel ---
                    onChange={handleTableChange}
                />
            </Card>
        </Spin>
    );
};

export default StokHistoryTab;

