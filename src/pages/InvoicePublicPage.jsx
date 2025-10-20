// src/pages/InvoicePublicPage.jsx
// Versi: react-pdf viewer + Firebase + blob generator

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { db } from '../api/firebase';
import { generateInvoicePDF } from '../utils/pdfGenerator';
import { Layout, Spin, Button, App, Result, Space, Typography } from 'antd';
import { DownloadOutlined, ShareAltOutlined } from '@ant-design/icons';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';

const { Header, Content } = Layout;
const { Title } = Typography;

const InvoicePublicPage = () => {
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pdfBlob, setPdfBlob] = useState(null);
    const [transaksi, setTransaksi] = useState(null);
    const { message } = App.useApp();

    useEffect(() => {
        const fetchAndGenerate = async () => {
            try {
                if (!id || typeof id !== 'string') {
                    throw new Error(`ID tidak valid: ${id}`);
                }

                setLoading(true);
                const txRef = ref(db, `transaksiJualBuku/${id}`);
                const snapshot = await get(txRef);

                if (!snapshot.exists()) throw new Error('Transaksi tidak ditemukan');

                const txData = { id: snapshot.key, ...snapshot.val() };
                setTransaksi(txData);

                // Generate data URI lalu ubah ke blob
                const dataUri = await generateInvoicePDF(txData);
                const blob = await fetch(dataUri).then((r) => r.blob());
                setPdfBlob(blob);
            } catch (err) {
                console.error('Invoice load error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchAndGenerate();
    }, [id]);

    const getPdfTitle = () =>
        transaksi ? `Invoice_${transaksi.nomorInvoice || transaksi.id}.pdf` : 'invoice.pdf';

    const handleDownloadPdf = async () => {
        if (!pdfBlob) return;
        message.loading({ content: 'Mempersiapkan download...', key: 'pdfdownload' });
        try {
            const url = URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', getPdfTitle());
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            message.success({ content: 'Download dimulai!', key: 'pdfdownload', duration: 2 });
        } catch (error) {
            console.error('Download error:', error);
            message.error({ content: `Gagal download: ${error.message}`, key: 'pdfdownload', duration: 3 });
        }
    };

    const handleSharePdf = async () => {
        if (!navigator.share) {
            message.error('Web Share API tidak didukung di browser ini.');
            return;
        }
        try {
            const file = new File([pdfBlob], getPdfTitle(), { type: 'application/pdf' });
            const shareData = {
                title: `Invoice ${transaksi?.nomorInvoice || id}`,
                text: `Berikut adalah invoice untuk ${transaksi?.namaPelanggan || 'pelanggan'}`,
                files: [file],
            };

            if (navigator.canShare && navigator.canShare(shareData)) {
                await navigator.share(shareData);
                message.success('File berhasil dibagikan!');
            } else {
                await navigator.share({
                    title: `Invoice ${transaksi?.nomorInvoice || id}`,
                    url: window.location.href,
                });
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Share error:', error);
                message.error(`Gagal membagikan: ${error.message}`);
            }
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
            <Header
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'white',
                    borderBottom: '1px solid #f0f0f0',
                    padding: '0 24px',
                    position: 'fixed',
                    width: '100%',
                    zIndex: 10,
                }}
            >
                <Title
                    level={4}
                    style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                    {loading ? 'Memuat Invoice...' : `Invoice: ${transaksi?.nomorInvoice || id}`}
                </Title>
                <Space>
                    <Button
                        icon={<ShareAltOutlined />}
                        onClick={handleSharePdf}
                        disabled={loading || !!error || !pdfBlob}
                    >
                        Share
                    </Button>
                    <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={handleDownloadPdf}
                        disabled={loading || !!error || !pdfBlob}
                    >
                        Download
                    </Button>
                </Space>
            </Header>

            <Content
                style={{
                    paddingTop: '64px',
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {loading && (
                    <div
                        style={{
                            flexGrow: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Spin size="large" tip="Mempersiapkan invoice..." />
                    </div>
                )}

                {error && (
                    <div
                        style={{
                            flexGrow: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Result status="error" title="Gagal Memuat Invoice" subTitle={error} />
                    </div>
                )}

                {!loading && !error && pdfBlob && (
                    <div
                        style={{
                            flexGrow: 1,
                            overflow: 'auto',
                            backgroundColor: '#f0f2f5',
                        }}
                    >
                        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
                            <Viewer fileUrl={URL.createObjectURL(pdfBlob)} />
                        </Worker>
                    </div>
                )}
            </Content>
        </Layout>
    );
};

export default InvoicePublicPage;
