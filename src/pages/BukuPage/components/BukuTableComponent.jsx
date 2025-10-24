import React, { memo } from 'react';
import { Table, Space, Tooltip, Button } from 'antd';
import { EditOutlined, HistoryOutlined } from '@ant-design/icons';

// Helper (jika belum diimpor di file ini)
const numberFormatter = (value) =>
    new Intl.NumberFormat('id-ID').format(value || 0);
const currencyFormatter = (value) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);

// Komponen Tabel yang di-memoize
const BukuTableComponent = memo(({
    columns, // Definisi kolom dari parent
    dataSource, // Data yang SUDAH di-filter (hasil debounced search)
    loading, // Loading fetch awal
    isCalculating, // Loading saat filter/sort
    pagination, // State pagination dari parent
    summaryData, // State summary dari parent
    handleTableChange, // Callback onChange dari parent
    tableScrollX, // Kalkulasi scrollX dari parent
    handleEdit, // Callback edit dari parent
    handleTambahStok, // Callback stok dari parent
}) => {

    // Fungsi untuk merender summary (bisa di dalam atau di luar, tapi karena props berubah, ok di sini)
    const renderSummary = () => (
        <Table.Summary.Row style={{ backgroundColor: '#fafafa', fontWeight: 'bold' }}>
            <Table.Summary.Cell index={0} colSpan={2} align="right">
                Total (Data Terfilter):
            </Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="right">
                {numberFormatter(summaryData.totalStok)}
            </Table.Summary.Cell>
            <Table.Summary.Cell index={3} colSpan={4} align="right">
                Total Aset (Data Terfilter):
            </Table.Summary.Cell>
            <Table.Summary.Cell index={7} align="right" colSpan={5}>
                {currencyFormatter(summaryData.totalAsset)}
            </Table.Summary.Cell>
        </Table.Summary.Row>
    );

    // Tambahkan kolom Aksi di sini jika belum ada di definisi `columns` dari parent
    // Atau pastikan `columns` dari parent sudah menyertakan kolom Aksi
    // Contoh menambahkan kolom Aksi di sini (jika diperlukan):
    /*
    const columnsWithActions = useMemo(() => [
        ...columns,
        {
            title: 'Aksi',
            key: 'aksi',
            align: 'center',
            width: 120,
            fixed: 'right', // Opsional: bekukan kolom aksi
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="Edit Detail Buku">
                        <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
                    </Tooltip>
                    <Tooltip title="Tambah/Kurangi Stok">
                        <Button type="link" icon={<HistoryOutlined />} onClick={() => handleTambahStok(record)} />
                    </Tooltip>
                </Space>
            ),
        }
    ], [columns, handleEdit, handleTambahStok]);
    */
    // Jika kolom Aksi sudah ada di `columns` dari parent, gunakan `columns` langsung.

    return (
        <Table
            columns={columns} // Gunakan columns (atau columnsWithActions jika perlu)
            dataSource={dataSource}
            loading={loading || isCalculating}
            rowKey="id"
            size="middle"
            scroll={{ x: tableScrollX }}
            pagination={pagination}
            onChange={handleTableChange}
            style={{ marginTop: 24 }}
            summary={renderSummary}
        />
    );
}); // <-- Dibungkus React.memo

export default BukuTableComponent;