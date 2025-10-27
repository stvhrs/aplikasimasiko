import React, { useState, useCallback } from 'react';
import { Button, Input, message, Spin, Space, Typography } from 'antd';
import { CloudUploadOutlined, CopyOutlined, SyncOutlined, CodeOutlined } from '@ant-design/icons';
import { db } from '../api/firebase.js'; // Sesuaikan path ke file firebase.js kamu
import { ref, push, set } from "firebase/database";

const { Text } = Typography;
const { TextArea } = Input;

// --- Helper & Default Values (Tidak Berubah) ---
const romanToIntMap = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };

const romanToInt = (s) => romanToIntMap[s.toUpperCase()] || null;

const formatCellValue = (cellValue) => {
  if (cellValue === null || cellValue === undefined) {
    return '';
  }
  return String(cellValue).trim();
};

// =================================================================
// --- FUNGSI PARSING (DIPERBARUI SESUAI PERMINTAAN) ---
// =================================================================
/**
 * Mem-parsing satu OBJEK data dari JSON menjadi objek buku.
 * @param {Object} item - Objek data baris dari array JSON
 * @returns {Object|null} - Objek bukuData yang sudah diproses, atau null jika baris tidak valid.
*/
const parseBookRow = (item) => {
  // Pastikan item adalah objek
  if (!item || typeof item !== 'object') {
    return null;
  }

  // --- 1. Ambil data mentah (Sesuai mapping KEY JSON) ---
  const kodeBukuRaw = item["Kode"];
  const namaBarangRaw = item["Nama Barang"];
  const qtyRaw = item["Qty"];
  const groupRaw = item["Group"];
  const departemenRaw = item["Departemen"];

  // Validasi data penting
  if (!kodeBukuRaw || !namaBarangRaw) {
    return null; // Lewati baris jika tidak ada Kode atau Nama
  }

  // --- 2. Inisialisasi Variabel ---
  let kodeBuku = formatCellValue(kodeBukuRaw);
  let judul = formatCellValue(namaBarangRaw);
  let judul_untuk_diproses = formatCellValue(namaBarangRaw);
  let departemen = formatCellValue(departemenRaw);
  let penerbit = "BSE"; // Default
  let tahun = null;
  let kelas = null;
  let mapel = null;
  let jenjang = null;

  // --- 3. Proses Parsing & Cleaning (Menggunakan 'judul_untuk_diproses') ---
  const groupStr = formatCellValue(groupRaw).toUpperCase();
  const deptStr = departemen.toUpperCase();

  // 3a. Ekstrak Penerbit
  const penerbitMatch = judul_untuk_diproses.match(/\(([^)]+)\)/);
  if (penerbitMatch && penerbitMatch[1]) {
    penerbit = penerbitMatch[1].trim().toLowerCase();
    judul_untuk_diproses = judul_untuk_diproses.replace(penerbitMatch[0], '').trim();
  }

  // 3b. Cek Revisi
  const revisiMatch = judul_untuk_diproses.match(/\(\s*REVISI\s*\)/i);
  if (revisiMatch) {
    tahun = "revisi";
    judul_untuk_diproses = judul_untuk_diproses.replace(revisiMatch[0], '').trim();
  }

  // 3c. Ekstrak Kelas
  if (groupStr === "UMUM") {
      kelas = "UMUM";
  } else {
      const deptKelasMatch = deptStr.match(/KELAS\s+([IVXLCDM\w\s]+)/i);
      if (deptKelasMatch && deptKelasMatch[1]) {
          const kelasRawDept = deptKelasMatch[1].trim();
          const kelasNumDept = parseInt(kelasRawDept, 10);
          if (!isNaN(kelasNumDept)) {
              kelas = kelasNumDept;
          } else {
              const romawiNum = romanToInt(kelasRawDept);
              kelas = romawiNum !== null ? romawiNum : kelasRawDept;
          }
      }
  }

  // 3d. Hapus sisa "KELAS..." dari Judul
  const sisaKelasDiJudulMatch = judul_untuk_diproses.match(/\.?\s*KELAS\s+([IVXLCDM\w\s]+)$/i);
  if (sisaKelasDiJudulMatch) {
      judul_untuk_diproses = judul_untuk_diproses.substring(0, sisaKelasDiJudulMatch.index).trim();
  }
  judul_untuk_diproses = judul_untuk_diproses.replace(/[\s.]+$/, '').trim();

  // 3e. Tebak Mapel
  const potentialMapel = judul_untuk_diproses.split('.')[0].split(' - ')[0].split(' SMT ')[0];
  if (!potentialMapel.match(/^T\.\d+$/i) && !potentialMapel.match(/^TEMA\s+\d+/i)) {
    let cleanedMapel = potentialMapel.trim();
    cleanedMapel = cleanedMapel.replace(/\s+(\d+|[IVX]+)$/i, '').trim();
    mapel = cleanedMapel || null;
  } else {
    mapel = "Tematik";
  }
  if (mapel && mapel.length > 25) {
    mapel = mapel.substring(0, 25) + "...";
  }

  // --- 4. Proses Kolom Lain ---

  // 4a. Peruntukan
  let peruntukan;
  if (groupStr === "UMUM") {
      peruntukan = "UMUM";
  } else {
      peruntukan = groupStr.includes("GURU") ? "guru" : "siswa";
  }

  // 4b. Spek
  const spek = deptStr.includes("LKS") ? "LKS" : "Buku";

  // 4c. Jenjang
  if (groupStr === "UMUM") {
      jenjang = "UMUM";
  }
  else if (typeof kelas === 'number') {
      if (kelas >= 1 && kelas <= 6) jenjang = "SD";
      else if (kelas >= 7 && kelas <= 9) jenjang = "SMP";
      else if (kelas >= 10 && kelas <= 12) jenjang = "SMA";
      else {
          const jenjangMatch = deptStr.match(/(SD|SMP|SMA|SMK)/);
          jenjang = jenjangMatch ? jenjangMatch[0] : "UMUM";
      }
  }
  else {
      const jenjangMatch = deptStr.match(/(SD|SMP|SMA|SMK)/);
      jenjang = jenjangMatch ? jenjangMatch[0] : "UMUM";
  }

  // 4d. Stok
  const stokStr = formatCellValue(qtyRaw).replace(/,/g, '');
  const stok = parseInt(stokStr, 10) || 0;

  // 4e. Tipe Buku (Sesuai Permintaan)
  const tipe_buku = (penerbit.toLowerCase() === 'bse' || tahun === 'revisi') ? 'HET' : '';

  // --- 5. Buat Histori Stok Awal ---
  const historyRef = push(ref(db, 'buku/historiStok'));
  const historyKey = historyRef.key;

  const newHistoryEntry = {
    [historyKey]: {
      keterangan: "Cetakan dari Gubuk",
      perubahan: stok,
      stokSebelum: 0,
      stokSesudah: stok,
      timestamp: Date.now()
    }
  };

  // --- 5b. Buat timestamp updatedAt random untuk tahun ini (2025) ---
  const startOfYear = new Date(2025, 0, 1).getTime(); // 1 Jan 2025
  const endOfYear = new Date(2025, 11, 31, 23, 59, 59).getTime(); // 31 Des 2025
  const lastEditedTimestamp = Math.floor(Math.random() * (endOfYear - startOfYear + 1)) + startOfYear;
  
  // --- 6. Buat Objek Data Final (Sesuai Permintaan) ---
  return {
    kode_buku: kodeBuku,
    judul: judul,
    stok: stok,
    kelas: kelas,
    peruntukan: peruntukan,
    jenjang: jenjang,
    penerbit: penerbit,
    mapel: mapel,
    tahun: tahun,
    spek: spek,
    
    spek_kertas: spek, 
    tipe_buku: tipe_buku, 

    hargaJual: 0,
    diskonJual: 0,
    
    harga_zona_2: 0,
    harga_zona_3: 0,
    harga_zona_4: 0,
    harga_zona_5a: 0,
    harga_zona_5b: 0,

    historiStok: newHistoryEntry,
    updatedAt: 0,
  };
};
// =================================================================
// --- AKHIR FUNGSI PARSING ---
// =================================================================


