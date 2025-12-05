import { useState, useEffect } from 'react';
import { db } from '../api/firebase'; 
import { 
    ref, query, orderByChild, startAt, endAt, onValue 
} from "firebase/database";
import dayjs from 'dayjs';

// --- SINGLETON STATE (Variable di luar Hook) ---
// Data ini akan tetap hidup di memori selama aplikasi tidak di-refresh browser-nya.

// Store Pembayaran
let globalPembayaran = {
    data: [],
    loading: false,
    unsubscribe: null,
    rangeKey: null // Untuk mengecek apakah filter tanggal berubah
};

// Store Retur
let globalRetur = {
    data: [],
    loading: false,
    unsubscribe: null,
    rangeKey: null
};

// --- HOOK PEMBAYARAN ---
export const usePembayaranStream = (dateRange) => {
    // State lokal untuk memicu re-render komponen
    const [data, setData] = useState(globalPembayaran.data);
    const [loading, setLoading] = useState(globalPembayaran.loading || (globalPembayaran.data.length === 0));

    useEffect(() => {
        // Buat key unik dari tanggal untuk cek perubahan filter
        const start = dateRange ? dayjs(dateRange[0]).format('YYYY-MM-DD') : 'start';
        const end = dateRange ? dayjs(dateRange[1]).format('YYYY-MM-DD') : 'end';
        const currentRangeKey = `${start}_${end}`;

        // LOGIKA SINGLETON:
        // Jika stream sudah ada DAN range tanggalnya sama, JANGAN reload.
        if (globalPembayaran.unsubscribe && globalPembayaran.rangeKey === currentRangeKey) {
            setData(globalPembayaran.data);
            setLoading(false);
            
            // Kita tetap perlu listener dummy atau cara untuk update state lokal jika ada data baru masuk
            // Tapi karena onValue di bawah mengupdate variabel global, kita perlu attach listener baru? 
            // TIDAK. Di React, kita harus setup listener baru yang mengupdate state lokal ini.
            
            // KOREKSI: Karena onValue hanya jalan sekali di singleton, kita harus menimpa callback-nya 
            // atau membuat mekanisme observer. 
            // Cara termudah & teraman tanpa over-engineering: 
            // Kita RESTART stream HANYA jika tanggal berubah. Jika tanggal sama, kita biarkan stream lama jalan
            // TAPI kita harus bisa menangkap update-nya ke state lokal component ini.
            
            // Solusi Hybrid: 
            // Kita matikan stream lama jika range berubah, lalu buat baru.
        }

        // Jika range berubah ATAU belum ada stream, buat baru.
        if (globalPembayaran.rangeKey !== currentRangeKey || !globalPembayaran.unsubscribe) {
            
            // 1. Cleanup stream lama jika ada
            if (globalPembayaran.unsubscribe) {
                globalPembayaran.unsubscribe();
            }

            setLoading(true);
            globalPembayaran.loading = true;
            globalPembayaran.rangeKey = currentRangeKey;

            const startDate = dateRange ? dayjs(dateRange[0]).startOf('day').valueOf() : 0;
            const endDate = dateRange ? dayjs(dateRange[1]).endOf('day').valueOf() : Date.now();

            const q = query(
                ref(db, 'historiPembayaran'), 
                orderByChild('tanggal'), 
                startAt(startDate), 
                endAt(endDate)
            );

            // 2. Setup Stream Baru
            globalPembayaran.unsubscribe = onValue(q, (snapshot) => {
                const list = [];
                if (snapshot.exists()) {
                    snapshot.forEach((child) => {
                        list.push({ id: child.key, ...child.val() });
                    });
                }
                list.reverse(); // Terbaru diatas

                // Update Global Singleton
                globalPembayaran.data = list;
                globalPembayaran.loading = false;

                // Update Lokal State (agar UI berubah)
                setData(list);
                setLoading(false);
            });
        } else {
            // Jika Stream sudah ada & Range SAMA, kita perlu "Hook" ke update stream tsb.
            // Sayangnya Firebase onValue callback terikat scope lama.
            // Trik Singleton React: Kita reset onValue dengan callback yang membungkus setData INI.
            
            // Agar aman dan simple: Kita biarkan logic di atas me-restart stream jika range beda.
            // TAPI jika range sama, kita attach ulang onValue agar setData component aktif ini yang dipanggil.
            // (Ini cost-nya murah karena data di cache firebase SDK sudah ada).
            
            // NAMUN, permintaan Anda adalah "Tidak Reload". 
            // Maka kita pakai data global dulu sebagai initial state (sudah di useState di atas).
            
            // Kita timpa listener lama dengan listener baru yang mengarah ke komponen aktif ini
             const startDate = dateRange ? dayjs(dateRange[0]).startOf('day').valueOf() : 0;
             const endDate = dateRange ? dayjs(dateRange[1]).endOf('day').valueOf() : Date.now();
             const q = query(ref(db, 'historiPembayaran'), orderByChild('tanggal'), startAt(startDate), endAt(endDate));
             
             // Matikan yang lama (yang mengarah ke component yang sudah unmount)
             if(globalPembayaran.unsubscribe) globalPembayaran.unsubscribe();

             // Hidupkan yang baru mengarah ke component ini
             globalPembayaran.unsubscribe = onValue(q, (snapshot) => {
                 const list = [];
                 if (snapshot.exists()) {
                     snapshot.forEach((child) => {
                         list.push({ id: child.key, ...child.val() });
                     });
                 }
                 list.reverse();
                 globalPembayaran.data = list;
                 setData(list); // Update UI
             });
        }

        // Cleanup: Saat unmount, KITA TIDAK MATIKAN STREAM DATABASE (globalPembayaran.unsubscribe).
        // Kita biarkan menggantung agar saat balik lagi datanya instan.
        // HANYA matikan jika range tanggal berubah di effect selanjutnya.
        
    }, [dateRange]);

    return { pembayaranList: data, loadingPembayaran: loading };
};


