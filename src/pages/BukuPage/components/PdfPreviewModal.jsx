// src/components/PdfPreviewModal.jsx
import React, { useRef } from 'react';
import { Modal, Button, Space, message } from 'antd';
import { PrinterOutlined, DownloadOutlined } from '@ant-design/icons';

const PdfPreviewModal = ({ visible, onClose, pdfBlobUrl, fileName = "document.pdf" }) => {
    const iframeRef = useRef(null);

    // Fungsi untuk memicu download dari dalam modal
    const handleDownload = () => {
        if (!pdfBlobUrl) {
            message.error("URL PDF tidak valid.");
            return;
        }
        try {
            const link = document.createElement('a');
            link.href = pdfBlobUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            // URL.revokeObjectURL(pdfBlobUrl); // Jangan revoke di sini, biarkan BukuPage yg handle
        } catch (error) {
            console.error("Error downloading PDF:", error);
            message.error("Gagal mengunduh PDF.");
        }
    };

    // Fungsi untuk memicu print dari iframe
    const handlePrint = () => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            try {
                iframeRef.current.contentWindow.focus(); // Fokus ke iframe
                iframeRef.current.contentWindow.print(); // Panggil print
            } catch (error) {
                console.error("Error printing PDF from iframe:", error);
                message.error("Gagal memulai print. Coba print manual dari viewer PDF.");
                // Fallback: Buka di tab baru untuk print manual
                // window.open(pdfBlobUrl, '_blank');
            }
        } else {
             message.error("Tidak dapat mengakses konten PDF untuk dicetak.");
        }
    };

    return (
        <Modal
            title="Pratinjau PDF"
            open={visible}
            onCancel={onClose}
            width="90%" // Lebar modal
            style={{ top: 20 }} // Posisi dekat atas
            destroyOnClose={true} // Hapus iframe saat ditutup
            footer={ // Tombol custom di footer
                <Space>
                    <Button key="download" icon={<DownloadOutlined />} onClick={handleDownload}>
                        Download PDF
                    </Button>
                    <Button key="print" icon={<PrinterOutlined />} onClick={handlePrint}>
                        Cetak
                    </Button>
                    <Button key="close" onClick={onClose}>
                        Tutup
                    </Button>
                </Space>
            }
        >
            {pdfBlobUrl ? (
                <iframe
                    ref={iframeRef}
                    src={pdfBlobUrl}
                    style={{ width: '100%', height: '75vh', border: 'none' }}
                    title="PDF Preview"
                />
            ) : (
                <p>Memuat pratinjau PDF...</p> // Atau tampilkan loading indicator
            )}
        </Modal>
    );
};

export default PdfPreviewModal;