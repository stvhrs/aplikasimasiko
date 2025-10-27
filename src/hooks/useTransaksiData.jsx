// src/hooks/useTransaksiData.js
import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../api/firebase'; // <-- SESUAIKAN PATH KE FIREBASE CONFIG ANDA

// --- Helper ---
const snapshotToArray = (snapshot) => {
    const data = snapshot.val();
    return data ? Object.keys(data).map((key) => ({ id: key, ...data[key] })) : [];
};

// =============================================================
// --- Singleton RTDB Listener untuk 'transaksiJualBuku' ---
// =============================================================
let txJualCache = [];
let txJualListeners = [];
let txJualIsInitialized = false;
let txJualIsLoading = true; // Mulai dengan true
let txJualGlobalUnsubscribe = null;

function notifyTxJualListeners() {
    // Beri salinan cache agar state tidak termutasi langsung
    txJualListeners.forEach((listener) => listener([...txJualCache]));
}

function initializeTxJualListener() {
    if (txJualGlobalUnsubscribe) return; // Hanya inisialisasi sekali

    console.log("Initializing TransaksiJual listener..."); // Debug log
    txJualIsLoading = true; // Set loading saat inisialisasi

    const txRef = ref(db, 'transaksiJualBuku');
    txJualGlobalUnsubscribe = onValue(txRef, (snapshot) => {
        console.log("TransaksiJual data received."); // Debug log
        const data = snapshotToArray(snapshot);
        // Urutkan di sini jika selalu ingin urut default terbaru
        data.sort((a, b) => (b.tanggal || 0) - (a.tanggal || 0));
        txJualCache = data;
        txJualIsInitialized = true;
        txJualIsLoading = false;
        notifyTxJualListeners();
    }, (error) => {
        console.error("Firebase error (transaksiJual):", error);
        txJualIsInitialized = true; // Anggap initialized agar tidak loading terus
        txJualIsLoading = false;
        // Mungkin notifikasi error ke listener? Atau handle di komponen?
        notifyTxJualListeners(); // Notifikasi dengan cache kosong/lama
    });
}

// Custom Hook untuk Data Transaksi Jual
export function useTransaksiJualData() {
    const [data, setData] = useState(txJualCache);
    // Loading state hanya true jika belum diinisialisasi DAN sedang proses loading awal
    const [loading, setLoading] = useState(!txJualIsInitialized && txJualIsLoading);

    useEffect(() => {
        // Inisialisasi listener jika belum ada
        if (!txJualGlobalUnsubscribe) {
            initializeTxJualListener();
        }

        // Fungsi listener untuk update state lokal
        const listener = (newData) => {
             setData(newData);
             // Update loading status berdasarkan status global
             setLoading(!txJualIsInitialized && txJualIsLoading);
        };

        txJualListeners.push(listener);

        // Jika data sudah ada saat hook mount, langsung set data & loading
        if (txJualIsInitialized) {
             setData([...txJualCache]); // Beri salinan
             setLoading(false);
        } else {
             setLoading(true); // Pastikan loading true jika belum initialized
        }


        // Cleanup: Hapus listener saat komponen unmount
        return () => {
            txJualListeners = txJualListeners.filter((cb) => cb !== listener);
            console.log("TransaksiJual listener removed. Count:", txJualListeners.length); // Debug
            // Opsional: Unsubscribe global jika tidak ada listener lagi (jika aplikasi kompleks)
            // if (txJualListeners.length === 0 && txJualGlobalUnsubscribe) {
            //     console.log("Unsubscribing global TransaksiJual listener.");
            //     txJualGlobalUnsubscribe();
            //     txJualGlobalUnsubscribe = null;
            //     txJualIsInitialized = false; // Reset status
            //     txJualCache = [];
            // }
        };
    }, []); // Dependency array kosong agar hanya run sekali saat mount

    return { data, loading };
}

// =============================================================
// --- Singleton RTDB Listener untuk 'buku' ---
// =============================================================
let bukuCache = [];
let bukuListeners = [];
let bukuIsInitialized = false;
let bukuIsLoading = true; // Mulai dengan true
let bukuGlobalUnsubscribe = null;

function notifyBukuListeners() {
    bukuListeners.forEach((listener) => listener([...bukuCache]));
}