// --- HOOK RETUR (Pola Sama) ---
export const useReturStream = (dateRange) => {
    const [data, setData] = useState(globalRetur.data);
    const [loading, setLoading] = useState(globalRetur.loading || (globalRetur.data.length === 0));

    useEffect(() => {
        const start = dateRange ? dayjs(dateRange[0]).format('YYYY-MM-DD') : 'start';
        const end = dateRange ? dayjs(dateRange[1]).format('YYYY-MM-DD') : 'end';
        const currentRangeKey = `${start}_${end}`;

        // Cek apakah perlu restart stream (karena range beda) atau refresh listener (range sama)
        if (globalRetur.rangeKey !== currentRangeKey) {
            setLoading(true);
            globalRetur.loading = true;
            globalRetur.data = []; // Reset data visual saat ganti tanggal
            setData([]); 
        }

        // Logic Query
        const startDate = dateRange ? dayjs(dateRange[0]).startOf('day').valueOf() : 0;
        const endDate = dateRange ? dayjs(dateRange[1]).endOf('day').valueOf() : Date.now();
        const q = query(ref(db, 'historiRetur'), orderByChild('timestamp'), startAt(startDate), endAt(endDate));

        // Matikan listener "hantu" dari page sebelumnya
        if (globalRetur.unsubscribe) globalRetur.unsubscribe();

        // Start Listener Baru (langsung ambil cache jika ada)
        globalRetur.unsubscribe = onValue(q, (snapshot) => {
            const list = [];
            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    list.push({ id: child.key, ...child.val() });
                });
            }
            list.reverse(); // Terbaru diatas
            
            globalRetur.data = list;
            globalRetur.loading = false;
            globalRetur.rangeKey = currentRangeKey;

            setData(list);
            setLoading(false);
        });

    }, [dateRange]);

    return { returList: data, loadingRetur: loading };
};
// ============================================================================
// 2. USE RETUR STREAM (Simple Stream)
// ============================================================================


// ============================================================================
// 3. BUKU STREAM (GLOBAL CACHE - ANTI RELOAD)
// ============================================================================
let globalBukuData = [];
let globalBukuLoading = true;
let globalBukuUnsubscribe = null; 
const bukuSubscribers = new Set(); 

const notifyBukuSubscribers = () => {
    bukuSubscribers.forEach(cb => cb(globalBukuData, globalBukuLoading));
};

