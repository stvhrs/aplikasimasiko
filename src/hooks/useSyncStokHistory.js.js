import { useSyncExternalStore } from 'react';
// Impor store yang kita buat
import { stokHistoryStore } from './stokHistoryStore'; 

/**
 * Hook kustom untuk mengambil data 'historiStok' dari singleton store.
 * * Menggunakan `useSyncExternalStore` adalah cara modern React untuk
 * terhubung ke state eksternal (seperti singleton store kita) 
 * dan memastikan tidak ada "tearing" (UI tidak sinkron).
 */
const useSyncStokHistory = () => {
    // Hook ini memberi tahu React untuk:
    // 1. "subscribe" ke store kita.
    // 2. "getSnapshot" untuk data terbaru.
    // 3. Re-render komponen ini jika "subscribe" callback dipanggil.
    const state = useSyncExternalStore(
        stokHistoryStore.subscribe,
        stokHistoryStore.getSnapshot
    );

    // Kembalikan state { data, loading }
    return state;
};

export default useSyncStokHistory;
