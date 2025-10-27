// src/hooks/useFirebaseData.js (or wherever usePelangganData is)
import { useEffect, useState } from "react";
import { ref, onValue, query, orderByChild, equalTo } from "firebase/database";
import { db } from '../../api/firebase'; // Adjust path if needed

// --- Helper ---
const snapshotToArrayWithId = (snapshot) => {
    const val = snapshot.val();
    return val ? Object.keys(val).map(key => ({ id: key, ...val[key] })) : [];
};

// --- Pelanggan Singleton (Existing - Ensure ID is included) ---
let pelangganCache = [];
let pelangganListeners = [];
let pelangganIsInitialized = false;
let pelangganIsLoading = false;
let pelangganGlobalUnsubscribe = null;

function notifyPelangganListeners() { /* ... */ }
function initializePelangganListener() { /* ... ensure snapshotToArrayWithId is used ... */ }
export function usePelangganData() { /* ... existing hook ... */ }

// --- Buku Singleton (Example - Add if not already done, ensure ID is included) ---
// let bukuCache = []; etc...
// export function useBukuData() { /* ... similar logic ... */ }


// === (BARU) Mutasi Singleton ===
let mutasiCache = [];
let mutasiListeners = [];
let mutasiIsInitialized = false;
let mutasiIsLoading = false;
let mutasiGlobalUnsubscribe = null;

function notifyMutasiListeners() {
  mutasiListeners.forEach((listener) => listener(mutasiCache));
}

function initializeMutasiListener() {
  if (mutasiGlobalUnsubscribe || mutasiIsLoading) return;
  mutasiIsLoading = true;
  const mutasiRef = ref(db, "mutasi");

  mutasiGlobalUnsubscribe = onValue(
    mutasiRef,
    (snapshot) => {
      const data = snapshotToArrayWithId(snapshot);
      // Sort immediately after fetching (newest first)
      const getTimestamp = (record) => record?.tanggal || record?.tanggalBayar || 0;
      data.sort((a, b) => getTimestamp(b) - getTimestamp(a));

      mutasiCache = data;
      mutasiIsInitialized = true;
      mutasiIsLoading = false;
      console.log("Mutasi data fetched/updated:", mutasiCache);
      notifyMutasiListeners();
    },
    (error) => {
      console.error("RTDB error (mutasi):", error);
      mutasiCache = [];
      mutasiIsInitialized = true;
      mutasiIsLoading = false;
      notifyMutasiListeners();
    }
  );
}

export function useMutasiData() {
  const [data, setData] = useState(mutasiCache);
  const [loading, setLoading] = useState(!mutasiIsInitialized);

  useEffect(() => {
    if (!mutasiGlobalUnsubscribe && !mutasiIsLoading) {
      initializeMutasiListener();
    }
    const handleUpdate = (newData) => {
      setData(newData);
      if (mutasiIsInitialized && loading) {
        setLoading(false);
      }
    };
    mutasiListeners.push(handleUpdate);
    if (mutasiIsInitialized) {
      setData(mutasiCache);
      setLoading(false);
    } else {
        setLoading(true);
    }
    return () => {
      mutasiListeners = mutasiListeners.filter((cb) => cb !== handleUpdate);
    };
  }, [loading]); // Add loading dependency

  return { mutasiList: data, loadingMutasi: loading };
}
// === Akhir Mutasi Singleton ===


// === (BARU) Unpaid Invoices Singleton ===
let unpaidJualCache = [];
let unpaidCetakCache = [];
let unpaidListeners = [];
let unpaidJualInitialized = false;
let unpaidCetakInitialized = false;
let unpaidJualLoading = false;
let unpaidCetakLoading = false;
let unpaidJualUnsub = null; // Separate unsubscribe for jual DP/BB
let unpaidCetakUnsub = null;// Separate unsubscribe for cetak DP/BB

// Helper to combine and notify
function notifyUnpaidListeners() {
    // Only notify if *both* sources have loaded at least once
    if (unpaidJualInitialized && unpaidCetakInitialized) {
        unpaidListeners.forEach(listener => listener({
            unpaidJual: unpaidJualCache,
            unpaidCetak: unpaidCetakCache,
            loadingInvoices: unpaidJualLoading || unpaidCetakLoading // True if either is still loading initially
        }));
    }
}

