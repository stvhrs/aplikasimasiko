import React, { useState, useEffect } from 'react';
import { Modal, Descriptions, Table, Typography, Tag, Timeline, Empty, Button, Divider, Spin } from 'antd';
import { db } from '../../../api/firebase'; // Sesuaikan path ini
import { ref, query, orderByChild, equalTo, onValue } from "firebase/database";

const { Title, Text } = Typography;

// --- Helper Format ---
const formatCurrency = (value) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(value || 0);

const formatDate = (timestamp) =>
    new Date(timestamp || 0).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric'
    });

const formatTimestamp = (timestamp) => {
    if (!timestamp) return '...';
    return new Date(timestamp).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

// --- Kolom Tabel ---
const itemColumns = [
    { title: 'Judul Buku', dataIndex: 'judulBuku', key: 'judulBuku' },
    { title: 'Qty', dataIndex: 'jumlah', key: 'jumlah', align: 'center', width: 60 },
    { title: 'Harga', dataIndex: 'hargaSatuan', key: 'hargaSatuan', align: 'right', render: (val) => formatCurrency(val) },
    { title: 'Disc', dataIndex: 'diskonPersen', key: 'diskonPersen', align: 'center', render: (val) => `${val || 0}%`, width: 60 },
    { 
        title: 'Subtotal', key: 'subtotal', align: 'right',
        render: (_, record) => {
            const sub = (record.jumlah || 0) * ((record.hargaSatuan || 0) * (1 - (record.diskonPersen || 0) / 100));
            return <Text strong>{formatCurrency(sub)}</Text>;
        }
    }
];

const TransaksiJualDetailModal = ({ open, onCancel, transaksi }) => {
    const [historiArray, setHistoriArray] = useState([]);
    const [loadingHistori, setLoadingHistori] = useState(false);

    // --- 1. FETCH RIWAYAT DARI MUTASI (Gabungan Jual & Retur) ---
    useEffect(() => {
        if (open && transaksi?.id) {
            setLoadingHistori(true);
            
            // Query ke tabel 'mutasi' cari yang idTransaksi-nya sama
            const q = query(
                ref(db, 'mutasi'), 
                orderByChild('idTransaksi'), 
                equalTo(transaksi.id)
            );

            const unsubscribe = onValue(q, (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    const rawList = Object.keys(data).map(key => ({
                        id: key,
                        ...data[key]
                    }));

                    // Filter: Hanya ambil Penjualan Buku & Retur Buku
                    const filteredList = rawList.filter(item => 
                        item.tipeMutasi === 'Penjualan Buku' || 
                        item.kategori === 'Penjualan Buku' ||
                        item.tipeMutasi === 'Retur Buku' || 
                        item.kategori === 'Retur Buku'
                    );

                    // Sort: Tanggal Terbaru di Atas (Descending)
                    filteredList.sort((a, b) => b.tanggal - a.tanggal);
                    
                    setHistoriArray(filteredList);
                } else {
                    setHistoriArray([]);
                }
                setLoadingHistori(false);
            });

            return () => unsubscribe();
        } else {
            setHistoriArray([]);
        }
    }, [open, transaksi]);
    
    if (!transaksi) return null;

    // Destructure Data Invoice
    const {
        nomorInvoice, tanggal, namaPelanggan, statusPembayaran,
        totalTagihan, jumlahTerbayar, items, diskonLain = 0, biayaTentu = 0
    } = transaksi;

    // --- KALKULASI HEADER ---
    let subtotalKotor = 0;
    let totalDiskonItem = 0;

    (items || []).forEach(item => {
        const qty = Number(item.jumlah || 0);
        const harga = Number(item.hargaSatuan || 0);
        const diskonPrsn = Number(item.diskonPersen || 0);
        const totalBruto = qty * harga;
        const nominalDiskon = Math.round(totalBruto * (diskonPrsn / 100));
        
        subtotalKotor += totalBruto;
        totalDiskonItem += nominalDiskon;
    });

    const totalDiskonGabungan = totalDiskonItem + Number(diskonLain);
    
    // Perbaikan Logika Sisa Tagihan (Agar tidak minus tampilan, jika lunas ya 0)
    // Tapi jika logic backend Anda membolehkan minus (kembalian), biarkan raw calculation.
    let sisaTagihan = (totalTagihan || 0) - (jumlahTerbayar || 0);
    // if (sisaTagihan < 0 && statusPembayaran === 'Lunas') sisaTagihan = 0; // Opsional

    const getStatusColor = (status) => {
        if (status === 'Lunas') return 'green';
        if (status === 'Belum') return 'red';
        return 'orange';
    };

    return (
        <Modal
            open={open} onCancel={onCancel} centered footer={[<Button key="close" type="primary" onClick={onCancel}>Tutup</Button>]}
            title={`Detail Transaksi: ${nomorInvoice || ''}`}
            width={800}
        >
            {/* --- SECTION INFO UTAMA --- */}
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} style={{ marginBottom: 16 }}>
                <Descriptions.Item label="Pelanggan">{namaPelanggan}</Descriptions.Item>
                <Descriptions.Item label="Tanggal">{formatDate(tanggal)}</Descriptions.Item>
                <Descriptions.Item label="Status">
                    <Tag color={getStatusColor(statusPembayaran)}>{statusPembayaran}</Tag>
                </Descriptions.Item>
            </Descriptions>

            {/* --- SECTION KALKULASI --- */}
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} layout="horizontal" style={{ marginBottom: 24 }}>
                <Descriptions.Item label="Subtotal (Kotor)">{formatCurrency(subtotalKotor)}</Descriptions.Item>
                <Descriptions.Item label="Total Diskon"><Text type="danger">-{formatCurrency(totalDiskonGabungan)}</Text></Descriptions.Item>
                <Descriptions.Item label="Biaya Lain">{formatCurrency(biayaTentu)}</Descriptions.Item>
                <Descriptions.Item label="Grand Total"><Text strong>{formatCurrency(totalTagihan)}</Text></Descriptions.Item>
                <Descriptions.Item label="Sudah Dibayar"><Text style={{ color: '#3f8600' }}>{formatCurrency(jumlahTerbayar)}</Text></Descriptions.Item>
                <Descriptions.Item label="Sisa Tagihan">
                    <Text strong style={{ color: sisaTagihan > 0 ? '#cf1322' : '#3f8600' }}>{formatCurrency(sisaTagihan)}</Text>
                </Descriptions.Item>
            </Descriptions>
            
            {/* --- SECTION ITEM BUKU --- */}
            <Title level={5}>Item Buku</Title>
            <Table
                columns={itemColumns} dataSource={items || []}
                rowKey={(r, i) => r.idBuku || i} pagination={false}
                bordered size="small" scroll={{ x: 'max-content' }}
                style={{ marginBottom: 24 }}
            />

            {/* --- SECTION RIWAYAT (DARI MUTASI) --- */}
            <Title level={5}>Riwayat Transaksi (Jual & Retur)</Title>
            <div style={{ maxHeight: 250, overflowY: 'auto', border: '1px solid #f0f0f0', padding: 16, borderRadius: 8 }}>
                {loadingHistori ? <div style={{textAlign:'center', padding:20}}><Spin /></div> : (
                    historiArray.length > 0 ? (
                        <Timeline>
                            {historiArray.map((mutasi) => {
                                // Tentukan Warna & Tanda
                                const isRetur = mutasi.kategori === 'Retur Buku' || mutasi.tipeMutasi === 'Retur Buku';
                                const color = isRetur ? 'red' : 'green';
                                const sign = isRetur ? '-' : '+';
                                
                                // Nominal: Jika Retur ambil jumlahKeluar (Refund) atau Absolute dari jumlah
                                const nominal = isRetur 
                                    ? (mutasi.jumlahKeluar || Math.abs(mutasi.jumlah)) 
                                    : (mutasi.jumlahBayar || mutasi.jumlah);

                                return (
                                    <Timeline.Item key={mutasi.id} color={color}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <Text strong style={{ fontSize: 15, color: isRetur ? '#cf1322' : '#3f8600' }}>
                                                    {sign} {formatCurrency(nominal)}
                                                </Text>
                                                <div style={{ marginTop: 2 }}>
                                                    <Text strong>{isRetur ? 'RETUR / REFUND' : 'PEMBAYARAN'}</Text>
                                                </div>
                                                <div style={{ fontSize: 12, color: '#666' }}>
                                                    {mutasi.keterangan || '-'}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <Text type="secondary" style={{ fontSize: 11 }}>
                                                    {formatTimestamp(mutasi.tanggal)}
                                                </Text>
                                            </div>
                                        </div>
                                    </Timeline.Item>
                                );
                            })}
                        </Timeline>
                    ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada riwayat transaksi" />
                    )
                )}
            </div>
        </Modal>
    );
};

export default TransaksiJualDetailModal;