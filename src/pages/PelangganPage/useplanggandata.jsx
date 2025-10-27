// src/data/usePelangganData.js
import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from '../../api/firebase'; // Pastikan path ini benar

// --- Cache & Listener Global ---
let pelangganCache = [];
let listeners = [];
let isInitialized = false;
let isLoading = false; // Status loading *global listener*
let globalUnsubscribe = null;

function notifyListeners() {
  listeners.forEach((listener) => {
    listener(pelangganCache);
  });
}

function initializeListener() {
  if (globalUnsubscribe || isLoading) {
    return;
  }

  isLoading = true;
  const pelangganRef = ref(db, "pelanggan");

  globalUnsubscribe = onValue(
    pelangganRef,
    (snapshot) => {
      const val = snapshot.val();
      // --- (PERBAIKAN) Transformasi data untuk menyertakan ID ---
      const arr = val
        ? Object.keys(val).map(key => ({ id: key, ...val[key] }))
        : [];
      // --------------------------------------------------------

      pelangganCache = arr;
      isInitialized = true;
      isLoading = false;

      console.log("Pelanggan data fetched/updated:", pelangganCache); // Log data
      notifyListeners();
    },
    (error) => {
      console.error("RTDB error (pelanggan):", error);
      pelangganCache = []; // Reset cache on error
      isInitialized = true; // Tandai sebagai selesai meski error
      isLoading = false;
      notifyListeners(); // Tetap notifikasi agar loading hilang
    }
  );
}
// --- Akhir dari Logika Global ---


/**
 * Custom hook untuk mendapatkan data pelanggan secara live.
 */
export function usePelangganData() {
  // 1. State lokal, diinisialisasi dengan cache
  const [data, setData] = useState(pelangganCache);

  // 2. State loading LOKAL komponen, tergantung status global
  const [loading, setLoading] = useState(!isInitialized);

  useEffect(() => {
    // 3. Inisialisasi listener global jika belum
    if (!globalUnsubscribe && !isLoading) { // Cek isLoading juga
      initializeListener();
    }

    // --- (PERBAIKAN) Wrapper untuk setData agar bisa update loading ---
    const handleDataUpdate = (newData) => {
        setData(newData);
        // Jika listener global sudah selesai (isInitialized=true)
        // DAN state loading lokal masih true, set loading lokal ke false.
        if (isInitialized && loading) {
            setLoading(false);
        }
    };
    // --------------------------------------------------------------

    // 4. Daftarkan wrapper listener
    listeners.push(handleDataUpdate);

    // 5. Sinkronisasi saat mount jika data sudah ada & matikan loading
    if (isInitialized) {
      setData(pelangganCache); // Pastikan data terbaru
      setLoading(false);      // Matikan loading jika sudah init
    } else {
        // Jika belum init, pastikan loading=true (walau defaultnya sudah)
        setLoading(true);
    }


    // 6. Cleanup saat unmount
    return () => {
      // Hapus wrapper listener dari daftar global
      listeners = listeners.filter((cb) => cb !== handleDataUpdate);

      // JANGAN UNSUBSCRIBE LISTENER GLOBAL DI SINI
    };
  }, [loading]); // (PERBAIKAN) Tambahkan `loading` sebagai dependensi

  // Return state lokal
  return { pelangganList: data, loadingPelanggan: loading }; // Sesuaikan nama return
}