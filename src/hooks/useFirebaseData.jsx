import { useState, useEffect } from 'react';
import { db } from '../api/firebase'; 
import { 
    ref, query, orderByChild, startAt, endAt, onValue 
} from "firebase/database";
import dayjs from 'dayjs';


// --- SINGLETON STATE ---
// Export agar bisa diakses komponen untuk set Initial State
export const globalPembayaran = {
    data: [],
    loading: false,
    unsubscribe: null,
    rangeKey: null,
    lastDateRange: null // TAMBAHAN: Simpan object date range terakhir
};

export const globalRetur = {
    data: [],
    loading: false,
    unsubscribe: null,
    rangeKey: null,
    lastDateRange: null
};
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
// --- HOOK PEMBAYARAN ---
export const usePembayaranStream = (dateRange) => {
    // Init state dari global (agar instan saat mount)
    const [data, setData] = useState(globalPembayaran.data);
    const [loading, setLoading] = useState(
        // Loading hanya true jika data kosong DAN global juga sedang loading/kosong
        globalPembayaran.data.length === 0 
    );

    useEffect(() => {
        const start = dateRange ? dayjs(dateRange[0]).format('YYYY-MM-DD') : 'start';
        const end = dateRange ? dayjs(dateRange[1]).format('YYYY-MM-DD') : 'end';
        const currentRangeKey = `${start}_${end}`;

        // LOGIKA UTAMA:
        // Cek apakah filter tanggal berubah dari yang tersimpan di memori global?
        const isRangeChanged = globalPembayaran.rangeKey !== currentRangeKey;

        if (isRangeChanged) {
            // JIKA TANGGAL BEDA: Set loading true, reset data visual
            setLoading(true);
            setData([]); 
            globalPembayaran.loading = true;
            globalPembayaran.rangeKey = currentRangeKey;
            globalPembayaran.lastDateRange = dateRange; // Simpan range object untuk UI
            
            // Matikan listener lama karena query akan berubah
            if (globalPembayaran.unsubscribe) {
                globalPembayaran.unsubscribe();
                globalPembayaran.unsubscribe = null;
            }
        }

        // Jika listener sudah ada DAN tanggal sama, kita hanya perlu update callback setData
        // Tapi Firebase onValue tidak support ganti callback.
        // Triknya: Kita tetap subscribe ulang, TAPI karena data sudah ada di cache SDK,
        // ini akan berjalan sangat cepat (hampir instan).
        
        // PENTING: Jangan unsubscribe jika range sama, kecuali kita mau replace listenernya.
        // Di React strict mode, mount/unmount sering terjadi.
        // Kita timpa listener lama.
        if (globalPembayaran.unsubscribe) globalPembayaran.unsubscribe();

        const startDate = dateRange ? dayjs(dateRange[0]).startOf('day').valueOf() : 0;
        const endDate = dateRange ? dayjs(dateRange[1]).endOf('day').valueOf() : Date.now();
        const q = query(
            ref(db, 'historiPembayaran'), 
            orderByChild('tanggal'), 
            startAt(startDate), 
            endAt(endDate)
        );

        globalPembayaran.unsubscribe = onValue(q, (snapshot) => {
            const list = [];
            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    list.push({ id: child.key, ...child.val() });
                });
            }
            list.reverse();

            // Update Global
            globalPembayaran.data = list;
            globalPembayaran.loading = false;

            // Update Lokal
            setData(list);
            setLoading(false);
        });

        // Cleanup saat unmount page:
        // JANGAN matikan globalPembayaran.unsubscribe di sini agar data tetap hidup di background/memori
        return () => {
            // Kosong: Biarkan stream tetap terbuka
        };

    }, [
        // Gunakan string key sebagai dependency agar useEffect tidak jalan 
        // hanya karena object dateRange direcreate oleh React
        dateRange ? `${dayjs(dateRange[0]).format('YYYY-MM-DD')}_${dayjs(dateRange[1]).format('YYYY-MM-DD')}` : 'null'
    ]);

    return { pembayaranList: data, loadingPembayaran: loading };
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
