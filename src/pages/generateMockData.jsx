// --- IMPOR UNTUK GENERATE KEY HISTORI (Client-side) ---
import { ref, push } from 'firebase/database';
import { db } from '../api/firebase'; // Pastikan path ini benar
// ---------------------------------------------

// --- KONSTANTA DATA BARU ---
const jenjangList = ["SD", "SMP", "SMA"];

const mapelSD = [
    "Tematik", "Matematika", "Bahasa Indonesia", "Bahasa Inggris", 
    "PJOK", "Seni Budaya", "Agama Islam", "Agama Kristen", "Bahasa Jawa" // Contoh mapel SD
];
const mapelSMP = [
    "Matematika", "IPA Terpadu", "IPS Terpadu", "Bahasa Indonesia", "Bahasa Inggris",
    "PPKn", "Informatika", "Seni Budaya", "PJOK", "Prakarya", "Agama Islam", "Agama Kristen" // Contoh mapel SMP
];
const mapelSMA = [
    "Matematika Wajib", "Matematika Minat", "Fisika", "Kimia", "Biologi", 
    "Geografi", "Sejarah Indonesia", "Sosiologi", "Ekonomi", "Bahasa Indonesia", 
    "Bahasa Inggris", "Sastra Inggris", "Informatika", "PPKn", "Seni Budaya", "PJOK", 
    "Prakarya & KWU", "Agama Islam", "Agama Kristen" // Contoh mapel SMA
];

// Daftar tipe buku (sesuai permintaan terakhir)
const tipeBukuList = [
    "BTU", "BTP", "Non Teks", "Buku Guru ", "Umum", "LKS", "Jurnal",
];

// Generate 13 nama penerbit secara otomatis
const penerbitList = Array.from({ length: 13 }, (_, i) => `Penerbit ${String.fromCharCode(65 + i)} Press`); // Penerbit A Press, B Press, dst.

// --- AKHIR KONSTANTA DATA ---


// Helper (tidak berubah)
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Fungsi utama generateBooks (DIR)
export const generateBooks = (numBooks) => {
    const books = [];
    const baseTimestamp = Date.now(); // Waktu saat ini sebagai basis
    const tempHistoryRef = ref(db, 'temp_history_key_generator'); // Hanya untuk generate key

    for (let i = 0; i < numBooks; i++) {
        const kodeBuku = `BK-${String(i + 1).padStart(6, '0')}`;
        
        // Pilih Jenjang, Kelas, Mapel secara logis
        const jenjang = getRandomElement(jenjangList);
        let kelas;
        let mapel;
        if (jenjang === "SD") {
            kelas = getRandomInt(1, 6);
            mapel = getRandomElement(mapelSD);
        } else if (jenjang === "SMP") {
            kelas = getRandomInt(7, 9);
            mapel = getRandomElement(mapelSMP);
        } else { // SMA
            kelas = getRandomInt(10, 12);
            mapel = getRandomElement(mapelSMA);
        }

        const tipeBuku = getRandomElement(tipeBukuList);
        const penerbit = getRandomElement(penerbitList);
        
        // Buat Judul lebih deskriptif
        const judul = `${tipeBuku} ${mapel} Kelas ${kelas} ${jenjang} - ${penerbit}`;

        // --- Simulasi Histori Stok (Logika sama seperti sebelumnya) ---
        let currentStok = 0;
        let lastHistoryTimestamp = baseTimestamp - (365 * 24 * 60 * 60 * 1000) + getRandomInt(0, 30 * 24 * 60 * 60 * 1000); 
        const historiStokObject = {};
        const numHistoryEntries = getRandomInt(95, 105); 

        for (let j = 0; j < numHistoryEntries; j++) {
            const isStokMasuk = Math.random() > 0.4; 
            const perubahan = isStokMasuk ? getRandomInt(5, 150) : getRandomInt(-100, -1);
            const stokSebelum = currentStok;
            const stokSesudah = stokSebelum + perubahan;
            lastHistoryTimestamp += getRandomInt(1 * 60 * 60 * 1000, 72 * 60 * 60 * 1000); 
            
            let keterangan = '';
            if (j === 0) keterangan = "Stok Awal (Import)";
            else if (isStokMasuk) keterangan = `Pembelian PO-${getRandomInt(1000, 9999)}`;
            else {
                keterangan = `Penjualan INV/${getRandomInt(2024, 2025)}/${String(getRandomInt(1,12)).padStart(2,'0')}/${String(getRandomInt(1,500)).padStart(4,'0')}`;
                if (Math.random() < 0.05) keterangan = "Koreksi Stok Fisik";
            }

            const historyKey = push(tempHistoryRef).key; 
            historiStokObject[historyKey] = {
                keterangan, perubahan, stokSebelum, stokSesudah, timestamp: lastHistoryTimestamp 
            };
            currentStok = stokSesudah; 
        }
        // --- Akhir Simulasi Histori Stok ---

        // Harga Jual dasar, sedikit variasi berdasarkan jenjang
        let hargaJual = 0;
        let basePrice = 50000;
        if (jenjang === "SMP") basePrice = 60000;
        else if (jenjang === "SMA") basePrice = 70000;

        if (tipeBuku === "LKS") hargaJual = getRandomInt(basePrice * 0.3, basePrice * 0.6);
        else if (tipeBuku === "Non Teks" || tipeBuku === "Umum" || tipeBuku === "Jurnal") hargaJual = getRandomInt(basePrice * 1.2, basePrice * 3);
        else hargaJual = getRandomInt(basePrice * 0.8, basePrice * 1.5); // BTU, BTP, Buku Guru
        
        hargaJual = Math.round(hargaJual / 1000) * 1000; // Bulatkan ke ribuan terdekat


        const book = {
            id: kodeBuku, 
            kode_buku: kodeBuku,
            judul: judul, // Judul baru yang deskriptif
            penerbit: penerbit,
            tipe_buku: tipeBuku, 
            jenjang: jenjang, // Tambahkan jenjang
            kelas: kelas,     // Tambahkan kelas
            mapel: mapel,     // Tambahkan mapel
            hargaJual: hargaJual, 
            harga_zona_2: 0,
            harga_zona_3: 0,
            harga_zona_4: 0,
            harga_zona_5a: 0,
            harga_zona_5b: 0,
            stok: currentStok, // Stok akhir dari simulasi
            // createdAt lebih awal dari histori pertama
            createdAt: lastHistoryTimestamp - (numHistoryEntries + getRandomInt(10, 50)) * (24 * 60 * 60 * 1000), 
            updatedAt: lastHistoryTimestamp, // updatedAt = timestamp histori terakhir
            historiStok: historiStokObject, 
        };
        books.push(book);
    }

    // Sortir hasil akhir berdasarkan updatedAt (terbaru dulu) - OPSIONAL
    books.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    console.log(`Generated ${books.length} books. First book sample:`, books[0]); // Log sample
    return books;
};