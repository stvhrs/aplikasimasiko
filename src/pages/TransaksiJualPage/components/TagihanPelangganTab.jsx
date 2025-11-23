// src/pages/transaksi-jual/components/TagihanPelangganTab.jsx
import React, { useState, useMemo, useCallback, useDeferredValue } from 'react';
import { Card, Typography, Input, Row, Col, Button, Spin, Modal, Empty, App } from 'antd';
import { PrinterOutlined, ShareAltOutlined, DownloadOutlined } from '@ant-design/icons';
import TransaksiJualTableComponent from './TransaksiJualTableComponent'; 
import useDebounce from '../../../hooks/useDebounce'; 
import { currencyFormatter } from '../../../utils/formatters'; 
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Worker, Viewer } from '@react-pdf-viewer/core'; 
import '@react-pdf-viewer/core/lib/styles/index.css';
import dayjs from 'dayjs'; 
import 'dayjs/locale/id'; // Pastikan locale ID diload

const { Title } = Typography;
const { Search } = Input;

// --- Helper PDF (Diupdate menerima parameter periodText) ---
const generateCustomerReportPdfBlob = (data, searchText, periodText) => {
    if (!data || data.length === 0) {
        throw new Error('Tidak ada data pelanggan untuk dicetak.');
    }

    const doc = new jsPDF();
    let startY = 36; 
    const title = 'Laporan Tagihan per Pelanggan';
    
    // Header
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    
    // Sub-header (Periode)
    doc.setFontSize(11);
    doc.text(`Periode: ${periodText}`, 14, 28);

    doc.setFontSize(10);
    if (searchText) {
        doc.text(`Filter Pencarian: "${searchText}"`, 14, 34);
        startY = 42; // Geser ke bawah jika ada filter search
    } else {
        startY = 36;
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
            [ '', '', 'TOTAL', 
              currencyFormatter(totals.tagihan),
              currencyFormatter(totals.terbayar),
              currencyFormatter(totals.sisa) ]
        ],
        footStyles: { fontStyle: 'bold', halign: 'right', fillColor: [230, 230, 230], textColor: 0 }
    });

    return doc.output('blob'); 
};


