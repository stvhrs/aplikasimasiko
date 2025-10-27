// src/pages/transaksi-jual/components/TagihanPelangganTab.jsx
import React, { useState, useMemo, useCallback, useDeferredValue } from 'react';
import { Card, Typography, Input, Row, Col, Button, Spin, Modal, Empty, message, App } from 'antd';
import { PrinterOutlined, ShareAltOutlined, DownloadOutlined } from '@ant-design/icons';
import TransaksiJualTableComponent from './TransaksiJualTableComponent'; // Sesuaikan path
import useDebounce from '../../../hooks/useDebounce'; // Sesuaikan path
import { currencyFormatter } from '../../../utils/formatters'; // Sesuaikan path
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Worker, Viewer } from '@react-pdf-viewer/core'; // Untuk PDF Preview
import '@react-pdf-viewer/core/lib/styles/index.css';
import dayjs from 'dayjs'; // Tambahkan import dayjs

const { Title } = Typography;
const { Search } = Input;

// Fungsi helper generate PDF Laporan Pelanggan (dipindahkan ke sini)
const generateCustomerReportPdfBlob = (data, searchText) => {
    if (!data || data.length === 0) {
        throw new Error('Tidak ada data pelanggan untuk dicetak.');
    }

    const doc = new jsPDF();
    let startY = 30; // Default startY
    const title = 'Laporan Tagihan per Pelanggan';
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(10);

    if (searchText) {
        doc.text(`Filter Aktif: Cari Pelanggan: "${searchText}"`, 14, 30);
        startY = 36; // Turunkan startY jika ada filter
    } else {
        doc.text('Filter Aktif: Menampilkan Semua Pelanggan', 14, 30);
    }

    const totals = data.reduce(
        (acc, item) => {
            acc.tagihan += item.totalTagihan;
            acc.terbayar += item.totalTerbayar;
            acc.sisa += item.sisaTagihan;
            return acc;
        },
        { tagihan: 0, terbayar: 0, sisa: 0 }
    );

    const tableHead = ['No.', 'Nama Pelanggan', 'Nomor HP', 'Total Tagihan', 'Total Terbayar', 'Sisa Tagihan'];
    const tableBody = data.map((item, idx) => [
        idx + 1,
        item.namaPelanggan,
        item.telepon || '-',
        currencyFormatter(item.totalTagihan),
        currencyFormatter(item.totalTerbayar),
        currencyFormatter(item.sisaTagihan),
    ]);

    autoTable(doc, {
        head: [tableHead],
        body: tableBody,
        startY: startY,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
            0: { halign: 'right', minCellWidth: 10 },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' },
        },
        foot: [
            [ '', '', 'TOTAL', // Tambah satu kolom kosong untuk nomor HP
              currencyFormatter(totals.tagihan),
              currencyFormatter(totals.terbayar),
              currencyFormatter(totals.sisa) ]
        ],
        footStyles: { fontStyle: 'bold', halign: 'right', fillColor: [230, 230, 230], textColor: 0 }
    });

    return doc.output('blob'); // Kembalikan blob
};


