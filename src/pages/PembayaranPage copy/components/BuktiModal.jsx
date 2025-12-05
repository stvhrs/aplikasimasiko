import React, { useState, useEffect } from 'react';
import { Modal, Button, Spin, message } from 'antd';
import { DownloadOutlined, ShareAltOutlined } from '@ant-design/icons';

const BuktiModal = ({ url, isOpen, onClose }) => {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            setIsLoading(true); // Reset loading state setiap modal dibuka
        }
    }, [isOpen]);
    
    const handleDownloadProof = async () => {
        if (!url) return;
        message.loading({ content: 'Mengunduh file...', key: 'downloading' });
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Gagal mengambil file.');
            const blob = await response.blob();
            const objectUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            const fileName = url.split('/').pop().split('?')[0].split('%2F').pop() || 'bukti-transaksi';
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(objectUrl);
            message.success({ content: 'File berhasil diunduh!', key: 'downloading', duration: 2 });
        } catch (error) {
            console.log('Error downloading file:', error);
            message.error({ content: 'Gagal mengunduh file.', key: 'downloading', duration: 3 });
        }
    };

    const handleShareProof = async () => {
        if (!navigator.share) {
            message.warning('Fitur share tidak didukung di browser ini.');
            return;
        }
        message.loading({ content: 'Menyiapkan file...', key: 'sharing' });
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Gagal mengambil file.');
            const blob = await response.blob();
            const fileName = url.split('/').pop().split('?')[0].split('%2F').pop() || 'bukti-transaksi';
            const file = new File([blob], fileName, { type: blob.type });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: 'Bukti Transaksi' });
            } else {
                await navigator.share({ title: 'Bukti Transaksi', url });
            }
            message.success({ content: 'Berhasil dibagikan!', key: 'sharing', duration: 2 });
        } catch (error) {
            if (error.name !== 'AbortError') {
                message.error({ content: 'Gagal membagikan file.', key: 'sharing', duration: 2 });
            } else {
                message.destroy('sharing');
            }
        }
    };

    return (
        <Modal
            open={isOpen}
            title="Bukti Transaksi"
            onCancel={onClose}
            footer={[
                <Button key="close" onClick={onClose}>Tutup</Button>,
                navigator.share && (
                    <Button key="share" icon={<ShareAltOutlined />} onClick={handleShareProof}>Share</Button>
                ),
                <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={handleDownloadProof}>Download</Button>
            ]}
            width={800}
            bodyStyle={{ padding: '24px', textAlign: 'center', minHeight: '300px' }}
            destroyOnClose
        >
            {isLoading && <Spin size="large" />}
            {url && (
                url.toLowerCase().includes('.pdf') ? (
                    <iframe
                        src={url}
                        style={{ width: '100%', height: '65vh', border: 'none', display: isLoading ? 'none' : 'block' }}
                        title="Bukti PDF"
                        onLoad={() => setIsLoading(false)}
                    />
                ) : (
                    <img
                        alt="Bukti Transaksi"
                        style={{ width: '100%', height: 'auto', maxHeight: '70vh', objectFit: 'contain', display: isLoading ? 'none' : 'block' }}
                        src={url}
                        onLoad={() => setIsLoading(false)}
                    />
                )
            )}
        </Modal>
    );
};

export default BuktiModal;