// --- Komponen Utama ---
// PERUBAHAN: Menambahkan props `dateRange` dan `isAllTime`
export default function TagihanPelangganTab({ allTransaksi, loadingTransaksi, dateRange, isAllTime }) {
    const { message: antdMessage } = App.useApp(); 
    const [searchText, setSearchText] = useState('');
    const debouncedSearchText = useDebounce(searchText, 300);
    
    // --- Logic untuk teks Periode ---
    const periodText = useMemo(() => {
        if (isAllTime) return "Semua Waktu";
        if (dateRange && dateRange[0] && dateRange[1]) {
            // Format: 01 Jan 2024 - 31 Des 2024
            return `${dateRange[0].format('DD MMM YYYY')} - ${dateRange[1].format('DD MMM YYYY')}`;
        }
        return "Semua Waktu"; // Fallback
    }, [isAllTime, dateRange]);

    const showTotalPagination = useCallback((total, range) => `${range[0]}-${range[1]} dari ${total} pelanggan`, []);
    const [pagination, setPagination] = useState({
        current: 1, pageSize: 50, showSizeChanger: true, pageSizeOptions: ['25', '50', '100', '200'], showTotal: showTotalPagination
    });

    // State PDF Modal
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

    // Filter Search
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

    // Columns
    const columns = useMemo(() => [
        { title: 'No.', key: 'index', width: 60, render: (_t, _r, idx) => ((pagination.current - 1) * pagination.pageSize) + idx + 1 },
        { title: 'Nama Pelanggan', dataIndex: 'namaPelanggan', key: 'namaPelanggan', sorter: (a, b) => a.namaPelanggan.localeCompare(b.namaPelanggan) },
        {
            title: 'Nomor HP', dataIndex: 'telepon', key: 'telepon', width: 150,
            render: (telepon) => {
                if (!telepon) return '-';
                let formattedTelepon = telepon.replace(/\D/g, '');
                if (formattedTelepon.startsWith('0')) formattedTelepon = '62' + formattedTelepon.substring(1);
                else if (!formattedTelepon.startsWith('62')) formattedTelepon = '62' + formattedTelepon;
                
                if (formattedTelepon.length >= 11) {
                    return (<a href={`https://wa.me/${formattedTelepon}`} target="_blank" rel="noopener noreferrer">{telepon}</a>);
                } else { return telepon; }
            }
        },
        { title: 'Total Tagihan', dataIndex: 'totalTagihan', key: 'totalTagihan', align: 'right', width: 180, render: currencyFormatter, sorter: (a, b) => a.totalTagihan - b.totalTagihan },
        { title: 'Total Terbayar', dataIndex: 'totalTerbayar', key: 'totalTerbayar', align: 'right', width: 180, render: (val) => <span style={{ color: '#3f8600' }}>{currencyFormatter(val)}</span>, sorter: (a, b) => a.totalTerbayar - b.totalTerbayar },
        { title: 'Sisa Tagihan', dataIndex: 'sisaTagihan', key: 'sisaTagihan', align: 'right', width: 200, render: (val) => <span style={{ color: val > 0 ? '#cf1322' : '#3f8600', fontWeight: 600 }}>{currencyFormatter(val)}</span>, sorter: (a, b) => a.sisaTagihan - b.sisaTagihan, defaultSortOrder: 'descend' }
    ], [pagination]); 

    const tableScrollX = useMemo(() => columns.reduce((acc, col) => acc + (col.width || 150), 0), [columns]);

    // Handlers
    const handleSearchChange = useCallback((e) => { setSearchText(e.target.value); setPagination(prev => ({ ...prev, current: 1 })); }, []);
    const handleTableChange = useCallback((paginationConfig) => { setPagination(paginationConfig); }, []);

    // Handler Generate PDF
    const handleGeneratePdf = useCallback(async () => {
        if (filteredCustomerSummary.length === 0) {
            antdMessage.warning('Tidak ada data pelanggan untuk dicetak.');
            return;
        }

        const title = 'Laporan Tagihan per Pelanggan';
        setPdfTitle(title);
        setIsGeneratingPdf(true);
        setIsPdfModalOpen(true);
        setPdfBlob(null);
        setPdfFileName(`Laporan_Tagihan_Pelanggan_${dayjs().format('YYYYMMDD')}.pdf`);

        setTimeout(async () => {
            try {
                // Kirim periodText ke fungsi generator
                const blob = generateCustomerReportPdfBlob(filteredCustomerSummary, debouncedSearchText, periodText);
                setPdfBlob(blob);
            } catch (err) {
                console.error("Gagal generate PDF:", err);
                antdMessage.error('Gagal membuat PDF.');
                setIsPdfModalOpen(false);
            } finally {
                setIsGeneratingPdf(false);
            }
        }, 50);

    }, [filteredCustomerSummary, debouncedSearchText, periodText, antdMessage]); // Tambah periodText ke dependency

    const handleClosePdfModal = useCallback(() => { setIsPdfModalOpen(false); setIsGeneratingPdf(false); setPdfBlob(null); setPdfTitle(''); }, []);
    const handleDownloadPdf = useCallback(async () => { if (!pdfBlob) return; antdMessage.loading({ content: 'Mengunduh...', key: 'pdfdl' }); try { const url = URL.createObjectURL(pdfBlob); const link = document.createElement('a'); link.href = url; const fn = `${pdfFileName.replace(/[\/:]/g, '_') || 'download'}`; link.setAttribute('download', fn); document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); antdMessage.success({ content: 'Unduhan dimulai!', key: 'pdfdl', duration: 2 }); } catch (err) { antdMessage.error({ content: `Gagal mengunduh: ${err.message}`, key: 'pdfdl', duration: 3 }); } }, [pdfBlob, pdfFileName, antdMessage]);
    const handleSharePdf = useCallback(async () => { if (!navigator.share) { antdMessage.error('Fitur share tidak didukung.'); return; } if (!pdfBlob) return; const fn = `${pdfFileName.replace(/[\/:]/g, '_') || 'file'}`; const file = new File([pdfBlob], fn, { type: 'application/pdf' }); const shareData = { title: pdfTitle, text: `File PDF: ${pdfTitle}`, files: [file] }; if (navigator.canShare && navigator.canShare(shareData)) { try { await navigator.share(shareData); antdMessage.success('Berhasil dibagikan!'); } catch (err) { if (err.name !== 'AbortError') antdMessage.error(`Gagal berbagi: ${err.message}`); } } else { antdMessage.warn('Tidak didukung.'); } }, [pdfBlob, pdfTitle, pdfFileName, antdMessage]);

    return (
        <>
            <Card
                // PERUBAHAN: Judul Card Dinamis
                title={<Title level={5} style={{ margin: 0 }}>Ringkasan Tagihan ({periodText})</Title>}
            >
                {/* Search & Print Button */}
                <Row gutter={[16, 16]} style={{ marginBottom: 24, alignItems: 'center' }}>
                    <Col xs={24} md={18}>
                        <Search placeholder="Cari nama pelanggan..." value={searchText} onChange={handleSearchChange} allowClear style={{ width: '100%' }} />
                    </Col>
                    <Col xs={24} md={6}>
                        <Button icon={<PrinterOutlined />} onClick={handleGeneratePdf} disabled={filteredCustomerSummary.length === 0 || isGeneratingPdf} loading={isGeneratingPdf} style={{ width: '100%' }}>
                            Cetak PDF
                        </Button>
                    </Col>
                </Row>
                
                <Spin spinning={isFiltering || loadingTransaksi} tip={loadingTransaksi ? "Memuat data..." : "Mencari..."}>
                    <TransaksiJualTableComponent
                        columns={columns}
                        dataSource={filteredCustomerSummary}
                        loading={false} 
                        isFiltering={false} 
                        pagination={pagination}
                        handleTableChange={handleTableChange}
                        tableScrollX={tableScrollX}
                        rowClassName={(record, index) => (index % 2 === 0 ? 'table-row-even' : 'table-row-odd')}
                    />
                </Spin>
            </Card>

            {/* Modal PDF (Sama seperti sebelumnya) */}
            <Modal title={pdfTitle} open={isPdfModalOpen} onCancel={handleClosePdfModal} width="95vw" style={{ top: 20 }} destroyOnClose footer={[ <Button key="close" onClick={handleClosePdfModal}>Tutup</Button>, navigator.share && (<Button key="share" icon={<ShareAltOutlined />} onClick={handleSharePdf} disabled={isGeneratingPdf || !pdfBlob}>Bagikan File</Button>), <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={handleDownloadPdf} disabled={isGeneratingPdf || !pdfBlob}>Unduh</Button> ]} bodyStyle={{ padding: 0, height: 'calc(100vh - 150px)', position: 'relative' }}>
                {isGeneratingPdf && ( <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.7)', zIndex: 10 }}> <Spin size="large" tip="Membuat file PDF..." /> </div> )}
                {!isGeneratingPdf && pdfBlob ? ( <div style={{ height: '100%', width: '100%', overflow: 'auto' }}> <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js"> <Viewer key={pdfFileName} fileUrl={URL.createObjectURL(pdfBlob)} /> </Worker> </div> ) : ( !isGeneratingPdf && (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}><Empty description="Gagal memuat PDF atau PDF belum dibuat." /></div>) )}
            </Modal>
        </>
    );
}