const connectBukuStream = () => {
    if (globalBukuUnsubscribe) {
        notifyBukuSubscribers();
        return;
    }

    console.log("%c📘 [BUKU] Stream Initialized", "color: white; background: blue; padding: 2px 5px; border-radius: 3px; font-weight: bold;");
    globalBukuLoading = true;
    notifyBukuSubscribers();

    const bukuRef = ref(db, 'buku');

    globalBukuUnsubscribe = onValue(bukuRef, (snapshot) => {
        const data = snapshotToArrayWithId(snapshot);
        data.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        
        console.log(`%c📘 [BUKU] Data Incoming: ${data.length} items`, "color: blue");
        
        globalBukuData = data;
        globalBukuLoading = false;
        notifyBukuSubscribers();
    }, (error) => {
        console.error("Error streaming buku:", error);
        globalBukuLoading = false;
        notifyBukuSubscribers();
    });
};

export const useBukuStream = () => {
    const [data, setData] = useState(globalBukuData);
    const [loading, setLoading] = useState(globalBukuLoading);

    useEffect(() => {
        connectBukuStream();
        const onDataUpdate = (d, l) => { setData(d); setLoading(l); };
        bukuSubscribers.add(onDataUpdate);
        return () => bukuSubscribers.delete(onDataUpdate);
    }, []);

    return { bukuList: data, loadingBuku: loading };
};

// ============================================================================
// 4. PELANGGAN STREAM (GLOBAL CACHE - ANTI RELOAD)
// ============================================================================
let globalPelangganData = [];
let globalPelangganLoading = true;
let globalPelangganUnsubscribe = null;
const pelangganSubscribers = new Set();
const snapshotToArrayWithId = (snapshot) => {
    const val = snapshot.val();
    if (!val) return [];
    return Object.keys(val).map(key => ({ id: key, ...val[key] }));
};

const notifyPelangganSubscribers = () => {
    pelangganSubscribers.forEach(cb => cb(globalPelangganData, globalPelangganLoading));
};

const connectPelangganStream = () => {
    if (globalPelangganUnsubscribe) {
        notifyPelangganSubscribers();
        return;
    }

    console.log("%c👥 [PELANGGAN] Stream Initialized", "color: white; background: #00BCD4; padding: 2px 5px; border-radius: 3px; font-weight: bold;");
    globalPelangganLoading = true;
    notifyPelangganSubscribers();

    const pelangganRef = ref(db, 'pelanggan');

    globalPelangganUnsubscribe = onValue(pelangganRef, (snapshot) => {
        const data = snapshotToArrayWithId(snapshot);
        // Sort Ascending by Nama
        data.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
        
        console.log(`%c👥 [PELANGGAN] Data Incoming: ${data.length} items`, "color: #00BCD4");
        
        globalPelangganData = data;
        globalPelangganLoading = false;
        notifyPelangganSubscribers();
    }, (error) => {
        console.error("Error streaming pelanggan:", error);
        globalPelangganLoading = false;
        notifyPelangganSubscribers();
    });
};

export const usePelangganStream = () => {
    const [data, setData] = useState(globalPelangganData);
    const [loading, setLoading] = useState(globalPelangganLoading);

    useEffect(() => {
        connectPelangganStream();
        const onDataUpdate = (d, l) => { setData(d); setLoading(l); };
        pelangganSubscribers.add(onDataUpdate);
        return () => pelangganSubscribers.delete(onDataUpdate);
    }, []);

    return { pelangganList: data, loadingPelanggan: loading };
};

// ============================================================================
// 5. TRANSAKSI JUAL STREAM (CACHE + FILTER LOGIC)
// ============================================================================
let globalTransaksiData = [];
let globalTransaksiLoading = true;
let globalTransaksiFilterKey = null;
let globalTransaksiUnsubscribe = null;
const transaksiSubscribers = new Set();

const notifyTransaksiSubscribers = () => {
    transaksiSubscribers.forEach(cb => cb(globalTransaksiData, globalTransaksiLoading));
};

