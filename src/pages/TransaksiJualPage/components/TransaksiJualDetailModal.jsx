// ================================
// FILE: TransaksiJualDetailModal.jsx
// PERUBAHAN:
// 1. Modal dibuat FULLSCREEN (width="100vw", style, bodyStyle) agar responsive.
// 2. <Descriptions> dibuat responsive (column={{ xs: 1, sm: 2, ... }}).
// 3. <Table> "Daftar Item Buku":
//    - Kolom "Harga Satuan" & "Diskon" disembunyikan di mobile (responsive: ['sm']).
//    - Ditambahkan `scroll={{ x: 'max-content' }}` sebagai pengaman.
// ================================

import React, { useState, useEffect } from 'react';
import { Modal, Descriptions, Table, Typography, Tag, Timeline, Empty, Button } from 'antd'; // <-- Import Button

const { Title, Text } = Typography;

// --- Helper untuk Format ---
const formatCurrency = (value) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(value || 0);

const formatDate = (timestamp) =>
    new Date(timestamp || 0).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });

const formatTimestamp = (timestamp) => {
    if (!timestamp) return '...';
    return new Date(timestamp).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};
// -------------------------

// --- Kolom untuk tabel item buku (DIUBAH AGAR RESPONSIVE) ---
const itemColumns = [
    {
        title: 'Judul Buku',
        dataIndex: 'judulBuku',
        key: 'judulBuku',
        // 'fixed: 'left'' bisa ditambahkan jika tabel sangat lebar
        // fixed: 'left', 
    },
    {
        title: 'Qty',
        dataIndex: 'jumlah',
        key: 'jumlah',
        align: 'center',
        width: 60, // Beri lebar tetap agar rapi
    },
    {
        title: 'Harga Satuan',
        dataIndex: 'hargaSatuan',
        key: 'hargaSatuan',
        align: 'right',
        render: (val) => formatCurrency(val),
        responsive: ['sm'], // <-- HANYA TAMPIL di layar 'sm' (tablet) ke atas
    },
    {
        title: 'Diskon',
        dataIndex: 'diskonPersen',
        key: 'diskonPersen',
        align: 'center',
        render: (val) => `${val || 0}%`,
        width: 80, // Beri lebar tetap
        responsive: ['sm'], // <-- HANYA TAMPIL di layar 'sm' (tablet) ke atas
    },
    {
        title: 'Subtotal',
        key: 'subtotal',
        align: 'right',
        // fixed: 'right', // Bisa ditambahkan jika tabel sangat lebar
        render: (text, record) => {
            const { jumlah = 0, hargaSatuan = 0, diskonPersen = 0 } = record;
            const subtotal = jumlah * (hargaSatuan * (1 - diskonPersen / 100));
            return (
                <Text strong>{formatCurrency(subtotal)}</Text>
            );
        }
    }
];
// -----------------------------------------------------------