function initializeBukuListener() {
    if (bukuGlobalUnsubscribe) return;

    console.log("Initializing Buku listener..."); // Debug log
    bukuIsLoading = true;

    bukuGlobalUnsubscribe = onValue(ref(db, 'buku'), (snapshot) => {
         console.log("Buku data received."); // Debug log
        bukuCache = snapshotToArray(snapshot);
        // Pertimbangkan sort default jika perlu (misal by updatedAt)
        // bukuCache.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        bukuIsInitialized = true;
        bukuIsLoading = false;
        notifyBukuListeners();
    }, (error) => {
        console.error("Firebase error (buku global):", error);
        bukuIsInitialized = true;
        bukuIsLoading = false;
        notifyBukuListeners();
    });
}

// Custom Hook untuk Data Buku
export function useBukuData() {
    const [bukuList, setBukuList] = useState(bukuCache);
    const [loadingBuku, setLoadingBuku] = useState(!bukuIsInitialized && bukuIsLoading);

    useEffect(() => {
        if (!bukuGlobalUnsubscribe) {
            initializeBukuListener();
        }

        const listener = (newData) => {
            setBukuList(newData);
            setLoadingBuku(!bukuIsInitialized && bukuIsLoading);
        };

        bukuListeners.push(listener);

        if (bukuIsInitialized) {
            setBukuList([...bukuCache]);
            setLoadingBuku(false);
        } else {
            setLoadingBuku(true);
        }

        return () => {
            bukuListeners = bukuListeners.filter((cb) => cb !== listener);
            console.log("Buku listener removed. Count:", bukuListeners.length); // Debug
            // Logika unsubscribe global bisa ditambahkan di sini jika perlu
        };
    }, []);

    // Ganti nama return agar sesuai dengan penggunaan di komponen
    return { data: bukuList, loading: loadingBuku };
}

// =============================================================
// --- Singleton RTDB Listener untuk 'pelanggan' ---
// =============================================================
let pelangganCache = [];
let pelangganListeners = [];
let pelangganIsInitialized = false;
let pelangganIsLoading = true; // Mulai dengan true
let pelangganGlobalUnsubscribe = null;

function notifyPelangganListeners() {
    pelangganListeners.forEach((listener) => listener([...pelangganCache]));
}

function initializePelangganListener() {
    if (pelangganGlobalUnsubscribe) return;

    console.log("Initializing Pelanggan listener..."); // Debug log
    pelangganIsLoading = true;

    pelangganGlobalUnsubscribe = onValue(ref(db, 'pelanggan'), (snapshot) => {
        console.log("Pelanggan data received."); // Debug log
        pelangganCache = snapshotToArray(snapshot);
        // Sort default jika perlu (misal by nama)
        // pelangganCache.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
        pelangganIsInitialized = true;
        pelangganIsLoading = false;
        notifyPelangganListeners();
    }, (error) => {
        console.error("Firebase error (pelanggan global):", error);
        pelangganIsInitialized = true;
        pelangganIsLoading = false;
        notifyPelangganListeners();
    });
}

// Custom Hook untuk Data Pelanggan
export function usePelangganData() {
    const [pelangganList, setPelangganList] = useState(pelangganCache);
    const [loadingPelanggan, setLoadingPelanggan] = useState(!pelangganIsInitialized && pelangganIsLoading);

    useEffect(() => {
        if (!pelangganGlobalUnsubscribe) {
            initializePelangganListener();
        }

        const listener = (newData) => {
            setPelangganList(newData);
            setLoadingPelanggan(!pelangganIsInitialized && pelangganIsLoading);
        };

        pelangganListeners.push(listener);

        if (pelangganIsInitialized) {
            setPelangganList([...pelangganCache]);
            setLoadingPelanggan(false);
        } else {
            setLoadingPelanggan(true);
        }

        return () => {
            pelangganListeners = pelangganListeners.filter((cb) => cb !== listener);
            console.log("Pelanggan listener removed. Count:", pelangganListeners.length); // Debug
            // Logika unsubscribe global bisa ditambahkan di sini jika perlu
        };
    }, []);

    // Ganti nama return agar sesuai dengan penggunaan di komponen
    return { data: pelangganList, loading: loadingPelanggan };
}

// Anda bisa menambahkan hook lain di sini jika perlu