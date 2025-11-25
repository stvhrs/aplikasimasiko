import { useEffect, useState } from "react";
import { get, ref, onValue, query, orderByChild, startAt, endAt, equalTo, limitToLast, limitToFirst, off } from "firebase/database";
import { db } from '../api/firebase'; 
import dayjs from "dayjs";

// --- Helper ---
const snapshotToArrayWithId = (snapshot) => {
    const val = snapshot.val();
    if (!val) return [];
    return Object.keys(val).map(key => ({ id: key, ...val[key] }));
};

// ============================================================================
// 1. BUKU STREAM (GLOBAL CACHE - ANTI RELOAD)
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
        // console.log("%c📘 [BUKU] Using Existing Stream (No Reload)", "color: blue; background: #e6f7ff; padding: 2px 5px; border-radius: 3px;");
        notifyBukuSubscribers();
        return;
    }

    console.log("%c📘 [BUKU] Stream Initialized", "color: white; background: blue; padding: 2px 5px; border-radius: 3px; font-weight: bold;");
    globalBukuLoading = true;
    notifyBukuSubscribers();

    const bukuRef = ref(db, 'buku');

    globalBukuUnsubscribe = onValue(bukuRef, (snapshot) => {
        const formattedData = snapshotToArrayWithId(snapshot);
        formattedData.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        
        console.log(`%c📘 [BUKU] Data Incoming: ${formattedData.length} items`, "color: blue");
        
        globalBukuData = formattedData;
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
// 2. PELANGGAN STREAM (GLOBAL CACHE - ANTI RELOAD)
// ============================================================================
let globalPelangganData = [];
let globalPelangganLoading = true;
let globalPelangganUnsubscribe = null;
const pelangganSubscribers = new Set();

const notifyPelangganSubscribers = () => {
    pelangganSubscribers.forEach(cb => cb(globalPelangganData, globalPelangganLoading));
};

const connectPelangganStream = () => {
    if (globalPelangganUnsubscribe) {
        // console.log("%c👥 [PELANGGAN] Using Existing Stream (No Reload)", "color: #00BCD4; background: #E0F7FA; padding: 2px 5px; border-radius: 3px;");
        notifyPelangganSubscribers();
        return;
    }

    console.log("%c👥 [PELANGGAN] Stream Initialized", "color: white; background: #00BCD4; padding: 2px 5px; border-radius: 3px; font-weight: bold;");
    globalPelangganLoading = true;
    notifyPelangganSubscribers();

    const pelangganRef = ref(db, 'pelanggan');

    globalPelangganUnsubscribe = onValue(pelangganRef, (snapshot) => {
        const formattedData = snapshotToArrayWithId(snapshot);
        formattedData.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
        
        console.log(`%c👥 [PELANGGAN] Data Incoming: ${formattedData.length} items`, "color: #00BCD4");
        
        globalPelangganData = formattedData;
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
// 3. TRANSAKSI JUAL STREAM (PERBAIKAN UTAMA: LOADING STATE)
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

    // 1. Jika Filter SAMA -> Pakai Cache (Instant Load)
    if (globalTransaksiUnsubscribe && globalTransaksiFilterKey === newFilterKey) {
        console.log("%c🛒 [TRANSAKSI] Using Existing Stream (No Reload)", "color: #E91E63; background: #FCE4EC; padding: 2px 5px; border-radius: 3px;");
        notifyTransaksiSubscribers();
        return;
    }

    // 2. Jika Filter BEDA -> Reset Stream & DATA
    if (globalTransaksiUnsubscribe) {
        console.log("%c🛒 [TRANSAKSI] Filter Changed. Resetting...", "color: orange");
        globalTransaksiUnsubscribe();
        globalTransaksiUnsubscribe = null;
        
        // HARD RESET: Kosongkan data global agar semua subscriber masuk state loading
        globalTransaksiData = []; 
    }

    let logMsg = filterParams.mode === 'all' ? "ALL TIME" : "RANGE DATE";
    console.log(`%c🛒 [TRANSAKSI] Stream Initialized (${logMsg})`, "color: white; background: #E91E63; padding: 2px 5px; border-radius: 3px; font-weight: bold;");

    // Set Loading TRUE seketika
    globalTransaksiLoading = true;
    globalTransaksiFilterKey = newFilterKey;
    notifyTransaksiSubscribers(); // Trigger UI update (Show Spinner)

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

    // Menggunakan setTimeout 0 agar React sempat me-render Loading State
    // sebelum thread diblokir oleh proses data yang besar
    setTimeout(() => {
        globalTransaksiUnsubscribe = onValue(q, (snapshot) => {
            const formattedData = snapshotToArrayWithId(snapshot);
            formattedData.sort((a, b) => (b.tanggal || 0) - (a.tanggal || 0));
            
            console.log(`%c🛒 [TRANSAKSI] Data Loaded: ${formattedData.length} items`, "color: #E91E63");
            
            globalTransaksiData = formattedData;
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
    // Inisialisasi state dengan global data saat ini
    const [data, setData] = useState(globalTransaksiData);
    const [loading, setLoading] = useState(globalTransaksiLoading);

    // Deteksi perubahan filter di level komponen untuk local reset
    const currentFilterJson = JSON.stringify(filterParams);

    useEffect(() => {
        // Jika filter berubah dan tidak cocok dengan cache global, 
        // paksa komponen ini loading dulu (Local Reset)
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
        
        return () => {
            transaksiSubscribers.delete(onDataUpdate);
        };
    }, [currentFilterJson]);

    return { transaksiList: data, loadingTransaksi: loading };
};


// ============================================================================
// 4. HISTORI STOK STREAM (DENGAN HARD RESET)
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
        console.log("%c🕰️ [HISTORI] Using Existing Stream (No Reload)", "color: purple; background: #f9f0ff; padding: 2px 5px; border-radius: 3px;");
        notifyHistoriSubscribers();
        return;
    }

    if (globalHistoriUnsubscribe) {
        console.log("%c🕰️ [HISTORI] Filter Changed. Resetting...", "color: orange");
        globalHistoriUnsubscribe();
        globalHistoriUnsubscribe = null;
        globalHistoriData = []; // Hard Reset
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
            const formattedData = snapshotToArrayWithId(snapshot);
            formattedData.sort((a, b) => b.timestamp - a.timestamp);
            
            console.log(`%c🕰️ [HISTORI] Data Loaded: ${formattedData.length} items`, "color: purple");
            
            globalHistoriData = formattedData;
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
// 5. MUTASI STREAM (DENGAN HARD RESET)
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
        console.log("%c💰 [MUTASI] Using Existing Stream (No Reload)", "color: green; background: #f6ffed; padding: 2px 5px; border-radius: 3px;");
        notifyMutasiSubscribers();
        return;
    }

    if (globalMutasiUnsubscribe) {
        console.log("%c💰 [MUTASI] Filter Changed. Resetting...", "color: orange");
        globalMutasiUnsubscribe();
        globalMutasiUnsubscribe = null;
        globalMutasiData = []; // Hard Reset
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
            const rawData = snapshotToArrayWithId(snapshot);
            const getTimestamp = (r) => r?.tanggal || r?.tanggalBayar || 0;
            rawData.sort((a, b) => getTimestamp(b) - getTimestamp(a));

            console.log(`%c💰 [MUTASI] Data Incoming: ${rawData.length} items`, "color: green");

            globalMutasiData = rawData;
            globalMutasiLoading = false;
            notifyMutasiSubscribers();
        }, (error) => {
            console.error("🔴 [Stream] Error:", error);
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

// ==================================================================
// 6. FUNGSI PENCARIAN INVOICE (ON DEMAND)
// ==================================================================
export const searchInvoices = async (keyword = "", isReturMode) => {
    const dbRef = ref(db, 'transaksiJualBuku');
    let finalResults = [];

    try {
        console.log(`%c🔍 [SEARCH] Searching: "${keyword}"`, "color: teal");
        
        if (!keyword) {
            const q = query(dbRef, orderByChild('tanggal'), limitToLast(100));
            const snapshot = await get(q);
            
            if (snapshot.exists()) {
                const val = snapshot.val();
                let list = Object.keys(val).map(key => ({ id: key, ...val[key] }));
                list.sort((a, b) => (b.tanggal || 0) - (a.tanggal || 0));

                if (isReturMode) {
                    finalResults = list;
                } else {
                    finalResults = list.filter(item => 
                        item.statusPembayaran === 'Belum' || 
                        item.statusPembayaran === 'Sebagian' || 
                        item.statusPembayaran === 'DP'
                    );
                }
            }
        } 
        else {
            const searchInvoice = keyword.toUpperCase();
            const searchName = keyword; 

            const queries = [
                query(dbRef, orderByChild('nomorInvoice'), startAt(searchInvoice), endAt(searchInvoice + "\uf8ff"), limitToFirst(20)),
                query(dbRef, orderByChild('namaPelanggan'), startAt(searchName), endAt(searchName + "\uf8ff"), limitToFirst(20))
            ];

            const snapshots = await Promise.all(queries.map(q => get(q)));
            const uniqueMap = new Map();
            snapshots.forEach(snap => {
                if (snap.exists()) {
                    const val = snap.val();
                    Object.keys(val).forEach(key => {
                        uniqueMap.set(key, { id: key, ...val[key] });
                    });
                }
            });

            finalResults = Array.from(uniqueMap.values());

            if (!isReturMode) {
                finalResults = finalResults.filter(item => item.statusPembayaran !== 'Lunas');
            }
            
            finalResults.sort((a, b) => (b.tanggal || 0) - (a.tanggal || 0));
        }

        console.log(`%c🔍 [SEARCH] Found: ${finalResults.length} items`, "color: teal");
        return finalResults.slice(0, 20);

    } catch (error) {
        console.error("Error fetching invoices:", error);
        return [];
    }
};

// ==================================================================
// 7. LOGIC LAZY UNPAID JUAL (ON DEMAND STREAM)
// ==================================================================
export function useLazyUnpaidJual() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        console.log("%c🟠 [UNPAID] Stream Started...", "color: orange");
        setLoading(true);

        const dbRef = ref(db, 'transaksiJualBuku');
        const q = query(dbRef, orderByChild('statusPembayaran'), equalTo('Belum'));
        
        const unsubscribe = onValue(q, (snap) => {
            const list = snapshotToArrayWithId(snap);
            list.sort((a, b) => (b.tanggal || 0) - (a.tanggal || 0));
            
            console.log(`%c🟠 [UNPAID] Data Updated: ${list.length} items`, "color: orange");
            setData(list);
            setLoading(false);
        });

        return () => {
            console.log("%c🟠 [UNPAID] Stream Stopped", "color: gray");
            off(q); 
        };
    }, []);

    return { unpaidJual: data, loadingInvoices: loading };
}