export default function TagihanPelangganTab({ allTransaksi, loadingTransaksi }) {
    const { message: antdMessage } = App.useApp(); // Gunakan hook App untuk message
    const [searchText, setSearchText] = useState('');
    const debouncedSearchText = useDebounce(searchText, 300);
    const showTotalPagination = useCallback((total, range) => `${range[0]}-${range[1]} dari ${total} pelanggan`, []);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 50,
        showSizeChanger: true,
        pageSizeOptions: ['10', '20', '50', '100'],
        showTotal: showTotalPagination
    });

    // State untuk PDF Modal (dikelola di komponen ini)
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [pdfBlob, setPdfBlob] = useState(null);
    const [pdfTitle, setPdfTitle] = useState('');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [pdfFileName, setPdfFileName] = useState('laporan_tagihan_pelanggan.pdf');


    // Kalkulasi Data Dasar (Agregasi)
    const customerSummaryBaseData = useMemo(() => {
        const summary = new Map();
        allTransaksi.forEach(tx => {
            const customerName = tx.namaPelanggan || '(Pelanggan Umum)';
            let entry = summary.get(customerName);
            if (!entry) {
                entry = {
                    namaPelanggan: customerName,
                    telepon: tx.telepon || '',
                    totalTagihan: 0,
                    totalTerbayar: 0
                };
            }
            entry.totalTagihan += Number(tx.totalTagihan || 0);
            entry.totalTerbayar += Number(tx.jumlahTerbayar || 0);
            summary.set(customerName, entry);
        });

        return Array.from(summary.values()).map(item => ({
            ...item,
            sisaTagihan: item.totalTagihan - item.totalTerbayar
        })).sort((a, b) => b.sisaTagihan - a.sisaTagihan);
    }, [allTransaksi]);

    // Filter data dasar HANYA berdasarkan search text
    const deferredSearch = useDeferredValue(debouncedSearchText);
    const filteredCustomerSummary = useMemo(() => {
        if (!deferredSearch) {
            return customerSummaryBaseData;
        }
        const q = deferredSearch.toLowerCase();
        return customerSummaryBaseData.filter(item =>
            item.namaPelanggan.toLowerCase().includes(q)
        );
    }, [customerSummaryBaseData, deferredSearch]);

    const isFiltering = debouncedSearchText !== deferredSearch;

    // Kolom Tabel Pelanggan
    const columns = useMemo(() => [
        { title: 'No.', key: 'index', width: 60, render: (_t, _r, idx) => ((pagination.current - 1) * pagination.pageSize) + idx + 1 },
        { title: 'Nama Pelanggan', dataIndex: 'namaPelanggan', key: 'namaPelanggan', sorter: (a, b) => a.namaPelanggan.localeCompare(b.namaPelanggan) },
        {
            title: 'Nomor HP', dataIndex: 'telepon', key: 'telepon', width: 150,
            render: (telepon) => {
                if (!telepon) return '-';
                let formattedTelepon = telepon.replace(/\D/g, '');
                if (formattedTelepon.startsWith('0')) {
                    formattedTelepon = '62' + formattedTelepon.substring(1);
                } else if (!formattedTelepon.startsWith('62')) {
                    formattedTelepon = '62' + formattedTelepon;
                }
                if (formattedTelepon.length >= 11) {
                    return (<a href={`https://wa.me/${formattedTelepon}`} target="_blank" rel="noopener noreferrer">{telepon}</a>);
                } else { return telepon; }
            }
        },
        { title: 'Total Tagihan', dataIndex: 'totalTagihan', key: 'totalTagihan', align: 'right', width: 180, render: currencyFormatter, sorter: (a, b) => a.totalTagihan - b.totalTagihan },
        { title: 'Total Terbayar', dataIndex: 'totalTerbayar', key: 'totalTerbayar', align: 'right', width: 180, render: (val) => <span style={{ color: '#3f8600' }}>{currencyFormatter(val)}</span>, sorter: (a, b) => a.totalTerbayar - b.totalTerbayar },
        { title: 'Sisa Tagihan', dataIndex: 'sisaTagihan', key: 'sisaTagihan', align: 'right', width: 200, render: (val) => <span style={{ color: val > 0 ? '#cf1322' : '#3f8600', fontWeight: 600 }}>{currencyFormatter(val)}</span>, sorter: (a, b) => a.sisaTagihan - b.sisaTagihan, defaultSortOrder: 'descend' }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ], [pagination]); // Tambah dependensi pagination untuk No.

    const tableScrollX = useMemo(() => columns.reduce((acc, col) => acc + (col.width || 150), 0), [columns]);

    // Handlers
    const handleSearchChange = useCallback((e) => {
        setSearchText(e.target.value);
        setPagination(prev => ({ ...prev, current: 1 }));
    }, []);

    const handleTableChange = useCallback((paginationConfig) => {
        setPagination(paginationConfig);
    }, []);

    // Handler PDF Modal
    const handleGeneratePdf = useCallback(async () => {
        if (filteredCustomerSummary.length === 0) {
            antdMessage.warning('Tidak ada data pelanggan untuk dicetak.');
            return;
        }

        const title = 'Laporan Tagihan per Pelanggan';
        setPdfTitle(title);
        setIsGeneratingPdf(true);
        setIsPdfModalOpen(true); // Buka modal dulu
        setPdfBlob(null); // Kosongkan blob lama
        setPdfFileName(`Laporan_Tagihan_Pelanggan_${dayjs().format('YYYYMMDD')}.pdf`);

        // Generate PDF di background
        setTimeout(async () => {
            try {
                const blob = generateCustomerReportPdfBlob(filteredCustomerSummary, debouncedSearchText);
                setPdfBlob(blob);
            } catch (err) {
                console.error("Gagal generate PDF Laporan Pelanggan:", err);
                antdMessage.error('Gagal membuat PDF Laporan Pelanggan.');
                setIsPdfModalOpen(false); // Tutup modal jika gagal
            } finally {
                setIsGeneratingPdf(false);
            }
        }, 50); // Delay kecil agar modal sempat muncul

    }, [filteredCustomerSummary, debouncedSearchText, antdMessage]);

    const handleClosePdfModal = useCallback(() => {
        setIsPdfModalOpen(false);
        setIsGeneratingPdf(false); // Pastikan reset loading
        if (pdfBlob) {
            // Hapus URL blob jika sudah dibuat
            // URL.revokeObjectURL(URL.createObjectURL(pdfBlob)); // Ini tidak perlu jika pakai URL.createObjectURL di Viewer
        }
        setPdfBlob(null);
        setPdfTitle('');
    }, [pdfBlob]);

    const handleDownloadPdf = useCallback(async () => {
        if (!pdfBlob) return; antdMessage.loading({ content: 'Mengunduh...', key: 'pdfdl' }); try { const url = URL.createObjectURL(pdfBlob); const link = document.createElement('a'); link.href = url; const fn = `${pdfFileName.replace(/[\/:]/g, '_') || 'download'}`; link.setAttribute('download', fn); document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); antdMessage.success({ content: 'Unduhan dimulai!', key: 'pdfdl', duration: 2 }); } catch (err) { antdMessage.error({ content: `Gagal mengunduh: ${err.message}`, key: 'pdfdl', duration: 3 }); }
    }, [pdfBlob, pdfFileName, antdMessage]);

    const handleSharePdf = useCallback(async () => {
        if (!navigator.share) { antdMessage.error('Fitur share tidak didukung di browser ini.'); return; } if (!pdfBlob) return; const fn = `${pdfFileName.replace(/[\/:]/g, '_') || 'file'}`; const file = new File([pdfBlob], fn, { type: 'application/pdf' }); const shareData = { title: pdfTitle, text: `File PDF: ${pdfTitle}`, files: [file] }; if (navigator.canShare && navigator.canShare(shareData)) { try { await navigator.share(shareData); antdMessage.success('Berhasil dibagikan!'); } catch (err) { if (err.name !== 'AbortError') antdMessage.error(`Gagal berbagi: ${err.message}`); } } else { antdMessage.warn('Berbagi file PDF tidak didukung.'); }
    }, [pdfBlob, pdfTitle, pdfFileName, antdMessage]);


    return (
        <>
            <Card
                title={<Title level={5} style={{ margin: 0 }}>Ringkasan Tagihan per Pelanggan (Semua Waktu)</Title>}
                // Hapus extra, tombol cetak dipindahkan ke bawah
            >
                {/* --- Filter & Tombol Cetak (Diubah tata letaknya untuk mobile) --- */}
                <Row gutter={[16, 16]} style={{ marginBottom: 24, alignItems: 'center' }}>
                    <Col xs={24} md={18}>
                        <Search
                            placeholder="Cari nama pelanggan..."
                            value={searchText}
                            onChange={handleSearchChange}
                            allowClear
                            style={{ width: '100%' }}
                        />
                    </Col>
                    <Col xs={24} md={6}>
                        <Button
                            icon={<PrinterOutlined />}
                            onClick={handleGeneratePdf}
                            disabled={filteredCustomerSummary.length === 0 || isGeneratingPdf}
                            loading={isGeneratingPdf}
                            style={{ width: '100%' }} // Buat full width di mobile
                        >
                            Cetak PDF Laporan
                        </Button>
                    </Col>
                </Row>
                
                {/* --- Tabel --- */}
                <Spin spinning={isFiltering} tip="Mencari pelanggan...">
                    <TransaksiJualTableComponent
                        columns={columns}
                        dataSource={filteredCustomerSummary}
                        loading={loadingTransaksi} // Loading data utama saja
                        isFiltering={false} // Indikator filter ditangani Spin
                        pagination={pagination}
                        handleTableChange={handleTableChange}
                        tableScrollX={tableScrollX}
                        rowClassName={(record, index) => (index % 2 === 0 ? 'table-row-even' : 'table-row-odd')}
                    />
                </Spin>
            </Card>

            {/* --- Modal PDF --- */}
             <Modal
                title={pdfTitle} open={isPdfModalOpen} onCancel={handleClosePdfModal}
                width="95vw" style={{ top: 20 }} // Sedikit turunkan
                destroyOnClose
                footer={[
                    <Button key="close" onClick={handleClosePdfModal}>Tutup</Button>,
                    navigator.share && (<Button key="share" icon={<ShareAltOutlined />} onClick={handleSharePdf} disabled={isGeneratingPdf || !pdfBlob}>Bagikan File</Button>),
                    <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={handleDownloadPdf} disabled={isGeneratingPdf || !pdfBlob}>Unduh</Button>
                ]}
                bodyStyle={{ padding: 0, height: 'calc(100vh - 150px)', position: 'relative' }} // Sesuaikan tinggi body
            >
                {isGeneratingPdf && (
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.7)', zIndex: 10 }}>
                        <Spin size="large" tip="Membuat file PDF..." />
                    </div>
                )}
                {!isGeneratingPdf && pdfBlob ? (
                    <div style={{ height: '100%', width: '100%', overflow: 'auto' }}>
                        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
                            {/* Beri key unik agar viewer re-render saat blob berubah */}
                            <Viewer key={pdfFileName} fileUrl={URL.createObjectURL(pdfBlob)} />
                        </Worker>
                    </div>
                ) : (
                    !isGeneratingPdf && (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}><Empty description="Gagal memuat PDF atau PDF belum dibuat." /></div>)
                )}
            </Modal>
        </>
    );
}