const connectTransaksiStream = (filterParams) => {
    const newFilterKey = JSON.stringify(filterParams);

    // 1. Same Filter -> Use Cache
    if (globalTransaksiUnsubscribe && globalTransaksiFilterKey === newFilterKey) {
        notifyTransaksiSubscribers();
        return;
    }

    // 2. Different Filter -> Reset
    if (globalTransaksiUnsubscribe) {
        console.log("%c🛒 [TRANSAKSI] Filter Changed. Resetting...", "color: orange");
        globalTransaksiUnsubscribe();
        globalTransaksiUnsubscribe = null;
        globalTransaksiData = []; 
    }

    const logMsg = filterParams.mode === 'all' ? "ALL TIME" : "RANGE DATE";
    console.log(`%c🛒 [TRANSAKSI] Stream Initialized (${logMsg})`, "color: white; background: #E91E63; padding: 2px 5px; border-radius: 3px; font-weight: bold;");

    globalTransaksiLoading = true;
    globalTransaksiFilterKey = newFilterKey;
    notifyTransaksiSubscribers();

    const dbRef = ref(db, 'transaksiJualBuku');
    let q;

    if (filterParams.mode === 'all') {
        q = query(dbRef, orderByChild('tanggal'));
    } else {
        q = query(
            dbRef,
            orderByChild('tanggal'),
            startAt(filterParams.startDate),
            endAt(filterParams.endDate)
        );
    }

    // setTimeout 0 untuk unblock rendering thread
    setTimeout(() => {
        globalTransaksiUnsubscribe = onValue(q, (snapshot) => {
            const data = snapshotToArrayWithId(snapshot);
            data.sort((a, b) => (b.tanggal || 0) - (a.tanggal || 0));
            
            console.log(`%c🛒 [TRANSAKSI] Data Loaded: ${data.length} items`, "color: #E91E63");
            
            globalTransaksiData = data;
            globalTransaksiLoading = false;
            notifyTransaksiSubscribers();
        }, (error) => {
            console.error("Error streaming transaksi:", error);
            globalTransaksiLoading = false;
            notifyTransaksiSubscribers();
        });
    }, 0);
};

export const useTransaksiJualStream = (filterParams) => {
    const [data, setData] = useState(globalTransaksiData);
    const [loading, setLoading] = useState(globalTransaksiLoading);
    const currentFilterJson = JSON.stringify(filterParams);

    useEffect(() => {
        // Local Reset jika filter berubah dan cache belum siap
        if (currentFilterJson !== globalTransaksiFilterKey) {
            setLoading(true);
            setData([]); 
        }

        connectTransaksiStream(filterParams);

        const onDataUpdate = (d, l) => { 
            setData(d); 
            setLoading(l); 
        };
        transaksiSubscribers.add(onDataUpdate);
        
        return () => transaksiSubscribers.delete(onDataUpdate);
    }, [currentFilterJson]);

    return { transaksiList: data, loadingTransaksi: loading };
};

// ============================================================================
// 6. HISTORI STOK STREAM (CACHE + FILTER LOGIC)
// ============================================================================
let globalHistoriData = [];
let globalHistoriLoading = true;
let globalHistoriFilterKey = null; 
let globalHistoriUnsubscribe = null;
const historiSubscribers = new Set();

const notifyHistoriSubscribers = () => {
    historiSubscribers.forEach(cb => cb(globalHistoriData, globalHistoriLoading));
};

const connectHistoriStream = (filterParams) => {
    const newFilterKey = JSON.stringify(filterParams);

    if (globalHistoriUnsubscribe && globalHistoriFilterKey === newFilterKey) {
        notifyHistoriSubscribers();
        return;
    }

    if (globalHistoriUnsubscribe) {
        console.log("%c🕰️ [HISTORI] Filter Changed. Resetting...", "color: orange");
        globalHistoriUnsubscribe();
        globalHistoriUnsubscribe = null;
        globalHistoriData = []; 
    }

    const startStr = dayjs(filterParams.startDate).format("DD/MM");
    const endStr = dayjs(filterParams.endDate).format("DD/MM");
    console.log(`%c🕰️ [HISTORI] Stream Initialized (${startStr} - ${endStr})`, "color: white; background: purple; padding: 2px 5px; border-radius: 3px; font-weight: bold;");

    globalHistoriLoading = true;
    globalHistoriFilterKey = newFilterKey;
    notifyHistoriSubscribers();

    const historiRef = ref(db, 'historiStok');
    const q = query(
        historiRef,
        orderByChild('timestamp'),
        startAt(filterParams.startDate),
        endAt(filterParams.endDate)
    );

    setTimeout(() => {
        globalHistoriUnsubscribe = onValue(q, (snapshot) => {
            const data = snapshotToArrayWithId(snapshot);
            data.sort((a, b) => b.timestamp - a.timestamp);
            
            console.log(`%c🕰️ [HISTORI] Data Loaded: ${data.length} items`, "color: purple");
            
            globalHistoriData = data;
            globalHistoriLoading = false;
            notifyHistoriSubscribers();
        }, (error) => {
            console.error("Error streaming histori stok:", error);
            globalHistoriLoading = false;
            notifyHistoriSubscribers();
        });
    }, 0);
};

