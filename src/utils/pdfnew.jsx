import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- KONSTANTA ---
const companyInfo = {
    nama: "CV. GANGSAR MULIA UTAMA",
    alamat: "Jl. Kalicari Dalam I No.4, Kalicari, Kec. Pedurungan, Kota Semarang, Jawa Tengah 50198, ",
    hp: "0882-0069-05391"
};

const terms = [
    'Barang yang sudah dibeli tidak dapat dikembalikan atau ditukar (Kecuali perjanjian retur).',
    'Pembayaran dianggap lunas apabila dana sudah masuk ke rekening kami.',
    'Harap periksa kembali barang saat diterima. Komplain maks. 1x24 jam.',
];

// --- FUNGSI HELPER ---
const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 0,
    }).format(value || 0);

const formatDate = (timestamp) =>
    new Date(timestamp || 0).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });

/**
 * Fungsi inti untuk membangun dokumen PDF
 * @param {object} transaksi - Objek data transaksi
 * @param {string} docType - 'INVOICE' atau 'NOTA RETUR'
 */
const buildDoc = (transaksi, docType) => {
    
    // --- 1. PENGATURAN KERTAS ---
    const doc = new jsPDF('portrait', 'mm', 'a4'); 
    const margin = { top: 20, right: 20, bottom: 30, left: 20 };
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let currentY = margin.top;

    // --- 2. HEADER ---
    doc.setFontSize(18); 
    doc.setFont('helvetica', 'bold');
    doc.text(companyInfo.nama, margin.left, currentY);
    
    doc.setFontSize(14); 
    doc.text(docType, pageWidth - margin.right, currentY, { align: 'right' });
    
    currentY += 6; 
    
    doc.setFontSize(8.5); 
    doc.setFont('helvetica', 'normal');
    
    // Alamat
    const alamatLines = doc.splitTextToSize(companyInfo.alamat +` ${companyInfo.hp}` , 140);
    doc.text(alamatLines, margin.left, currentY);
    currentY += (alamatLines.length * 4.5); 

    doc.setLineWidth(0.2);
    doc.line(margin.left, currentY, pageWidth - margin.right, currentY);
    currentY += 7; 

    // --- 3. INFO PELANGGAN & TRANSAKSI ---
    const infoRightColX = pageWidth / 2 + 10;
    const infoRightColValueX = infoRightColX + 30;
    
    doc.setFontSize(9.5); 
    doc.setFont('helvetica', 'bold');
    doc.text('Kepada Yth:', margin.left, currentY);
    
    const labelDokumen = docType === 'INVOICE' ? 'No. Invoice:' : 'No. Retur:';
    doc.text(labelDokumen, infoRightColX, currentY);
    
    doc.setFont('helvetica', 'normal');
    doc.text(transaksi.nomorInvoice || '-', infoRightColValueX, currentY);
    
    currentY += 5; 
    
    doc.text(transaksi.namaPelanggan || 'Umum', margin.left, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text('Tanggal:', infoRightColX, currentY);
    
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(transaksi.tanggal), infoRightColValueX, currentY);
    
    currentY += 10; 

    // --- 4. TABEL ITEM (TANPA KOLOM DISKON) ---
    // Kolom: No, Judul Buku, Qty, Harga, Subtotal
    const head = [['No', 'Judul Buku', 'Qty', 'Harga', 'Subtotal']];
    
    let totalBuku = 0;
    let subtotalBruto = 0; 

    const body = (transaksi.items || []).map((item, i) => {
        const qty = Number(item.jumlah || 0);
        const hs_bruto = Number(item.hargaSatuan || 0);
        // Kita gunakan harga setelah diskon (Net) jika ingin simple, 
        // ATAU harga bruto jika diskon ditaruh di bawah. 
        // Sesuai prompt "Tanpa kolom diskon", biasanya di baris item ditampilkan harga real yg dibayar per item atau harga normal.
        // Disini kita tampilkan Harga Normal dan Subtotal Kotor, nanti diskon di total bawah.
        
        const item_subtotal_bruto = qty * hs_bruto;

        totalBuku += qty;
        subtotalBruto += item_subtotal_bruto; 
        
        return [
            i + 1, 
            item.judulBuku || '-', 
            qty, 
            formatNumber(hs_bruto), 
            formatNumber(item_subtotal_bruto)
        ];
    });

    autoTable(doc, {
        head,
        body,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, halign: 'center', fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 1.5, valign: 'middle', lineWidth: 0.1 },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 }, 
            1: { cellWidth: 'auto' }, 
            2: { halign: 'center', cellWidth: 15 }, 
            3: { halign: 'right', cellWidth: 35 }, 
            4: { halign: 'right', cellWidth: 35 }, 
        },
        margin: { left: margin.left, right: margin.right },
    });

    currentY = doc.lastAutoTable.finalY + 7; 

    // --- 5. SUMMARY & TOTAL ---
    const finalY = currentY;
    
    // Total Buku (Kiri)
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Item: ${totalBuku} pcs`, margin.left, finalY);

    // Perhitungan Total (Kanan)
    const rightColX = pageWidth - margin.right - 40;
    const rightValX = pageWidth - margin.right;
    let summaryY = finalY;

    // Subtotal
    doc.text('Subtotal:', rightColX, summaryY);
    doc.text(formatNumber(subtotalBruto), rightValX, summaryY, { align: 'right' });
    summaryY += 5;

    // Kalkulasi Total Diskon Global
    // (Total Bruto - Total Netto Item) + Diskon Lain
    let totalNettoItem = 0;
    (transaksi.items || []).forEach(item => {
        const h = Number(item.hargaSatuan);
        const q = Number(item.jumlah);
        const d = Number(item.diskonPersen || 0);
        totalNettoItem += (q * h * (1 - d/100));
    });
    
    const diskonItem = subtotalBruto - totalNettoItem;
    const diskonLain = Number(transaksi.diskonLain || 0);
    const totalDiskon = diskonItem + diskonLain;
    
    // Tampilkan Diskon jika ada
    if (totalDiskon > 0) {
        doc.text('Total Diskon:', rightColX, summaryY);
        doc.text(`(${formatNumber(totalDiskon)})`, rightValX, summaryY, { align: 'right' });
        summaryY += 5;
    }

    // Biaya Lain
    const biaya = Number(transaksi.biayaTentu || 0);
    if (biaya > 0) {
        doc.text('Biaya Lain:', rightColX, summaryY);
        doc.text(formatNumber(biaya), rightValX, summaryY, { align: 'right' });
        summaryY += 5;
    }

    // Grand Total
    const grandTotal = Number(transaksi.totalTagihan || 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Grand Total:', rightColX, summaryY + 2);
    doc.text(formatNumber(grandTotal), rightValX, summaryY + 2, { align: 'right' });

    // Footer S&K
    const footerY = pageHeight - margin.bottom - 20;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text("Syarat & Ketentuan:", margin.left, footerY);
    
    const termsText = terms.map((t, i) => `${i + 1}. ${t}`).join('\n');
    doc.text(termsText, margin.left, footerY + 5);

    return doc;
};

// --- EKSPOR FUNGSI ---
export const generateInvoicePDF = (transaksi) =>
    buildDoc(transaksi, 'INVOICE').output('datauristring');

export const generateNotaReturPDF = (transaksi) =>
    buildDoc(transaksi, 'NOTA RETUR').output('datauristring');