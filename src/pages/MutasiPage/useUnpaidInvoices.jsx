import { useState, useEffect } from 'react';
import { ref, onValue, query, orderByChild, equalTo } from 'firebase/database';
import { db } from '../../api/firebase'; // Sesuaikan path

// --- Helper ---
const snapshotToArray = (snapshot) => {
    const data = snapshot.val();
    // Tambahkan perhitungan sisaTagihan langsung di sini
    return data ? Object.keys(data).map(key => {
        const inv = { id: key, ...data[key] };
        inv.sisaTagihan = (inv.totalTagihan || 0) - (inv.jumlahTerbayar || 0);
        return inv;
    }) : [];
};

// --- Singleton RTDB Listener untuk 'Invoices' ---
let unpaidJualCache = [];
let unpaidCetakCache = [];
let invoiceListeners = [];
let invoiceIsInitialized = false;
let invoiceIsLoading = false;
// Simpan semua fungsi unsubscribe dalam satu objek
const invoiceGlobalUnsubscribes = { jualBB: null, jualDP: null, cetakBB: null, cetakDP: null };
// Cache internal untuk menampung hasil individu sebelum digabung
let _jualBB = [], _jualDP = [], _cetakBB = [], _cetakDP = [];

function notifyInvoiceListeners() {
    // Gabungkan hasil dari cache internal
    // Filter juga di sini untuk memastikan hanya yang > 0
    unpaidJualCache = [..._jualBB, ..._jualDP].filter(inv => inv.sisaTagihan > 0);
    unpaidCetakCache = [..._cetakBB, ..._cetakDP].filter(inv => inv.sisaTagihan > 0);

    // Set status inisialisasi dan loading
    invoiceIsInitialized = true;
    invoiceIsLoading = false;

    // Notifikasi semua listener komponen
    invoiceListeners.forEach((listener) => {
        listener({
            unpaidJual: unpaidJualCache,
            unpaidCetak: unpaidCetakCache,
            loadingInvoices: false // Set loading false setelah data siap
        });
    });
}

function initializeInvoiceListeners() {
    // Jangan inisialisasi ulang jika sudah ada atau sedang loading
    if (invoiceGlobalUnsubscribes.jualBB || invoiceIsLoading) return;
    invoiceIsLoading = true;

    // Definisikan query
    const jualBBRef = query(ref(db, 'transaksiJualBuku'), orderByChild('statusPembayaran'), equalTo('Belum Bayar'));
    const jualDPRef = query(ref(db, 'transaksiJualBuku'), orderByChild('statusPembayaran'), equalTo('DP'));
    const cetakBBRef = query(ref(db, 'transaksiCetakBuku'), orderByChild('statusPembayaran'), equalTo('Belum Bayar'));
    const cetakDPRef = query(ref(db, 'transaksiCetakBuku'), orderByChild('statusPembayaran'), equalTo('DP'));

    // Fungsi error handler
    const onError = (type, err) => {
        console.error(`Inv ${type} Error:`, err);
        // Tetap notifikasi agar loading hilang meskipun ada error di salah satu query
        notifyInvoiceListeners();
    };


    // Attach listeners dan simpan fungsi unsubscribe
    // Setiap listener akan update cache internalnya dan memanggil notifyInvoiceListeners
    invoiceGlobalUnsubscribes.jualBB = onValue(jualBBRef, (s) => { _jualBB = snapshotToArray(s); notifyInvoiceListeners(); }, (err) => onError("Jual BB", err));
    invoiceGlobalUnsubscribes.jualDP = onValue(jualDPRef, (s) => { _jualDP = snapshotToArray(s); notifyInvoiceListeners(); }, (err) => onError("Jual DP", err));
    invoiceGlobalUnsubscribes.cetakBB = onValue(cetakBBRef, (s) => { _cetakBB = snapshotToArray(s); notifyInvoiceListeners(); }, (err) => onError("Cetak BB", err));
    invoiceGlobalUnsubscribes.cetakDP = onValue(cetakDPRef, (s) => { _cetakDP = snapshotToArray(s); notifyInvoiceListeners(); }, (err) => onError("Cetak DP", err));
}

/**
 * Hook kustom untuk mendapatkan daftar invoice Jual & Cetak yang belum lunas.
 * Menggunakan listener global tunggal untuk efisiensi.
 */
export function useUnpaidInvoices() {
    // State lokal komponen, diinisialisasi dari cache global
    const [state, setState] = useState({
        unpaidJual: unpaidJualCache,
        unpaidCetak: unpaidCetakCache,
        loadingInvoices: !invoiceIsInitialized // Loading true jika belum inisialisasi
    });

    useEffect(() => {
        // Inisialisasi listener global jika belum ada
        if (!invoiceGlobalUnsubscribes.jualBB) {
            initializeInvoiceListeners();
        }

        // Daftarkan listener komponen ini
        const listener = (newState) => setState(newState);
        invoiceListeners.push(listener);

        // Jika data sudah siap saat komponen mount, update state
        if (invoiceIsInitialized) {
            setState({
                unpaidJual: unpaidJualCache,
                unpaidCetak: unpaidCetakCache,
                loadingInvoices: false
            });
        }

        // Cleanup: Hapus listener komponen saat unmount
        return () => {
            invoiceListeners = invoiceListeners.filter((cb) => cb !== listener);
             // Jangan panggil unsubscribe global di sini
        };
    }, []); // Dependency array kosong, hanya run sekali

    return state;
}

