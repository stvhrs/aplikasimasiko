import { useState, useEffect, useCallback } from 'react';
// PERBAIKAN: Tambahkan 'get' ke dalam import
import { ref, onValue, get, query, orderByChild, startAt, endAt } from 'firebase/database';
import { db } from '../api/firebase'; 
import dayjs from 'dayjs';

// --- Helper untuk ubah Snapshot ke Array + ID ---
const snapshotToArray = (snapshot) => {
    const data = [];
    if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
            data.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
    }
    // Opsional: Sortir dari yang terbaru (descending) karena Firebase sort by ascending
    return data.reverse();
};

// =============================================================
// HOOK 1: Transaksi Jual (Server Side Filtering)
// =============================================================
const CACHE = {
    data: null,      
    params: null,    
    timestamp: 0     
};

export const useTransaksiJualData = (filterParams) => {
    // Cek apakah parameter filter sama dengan yang ada di cache
    const isSameParams = JSON.stringify(filterParams) === JSON.stringify(CACHE.params);
    
    // Inisialisasi data
    const [data, setData] = useState(isSameParams && CACHE.data ? CACHE.data : []);
    const [loading, setLoading] = useState(!isSameParams || !CACHE.data);

    const fetchData = useCallback(async (force = false) => {
        // Gunakan cache jika parameter sama dan tidak dipaksa refresh
        if (!force && CACHE.data && JSON.stringify(filterParams) === JSON.stringify(CACHE.params)) {
            setData(CACHE.data);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            console.log("Fetching Data from Server with params:", filterParams); 
            
            const dbRef = ref(db, 'transaksiJualBuku');
            let dbQuery;

            // --- LOGIKA FILTERING FIREBASE ---
            if (filterParams?.mode === 'range' && filterParams?.startDate && filterParams?.endDate) {
                // Ambil data berdasarkan range tanggal (Default Awal Tahun - Hari Ini)
                dbQuery = query(
                    dbRef, 
                    orderByChild('tanggal'), 
                    startAt(filterParams.startDate), 
                    endAt(filterParams.endDate)
                );
            } else {
                // Ambil SEMUA data (Mode 'all' atau params kosong)
                dbQuery = query(dbRef, orderByChild('tanggal'));
            }

            // Eksekusi Query
            const snapshot = await get(dbQuery);
            const result = snapshotToArray(snapshot);

            // Update Cache
            CACHE.data = result;
            CACHE.params = filterParams;
            CACHE.timestamp = Date.now();

            setData(result);
        } catch (error) {
            console.error("Error fetching transaksi:", error);
            setData([]); 
        } finally {
            setLoading(false);
        }
    }, [filterParams]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, refresh: () => fetchData(true) };
};

// =============================================================
// HOOK 2: Data Buku (Tetap Sama)
// =============================================================
let bukuCache = [];
let bukuListeners = [];
let bukuIsInitialized = false;
let bukuIsLoading = true;
let bukuGlobalUnsubscribe = null;

function notifyBukuListeners() {
    bukuListeners.forEach((listener) => listener([...bukuCache]));
}

function initializeBukuListener() {
    if (bukuGlobalUnsubscribe) return;
    bukuIsLoading = true;
    bukuGlobalUnsubscribe = onValue(ref(db, 'buku'), (snapshot) => {
        bukuCache = snapshotToArray(snapshot).reverse(); // Reverse agar buku baru di atas (opsional)
        bukuIsInitialized = true;
        bukuIsLoading = false;
        notifyBukuListeners();
    }, (error) => {
        console.error("Error fetch buku:", error);
        bukuIsLoading = false;
    });
}

export function useBukuData() {
    const [bukuList, setBukuList] = useState(bukuCache);
    const [loadingBuku, setLoadingBuku] = useState(!bukuIsInitialized && bukuIsLoading);

    useEffect(() => {
        if (!bukuGlobalUnsubscribe) initializeBukuListener();

        const listener = (newData) => {
            setBukuList(newData);
            setLoadingBuku(false);
        };
        bukuListeners.push(listener);

        if (bukuIsInitialized) {
            setLoadingBuku(false);
        }

        return () => {
            bukuListeners = bukuListeners.filter((cb) => cb !== listener);
        };
    }, []);

    return { data: bukuList, loading: loadingBuku };
}

// =============================================================
// HOOK 3: Data Pelanggan (Tetap Sama)
// =============================================================
let pelangganCache = [];
let pelangganListeners = [];
let pelangganIsInitialized = false;
let pelangganIsLoading = true;
let pelangganGlobalUnsubscribe = null;

function notifyPelangganListeners() {
    pelangganListeners.forEach((listener) => listener([...pelangganCache]));
}

function initializePelangganListener() {
    if (pelangganGlobalUnsubscribe) return;
    pelangganIsLoading = true;
    pelangganGlobalUnsubscribe = onValue(ref(db, 'pelanggan'), (snapshot) => {
        pelangganCache = snapshotToArray(snapshot).reverse();
        pelangganIsInitialized = true;
        pelangganIsLoading = false;
        notifyPelangganListeners();
    }, (error) => {
        console.error("Error fetch pelanggan:", error);
        pelangganIsLoading = false;
    });
}

export function usePelangganData() {
    const [pelangganList, setPelangganList] = useState(pelangganCache);
    const [loadingPelanggan, setLoadingPelanggan] = useState(!pelangganIsInitialized && pelangganIsLoading);

    useEffect(() => {
        if (!pelangganGlobalUnsubscribe) initializePelangganListener();

        const listener = (newData) => {
            setPelangganList(newData);
            setLoadingPelanggan(false);
        };
        pelangganListeners.push(listener);

        if (pelangganIsInitialized) {
            setLoadingPelanggan(false);
        }

        return () => {
            pelangganListeners = pelangganListeners.filter((cb) => cb !== listener);
        };
    }, []);

    return { data: pelangganList, loading: loadingPelanggan };
}