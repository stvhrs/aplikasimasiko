// src/pages/InvoicePublicPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { db } from '../api/firebase'; // Sesuaikan path
import { downloadInvoicePDF } from '../utils/pdfGenerator'; // Sesuaikan path
import { Spin } from 'antd';

const InvoicePublicPage = () => {
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!id) {
            setError("ID Transaksi tidak ditemukan.");
            setLoading(false);
            return;
        }

        const fetchAndGenerate = async () => {
            try {
                const txRef = ref(db, `transaksiJualBuku/${id}`);
                const snapshot = await get(txRef);
                
                if (snapshot.exists()) {
                    const transaksi = { id: snapshot.key, ...snapshot.val() };
                    // Panggil fungsi download
                    downloadInvoicePDF(transaksi); 
                    setLoading(false);
                    // (Anda bisa menampilkan pesan "Download dimulai...")
                } else {
                    setError("Transaksi tidak ditemukan.");
                    setLoading(false);
                }
            } catch (err) {
                setError(err.message);
                setLoading(false);
            }
        };

        fetchAndGenerate();
    }, [id]);

    return (
        <div style={{ textAlign: 'center', padding: '100px' }}>
            {loading && <Spin size="large" tip="Mempersiapkan invoice..." />}
            {error && <p>Error: {error}</p>}
            {!loading && !error && <p>Download invoice Anda telah dimulai. Silakan cek file download Anda.</p>}
        </div>
    );
};

export default InvoicePublicPage;