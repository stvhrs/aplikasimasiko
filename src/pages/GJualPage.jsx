import React, { useState, useCallback, useEffect } from 'react';
import { Button, Spin, message, Progress, Typography, Space, Card, Alert } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { db } from '../api/firebase'; // Sesuaikan path ke firebase config Anda
import { ref, push, serverTimestamp, get, query, orderByKey, limitToLast, update } from 'firebase/database';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

// --- Helper Functions ---
const snapshotToArray = (snapshot) => {
    const data = snapshot.val();
    return data ? Object.keys(data).map((key) => ({ id: key, ...data[key] })) : [];
};
const getRandomInt = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
};
// -----------------------

// Fungsi generate satu transaksi (DIPERBAIKI check lastInvoiceNumber)
const generateRandomSalesTransaction = (lastInvoiceNumber) => {

    // 1. Generate Pelanggan Acak
    const randomCustId = `CUST-${getRandomInt(100, 999)}`;
    const randomCustName = `Pelanggan Random ${getRandomInt(1, 10000)}`;
    const isSpesialPelanggan = Math.random() < 0.2;

    // 2. Generate Nomor Invoice Baru
    const now = dayjs();
    const year = now.format('YYYY');
    const month = now.format('MM');
    let nextNum = 1;
    let displayInvoice = '';
    let invoiceKey = '';

    // --- PERBAIKAN: Check tipe data lastInvoiceNumber ---
    if (typeof lastInvoiceNumber === 'string' && lastInvoiceNumber.startsWith(`INV/${year}/${month}/`)) {
    // ----------------------------------------------------
        try {
            const lastNumStr = lastInvoiceNumber.split('/').pop();
            const lastNum = parseInt(lastNumStr, 10);
            if (!isNaN(lastNum)) {
                nextNum = lastNum + 1;
            }
        } catch { /* Biarkan nextNum = 1 */ }
    }
    const newNumStr = String(nextNum).padStart(4, '0');
    displayInvoice = `INV/${year}/${month}/${newNumStr}`;
    invoiceKey = `INV-${year}-${month}-${newNumStr}`;

    // 3. Tanggal Acak
    const randomDaysAgo = Math.floor(Math.random() * 365);
    const tanggal = dayjs().subtract(randomDaysAgo, 'day').valueOf();

    // 4. Generate Item Buku Acak
    const itemCount = getRandomInt(1, 5);
    const items = [];
    let totalTagihan = 0;
    let totalQty = 0;

    for (let i = 0; i < itemCount; i++) {
        const randomBookId = `BOOK-${getRandomInt(10000, 9999)}`;
        const randomBookTitle = `Buku Acak Judul ${getRandomInt(1, 500)}`;
        const hargaSatuan = getRandomInt(110000, 2100000);
        const diskonPersen = getRandomInt(0, 20);
        const jumlah = getRandomInt(1, 15);
        const hargaFinal = hargaSatuan * jumlah * (1 - diskonPersen / 100);
        totalQty += jumlah;
        totalTagihan += hargaFinal;
        items.push({ idBuku: randomBookId, judulBuku: randomBookTitle, jumlah, hargaSatuan, diskonPersen });
    }
     if (items.length === 0) { // Seharusnya tidak terjadi dengan logika di atas
        throw new Error("Gagal membuat item buku acak.");
    }

    // 5. Status Pembayaran Acak & Histori
    const statuses = ['Belum Bayar', 'DP', 'Lunas'];
    const statusPembayaran = statuses[Math.floor(Math.random() * statuses.length)];
    let jumlahTerbayar = 0;
    let historiPembayaran = null;
    const generateHistoryKey = () => push(ref(db, `transaksiJualBuku/${invoiceKey}/historiPembayaran`)).key;

    if (statusPembayaran === 'Lunas') {
        jumlahTerbayar = Math.round(totalTagihan);
        const historyKey = generateHistoryKey();
        if (historyKey) { historiPembayaran = { [historyKey]: { tanggalBayar: tanggal + getRandomInt(1, 86400000), jumlahBayar: jumlahTerbayar, metode: 'Transfer', keterangan: 'Pelunasan Otomatis', timestamp: serverTimestamp() } }; }
    } else if (statusPembayaran === 'DP') {
        jumlahTerbayar = Math.round(totalTagihan * (Math.random() * 0.5 + 0.1));
         const historyKey = generateHistoryKey();
         if (historyKey) { historiPembayaran = { [historyKey]: { tanggalBayar: tanggal + getRandomInt(1, 86400000), jumlahBayar: jumlahTerbayar, metode: 'Cash', keterangan: 'Uang Muka Otomatis', timestamp: serverTimestamp() } }; }
    }

    return {
        key: invoiceKey,
        data: {
            nomorInvoice: displayInvoice,
            tanggal,
            idPelanggan: randomCustId,
            namaPelanggan: randomCustName,
            pelangganIsSpesial: isSpesialPelanggan,
            items,
            totalTagihan: Math.round(totalTagihan),
            totalQty,
            keterangan: `Transaksi acak ${Math.random().toString(16).substring(2, 8)}`,
            jumlahTerbayar,
            statusPembayaran,
            historiPembayaran,
            createdAt: serverTimestamp()
        }
    };
};

