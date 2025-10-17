import React, { useState, useEffect } from 'react';
import { Layout, Card, Spin, Empty, Typography } from 'antd';
import { ref, onValue } from 'firebase/database';
import { db } from '../../api/firebase'; // Pastikan path ini benar

import TransaksiJualForm from './components/TransaksiJualForm'; // Kita akan buat file ini

const { Content } = Layout;
const { Title } = Typography;

// Fungsi helper untuk mengubah snapshot RTDB menjadi array
const snapshotToArray = (snapshot) => {
    const data = snapshot.val();
    return data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
};

const TransaksiJualPage = () => {
    const [bukuList, setBukuList] = useState([]);
    const [pelangganList, setPelangganList] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const bukuRef = ref(db, 'buku');
        const pelangganRef = ref(db, 'pelanggan');

        let bukuLoaded = false;
        let pelangganLoaded = false;

        const checkLoading = () => {
            if (bukuLoaded && pelangganLoaded) {
                setLoading(false);
            }
        };

        const unsubBuku = onValue(bukuRef, (snapshot) => {
            setBukuList(snapshotToArray(snapshot));
            bukuLoaded = true;
            checkLoading();
        });

        const unsubPelanggan = onValue(pelangganRef, (snapshot) => {
            setPelangganList(snapshotToArray(snapshot));
            pelangganLoaded = true;
            checkLoading();
        });

        return () => {
            unsubBuku();
            unsubPelanggan();
        };
    }, []);

    return (
        <Content style={{ padding: '24px' }}>
            <Card>
                <Title level={4}>Buat Transaksi Penjualan Buku Baru</Title>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '50px' }}>
                        <Spin size="large" />
                        <p>Memuat data buku & pelanggan...</p>
                    </div>
                ) : (
                    <TransaksiJualForm
                        bukuList={bukuList}
                        pelangganList={pelangganList}
                    />
                )}
            </Card>
        </Content>
    );
};

export default TransaksiJualPage;