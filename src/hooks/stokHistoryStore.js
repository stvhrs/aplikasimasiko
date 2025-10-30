import { ref, onValue, query, orderByChild } from 'firebase/database';
// Sesuaikan path ke firebase config Anda
import { db } from '../api/firebase'; 

/**
 * Ini adalah Singleton Store untuk Riwayat Stok.
 * Logika ini berada di luar React dan hanya berjalan sekali saat
 * aplikasi pertama kali dimuat.
 */

// 1. (UBAH) Variabel state disimpan di dalam satu objek snapshot
// Ini penting untuk 'useSyncExternalStore' agar tidak terjadi loop
let memoizedSnapshot = {
    data: [],
    loading: true,
};
let listeners = new Set(); // Daftar semua komponen yang mendengarkan

// 2. Buat koneksi stream ke Firebase RTDB (hanya sekali)
// Mengambil dari root 'historiStok' untuk efisiensi
const historyRef = query(ref(db, 'historiStok'), orderByChild('timestamp'));

// (UBAH) Argumen 'snapshot' diubah namanya menjadi 'fbSnapshot' 
// agar tidak bentrok dengan variabel 'memoizedSnapshot' kita.
onValue(historyRef, (fbSnapshot) => {
    // 3. Saat data baru masuk dari Firebase
    const historyData = fbSnapshot.val();
    let newData = []; // Definisikan data baru

    if (historyData) {
        const loadedHistory = Object.keys(historyData).map(key => ({
            id: key, // ID unik dari Firebase (misal: -Oabc...)
            ...historyData[key]
        }));
        // Urutkan (terbaru dulu)
        loadedHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        newData = loadedHistory; // Tetapkan data baru
    } else {
        newData = [];
    }
    
    // (UBAH) Buat objek snapshot BARU. 
    // 'useSyncExternalStore' akan mendeteksi perubahan referensi objek ini.
    memoizedSnapshot = {
        data: newData,
        loading: false
    };
    
    // 4. Beri tahu semua komponen yang "subscribe" bahwa ada data baru
    listeners.forEach(listener => listener());
}, (error) => {
    // Handle error
    console.error("Error fetching root stock history singleton:", error);
    
    // (UBAH) Buat snapshot baru saat terjadi error
    memoizedSnapshot = {
        data: [],
        loading: false
    };
    listeners.forEach(listener => listener());
});

// 5. Ekspor store agar bisa digunakan oleh hook React
export const stokHistoryStore = {
    /**
     * Dipanggil oleh React untuk mulai mendengarkan perubahan.
     * @param {function} listener - Callback untuk memberi tahu React agar re-render.
     * @returns {function} Fungsi untuk unsubscribe.
     */
    subscribe(listener) {
        listeners.add(listener); // Tambahkan komponen ke daftar
        return () => {
            listeners.delete(listener); // Hapus saat komponen unmount
        };
    },
    /**
     * Dipanggil oleh React untuk mendapatkan data terbaru.
     * @returns {object} Objek state saat ini { data, loading }
     */
    getSnapshot() {
        // (UBAH) Kembalikan snapshot yang sudah disimpan (di-"memoize")
        // Ini mencegah pembuatan objek baru setiap kali render
        return memoizedSnapshot;
    }
};

