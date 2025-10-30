import React, { useState } from 'react';
import { generateBooks } from './generateMockData'; 

// --- IMPOR ANT DESIGN ---
import { Spin, message, Button, Typography, Divider, Progress } from 'antd'; // <-- Tambahkan Progress

// --- IMPOR FIREBASE ---
import { db } from '../api/firebase'; 
// --- (MODIFIKASI) Impor `update` ---
import { ref, update } from 'firebase/database'; 
// ------------------------------------

const { Title, Paragraph } = Typography; 

export default function GenerateBukuChart() {
  const [booksData, setBooksData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isPushing, setIsPushing] = useState(false); 
  const [copied, setCopied] = useState(false);
  // --- (BARU) State untuk progress push ---
  const [pushProgress, setPushProgress] = useState(0); 
  // ---------------------------------------

  const NUM_BOOKS_TO_GENERATE = 3000; 

  const handleGenerateClick = () => {
    // ... (Fungsi generate tidak berubah) ...
    setLoading(true);
    setCopied(false);
    setBooksData([]); 
    message.loading({ content: `Membuat ${NUM_BOOKS_TO_GENERATE.toLocaleString('id-ID')} data buku...`, key: 'generate', duration: 0 });
    
    setTimeout(() => {
      try {
        const data = generateBooks(NUM_BOOKS_TO_GENERATE); 
        setBooksData(data);
        message.success({ content: `${data.length.toLocaleString('id-ID')} data buku berhasil dibuat!`, key: 'generate', duration: 3 });
      } catch (error) {
          console.error("Gagal generate data:", error);
          message.error({ content: `Gagal membuat data: ${error.message}`, key: 'generate', duration: 5 });
      } finally {
        setLoading(false);
      }
    }, 100); 
  };
  
  // --- (MODIFIKASI BESAR) Fungsi Push dengan Batching ---
  const handlePushToRtdb = async () => {
    if (booksData.length === 0) {
      message.warn("Silakan generate data terlebih dahulu!");
      return;
    }

    setIsPushing(true);
    setPushProgress(0); // Reset progress
    message.loading({ content: `Mempersiapkan pengiriman ${booksData.length.toLocaleString('id-ID')} data...`, key: 'push', duration: 0 });
    console.log("Mulai mengirim ke Firebase RTDB secara batch...");

    const BATCH_SIZE = 500; // <-- Ukuran batch (coba 500 dulu, bisa diubah jika masih error/lambat)
    const totalBatches = Math.ceil(booksData.length / BATCH_SIZE);
    let booksSent = 0;

    try {
      const dbRef = ref(db, 'buku'); // Ref ke path utama '/buku'

      for (let i = 0; i < booksData.length; i += BATCH_SIZE) {
        const batch = booksData.slice(i, i + BATCH_SIZE);
        const batchData = batch.reduce((acc, book) => {
          // Tetap gunakan kode_buku atau ID sebagai key unik
          acc[book.kode_buku] = book; 
          return acc;
        }, {});

        // Tampilkan progress
        const currentBatchNum = Math.floor(i / BATCH_SIZE) + 1;
        message.loading({ 
            content: `Mengirim Batch ${currentBatchNum}/${totalBatches} (${batch.length} buku)...`, 
            key: 'push', 
            duration: 0 
        });

        // Kirim batch menggunakan update()
        await update(dbRef, batchData); 

        booksSent += batch.length;
        setPushProgress(Math.round((booksSent / booksData.length) * 100)); // Update progress bar

        console.log(`Batch ${currentBatchNum}/${totalBatches} berhasil dikirim.`);

        // (OPSIONAL) Beri jeda kecil antar batch jika server terasa berat
        // await new Promise(resolve => setTimeout(resolve, 50)); 
      }
      
      message.success({ content: `Sukses! ${booksSent.toLocaleString('id-ID')} data buku telah dikirim ke path '/buku'.`, key: 'push', duration: 5 });
      console.log("Semua data berhasil dikirim!");
      // setBooksData([]); // Opsional: Kosongkan data setelah sukses

    } catch (error) {
      console.error(`Gagal mengirim data ke RTDB pada batch sekitar buku ke-${booksSent}:`, error);
      message.error({ content: `Gagal mengirim data batch: ${error.message}. Cek console.`, key: 'push', duration: 7 });
    } finally {
      setIsPushing(false);
      // Jangan reset progress agar user lihat hasil akhir
    }
  };
  // ------------------------------------

  const copyToClipboard = () => {
    // ... (Fungsi copy tidak berubah) ...
     if (booksData.length === 0) {
        message.info("Data belum digenerate untuk disalin.");
        return;
    }
    navigator.clipboard.writeText(JSON.stringify(booksData, null, 2));
    setCopied(true);
    message.success('Data JSON (lengkap) disalin ke clipboard!', 2); 
    setTimeout(() => setCopied(false), 2000); 
  };

  // Styles (tidak berubah)
  const styles = {
    // ... (copy style dari kode sebelumnya) ...
    container: { fontFamily: 'sans-serif', padding: '20px', maxWidth: '800px', margin: '0 auto', border: '1px solid #eee', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
    button: { padding: '10px 20px', fontSize: '16px', cursor: 'pointer', marginRight: '10px', backgroundColor: '#1890ff', color: 'white', border: 'none', borderRadius: '5px', transition: 'background-color 0.3s' },
    buttonDisabled: { backgroundColor: '#ccc', cursor: 'not-allowed' },
    pre: { backgroundColor: '#f9f9f9', border: '1px solid #ddd', borderRadius: '5px', padding: '15px', maxHeight: '400px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: '0.9em', marginTop: '15px' },
    copyButton: { padding: '8px 12px', fontSize: '14px', cursor: 'pointer', backgroundColor: '#52c41a', color: 'white', border: 'none', borderRadius: '5px', marginBottom: '10px', float: 'right' }, 
    pushButton: { padding: '10px 20px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#faad14', color: 'white', border: 'none', borderRadius: '5px', transition: 'background-color 0.3s' }, 
    spinnerContainer: { textAlign: 'center', marginTop: '30px', fontSize: '16px', color: '#555' },
    progressContainer: { marginTop: '15px', marginBottom: '15px'} // Style untuk progress bar
  };


  return (
    <div style={styles.container}>
      <Title level={2} style={{ textAlign: 'center', marginBottom: '24px' }}>Generator & Pusher Data Buku</Title>
      <Paragraph style={{ textAlign: 'center', color: '#555' }}>
        Buat {NUM_BOOKS_TO_GENERATE.toLocaleString('id-ID')} data buku tiruan dengan struktur lengkap (termasuk histori stok), lalu kirim ke Firebase Realtime Database path `/buku`.
      </Paragraph>
      <Divider /> 
      
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <Button 
            type="primary"
            size="large" 
            onClick={handleGenerateClick} 
            disabled={loading || isPushing}
            loading={loading} 
            style={{ marginRight: '10px' }}
          >
            {loading ? 'Membuat...' : `Generate ${NUM_BOOKS_TO_GENERATE.toLocaleString('id-ID')} Data`}
          </Button>

          <Button
            type="primary" 
            size="large"
            onClick={handlePushToRtdb}
            disabled={isPushing || loading || booksData.length === 0}
            loading={isPushing} 
            style={{ backgroundColor: '#faad14', borderColor: '#faad14' }} 
          >
            {isPushing ? 'Mengirim...' : `Push ke Firebase`}
          </Button>
      </div>

       {/* --- (BARU) Tampilkan Progress Bar saat Pushing --- */}
       {isPushing && (
            <div style={styles.progressContainer}>
                <Paragraph style={{ textAlign: 'center', marginBottom: '5px' }}>
                    Mengirim data ke Firebase... ({pushProgress}%)
                </Paragraph>
                <Progress percent={pushProgress} status="active" />
            </div>
        )}
       {/* ----------------------------------------------- */}


      {/* Tampilkan preview jika data ada dan tidak sedang pushing */}
      {booksData.length > 0 && !isPushing && ( 
        <div style={{ marginTop: '20px' }}>
          <Title level={4}>
            Data Berhasil Dibuat ({booksData.length.toLocaleString('id-ID')} item)
          </Title>
          <Paragraph type='secondary'>
            Data lengkap ada di console browser (F12). Klik tombol salin atau lihat 5 data pertama di bawah ini.
          </Paragraph>

          <Button onClick={copyToClipboard} style={styles.copyButton}>
            {copied ? 'Tersalin!' : 'Salin JSON Lengkap'}
          </Button>
          
          <pre style={styles.pre}>
            {JSON.stringify(booksData.slice(0, 5), null, 2)}
          </pre>
        </div>
      )}

      {/* Tampilkan pesan loading/spinning (dihapus karena sudah ada progress bar) */}
      {/* {(loading || isPushing) && (
          // ... spinner lama ...
      )} 
      */}
    </div>
  );
}