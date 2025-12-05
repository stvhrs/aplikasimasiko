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
            // A. AMBIL INVOICE (PIUTANG) -> Sumber: transaksiJualBuku
            const qInvoice = query(ref(db, 'transaksiJualBuku'), orderByChild('idPelanggan'), equalTo(pelanggan.id));
            
            // B. AMBIL PEMBAYARAN (BAYAR) -> Sumber: historiPembayaran
            const qBayar = query(ref(db, 'historiPembayaran'), orderByChild('namaPelanggan'), equalTo(pelanggan.nama));
            
            // C. AMBIL RETUR (DIANGGAP BAYAR/PENGURANG) -> Sumber: historiRetur
            const qRetur = query(ref(db, 'historiRetur'), orderByChild('namaPelanggan'), equalTo(pelanggan.nama));

            const [snapInvoice, snapBayar, snapRetur] = await Promise.all([
                get(qInvoice),
                get(qBayar),
                get(qRetur)
            ]);

            let rawData = [];

            // 1. PROSES INVOICE
            if (snapInvoice.exists()) {
                snapInvoice.forEach(child => {
                    const val = child.val();
                    rawData.push({
                        id: child.key,
                        rawId: val.nomorInvoice || child.key,
                        dateObj: val.tanggal,
                        type: 'INVOICE',
                        keterangan: 'Pembelian Buku',
                        debit: Number(val.totalTagihan || 0), 
                        credit: 0
                    });
                });
            }

            // 2. PROSES PEMBAYARAN
            if (snapBayar.exists()) {
                snapBayar.forEach(child => {
                    const val = child.val();
                    rawData.push({
                        id: child.key,
                        rawId: val.id || child.key,
                        dateObj: val.tanggal,
                        type: 'PAYMENT',
                        keterangan: val.keterangan || 'Pembayaran',
                        debit: 0,
                        credit: Number(val.jumlah || 0) 
                    });
                });
            }

            // 3. PROSES RETUR
            if (snapRetur.exists()) {
                snapRetur.forEach(child => {
                    const val = child.val();
                    const nilaiRetur = Number(val.totalHarga || val.nominal || 0);
                    
                    rawData.push({
                        id: child.key,
                        rawId: val.id || child.key,
                        dateObj: val.timestamp || val.tanggal, 
                        type: 'RETUR',
                        keterangan: 'Retur Barang',
                        debit: 0,
                        credit: nilaiRetur 
                    });
                });
            }

            // 4. SORTING KRONOLOGIS (Terlama ke Terbaru) untuk hitung Saldo Berjalan
            rawData.sort((a, b) => a.dateObj - b.dateObj);

            // 5. HITUNG SALDO BERJALAN
            let currentBalance = 0;
            const dataWithBalance = rawData.map(item => {
                currentBalance = currentBalance + item.debit - item.credit;
                return {
                    ...item,
                    saldo: currentBalance
                };
            });

            setSummary({ saldoAkhir: currentBalance });
            
            // 6. TAMPILKAN (Terbaru diatas sebagai default)
            setAllTransactions(dataWithBalance.reverse());

        } catch (error) {
            console.error("Error fetch history:", error);
            message.error("Gagal memuat data histori");
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
            (item.rawId && item.rawId.toLowerCase().includes(lower)) ||
            (item.type && item.type.toLowerCase().includes(lower)) ||
            (item.keterangan && item.keterangan.toLowerCase().includes(lower))
        );
    }, [allTransactions, searchText]);

    // --- GENERATE PDF ---
    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        
        doc.setFontSize(14);
        doc.text("KARTU PIUTANG PELANGGAN", 14, 20);
        doc.setFontSize(10);
        doc.text(`Nama : ${pelanggan.nama}`, 14, 30);
        doc.text(`Tgl Cetak : ${dayjs().format('DD/MM/YYYY HH:mm')}`, 14, 35);
        
        const tableColumn = ["Tanggal", "ID Transaksi", "Keterangan", "Bayar", "Piutang", "Saldo"];
        const tableRows = [];

        // Sort ulang berdasarkan tanggal untuk PDF agar urut kronologis
        const dataForPdf = [...filteredTransactions].sort((a, b) => a.dateObj - b.dateObj);

        dataForPdf.forEach(t => {
            tableRows.push([
                dayjs(t.dateObj).format('DD/MM/YY'),
                t.rawId,
                t.keterangan,
                t.credit > 0 ? formatCurrency(t.credit) : '-',
                t.debit > 0 ? formatCurrency(t.debit) : '-',
                formatCurrency(t.saldo)
            ]);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: {
                3: { halign: 'right' }, 
                4: { halign: 'right' }, 
                5: { halign: 'right', fontStyle: 'bold' }
            }
        });

        doc.save(`Kartu_Piutang_${pelanggan.nama}.pdf`);
    };

    // --- KOLOM TABEL (DENGAN SORTING) ---
    const columns = [
        {
            title: 'Tgl',
            dataIndex: 'dateObj',
            key: 'tanggal',
            width: 110,
            render: (val) => dayjs(val).format('DD MMM YYYY'),
            // Sorting berdasarkan Tanggal (Timestamp)
            sorter: (a, b) => a.dateObj - b.dateObj,
        },
        {
            title: 'ID Transaksi',
            dataIndex: 'rawId',
            key: 'idTransaksi',
            width: 150,
            render: (text, r) => {
                let color = 'default';
                if(r.type === 'INVOICE') color = 'blue';
                if(r.type === 'PAYMENT') color = 'green';
                if(r.type === 'RETUR') color = 'orange';
                return <Tag color={color}>{text}</Tag>
            },
            // Sorting berdasarkan String ID
            sorter: (a, b) => (a.rawId || '').localeCompare(b.rawId || ''),
        },
        {
            title: 'Bayar',
            dataIndex: 'credit',
            key: 'bayar',
            align: 'right',
            width: 130,
            render: (val) => val > 0 ? <Text style={{color: '#389e0d'}}>{formatCurrency(val)}</Text> : '-',
            // Sorting berdasarkan Nominal Bayar
            sorter: (a, b) => a.credit - b.credit,
        },
        {
            title: 'Piutang',
            dataIndex: 'debit',
            key: 'piutang',
            align: 'right',
            width: 130,
            render: (val) => val > 0 ? <Text style={{color: '#cf1322'}}>{formatCurrency(val)}</Text> : '-',
            // Sorting berdasarkan Nominal Piutang
            sorter: (a, b) => a.debit - b.debit,
        },
        {
            title: 'Saldo',
            dataIndex: 'saldo',
            key: 'saldo',
            align: 'right',
            width: 140,
            render: (val) => (
                <Text strong style={{ color: '#096dd9' }}>
                    {formatCurrency(val)}
                </Text>
            ),
            // Sorting berdasarkan Nominal Saldo Berjalan
            sorter: (a, b) => a.saldo - b.saldo,
        }
    ];

    return (
        <Modal
            title={`Riwayat Transaksi: ${pelanggan?.nama}`}
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
                <Card style={{ marginBottom: 16, background: '#f5f5f5' }} bodyStyle={{ padding: '16px' }}>
                    <Row gutter={[16, 16]} align="middle">
                        <Col xs={24} md={8}>
                             <Statistic 
                                title="Sisa Piutang (Saldo Akhir)" 
                                value={summary.saldoAkhir} 
                                precision={0}
                                valueStyle={{ color: summary.saldoAkhir > 0 ? '#cf1322' : '#3f8600', fontWeight: 'bold' }}
                                prefix="Rp"
                             />
                        </Col>
                        <Col xs={24} md={16}>
                            <Input
                                placeholder="Cari ID Transaksi..."
                                prefix={<SearchOutlined />}
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
                    pagination={{ pageSize: 8 }}
                    size="small"
                    scroll={{ x: 700 }}
                />
            </Spin>
        </Modal>
    );
};

export default CustomerHistoryModal;