const TransaksiJualDetailModal = ({ open, onCancel, transaksi }) => {
    const [historiArray, setHistoriArray] = useState([]);

    useEffect(() => {
        if (open && transaksi && transaksi.riwayatPembayaran) {
            // Cek jika riwayatPembayaran adalah Object, ubah jadi Array
            const rawRiwayat = typeof transaksi.riwayatPembayaran.forEach === 'function' 
                ? transaksi.riwayatPembayaran // Sudah array
                : Object.values(transaksi.riwayatPembayaran); // Masih object

            const arr = rawRiwayat.sort((a, b) => (b.tanggal || 0) - (a.tanggal || 0)); // Urutkan terbaru di atas
            setHistoriArray(arr);
        } else {
            setHistoriArray([]);
        }
    }, [open, transaksi]);
    
    if (!transaksi) return null;

    const {
        nomorInvoice,
        tanggal,
        namaPelanggan,
        statusPembayaran,
        totalTagihan,
        jumlahTerbayar,
        items
    } = transaksi;

    const sisaTagihan = (totalTagihan || 0) - (jumlahTerbayar || 0);

    const getStatusColor = (status) => {
        if (status === 'Lunas') return 'green';
        if (status === 'Belum Bayar') return 'red';
        if (status === 'Sebagian' || status === 'DP') return 'orange';
        return 'default';
    };

    return (
        <Modal
            open={open}
            onCancel={onCancel}
            title={`Detail Transaksi: ${nomorInvoice || ''}`}
            
            // --- PERUBAHAN 1: Modal Fullscreen ---
            width="100vw"
            style={{ top: 0, padding: 0, margin: 0, maxWidth: '100vw' }}
            // Body dibuat scrollable
            bodyStyle={{ padding: '24px', height: 'calc(100vh - 55px - 53px)', overflowY: 'auto' }}
            
            footer={[
                // Ganti <button> biasa menjadi <Button> Ant Design
                <Button key="close" type="primary" onClick={onCancel}>
                    Tutup
                </Button>
            ]}
        >
            {/* --- PERUBAHAN 2: Descriptions Responsive --- */}
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} style={{ marginBottom: 16 }}>
                <Descriptions.Item label="Pelanggan">{namaPelanggan}</Descriptions.Item>
                <Descriptions.Item label="Tanggal">{formatDate(tanggal)}</Descriptions.Item>
                <Descriptions.Item label="Status Bayar" span={2}>
                    <Tag color={getStatusColor(statusPembayaran)}>{statusPembayaran}</Tag>
                </Descriptions.Item>
            </Descriptions>

            <Descriptions bordered size="small" column={{ xs: 1, sm: 3 }} style={{ marginBottom: 24 }}>
                <Descriptions.Item label="Total Tagihan">
                    <Text strong style={{ fontSize: 16 }}>{formatCurrency(totalTagihan)}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Total Terbayar">
                    <Text strong style={{ fontSize: 16, color: '#3f8600' }}>{formatCurrency(jumlahTerbayar)}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Sisa Tagihan">
                    <Text strong style={{ fontSize: 16, color: sisaTagihan > 0 ? '#cf1322' : '#3f8600' }}>
                        {formatCurrency(sisaTagihan)}
                    </Text>
                </Descriptions.Item>
            </Descriptions>
            
            {/* --- BLOK RIWAYAT PEMBAYARAN (Layout sudah OK) --- */}
            <Title level={5} style={{ marginTop: 24, marginBottom: 16 }}>
                Riwayat Pembayaran
            </Title>
            <div 
                style={{ 
                    maxHeight: 200, 
                    overflowY: 'auto', 
                    border: '1px solid #f0f0f0', 
                    padding: '16px', 
                    borderRadius: 8,
                    marginBottom: 24 
                }}
            >
                {historiArray.length > 0 ? (
                    <Timeline>
                        {historiArray.map((item, index) => (
                            <Timeline.Item key={index} color="green">
                                <Text strong style={{ fontSize: 16, color: '#3f8600' }}>
                                    {formatCurrency(item.jumlah)} 
                                </Text>
                                <div>
                                    <Text type="secondary">
                                        {item.keterangan || item.metode || (item.mutasiId ? `Ref: ${item.mutasiId.slice(-6)}` : 'Pembayaran')} 
                                    </Text>
                                </div>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {formatTimestamp(item.tanggal)}
                                </Text>
                            </Timeline.Item>
                        ))}
                    </Timeline>
                ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada riwayat pembayaran" />
                )}
            </div>

            {/* --- PERUBAHAN 3: Table Responsive --- */}
            <Title level={5}>Daftar Item Buku</Title>
            <Table
                columns={itemColumns}
                dataSource={items || []} // Pengaman error "rawData.some"
                rowKey={(item, index) => item.idBuku || index}
                pagination={false}
                bordered
                size="small"
                // Tambahkan scroll={{ x: ... }} sebagai PENGAMAN
                // jika judul buku terlalu panjang
                scroll={{ x: 'max-content' }}
            />
        </Modal>
    );
};

export default TransaksiJualDetailModal;