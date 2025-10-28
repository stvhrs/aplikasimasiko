import React, { useState } from 'react';
import { generateBooks } from './generateMockData';

// --- IMPOR BARU UNTUK FIREBASE ---
import { db } from '../api/firebase';
import { ref, set } from 'firebase/database';
// ------------------------------------

export default function GenerateBukuChart() {
  const [booksData, setBooksData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isPushing, setIsPushing] = useState(false); // State baru
  const [copied, setCopied] = useState(false);

  const handleGenerateClick = () => {
    setLoading(true);
    setCopied(false);
    
    setTimeout(() => {
      const data = generateBooks(1000); 
      setBooksData(data);
      setLoading(false);
      console.log("Generated Data:", data);
    }, 500);
  };
  
  // --- FUNGSI BARU UNTUK PUSH KE RTDB ---
  const handlePushToRtdb = async () => {
    if (booksData.length === 0) {
      alert("Silakan generate data terlebih dahulu!");
      return;
    }

    setIsPushing(true);
    console.log("Mulai mengirim ke Firebase RTDB...");

    // Ubah array [ {..}, {..} ] menjadi objek { "kode_buku_1": {..}, "kode_buku_2": {..} }
    // Ini adalah cara terbaik menyimpan list di RTDB.
    const dataAsObject = booksData.reduce((acc, book) => {
      // Kita gunakan kode_buku sebagai key unik
      acc[book.kode_buku] = book;
      return acc;
    }, {});

    try {
      // Tentukan path di database Anda, misal 'buku'
      const dbRef = ref(db, 'buku');
      
      // Gunakan set() untuk menimpa semua data di path '/buku'
      // dengan data baru yang kita generate.
      await set(dbRef, dataAsObject);
      
      alert(`Sukses! ${booksData.length} data buku telah dikirim ke path '/buku' di RTDB.`);
      console.log("Data berhasil dikirim!");

    } catch (error) {
      console.error("Gagal mengirim data ke RTDB:", error);
      alert(`Gagal mengirim data. Cek console (F12) untuk error.\n\nError: ${error.message}`);
    } finally {
      setIsPushing(false);
    }
  };
  // ------------------------------------

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(booksData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); 
  };

  // (Salin 'styles' dari kode sebelumnya, tidak ada perubahan)
  const styles = {
    container: { fontFamily: 'sans-serif', padding: '20px', maxWidth: '800px', margin: '0 auto' },
    button: { padding: '10px 20px', fontSize: '16px', cursor: 'pointer', marginRight: '10px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '5px' },
    buttonDisabled: { backgroundColor: '#ccc', cursor: 'not-allowed' },
    pre: { backgroundColor: '#f4f4f4', border: '1px solid #ddd', borderRadius: '5px', padding: '10px', maxHeight: '400px', overflowY: 'auto', whiteSpace: 'pre-wrap' },
    copyButton: { padding: '8px 12px', fontSize: '14px', cursor: 'pointer', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', marginTop: '10px' },
    pushButton: { padding: '10px 20px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#f0ad4e', color: 'white', border: 'none', borderRadius: '5px' }, // Style tombol push
  };


  return (
    <div style={styles.container}>
      <h1>Generator Data Buku (Mock Data)</h1>
      <p>Klik tombol untuk membuat 1.000 data buku tiruan sesuai format Anda.</p>
      
      <button 
        onClick={handleGenerateClick} 
        disabled={loading}
        style={{...styles.button, ...(loading && styles.buttonDisabled)}}
      >
        {loading ? 'Sedang Membuat...' : 'Generate 1.000 Data Buku'}
      </button>

      {/* --- TOMBOL PUSH BARU --- */}
      <button
        onClick={handlePushToRtdb}
        disabled={isPushing || booksData.length === 0}
        style={{...styles.pushButton, ...((isPushing || booksData.length === 0) && styles.buttonDisabled)}}
      >
        {isPushing ? 'Mengirim ke RTDB...' : 'Push 1.000 Data ke RTDB'}
      </button>

      {booksData.length > 0 && !isPushing && (
        <div style={{ marginTop: '20px' }}>
          <h2>
            Sukses! {booksData.length} data telah dibuat.
          </h2>
          <p>Data lengkap ada di console. Di bawah ini adalah 5 data pertama:</p>

          <button onClick={copyToClipboard} style={styles.copyButton}>
            {copied ? 'Tersalin!' : 'Salin 1.000 data (JSON) ke Clipboard'}
          </button>
          
          <pre style={styles.pre}>
            {JSON.stringify(booksData.slice(0, 5), null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}