// --- Komponen React (TYPO JSX DIPERBAIKI) ---

function GBukuPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [processedData, setProcessedData] = useState([]);
  const [jsonInput, setJsonInput] = useState('');

  /**
   * Menangani parsing data dari JSON string di TextArea.
   */
  const handleProcessJson = useCallback(() => {
    if (!jsonInput) {
      message.warn('Tidak ada data JSON untuk diproses.');
      return;
    }

    setIsLoading(true);
    setProcessedData([]);
    
    setTimeout(() => {
      try {
        const jsonData = JSON.parse(jsonInput);

        if (!Array.isArray(jsonData)) {
          message.error('Data JSON harus berupa array (diawali dengan [ ).');
          setIsLoading(false);
          return;
        }

        const results = [];
        let skippedCount = 0;

        for (let i = 0; i < jsonData.length; i++) {
          const item = jsonData[i];
          const bukuData = parseBookRow(item);
          
          if (bukuData) {
            results.push(bukuData);
          } else {
            console.warn(`Skipping item index ${i}: Invalid or missing data.`, item);
            skippedCount++;
          }
        }

        setProcessedData(results);
        
        let successMsg = `Berhasil mengonversi ${results.length} data.`;
        if (skippedCount > 0) {
            successMsg = `Berhasil konversi ${results.length} data. ${skippedCount} item dilewati.`;
        }
        message.success(successMsg);

      } catch (error) {
        console.error("Error processing JSON:", error);
        message.error('Gagal memproses JSON. Periksa format teks Anda.');
      } finally {
        setIsLoading(false);
      }
    }, 10);
  }, [jsonInput]);

  /**
   * Mengunggah data yang sudah diproses ke Firebase RTDB.
   */
  const handleUploadToFirebase = useCallback(async () => {
    if (processedData.length === 0) {
      message.warn('Tidak ada data yang diproses untuk diunggah.');
      return;
    }
    
    setIsUploading(true);
    const loadingKey = 'uploading';
    message.loading({ content: `Mengunggah ${processedData.length} data...`, key: loadingKey, duration: 0 });
    
    const bukuListRef = ref(db, 'buku');
    let successCount = 0;
    let errorCount = 0;

    const uploadPromises = processedData.map(async (bookData) => {
      try {
        const newBookRef = push(bukuListRef);
        await set(newBookRef, bookData);
        successCount++;
      } catch (error) {
        // <-- TYPO DIPERBAIKI (Karakter 'D' dihapus dan template literal diperbaiki)
        console.error(`Gagal mengunggah buku kode ${bookData.kode_buku}:`, error); 
        errorCount++;
      }
    });

    try {
      await Promise.all(uploadPromises);
      
      message.destroy(loadingKey);
      if (errorCount === 0) {
        message.success(`Semua ${processedData.length} data berhasil diunggah ke Firebase!`);
        setProcessedData([]);
        setJsonInput('');
      } else {
        message.warn(`${successCount} data berhasil diunggah, ${errorCount} gagal. Cek console log.`);
      }
    } catch (e) {
      message.destroy(loadingKey);
      message.error('Terjadi kesalahan tak terduga saat mengunggah.');
      console.error("Unexpected upload error:", e);
    } finally {
      setIsUploading(false);
    }
  }, [processedData]);

  /**
   * Menyalin data JSON yang sudah diproses ke clipboard. (DIPERBAIKI)
   */
  const handleCopyJson = useCallback(() => {
    if (processedData.length === 0) {
      message.warn('Tidak ada data untuk disalin.');
      return;
    }
    try {
      navigator.clipboard.writeText(JSON.stringify(processedData, null, 2));
      message.success('Data JSON yang diproses disalin ke clipboard!');
    } catch (err) {
      message.error('Gagal menyalin ke clipboard.');
      console.error('Clipboard copy failed:', err);
IA   }
  }, [processedData]);

  /**
   * Reset semua state
   */
  const handleReset = () => {
    setIsLoading(false);
    setIsUploading(false);
    setProcessedData([]);
    setJsonInput('');
    message.info('Formulir dibersihkan.');
  }

  const hasProcessedData = processedData.length > 0;

  // --- Render JSX (TYPO DIPERBAIKI) ---
  return (
    <div style={{ padding: '20px' }}>
    <Typography.Title level={4}>Unggah Data Buku dari JSON ke Firebase</Typography.Title>
    <Space direction="vertical" style={{ width: '100%' }} size="large">
        
        <Typography.Text>1. Tempelkan data JSON Anda di bawah:</Typography.Text>
        <TextArea
          rows={10}
          placeholder='Tempelkan array JSON Anda di sini. Contoh: [{"Kode": "123", "Nama Barang": "BUKU A", ...}, ...]'
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          disabled={isLoading || isUploading || hasProcessedData}
        />

        {!hasProcessedData ? (
          <Button 
            type="primary"
            icon={<CodeOutlined />} // <-- TYPO DIPERBAIKI (Karakter 'D' dihapus)
            onClick={handleProcessJson} 
            loading={isLoading}
            disabled={isUploading || !jsonInput}
          >
            {isLoading ? 'Memproses...' : '2. Proses Data JSON'}
          </Button>
        ) : (
          <Space direction='vertical' align='start'>
            <Text type="success">Berhasil mengonversi {processedData.length} data buku.</Text>
            <Space>
              <Button
                icon={<CopyOutlined />}
                onClick={handleCopyJson}
                disabled={isUploading}
              >
                Salin Hasil Konversi
              </Button>
              <Button
          S       type="primary"
                icon={<CloudUploadOutlined />}
                onClick={handleUploadToFirebase}
                loading={isUploading} // <-- TYPO DIPERBAIKI (Karakter 'D' dihapus)
                disabled={isLoading}
              >
                {isUploading ? 'Mengunggah...' : '3. Unggah ke Firebase'}
              </Button> 
              <Button
                danger
                icon={<SyncOutlined />}
                onClick={handleReset} // <-- TYPO DIPERBAIKI (Karakter 'S' dihapus)
                disabled={isUploading}
              >
                Reset
              </Button>
            </Space>
          </Space>
        )}
    </Space>
  </div>
  );
}

export default GBukuPage;