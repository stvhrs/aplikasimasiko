// src/utils/pdfGenerator.js
import { numberFormatter, currencyFormatter, percentFormatter } from './formatters';

// --- MODIFIKASI IMPORT ---
import jsPDF from 'jspdf';
// Hapus: import 'jspdf-autotable'; 
import autoTable from 'jspdf-autotable'; // Import fungsi autoTable secara langsung
// --- AKHIR MODIFIKASI ---

// Pastikan Mock jsPDF sudah dihapus atau dikomentari semua jika library asli diinstal

export const generateBukuPdfBlob = (dataToExport, headerInfo = {}) => {
    const {
        cvName = "CV. GANGSAR MULIA UTAMA",
        address = "Jl. Kalicari Dalam I No.4, Kalicari, Kec. Pedurungan, Kota Semarang, Jawa Tengah 50198",
        phone = "0882-0069-05391" 
    } = headerInfo;

    const doc = new jsPDF('vertical');
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    let finalY = 0;

    // --- HEADER PDF (Tidak berubah) ---
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(cvName, pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(address, pageWidth / 2, 21, { align: 'center' });
    doc.text(`Telp: ${phone}`, pageWidth / 2, 26, { align: 'center' }); 
    doc.setLineWidth(0.3);
    doc.line(14, 29, pageWidth - 14, 29); 
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Daftar Stok Buku', pageWidth / 2, 36, { align: 'center' });
    // --- AKHIR HEADER ---
    
    // --- KOLOM & DATA TABEL (Tidak berubah) ---
    const tableColumn = [ /* ... kolom ... */ 
        "No.", "Judul Buku", "Penerbit", "Stok", "Hrg. Z1", 
        "Diskon", "Mapel", "Kelas", "Tipe Buku", "Spek", "Peruntukan"
    ];
    const tableRows = dataToExport.map((buku, index) => [ /* ... data ... */ 
        index + 1, 
        buku.judul || '-',
        buku.penerbit || '-',
        numberFormatter(buku.stok),
        currencyFormatter(buku.hargaJual), 
        percentFormatter(buku.diskonJual), 
        buku.mapel || '-',
        buku.kelas || '-',
        buku.tipe_buku || '-',
        buku.spek || '-',
        buku.peruntukan || '-'
    ]);
    // --- AKHIR KOLOM & DATA ---

    // --- PENGATURAN TABEL autoTable (MODIFIED) ---
    // Panggil autoTable sebagai fungsi, bukan metode dari doc
    autoTable(doc, { // <-- PERUBAHAN DI SINI
        head: [tableColumn],
        body: tableRows,
        startY: 42, 
        theme: 'grid', 
        headStyles: { 
            fillColor: [230, 230, 230], 
            textColor: 30, 
            fontStyle: 'bold', 
            halign: 'left', 
            fontSize: 6, 
            cellPadding: 1 
        },
        bodyStyles: { 
            fontSize: 5, 
            cellPadding: 1 
        },
        alternateRowStyles: {
            fillColor: [245, 245, 245] 
        },
        columnStyles: { 
            0: { cellWidth: 7, halign: 'center' },   // No.
            1: { cellWidth: "auto" },               // Judul Buku
            2: { cellWidth: 12 },                   // Penerbit
            3: { cellWidth: 9, halign: 'right' },  // Stok
            4: { cellWidth: 18, halign: 'right' },  // Hrg. Z1
            5: { cellWidth: 10, halign: 'left' },  // Diskon
            6: { cellWidth: 36 },                   // Mapel
            7: { cellWidth: 9, halign: 'left' }, // Kelas
            8: { cellWidth: 14 },                   // Tipe Buku
            9: { cellWidth: 11, halign: 'left' }, // Spek
            10: { cellWidth: 14 }                   // Peruntukan
        },
        willDrawCell: function (data) {
            if (data.column.dataKey === 1 ) { 
                if (data.cell.raw && typeof data.cell.raw === 'string' && data.cell.raw.length > 45) { 
                    data.cell.text = data.cell.raw.substring(0, 42) + '...';
                }
            }
        },
        didDrawPage: function (data) {
            // Untuk mendapatkan posisi Y terakhir, kita perlu akses dari argumen autoTable
            // atau menggunakan properti internal jika tersedia di versi ini
             try {
                // @ts-ignore (Mengabaikan error type checking jika ada)
                finalY = data.cursor.y; 
             } catch(e){
                console.warn("Tidak bisa mendapatkan cursor.y dari didDrawPage");
                // Fallback jika cursor tidak tersedia
                // @ts-ignore 
                finalY = doc.lastAutoTable?.finalY || 50; // Coba pakai lastAutoTable jika masih ada
             }
        }
    });
    // --- AKHIR PENGATURAN TABEL ---

    // --- FOOTER PDF (Tidak berubah) ---
    const pageCount = doc.internal.getNumberOfPages ? doc.internal.getNumberOfPages() : 1; 
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i); 
        const printDate = `Dicetak: ${new Date().toLocaleString('id-ID')}`;
        const pageNumText = `Halaman ${i} dari ${pageCount}`;
        doc.text(printDate, 14, pageHeight - 10);
        doc.text(pageNumText, pageWidth - 14 - doc.getTextWidth(pageNumText), pageHeight - 10);
    }
    // --- AKHIR FOOTER ---

    return doc.output('blob'); 
};