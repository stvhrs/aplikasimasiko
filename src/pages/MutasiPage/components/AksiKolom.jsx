import React, { useState } from 'react';
import { Space, Tooltip, Button, Modal } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined, PrinterOutlined } from '@ant-design/icons';
import { generateInvoicePDF, generateNotaReturPDF } from '../../../utils/pdfGenerator'; // Sesuaikan path

const AksiKolom = ({ record, onView, onEdit, onDelete }) => {
    // State untuk Modal PDF
    const [isPdfVisible, setIsPdfVisible] = useState(false);
    const [pdfUrl, setPdfUrl] = useState('');
    const [pdfTitle, setPdfTitle] = useState('');

    // Handle Print
    const handlePrint = () => {
        let pdfData = '';
        let title = '';

        if (record.kategori === 'Penjualan Buku') {
            pdfData = generateInvoicePDF(record);
            title = `Cetak Invoice - ${record.nomorInvoice}`;
        } else if (record.kategori === 'Retur Buku') {
            pdfData = generateNotaReturPDF(record);
            title = `Cetak Nota Retur - ${record.nomorInvoice}`;
        }

        if (pdfData) {
            setPdfUrl(pdfData);
            setPdfTitle(title);
            setIsPdfVisible(true);
        }
    };

    // Cek apakah transaksi bisa diprint (Penjualan atau Retur)
    const canPrint = record.kategori === 'Penjualan Buku' || record.kategori === 'Retur Buku';

    return (
        <>
            <Space size="middle">
                {/* Tombol Lihat Bukti Upload */}
                <Tooltip title={record.bukti?.url ? "Lihat Bukti Upload" : "Tidak ada bukti upload"}>
                    <Button
                        type="link"
                        icon={<EyeOutlined />}
                        onClick={() => onView(record.bukti?.url)}
                        disabled={!record.bukti?.url}
                    />
                </Tooltip>

                {/* Tombol Print PDF (NEW) */}
                {canPrint && (
                    <Tooltip title={record.kategori === 'Retur Buku' ? "Cetak Nota Retur" : "Cetak Invoice"}>
                        <Button
                            type="link"
                            icon={<PrinterOutlined />}
                            onClick={handlePrint}
                            style={{ color: '#fa8c16' }} // Warna oranye biar beda
                        />
                    </Tooltip>
                )}

                {/* Tombol Edit */}
                <Tooltip title="Edit Transaksi">
                    <Button
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => onEdit(record)}
                    />
                </Tooltip>

                {/* Tombol Hapus */}
                <Tooltip title="Hapus Transaksi">
                    <Button
                        type="link"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => onDelete(record.id)}
                    />
                </Tooltip>
            </Space>

            {/* MODAL PREVIEW PDF */}
            <Modal
                title={pdfTitle}
                open={isPdfVisible}
                onCancel={() => setIsPdfVisible(false)}
                footer={null}
                width={850}
                centered
                bodyStyle={{ height: '80vh', padding: 0 }}
            >
                <iframe
                    src={pdfUrl}
                    title="PDF Preview"
                    style={{ width: '100%', height: '100%', border: 'none' }}
                />
            </Modal>
        </>
    );
};

export default AksiKolom;