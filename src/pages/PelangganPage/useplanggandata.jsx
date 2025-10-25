// src/data/usePelangganData.js
import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from '../../api/firebase'; // Pastikan path ini benar

// --- Cache & Listener Global ---
// Didefinisikan di luar hook agar "selamat" dari unmount komponen

let pelangganCache = []; // Menyimpan data terakhir
let listeners = []; // Menyimpan semua fungsi `setData` dari komponen yang aktif
let isInitialized = false; // Status: Apakah fetch *pertama kali* sudah selesai?
let isLoading = false; // Status: Apakah sedang dalam proses fetch *pertama kali*?
let globalUnsubscribe = null; // Menyimpan fungsi `off()` dari onValue

/**
 * Menyiarkan data baru ke semua komponen yang sedang "mendengarkan".
 */
function notifyListeners() {
  listeners.forEach((listener) => {
    listener(pelangganCache);
  });
}

/**
 * Fungsi ini hanya akan dipanggil SATU KALI selama siklus hidup aplikasi.
 * Fungsi ini menyiapkan listener streaming ke Firebase RTDB.
 */
function initializeListener() {
  // Jika sudah ada listener atau sedang dalam proses loading, jangan buat baru.
  if (globalUnsubscribe || isLoading) {
    return;
  }

  isLoading = true;
  const pelangganRef = ref(db, "pelanggan");

  globalUnsubscribe = onValue(
    pelangganRef,
    (snapshot) => {
      const val = snapshot.val();
      // Ubah objek dari Firebase menjadi array
      const arr = val ? Object.values(val) : [];
      
      // Update cache global
      pelangganCache = arr;
      isInitialized = true;
      isLoading = false;
      
      // Siarkan data baru ke semua komponen
      notifyListeners();
    },
    (error) => {
      console.error("RTDB error:", error);
      // Tetap selesaikan proses agar loading hilang
      pelangganCache = [];
      isInitialized = true;
      isLoading = false;
      notifyListeners();
    }
  );
}
// --- Akhir dari Logika Global ---


/**
 * Custom hook untuk mendapatkan data pelanggan secara live.
 * Menggunakan listener global tunggal untuk efisiensi.
 */
export function usePelangganData() {
  // 1. State lokal, diinisialisasi dengan data dari cache global
  const [data, setData] = useState(pelangganCache);
  
  // 2. Tampilkan loading HANYA jika data belum pernah diinisialisasi
  const [loading, setLoading] = useState(!isInitialized);

  useEffect(() => {
    // 3. Jika listener global belum aktif, aktifkan
    if (!globalUnsubscribe) {
      initializeListener();
    }

    // 4. Daftarkan fungsi `setData` dari komponen INI ke daftar listener global
    listeners.push(setData);

    // 5. Jika data sudah terinisialisasi (misal, pindah halaman),
    //    pastikan data di komponen ini sinkron & loading=false.
    if (isInitialized) {
      setData(pelangganCache);
      setLoading(false);
    }

    // 6. Fungsi cleanup saat komponen unmount
    return () => {
      // Hapus fungsi `setData` komponen INI dari daftar global
      listeners = listeners.filter((cb) => cb !== setData);
      
      // !! PENTING: JANGAN panggil globalUnsubscribe() di sini.
      // Kita ingin listener tetap hidup meski komponen di-unmount.
    };
  }, []); // Array dependensi kosong, hanya berjalan saat mount & unmount

  return { data, loading };
}