function initializeUnpaidListeners() {
    // Jual Listener (DP and Belum Bayar combined logic)
    if (!unpaidJualUnsub && !unpaidJualLoading) {
        unpaidJualLoading = true;
        let jualDPData = [];
        let jualBBData = [];
        const processJualUpdate = () => {
            unpaidJualCache = [...jualBBData, ...jualDPData]; // Combine
            notifyUnpaidListeners(); // Notify combined result
        };

        const jualBBRef = query(ref(db, 'transaksiJualBuku'), orderByChild('statusPembayaran'), equalTo('Belum Bayar'));
        const jualDPRef = query(ref(db, 'transaksiJualBuku'), orderByChild('statusPembayaran'), equalTo('DP'));

        const unsubBB = onValue(jualBBRef, snapshot => {
            jualBBData = snapshotToArrayWithId(snapshot);
            unpaidJualInitialized = true; // Mark as initialized on first successful fetch
            unpaidJualLoading = false;
            processJualUpdate();
        }, error => {
            console.error("Error fetching unpaid Jual (BB):", error);
            unpaidJualInitialized = true; unpaidJualLoading = false; processJualUpdate(); // Still proceed
        });
        const unsubDP = onValue(jualDPRef, snapshot => {
            jualDPData = snapshotToArrayWithId(snapshot);
            unpaidJualInitialized = true; // Mark as initialized on first successful fetch
            unpaidJualLoading = false;
            processJualUpdate();
        }, error => {
             console.error("Error fetching unpaid Jual (DP):", error);
             unpaidJualInitialized = true; unpaidJualLoading = false; processJualUpdate(); // Still proceed
        });
        // Store combined unsubscribe function
        unpaidJualUnsub = () => { unsubBB(); unsubDP(); };
    }

    // Cetak Listener (DP and Belum Bayar combined logic)
    if (!unpaidCetakUnsub && !unpaidCetakLoading) {
        unpaidCetakLoading = true;
        let cetakDPData = [];
        let cetakBBData = [];
        const processCetakUpdate = () => {
            unpaidCetakCache = [...cetakBBData, ...cetakDPData]; // Combine
            notifyUnpaidListeners(); // Notify combined result
        };

        const cetakBBRef = query(ref(db, 'transaksiCetakBuku'), orderByChild('statusPembayaran'), equalTo('Belum Bayar'));
        const cetakDPRef = query(ref(db, 'transaksiCetakBuku'), orderByChild('statusPembayaran'), equalTo('DP'));

         const unsubCetakBB = onValue(cetakBBRef, snapshot => {
            cetakBBData = snapshotToArrayWithId(snapshot);
            unpaidCetakInitialized = true; // Mark as initialized
            unpaidCetakLoading = false;
            processCetakUpdate();
        }, error => {
            console.error("Error fetching unpaid Cetak (BB):", error);
            unpaidCetakInitialized = true; unpaidCetakLoading = false; processCetakUpdate();
        });
        const unsubCetakDP = onValue(cetakDPRef, snapshot => {
            cetakDPData = snapshotToArrayWithId(snapshot);
            unpaidCetakInitialized = true; // Mark as initialized
            unpaidCetakLoading = false;
            processCetakUpdate();
        }, error => {
             console.error("Error fetching unpaid Cetak (DP):", error);
             unpaidCetakInitialized = true; unpaidCetakLoading = false; processCetakUpdate();
        });
         // Store combined unsubscribe function
        unpaidCetakUnsub = () => { unsubCetakBB(); unsubCetakDP(); };
    }
}

export function useUnpaidInvoicesData() {
    const [state, setState] = useState({
        unpaidJual: unpaidJualCache,
        unpaidCetak: unpaidCetakCache,
        // Loading is true if *either* source hasn't initialized
        loadingInvoices: !unpaidJualInitialized || !unpaidCetakInitialized
    });

    useEffect(() => {
        // Initialize if needed
        if ((!unpaidJualUnsub || !unpaidCetakUnsub) && !(unpaidJualLoading || unpaidCetakLoading)) {
            initializeUnpaidListeners();
        }

        // Wrapper to update state
        const handleUpdate = (newState) => {
            setState(newState);
        };

        unpaidListeners.push(handleUpdate);

        // Sync on mount if already initialized
        if (unpaidJualInitialized && unpaidCetakInitialized) {
            setState({
                unpaidJual: unpaidJualCache,
                unpaidCetak: unpaidCetakCache,
                loadingInvoices: false
            });
        } else {
             // Ensure loading is true if not initialized
             setState(prev => ({ ...prev, loadingInvoices: true }));
        }

        return () => {
            unpaidListeners = unpaidListeners.filter(cb => cb !== handleUpdate);
        };
        // Use loading state as dependency to ensure it turns off
    }, [state.loadingInvoices]);

    return state; // { unpaidJual, unpaidCetak, loadingInvoices }
}

// === Akhir Unpaid Invoices Singleton ===