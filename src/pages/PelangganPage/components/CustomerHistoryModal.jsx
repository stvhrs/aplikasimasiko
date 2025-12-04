import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Table, Button, Typography, Tag, Spin, message, Statistic, Card, Row, Col, Input } from 'antd';
import { FilePdfOutlined, SearchOutlined } from '@ant-design/icons';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { db } from '../../../api/firebase'; 
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const { Text } = Typography;

const formatCurrency = (value) => 
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

const CustomerHistoryModal = ({ open, onCancel, pelanggan }) => {
    const [loading, setLoading] = useState(false);
    const [allTransactions, setAllTransactions] = useState([]); 
    const [searchText, setSearchText] = useState(''); 
    const [summary, setSummary] = useState({ saldoAkhir: 0 });

    // --- 1. FETCH DATA & HITUNG SALDO ---
    const fetchHistory = async () => {
        if (!pelanggan) return;
        setLoading(true);
        try {
            // A. AMBIL INVOICE (Query pakai idPelanggan - karena di Invoice pasti ada ID)
            const qInvoice = query(ref(db, 'transaksiJualBuku'), orderByChild('idPelanggan'), equalTo(pelanggan.id));
            const snapInvoice = await get(qInvoice);
            
            // B. AMBIL MUTASI (Query pakai namaPelanggan - karena di Mutasi kadang ID belum tersimpan)
            // Pastikan di Firebase Rules: "mutasi": { ".indexOn": ["namaPelanggan"] }
            const qMutasi = query(ref(db, 'mutasi'), orderByChild('namaPelanggan'), equalTo(pelanggan.nama));
            const snapMutasi = await get(qMutasi);

            let rawData = [];

            // --- PROSES 1: INVOICE (Sesuai Request: MINUS) ---
            if (snapInvoice.exists()) {
                const invObj = snapInvoice.val();
                Object.keys(invObj).forEach(key => {
                    const item = invObj[key];
                    rawData.push({
                        id: key,
                        type: 'INVOICE',
                        kategoriDisplay: 'Tagihan / Invoice',
                        tanggal: item.tanggal,
                        keterangan: `Invoice #${item.nomorInvoice}`,
                        // USER REQUEST: Transaksi Jual Buku (Invoice) = MINUS
                        nominalEfektif: -Math.abs(Number(item.totalTagihan || 0)) 
                    });
                });
            }

            // --- PROSES 2: MUTASI (Pembayaran & Retur) ---
            if (snapMutasi.exists()) {
                const mutObj = snapMutasi.val();
                Object.keys(mutObj).forEach(key => {
                    const item = mutObj[key];
                    
                    // Filter kategori yang relevan
                    if (item.kategori === 'Retur Buku' || item.kategori === 'Penjualan Buku') {
                        
                        let nominal = 0;
                        let labelKat = item.kategori;
                        let desc = item.keterangan || '';

                        // A. Retur Buku -> USER REQUEST: MINUS
                        if (item.kategori === 'Retur Buku') {
                            labelKat = 'Retur Buku';
                            // Pakai Math.abs lalu dikali -1 biar pasti MINUS
                            nominal = -Math.abs(Number(item.jumlah || 0)); 
                        } 
                        // B. Penjualan Buku (Pembayaran Masuk) -> USER REQUEST: PLUS
                        else if (item.kategori === 'Penjualan Buku' && item.tipe === 'pemasukan') {
                            labelKat = 'Pembayaran Masuk'; 
                            // Pastikan jadi POSITIF
                            nominal = Math.abs(Number(item.jumlah || 0));
                        }

                        rawData.push({
                            id: key,
                            type: item.kategori === 'Retur Buku' ? 'RETUR' : 'PAYMENT',
                            kategoriDisplay: labelKat,
                            tanggal: item.tanggal,
                            keterangan: desc,
                            nominalEfektif: nominal
                        });
                    }
                });
            }

            // 3. SORTING KRONOLOGIS (Terlama ke Terbaru) untuk hitung Saldo Berjalan
            rawData.sort((a, b) => a.tanggal - b.tanggal);

            // 4. HITUNG SALDO BERJALAN
            let currentBalance = 0;
            const dataWithBalance = rawData.map(item => {
                currentBalance += item.nominalEfektif;
                return {
                    ...item,
                    saldoBerjalan: currentBalance
                };
            });

            // 5. Simpan Saldo Terakhir
            setSummary({ saldoAkhir: currentBalance });

            // 6. BALIK URUTAN (Terbaru Diatas) untuk ditampilkan di tabel
            setAllTransactions(dataWithBalance.reverse());

        } catch (error) {
            console.error("Error fetch history:", error);
            message.error("Gagal mengambil riwayat transaksi");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open && pelanggan) {
            setSearchText(''); 
            fetchHistory();
        }
    }, [open, pelanggan]);

    // --- FILTER PENCARIAN ---
    const filteredTransactions = useMemo(() => {
        if (!searchText) return allTransactions;
        const lower = searchText.toLowerCase();
        return allTransactions.filter(item => 
            (item.keterangan && item.keterangan.toLowerCase().includes(lower)) ||
            (item.kategoriDisplay && item.kategoriDisplay.toLowerCase().includes(lower))
        );
    }, [allTransactions, searchText]);

    // --- GENERATE PDF ---
    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        const dataToPrint = filteredTransactions;

        doc.setFontSize(14);
        doc.text("KARTU RIWAYAT PELANGGAN", 14, 20);
        
        doc.setFontSize(9);
        doc.text(`Nama : ${pelanggan.nama}`, 14, 30);
        doc.text(`Telp : ${pelanggan.telepon || '-'}`, 14, 35);
        
        const tableColumn = ["Tanggal", "Transaksi", "Keterangan", "Nominal", "Saldo"];
        const tableRows = [];

        dataToPrint.forEach(t => {
            tableRows.push([
                dayjs(t.tanggal).format('DD/MM/YY'),
                t.kategoriDisplay,
                t.keterangan || '-',
                { content: formatCurrency(t.nominalEfektif), styles: { halign: 'right', textColor: t.nominalEfektif < 0 ? [200, 0, 0] : [0, 0, 0] } },
                { content: formatCurrency(t.saldoBerjalan), styles: { halign: 'right', fontStyle: 'bold' } }
            ]);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 45,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2 }
        });

        doc.save(`Riwayat_${pelanggan.nama.replace(/\s+/g, '_')}.pdf`);
    };

    // --- KOLOM TABEL ---
    const columns = [
        {
            title: 'Tanggal',
            dataIndex: 'tanggal',
            key: 'tanggal',
            width: 100,
            render: (val) => dayjs(val).format('DD MMM YYYY'),
            sorter: (a, b) => a.tanggal - b.tanggal,
        },
        {
            title: 'Jenis',
            dataIndex: 'kategoriDisplay',
            key: 'jenis',
            width: 140,
            render: (val) => {
                let color = 'default';
                if (val === 'Tagihan / Invoice') color = 'red'; // Minus
                if (val === 'Retur Buku') color = 'volcano';    // Minus
                if (val === 'Pembayaran Masuk') color = 'green';// Plus
                return <Tag color={color}>{val}</Tag>;
            }
        },
        {
            title: 'Keterangan',
            dataIndex: 'keterangan',
            key: 'keterangan',
            render: (text) => {
                if (!searchText) return text;
                const parts = text.split(new RegExp(`(${searchText})`, 'gi'));
                return (
                    <span>
                        {parts.map((part, i) => 
                            part.toLowerCase() === searchText.toLowerCase() ? 
                            (<span key={i} style={{ backgroundColor: '#ffc069' }}>{part}</span>) : part
                        )}
                    </span>
                );
            }
        },
        {
            title: 'Nominal',
            dataIndex: 'nominalEfektif',
            key: 'nominal',
            align: 'right',
            width: 140,
            sorter: (a, b) => a.nominalEfektif - b.nominalEfektif,
            render: (val) => (
                <Text style={{ color: val < 0 ? '#cf1322' : '#389e0d', fontWeight: 'bold' }}>
                    {val > 0 ? `+ ${formatCurrency(val)}` : formatCurrency(val)}
                </Text>
            )
        },
        {
            title: 'Saldo',
            dataIndex: 'saldoBerjalan',
            key: 'saldo',
            align: 'right',
            width: 140,
            render: (val) => (
                <Text strong style={{ color: val < 0 ? '#cf1322' : '#096dd9' }}>
                    {formatCurrency(val)}
                </Text>
            )
        }
    ];

    return (
        <Modal
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>Kartu Riwayat: <b>{pelanggan?.nama}</b></span>
                </div>
            }
            open={open}
            onCancel={onCancel}
            width={900}
            footer={[
                <Button key="close" onClick={onCancel}>Tutup</Button>,
                <Button key="pdf" type="primary" icon={<FilePdfOutlined />} onClick={handleDownloadPDF} disabled={filteredTransactions.length === 0}>
                    Download PDF
                </Button>
            ]}
        >
            <Spin spinning={loading}>
                <Card style={{ marginBottom: 16, background: '#f0f2f5' }} bodyStyle={{ padding: '12px 16px' }}>
                    <Row gutter={[16, 16]} align="middle">
                        <Col xs={24} md={10}>
                             <Statistic 
                                title="Total Saldo Akhir" 
                                value={summary.saldoAkhir} 
                                precision={0}
                                valueStyle={{ 
                                    color: summary.saldoAkhir >= 0 ? '#096dd9' : '#cf1322', 
                                    fontWeight: 'bold' 
                                }}
                                prefix="Rp"
                             />
                        </Col>
                        <Col xs={24} md={14}>
                            <Input
                                placeholder="Cari keterangan, invoice..."
                                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                allowClear
                            />
                        </Col>
                    </Row>
                </Card>

                <Table
                    columns={columns}
                    dataSource={filteredTransactions}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    size="small"
                    scroll={{ x: 700 }}
                />
            </Spin>
        </Modal>
    );
};

export default CustomerHistoryModal;