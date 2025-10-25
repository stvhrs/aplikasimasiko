import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../../api/firebase'; // Sesuaikan path

// --- Helper ---
// Definisikan getTimestamp di sini atau impor dari utils jika ada
const getTimestamp = (record) => record?.tanggal || record?.tanggalBayar || 0;

// --- Singleton RTDB Listener untuk 'mutasi' ---
let mutasiCache = [];
let mutasiBalanceMap = new Map();
let mutasiListeners = [];
let mutasiIsInitialized = false;
let mutasiIsLoading = false;
let mutasiGlobalUnsubscribe = null;

function notifyMutasiListeners() {
    // Hitung balance map di sini sekali saja
    const sortedAllTx = [...mutasiCache].sort((a, b) => getTimestamp(a) - getTimestamp(b));
    const map = new Map();
    let currentBalance = 0;
    for (const tx of sortedAllTx) {
        currentBalance += (tx.jumlah || 0);
        map.set(tx.id, currentBalance);
    }
    mutasiBalanceMap = map;
    
    // Kirim data dan balance map ke listeners
    mutasiListeners.forEach((listener) => {
        listener({ data: mutasiCache, balanceMap: mutasiBalanceMap });
    });
}

function initializeMutasiListener() {
    if (mutasiGlobalUnsubscribe || mutasiIsLoading) return;
    mutasiIsLoading = true;
    
    const transaksiRef = ref(db, 'mutasi');
    mutasiGlobalUnsubscribe = onValue(transaksiRef, (snapshot) => {
        const data = snapshot.val();
        const loadedTransaksi = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
        // Sort DESC (terbaru dulu) untuk tampilan awal
        loadedTransaksi.sort((a, b) => getTimestamp(b) - getTimestamp(a)); 
        
        mutasiCache = loadedTransaksi;
        mutasiIsInitialized = true;
        mutasiIsLoading = false;
        notifyMutasiListeners(); // Hitung balance map & notifikasi
    }, (error) => {
        console.error("Firebase error (mutasi global):", error);
        // Pertimbangkan cara menangani error, mungkin dengan state error terpisah
        mutasiCache = []; // Reset cache on error
        mutasiBalanceMap = new Map(); // Reset map on error
        mutasiIsInitialized = true;
        mutasiIsLoading = false;
        notifyMutasiListeners();
    });
}

export function useMutasiData() {
    const [state, setState] = useState({ data: mutasiCache, balanceMap: mutasiBalanceMap });
    const [loading, setLoading] = useState(!mutasiIsInitialized);

    useEffect(() => {
        // Inisialisasi listener jika belum ada
        if (!mutasiGlobalUnsubscribe) {
            initializeMutasiListener();
        }

        // Daftarkan listener komponen ini
        const listener = (newState) => setState(newState);
        mutasiListeners.push(listener);

        // Jika data sudah siap, langsung update state komponen
        if (mutasiIsInitialized) {
            setState({ data: mutasiCache, balanceMap: mutasiBalanceMap });
            setLoading(false);
        }

        // Cleanup: Hapus listener komponen saat unmount
        return () => {
            mutasiListeners = mutasiListeners.filter((cb) => cb !== listener);
            // Jangan panggil unsubscribe global di sini
        };
    }, []); // Dependency array kosong, hanya run sekali

    return { ...state, loading: loading && !mutasiIsInitialized };
}
