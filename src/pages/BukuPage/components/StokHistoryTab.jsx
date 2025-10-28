import React, { useState, useMemo, useCallback } from 'react';
// --- UBAH: Impor Select sudah ada, tidak perlu diubah ---
import { Card, Table, Input, Row, Col, Typography, DatePicker, Statistic, Button, Space, Spin, Select } from 'antd';
import { timestampFormatter, numberFormatter } from '../../../utils/formatters'; 
import useBukuData from '../../../hooks/useBukuData'; 
import useDebounce from '../../../hooks/useDebounce'; 
import dayjs from 'dayjs';

import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
// const { Option } = Select; // Tidak dihapus, mungkin berguna di masa depan

const StokHistoryTab = () => {
    const { data: bukuList, loading: bukuLoading } = useBukuData(); 
    
    const [searchText, setSearchText] = useState('');
    const debouncedSearchText = useDebounce(searchText, 300);
    const [dateRange, setDateRange] = useState(null); 
    // State ini tetap kita gunakan untuk mengontrol filter
    const [selectedPenerbit, setSelectedPenerbit] = useState(undefined);

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
                        penerbit: buku.historiStok[key].penerbit || buku.penerbit, 
                    });
                });
            }
        });

        combinedHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        return combinedHistory; 
    }, [bukuList]);

    // Daftar penerbit unik (Tidak berubah, masih diperlukan untuk list filter)
    const penerbitList = useMemo(() => {
        const allPenerbit = allHistory
            .map(item => item.penerbit)
            .filter(Boolean); 
        return [...new Set(allPenerbit)].sort();
    }, [allHistory]);


    const filteredHistory = useMemo(() => {
        let filteredData = [...allHistory];

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

        // --- 2. Filter Penerbit (Tidak Berubah) ---
        // Logika ini tetap diperlukan agar filteredHistory
        // akurat untuk perhitungan dashboardData.
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
    // Dependency 'selectedPenerbit' tetap ada
    }, [allHistory, debouncedSearchText, dateRange, selectedPenerbit]);

    // Dashboard Ringkasan (Tidak Berubah)
    // Ini akan tetap akurat karena 'filteredHistory' masih
    // memperhitungkan 'selectedPenerbit'
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


    // --- TAMBAHAN: Handler untuk perubahan Tabel (Filter, Sort, Paging) ---
    const handleTableChange = (pagination, filters, sorter) => {
        // Cek apakah ada filter 'penerbit' yang diterapkan
        const penerbitFilterValue = filters.penerbit;

        if (penerbitFilterValue && penerbitFilterValue.length > 0) {
            // Karena filterMultiple: false, kita ambil yg pertama
            setSelectedPenerbit(penerbitFilterValue[0]);
        } else {
            // Jika filter dikosongkan (di-reset)
            setSelectedPenerbit(undefined);
        }
    };
    // --- AKHIR TAMBAHAN ---


    const historyColumns = [
        {
            title: 'Waktu', dataIndex: 'timestamp', key: 'timestamp',
            render: timestampFormatter,
            width: 150,
            fixed: 'left',
            sorter: (a, b) => (a.timestamp || 0) - (b.timestamp || 0),
            defaultSortOrder: 'descend',
        },
        { title: 'Kode', dataIndex: 'kode_buku', key: 'kode_buku', width: 120 },

        { title: 'Judul Buku', dataIndex: 'judul', key: 'judul', width: 250, fixed: 'left', },
        { 
            title: 'Penerbit', 
            dataIndex: 'penerbit', 
            key: 'penerbit', 
            width: 150,
            // --- UBAH: Tambahkan filter bawaan kolom ---
            filters: penerbitList.map(penerbit => ({
                text: penerbit,
                value: penerbit,
            })),
            // Kontrol nilainya menggunakan state kita
            filteredValue: selectedPenerbit ? [selectedPenerbit] : null,
            // Paksa hanya bisa 1 pilihan (bukan multi-select)
            filterMultiple: false, 
            // 'onFilter' tidak perlu, karena filtering sudah ditangani
            // oleh 'filteredHistory' di atas (agar dashboard sinkron)
            sorter: (a, b) => (a.penerbit || '').localeCompare(b.penerbit || ''),
            // --- AKHIR UBAHAN ---
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

    // resetFilters tidak berubah, masih berfungsi
    const resetFilters = useCallback(() => {
        setSearchText('');
        setDateRange(null);
        setSelectedPenerbit(undefined);
    }, []);

    // isFilterActive tidak berubah, masih berfungsi
    const isFilterActive = debouncedSearchText || dateRange || selectedPenerbit;

    return (
        <Spin spinning={bukuLoading} tip="Memuat data buku...">
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
                            
                            {/* --- UBAH: Hapus <Select> Filter Penerbit dari sini --- */}
                            
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
                    loading={bukuLoading} 
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
                    
                    // --- TAMBAHAN: Hubungkan handler perubahan tabel ---
                    onChange={handleTableChange}
                />
            </Card>
        </Spin>
    );
};

export default StokHistoryTab;