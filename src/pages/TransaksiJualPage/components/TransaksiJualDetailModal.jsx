// ================================
// FILE: TransaksiJualDetailModal.jsx
// UPDATE:
// 1. Menambahkan perhitungan Subtotal Kotor & Total Diskon Gabungan.
// 2. Menampilkan field Biaya Tambahan, Total Sebelum Diskon, dan Total Diskon di UI.
// ================================

import React, { useState, useEffect } from 'react';
import { Modal, Descriptions, Table, Typography, Tag, Timeline, Empty, Button, Divider } from 'antd';

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

// --- Kolom untuk tabel item buku ---
const itemColumns = [
    {
        title: 'Judul Buku',
        dataIndex: 'judulBuku',
        key: 'judulBuku',
    },
    {
        title: 'Qty',
        dataIndex: 'jumlah',
        key: 'jumlah',
        align: 'center',
        width: 60,
    },
    {
        title: 'Harga Satuan',
        dataIndex: 'hargaSatuan',
        key: 'hargaSatuan',
        align: 'right',
        render: (val) => formatCurrency(val),
        responsive: ['sm'],
    },
    {
        title: 'Diskon',
        dataIndex: 'diskonPersen',
        key: 'diskonPersen',
        align: 'center',
        render: (val) => `${val || 0}%`,
        width: 80,
        responsive: ['sm'],
    },
    {
        title: 'Subtotal',
        key: 'subtotal',
        align: 'right',
        render: (text, record) => {
            const { jumlah = 0, hargaSatuan = 0, diskonPersen = 0 } = record;
            const subtotal = jumlah * (hargaSatuan * (1 - diskonPersen / 100));
            return (
                <Text strong>{formatCurrency(subtotal)}</Text>
            );
        }
    }
];

const TransaksiJualDetailModal = ({ open, onCancel, transaksi }) => {
    const [historiArray, setHistoriArray] = useState([]);

    useEffect(() => {
        if (open && transaksi && transaksi.riwayatPembayaran) {
            const rawRiwayat = typeof transaksi.riwayatPembayaran.forEach === 'function' 
                ? transaksi.riwayatPembayaran 
                : Object.values(transaksi.riwayatPembayaran);

            const arr = rawRiwayat.sort((a, b) => (b.tanggal || 0) - (a.tanggal || 0));
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
        items,
        diskonLain = 0, // Default 0 jika data lama
        biayaTentu = 0  // Default 0 jika data lama
    } = transaksi;

    // --- KALKULASI RINCIAN KEUANGAN ---
    let subtotalKotor = 0; // Harga Total Item Sebelum Diskon Apapun
    let totalDiskonItem = 0; // Total Nominal Diskon dari per-item

    (items || []).forEach(item => {
        const qty = Number(item.jumlah || 0);
        const harga = Number(item.hargaSatuan || 0);
        const diskonPrsn = Number(item.diskonPersen || 0);

        const totalItemBruto = qty * harga;
        const nominalDiskon = Math.round(totalItemBruto * (diskonPrsn / 100));

        subtotalKotor += totalItemBruto;
        totalDiskonItem += nominalDiskon;
    });

    const totalDiskonGabungan = totalDiskonItem + Number(diskonLain);
    const sisaTagihan = (totalTagihan || 0) - (jumlahTerbayar || 0);

    const getStatusColor = (status) => {
        if (status === 'Lunas') return 'green';
        if (status === 'Belum') return 'red';
        if (status === 'Sebagian' || status === 'DP') return 'orange';
        return 'default';
    };

    return (
        <Modal
            open={open}
            onCancel={onCancel} centered={true}
            title={`Detail Transaksi: ${nomorInvoice || ''}`}
            width="70vw"
            style={{ top: 0, padding: 0, margin: 0, maxWidth: '70vw' }}
            footer={[
                <Button key="close" type="primary" onClick={onCancel}>
                    Tutup
                </Button>
            ]}
        >
            {/* Info Utama */}
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} style={{ marginBottom: 16 }}>
                <Descriptions.Item label="Pelanggan">{namaPelanggan}</Descriptions.Item>
                <Descriptions.Item label="Tanggal">{formatDate(tanggal)}</Descriptions.Item>
                <Descriptions.Item label="Status Bayar" span={2}>
                    <Tag color={getStatusColor(statusPembayaran)}>{statusPembayaran}</Tag>
                </Descriptions.Item>
            </Descriptions>

            {/* Rincian Keuangan Lengkap */}
            <Descriptions 
                bordered 
                size="small" 
                column={{ xs: 1, sm: 2 }} 
                layout="horizontal"
                style={{ marginBottom: 24 }}
            >
                {/* Baris 1: Dasar */}
                <Descriptions.Item label="Subtotal (Sebelum Diskon)">
                    <Text>{formatCurrency(subtotalKotor)}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Total Diskon">
                    <Text type="danger">-{formatCurrency(totalDiskonGabungan)}</Text>
                </Descriptions.Item>

                {/* Baris 2: Tambahan */}
                <Descriptions.Item label="Biaya Tambahan">
                    <Text>{formatCurrency(biayaTentu)}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Grand Total (Tagihan)">
                    <Text strong style={{ fontSize: 16 }}>{formatCurrency(totalTagihan)}</Text>
                </Descriptions.Item>

                {/* Baris 3: Pembayaran */}
                <Descriptions.Item label="Sudah Dibayar">
                    <Text strong style={{ color: '#3f8600' }}>{formatCurrency(jumlahTerbayar)}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Sisa Tagihan">
                    <Text strong style={{ color: sisaTagihan > 0 ? '#cf1322' : '#3f8600' }}>
                        {formatCurrency(sisaTagihan)}
                    </Text>
                </Descriptions.Item>
            </Descriptions>
            
            <Title level={5}>Daftar Item Buku</Title>
            <Table
                columns={itemColumns}
                dataSource={items || []}
                rowKey={(item, index) => item.idBuku || index}
                pagination={false}
                bordered
                size="small"
                scroll={{ x: 'max-content' }}
                style={{ marginBottom: 24 }}
            />

            <Title level={5} style={{ marginBottom: 16 }}>
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
        </Modal>
    );
};

export default TransaksiJualDetailModal;