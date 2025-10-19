// src/pages/InvoicePublicPage.jsx
// Versi bersih tanpa karakter error

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { db } from '../api/firebase'; // Sesuaikan path
import { generateInvoicePDF } from '../utils/pdfGenerator'; // Pastikan ini 'generate' (mengembalikan URL)
import { Layout, Spin, Button, App, Result, Space, Typography } from 'antd';
import { DownloadOutlined, ShareAltOutlined } from '@ant-design/icons';

const { Header, Content } = Layout;
const { Title } = Typography;

const InvoicePublicPage = () => {
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pdfUrl, setPdfUrl] = useState(''); // State untuk menampung URL PDF
    const [transaksi, setTransaksi] = useState(null); // State untuk data transaksi (untuk judul/share)
    const { message } = App.useApp(); // Gunakan 'message' dari AntD

    useEffect(() => {
        if (!id) {
            setError("ID Transaksi tidak ditemukan.");
            setLoading(false);
            return;
        }

        const fetchAndGenerate = async () => {
            setLoading(true);
            setError(null);
            try {
                const txRef = ref(db, `transaksiJualBuku/${id}`);
                const snapshot = await get(txRef);
                
                if (snapshot.exists()) {
                    const txData = { id: snapshot.key, ...snapshot.val() };
                    setTransaksi(txData); // Simpan data transaksi

                    // Panggil fungsi yang mengembalikan URL
                    const url = generateInvoicePDF(txData);
                    setPdfUrl(url); // Simpan URL ke state

                    setLoading(false);
                } else {
                    setError("Transaksi tidak ditemukan.");
                    setLoading(false);
                }
            } catch (err) {
                console.error(err);
                setError(err.message || 'Gagal memuat data');
                setLoading(false);
            }
        };

        fetchAndGenerate();
    }, [id]);

    // Helper untuk mendapatkan nama file
    const getPdfTitle = () => {
        if (!transaksi) return 'invoice.pdf';
        return `Invoice_${transaksi.nomorInvoice || transaksi.id}.pdf`;
    };

    // --- HANDLER UNTUK DOWNLOAD ---
    const handleDownloadPdf = async () => {
        if (!pdfUrl) return;
        message.loading({ content: 'Mempersiapkan download...', key: 'pdfdownload' });
        try {
            const response = await fetch(pdfUrl);
            if (!response.ok) throw new Error('Gagal mengambil file PDF.');
            const blob = await response.blob();
            const objectUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.setAttribute('download', getPdfTitle());
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(objectUrl);
            message.success({ content: 'Download dimulai!', key: 'pdfdownload', duration: 2 });
        } catch (error) {
            console.error('Download error:', error);
            message.error({ content: `Gagal download: ${error.message}`, key: 'pdfdownload', duration: 3 });
        }
    };

    // --- HANDLER UNTUK SHARE FILE ---
    const handleSharePdf = async () => {
        if (!navigator.share) {
            message.error('Web Share API tidak didukung di browser ini.');
            return;
        }
        message.loading({ content: 'Mempersiapkan file...', key: 'pdfshare' });
        try {
            const response = await fetch(pdfUrl);
            if (!response.ok) throw new Error('Gagal mengambil file PDF.');
            const blob = await response.blob();
            const fileName = getPdfTitle();
            const file = new File([blob], fileName, { type: 'application/pdf' });

            const shareData = {
                title: `Invoice ${transaksi?.nomorInvoice || id}`,
                text: `Berikut adalah invoice untuk ${transaksi?.namaPelanggan || 'pelanggan'}`,
                files: [file],
            };

            if (navigator.canShare && navigator.canShare(shareData)) {
                await navigator.share(shareData);
                message.success({ content: 'File berhasil dibagikan!', key: 'pdfshare', duration: 2 });
            } else {
                // Fallback jika tidak bisa share file, share link saja
                await navigator.share({
                    title: `Invoice ${transaksi?.nomorInvoice || id}`,
                    url: window.location.href, // Share link halaman ini
                });
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Share error:', error);
                message.error({ content: `Gagal membagikan: ${error.message}`, key: 'pdfshare', duration: 3 });
            } else {
                message.destroy('pdfshare');
            }
        }
    };

    // --- TAMPILAN UI BARU ---
    return (
        <Layout style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
            <Header style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'white',
                borderBottom: '1px solid #f0f0f0',
                padding: '0 24px',
                position: 'fixed', // Header tetap di atas
                width: '100%',
                zIndex: 10
            }}>
                <Title level={4} style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {loading ? 'Memuat Invoice...' : `Invoice: ${transaksi?.nomorInvoice || id}`}
                </Title>
                <Space>
                    <Button
                        icon={<ShareAltOutlined />}
                        onClick={handleSharePdf}
                        disabled={loading || !!error || !navigator.share}
                    >
                        Share
                    </Button>
                    <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={handleDownloadPdf}
                        disabled={loading || !!error}
                    >
                        Download
                    </Button>
                </Space>
            </Header>
            <Content style={{
                // Beri padding atas seukuran header
                paddingTop: '64px',
                // Tinggi 100% layar
                height: '100vh',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {loading && (
                    <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Spin size="large" tip="Mempersiapkan invoice..." />
                    </div>
                )}
                {error && (
                    <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Result
                            status="error"
                            title="Gagal Memuat Invoice"
                            subTitle={error}
                        />
                    </div>
                )}
                {!loading && !error && pdfUrl && (
                    // Iframe mengisi sisa ruang
                    <iframe
                        src={pdfUrl}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        title="Preview Invoice"
                    />
                )}
            </Content>
        </Layout>
    );
};

export default InvoicePublicPage;