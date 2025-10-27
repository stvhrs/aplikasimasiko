// src/utils/mutasiPdfGenerator.js

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

// Helper formatter (bisa juga di-share dari file constants)
const currencyFormatter = (value) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);

// Helper untuk mengambil tanggal
const getTimestamp = (record) => record?.tanggal || record?.tanggalBayar || 0;

/**
 * Membuat Laporan Mutasi dalam format PDF
 * @param {Array} data - Array data (filteredTransaksi)
 * @param {Object} filters - Objek filters dari state
 * @param {Map} balanceMap - Map saldo berjalan
 * @param {Object} KategoriPemasukan - Konstanta KategoriPemasukan
 * @param {Object} KategoriPengeluaran - Konstanta KategoriPengeluaran
 * @returns {Object} { blobUrl, fileName }
 */
export const generateMutasiPdf = (data, filters, balanceMap, KategoriPemasukan, KategoriPengeluaran) => {
    
    const doc = new jsPDF();
    let startY = 46; // Posisi Y awal untuk tabel pertama

    // --- 1. Judul & Info Filter ---
    doc.setFontSize(18);
    doc.text('Laporan Mutasi Transaksi', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);

    // Info Periode Data (Selalu tampil)
    const tglTerbaru = dayjs(getTimestamp(data[0])).format('DD MMM YYYY');
    const tglTerlama = dayjs(getTimestamp(data[data.length - 1])).format('DD MMM YYYY');
    doc.text(`Periode Data: ${tglTerlama} - ${tglTerbaru}`, 14, 30);

    // Info Filter Aktif
    const filterInfo = [];
    if (filters.dateRange) {
        filterInfo.push(`Filter Tanggal: ${dayjs(filters.dateRange[0]).format('DD/MM/YY')} - ${dayjs(filters.dateRange[1]).format('DD/MM/YY')}`);
    }
    if (filters.selectedTipe.length > 0) {
        filterInfo.push(`Tipe: ${filters.selectedTipe.join(', ')}`);
    }
    if (filters.selectedKategori.length > 0) {
        filterInfo.push(`Kategori: (terpilih)`);
    }
    if (filters.searchText) { // Gunakan searchText, bukan debounced
        filterInfo.push(`Cari: "${filters.searchText}"`);
    }

    doc.setFontSize(10);
    doc.text(`Filter Aktif: ${filterInfo.length > 0 ? filterInfo.join(' | ') : 'Tidak ada'}`, 14, 36);

    // --- 2. Ringkasan (Rekapitulasi) ---
    const totalPemasukan = data.reduce((acc, tx) => (tx.jumlah > 0 ? acc + tx.jumlah : acc), 0);
    const totalPengeluaran = data.reduce((acc, tx) => (tx.jumlah < 0 ? acc + tx.jumlah : acc), 0);
    const selisih = totalPemasukan + totalPengeluaran;

    autoTable(doc, {
        startY: startY,
        body: [
            ['Total Pemasukan:', currencyFormatter(totalPemasukan)],
            ['Total Pengeluaran:', currencyFormatter(totalPengeluaran)],
            ['Selisih (Net):', currencyFormatter(selisih)],
        ],
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 2 },
        columnStyles: {
            0: { fontStyle: 'bold', halign: 'right' },
            1: { halign: 'right' },
        },
        didDrawCell: (data) => {
            if (data.section === 'body') {
                if (data.row.index === 0) data.cell.styles.textColor = [40, 167, 69]; // Hijau
                if (data.row.index === 1) data.cell.styles.textColor = [220, 53, 69]; // Merah
                if (data.row.index === 2) data.cell.styles.fontStyle = 'bold';
            }
        }
    });

    // --- 3. (BARU) Ringkasan per Kategori ---
    const pemasukanTotals = {};
    const pengeluaranTotals = {};

    for (const tx of data) {
        if (tx.tipe === 'pemasukan') {
            pemasukanTotals[tx.kategori] = (pemasukanTotals[tx.kategori] || 0) + tx.jumlah;
        } else if (tx.tipe === 'pengeluaran') {
            pengeluaranTotals[tx.kategori] = (pengeluaranTotals[tx.kategori] || 0) + tx.jumlah;
        }
    }

    // Tabel Kategori Pemasukan
    const bodyPemasukan = Object.keys(pemasukanTotals).map(key => [
        KategoriPemasukan[key] || key.replace(/_/g, ' '),
        currencyFormatter(pemasukanTotals[key])
    ]);
    
    if (bodyPemasukan.length > 0) {
        autoTable(doc, {
            head: [['Ringkasan Pemasukan per Kategori', 'Total']],
            body: bodyPemasukan,
            startY: doc.lastAutoTable.finalY + 10, // Mulai setelah tabel ringkasan
            theme: 'striped',
            headStyles: { fillColor: [40, 167, 69] }, // Hijau
            styles: { fontSize: 9, cellPadding: 2 },
            columnStyles: { 1: { halign: 'right' } }
        });
    }

    // Tabel Kategori Pengeluaran
    const bodyPengeluaran = Object.keys(pengeluaranTotals).map(key => [
        KategoriPengeluaran[key] || key.replace(/_/g, ' '),
        currencyFormatter(pengeluaranTotals[key])
    ]);
    
    if (bodyPengeluaran.length > 0) {
        autoTable(doc, {
            head: [['Ringkasan Pengeluaran per Kategori', 'Total']],
            body: bodyPengeluaran,
         startY: doc.lastAutoTable.finalY + 10 + (bodyPemasukan.length > 0 ? 10 : 0), // Mulai setelah tabel sblmnya
            theme: 'striped',
            headStyles: { fillColor: [220, 53, 69] }, // Merah
            styles: { fontSize: 9, cellPadding: 2 },
            columnStyles: { 1: { halign: 'right' } }
        });
    }

    // --- 4. Tabel Data Transaksi ---
    const tableHeaders = ['Tanggal', 'Jenis Transaksi', 'Keterangan', 'Nominal', 'Saldo Akhir'];
    const tableBody = data.map(tx => [
        dayjs(getTimestamp(tx)).format('DD/MM/YYYY'),
        KategoriPemasukan[tx.kategori] || KategoriPengeluaran[tx.kategori] || tx.kategori?.replace(/_/g, ' ') || tx.tipeMutasi,
        tx.keterangan || '-',
        currencyFormatter(tx.jumlah),
        currencyFormatter(balanceMap.get(tx.id))
    ]);

    autoTable(doc, {
        head: [tableHeaders],
        body: tableBody,
        startY: doc.lastAutoTable.finalY + 10, // Mulai setelah tabel ringkasan
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
            3: { halign: 'right' },
            4: { halign: 'right' },
        },
        didParseCell: (data) => {
            if (data.column.index === 3 && data.section === 'body') {
              // --- GANTI INI ---
// --- MENJADI INI ---
const tx = data.table.body[data.row.index].raw; // Ambil data mentah
                if (tx && typeof tx.jumlah === 'number' && tx.jumlah < 0) {
                     data.cell.styles.textColor = [220, 53, 69]; // Merah
                } else {
                     data.cell.styles.textColor = [40, 167, 69]; // Hijau
                }
            }
        }
    });

    // --- 5. Return Blob ---
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    const fileName = `Laporan_Mutasi_${dayjs().format('YYYYMMDD_HHmmss')}.pdf`;

    return { blobUrl: url, fileName: fileName };
};