export const useHistoriStokStream = ({ startDate, endDate }) => {
    const [data, setData] = useState(globalHistoriData);
    const [loading, setLoading] = useState(globalHistoriLoading);
    const filterKey = JSON.stringify({ startDate, endDate });

    useEffect(() => {
        if (!startDate || !endDate) {
            setLoading(false);
            return;
        }
        
        if (filterKey !== globalHistoriFilterKey) {
             setLoading(true);
             setData([]);
        }

        connectHistoriStream({ startDate, endDate });
        const onDataUpdate = (d, l) => { setData(d); setLoading(l); };
        historiSubscribers.add(onDataUpdate);
        return () => historiSubscribers.delete(onDataUpdate);
    }, [filterKey]); 

    return { historyList: data, loadingHistory: loading };
};

// ============================================================================
// 7. MUTASI STREAM (CACHE + FILTER LOGIC)
// ============================================================================
let globalMutasiData = [];
let globalMutasiLoading = true;
let globalMutasiFilterKey = null;
let globalMutasiUnsubscribe = null;
const mutasiSubscribers = new Set();

const notifyMutasiSubscribers = () => {
    mutasiSubscribers.forEach(cb => cb(globalMutasiData, globalMutasiLoading));
};

const connectMutasiStream = (filterParams) => {
    const newFilterKey = JSON.stringify(filterParams);

    if (globalMutasiUnsubscribe && globalMutasiFilterKey === newFilterKey) {
        notifyMutasiSubscribers();
        return;
    }

    if (globalMutasiUnsubscribe) {
        console.log("%c💰 [MUTASI] Filter Changed. Resetting...", "color: orange");
        globalMutasiUnsubscribe();
        globalMutasiUnsubscribe = null;
        globalMutasiData = []; 
    }

    console.log("%c💰 [MUTASI] Stream Initialized", "color: white; background: green; padding: 2px 5px; border-radius: 3px; font-weight: bold;");
    globalMutasiLoading = true;
    globalMutasiFilterKey = newFilterKey;
    notifyMutasiSubscribers();

    const dbRef = ref(db, "mutasi");
    const q = query(
        dbRef, 
        orderByChild('tanggal'), 
        startAt(filterParams.startDate), 
        endAt(filterParams.endDate)
    );

    setTimeout(() => {
        globalMutasiUnsubscribe = onValue(q, (snapshot) => {
            const data = snapshotToArrayWithId(snapshot);
            const getTimestamp = (r) => r?.tanggal || r?.tanggalBayar || 0;
            data.sort((a, b) => getTimestamp(b) - getTimestamp(a));

            console.log(`%c💰 [MUTASI] Data Incoming: ${data.length} items`, "color: green");

            globalMutasiData = data;
            globalMutasiLoading = false;
            notifyMutasiSubscribers();
        }, (error) => {
            console.error("Error streaming mutasi:", error);
            globalMutasiLoading = false;
            notifyMutasiSubscribers();
        });
    }, 0);
};

export function useMutasiStream(filterParams) {
    const [data, setData] = useState(globalMutasiData);
    const [loading, setLoading] = useState(globalMutasiLoading);
    const filterKey = JSON.stringify(filterParams);

    useEffect(() => {
        if (filterKey !== globalMutasiFilterKey) {
            setLoading(true);
            setData([]);
        }

        connectMutasiStream(filterParams);
        const onDataUpdate = (d, l) => { setData(d); setLoading(l); };
        mutasiSubscribers.add(onDataUpdate);
        return () => mutasiSubscribers.delete(onDataUpdate);
    }, [filterKey]);

    return { mutasiList: data, loadingMutasi: loading };
}


// ============================================================================
// 9. LOGIC LAZY UNPAID JUAL (ON DEMAND STREAM)
// ============================================================================