// --- Komponen React ---
function GJualPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('Siap untuk generate data.');
    const [isDepsLoading, setIsDepsLoading] = useState(false);
    const [lastInvNumber, setLastInvNumber] = useState(null); // Tetap simpan nomor terakhir

    // Fungsi fetch HANYA nomor invoice terakhir
    const fetchLastInvoice = useCallback(async () => {
        setIsDepsLoading(true);
        setStatusText('Mengambil nomor invoice terakhir...');
        console.log("Memulai fetchLastInvoice...");
        try {
            const lastInvQuery = query(ref(db, 'transaksiJualBuku'), orderByKey(), limitToLast(1));
            const lastInvSnapshot = await get(lastInvQuery);

            let lastInvNum = null;
            if (lastInvSnapshot.exists()) {
                 const lastTx = lastInvSnapshot.val();
                 const lastKey = Object.keys(lastTx)[0];
                 // Coba ambil nomor display dari data, fallback ke key jika tidak ada
                 lastInvNum = lastTx[lastKey]?.nomorInvoice || lastKey.replace(/-/g, '/');
                 console.log(`Nomor Invoice Terakhir Ditemukan: ${lastInvNum}`);
            } else {
                 console.log("Tidak ada transaksi sebelumnya, nomor invoice akan mulai dari 1.");
                 lastInvNum = null; // Pastikan null jika kosong
            }

            setLastInvNumber(lastInvNum);
            setStatusText('Nomor invoice siap.');
            setIsDepsLoading(false);
            return true;
        } catch (error) {
            console.error("Gagal fetch invoice terakhir:", error);
            message.error(`Gagal mengambil invoice terakhir: ${error.message}`);
            setStatusText('Gagal mengambil nomor invoice.');
            setIsDepsLoading(false);
            return false;
        }
    }, []);

    // Fungsi utama generate & push
    const handleGenerateAndPush = useCallback(async () => {
        console.log("handleGenerateAndPush dipanggil.");
        const totalData = 10000;

        const readyToGenerate = await fetchLastInvoice();
        if (!readyToGenerate) {
             console.log("Nomor invoice tidak siap, proses generate dibatalkan.");
             return;
        }

        setIsLoading(true);
        setProgress(0);
        setStatusText(`Mulai generate ${totalData} transaksi penjualan...`);

        const updates = {};
        let successCount = 0;
        let errorCount = 0;
        // Gunakan nomor terakhir yg di-fetch, atau null jika database kosong
        let currentLastInvNumber = lastInvNumber;

        try {
            for (let i = 0; i < totalData; i++) {
                // Generate data transaksi
                const { key: txKey, data: txData } = generateRandomSalesTransaction(
                    // Array dummy tidak lagi diperlukan
                    currentLastInvNumber
                );

                 if (i < 5 || i % 10000 === 0) {
                   console.log(`[Iterasi ${i+1}] Generated Key: ${txKey}, Invoice: ${txData.nomorInvoice}`);
                 }

                updates[`transaksiJualBuku/${txKey}`] = txData;
                currentLastInvNumber = txData.nomorInvoice; // Update nomor untuk iterasi berikutnya

                // Kirim per batch
                if (Object.keys(updates).length >= 500 || i === totalData - 1) {
                     const batchSize = Object.keys(updates).length;
                     const startIdx = successCount + 1;
                     const endIdx = successCount + batchSize;
                     setStatusText(`Mengirim batch ${startIdx}-${endIdx}... (${i + 1} / ${totalData})`);
                     console.log(`--> Sending batch update for ${batchSize} transactions...`);

                    try {
                        await update(ref(db), updates);
                        successCount += batchSize;
                        console.log(`==> Batch ${startIdx}-${endIdx} SUCCESS.`);
                        Object.keys(updates).forEach(key => delete updates[key]);

                        const currentProgress = Math.round(((i + 1) / totalData) * 100);
                        setProgress(currentProgress);
                        setStatusText(`Batch terkirim. (${i + 1} / ${totalData})`);

                    } catch(batchError) {
                         console.error(`XXX Batch FAILED (starting from ${startIdx}):`, batchError);
                         message.error(`Gagal mengirim batch data ke-${i+1}. Cek console.`);
                         errorCount += batchSize;
                         Object.keys(updates).forEach(key => delete updates[key]);
                         break;
                    }
                     // await new Promise(resolve => setTimeout(resolve, 200));
                }
            } // End loop
        } catch (generationError) {
             console.error("XXX Error generating transaction:", generationError);
             message.error(`Error saat generate data: ${generationError.message}`);
             // Hitung error berdasarkan sisa data yg belum dikirim
             errorCount = totalData - successCount;
        }

        setIsLoading(false);
        const finalText = `Selesai: ${successCount} berhasil, ${errorCount} gagal.`;
        setStatusText(finalText);
        console.log(finalText);
        if (errorCount === 0) {
            message.success(`Berhasil mengunggah ${successCount} transaksi penjualan!`);
        } else {
            message.warning(`Selesai dengan ${errorCount} kegagalan. Cek console log.`);
        }
         setLastInvNumber(null); // Reset nomor terakhir

    }, [fetchLastInvoice, lastInvNumber]); // Include dependencies

    return (
        <div style={{ padding: '24px' }}>
            <Card>
                <Title level={4}>Generate Data Transaksi Penjualan Acak (Tanpa Relasi)</Title>
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <Paragraph>
                        Fitur ini akan membuat 10.000 data transaksi penjualan buku acak
                        dengan ID/nama buku dan pelanggan acak.
                        Data akan disimpan ke Firebase RTDB di path <Text code>/transaksiJualBuku</Text>.
                        Nomor invoice akan digenerate berurutan.
                    </Paragraph>
                    <Alert
                        message="Penting!"
                       
                        type="warning"
                        showIcon
                    />

                    <Button
                        type="primary"
                        icon={<PlayCircleOutlined />}
                        loading={isLoading || isDepsLoading}
                        onClick={handleGenerateAndPush}
                        disabled={isLoading || isDepsLoading}
                        size="large"
                    >
                        {isLoading ? 'Sedang Memproses...' : (isDepsLoading ? 'Mencari Inv Terakhir...' : 'Generate & Push 10.000 Transaksi Acak')}
                    </Button>

                    {(isLoading || progress > 0) && (
                        <div style={{ marginTop: '16px' }}>
                            <Progress
                                percent={progress}
                                status={isLoading ? 'active' : (progress < 100 && !isLoading ? 'exception' : 'success')}
                            />
                            <Text>{statusText}</Text>
                        </div>
                    )}
                </Space>
            </Card>
        </div>
    );
}

export default GJualPage;