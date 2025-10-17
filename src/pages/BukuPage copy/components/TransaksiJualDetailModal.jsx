import React, { useState, useEffect } from 'react';
import { Modal, Descriptions, Table, Typography, Tag, Timeline, Empty } from 'antd';

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

// --- Kolom untuk tabel item buku (Tidak berubah) ---
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
    },
    {
        title: 'Harga Satuan',
        dataIndex: 'hargaSatuan',
        key: 'hargaSatuan',
        align: 'right',
        render: (val) => formatCurrency(val),
    },
    {
        title: 'Diskon',
        dataIndex: 'diskonPersen',
        key: 'diskonPersen',
        align: 'center',
        render: (val) => `${val || 0}%`,
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
        // --- PERBAIKAN: Menggunakan 'riwayatPembayaran' dan 'tanggal' ---
        if (open && transaksi && transaksi.riwayatPembayaran) {
            const arr = Object.values(transaksi.riwayatPembayaran)
                .sort((a, b) => b.tanggal - a.tanggal); // Urutkan berdasarkan tanggal
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
        if (status === 'Sebagian' || status === 'DP') return 'orange'; // <-- Ditambahkan 'DP'
        return 'default';
    };

    return (
        <Modal
            open={open}
            onCancel={onCancel}
            title={`Detail Transaksi: ${nomorInvoice || ''}`}
            width={900}
            footer={[
                <button key="close" onClick={onCancel} className="ant-btn ant-btn-default">
                    Tutup
                </button>
            ]}
        >
            {/* --- Info Utama & Keuangan (Tidak berubah) --- */}
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
                <Descriptions.Item label="Pelanggan">{namaPelanggan}</Descriptions.Item>
                <Descriptions.Item label="Tanggal">{formatDate(tanggal)}</Descriptions.Item>
                <Descriptions.Item label="Status Bayar">
                    <Tag color={getStatusColor(statusPembayaran)}>{statusPembayaran}</Tag>
                </Descriptions.Item>
            </Descriptions>

            <Descriptions bordered size="small" column={3} style={{ marginBottom: 24 }}>
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
            
            {/* --- BLOK RIWAYAT PEMBAYARAN --- */}
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
                                        {/* Menggunakan 'mutasiId' sebagai referensi jika ada */}
                                        {item.keterangan || item.metode || `Ref: ${item.mutasiId.slice(-6)}`} 
                                    </Text>
                                </div>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {/* --- PERBAIKAN: Menggunakan 'item.tanggal' --- */}
                                    {formatTimestamp(item.tanggal)}
                                </Text>
                            </Timeline.Item>
                        ))}
                    </Timeline>
                ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada riwayat pembayaran" />
                )}
            </div>

            {/* --- Daftar Item (Tidak berubah) --- */}
            <Title level={5}>Daftar Item Buku</Title>
            <Table
                columns={itemColumns}
                dataSource={items || []}
                rowKey={(item, index) => item.idBuku || index} // Pengaman jika idBuku duplikat
                pagination={false}
                bordered
                size="small"
            />
        </Modal>
    );
};

export default TransaksiJualDetailModal;