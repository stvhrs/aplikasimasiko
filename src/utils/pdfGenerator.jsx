import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- KONSTANTA ---
const companyInfo = {
    nama: "CV. GANGSAR MULIA UTAMA",
    alamat: "Jl. Kalicari Dalam I No.4, Kalicari, Kec. Pedurungan, Kota Semarang, Jawa Tengah 50198, ",
    hp: "0882-0069-05391"
};

const baseURL = 'https://gudanggalatama.web.app/';

const terms = [
    'Barang yang sudah dibeli tidak dapat dikembalikan atau ditukar.',
    'Pembayaran dianggap lunas apabila dana sudah masuk ke rekening kami.',
    'Keterlambatan pembayaran akan dikenakan denda (jika ada, sesuai kesepakatan).',
    'Harap periksa kembali barang saat diterima. Komplain maks. 1x24 jam.',
];

// --- FUNGSI HELPER ---
const formatCurrency = (value) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(value || 0);

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
 * @param {string} type - 'invoice' atau 'nota'
 * @returns {jsPDF} - Objek dokumen jsPDF
 */
const buildDoc = (transaksi, type) => {
    
    // --- 1. PENGATURAN KERTAS ---
    let doc, margin;

    // A4 Portrait
    doc = new jsPDF('portrait', 'mm', 'a4'); // 210 x 297 mm
    margin = { top: 20, right: 20, bottom: 30, left: 20 };

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let currentY = margin.top;

    const isInvoice = type === 'invoice';
    const title = isInvoice ? 'INVOICE' : 'KWITANSI PEMBAYARAN';
    const link = `${baseURL}/${isInvoice ? 'invoice' : 'nota'}/${transaksi.id}`;

    // --- 2. HEADER (FONT 130%) ---
    // Base 14 -> 18.2 (Kita pakai 18)
    doc.setFontSize(18); 
    doc.setFont('helvetica', 'bold');
    doc.text(companyInfo.nama, margin.left, currentY);
    
    // Base 8.4 -> 11
    doc.setFontSize(11); 
    doc.text(title, pageWidth - margin.right, currentY, { align: 'right' });
    
    currentY += 6; // Spasi
    
    // Base 6.3 -> 8.5
    doc.setFontSize(8.5); 
    doc.setFont('helvetica', 'normal');
    
    // Alamat
    const alamatLines = doc.splitTextToSize(companyInfo.alamat +` ${companyInfo.hp}` , 140);
    doc.text(alamatLines, margin.left, currentY);
    currentY += (alamatLines.length * 4.5); 

    doc.setLineWidth(0.2);
    doc.setDrawColor(0, 0, 0);
    doc.line(margin.left, currentY, pageWidth - margin.right, currentY);
    currentY += 7; 

    // --- 3. INFO PELANGGAN & TRANSAKSI (FONT 130%) ---
    const infoRightColX = pageWidth / 2 + 10;
    const infoRightColValueX = infoRightColX + 25;
    
    // Base 7 -> 9.5
    doc.setFontSize(9.5); 
    doc.setFont('helvetica', 'bold');
    doc.text('Kepada Yth:', margin.left, currentY);
    
    const noDokumenLabel = isInvoice ? 'No. Invoice:' : 'No. Nota:';
    doc.text(noDokumenLabel, infoRightColX, currentY);
    
    doc.setFont('helvetica', 'normal');
    doc.text(transaksi.nomorInvoice || '-', infoRightColValueX, currentY);
    
    currentY += 5; 
    
    doc.text(transaksi.namaPelanggan || '-', margin.left, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text('Tanggal:', infoRightColX, currentY);
    
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(transaksi.tanggal), infoRightColValueX, currentY);
    
    // (Nomor Telepon Pelanggan dihapus sesuai permintaan sebelumnya)
    
    currentY += 8; 

    // --- 4. TABEL ITEM (FONT 130%) ---
    const head = [['No', 'Judul Buku', 'Qty', 'Harga', 'Subtotal']];
    let totalBuku = 0;
    let subtotalBruto = 0; 
    let subtotalNet = 0; 

    const body = (transaksi.items || []).map((item, i) => {
        const qty = Number(item.jumlah || 0);
        const hs_bruto = Number(item.hargaSatuan || 0);
        const disc = Number(item.diskonPersen || 0); 

        const hs_net = hs_bruto * (1 - disc / 100); 
        const item_subtotal_net = qty * hs_net; 
        const item_subtotal_bruto = qty * hs_bruto;

        totalBuku += qty;
        subtotalBruto += item_subtotal_bruto; 
        subtotalNet += item_subtotal_net; 
        
        return [i + 1, item.judulBuku || '-', qty, formatNumber(hs_bruto), formatNumber(item_subtotal_bruto)];
    });

    autoTable(doc, {
        head,
        body,
        startY: currentY,
        theme: 'grid',
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            lineColor: [0, 0, 0],
            lineWidth: 0.2,
            halign: 'center',
            fontSize: 9, // Diperbesar proporsional
            fontStyle: 'bold',
            cellPadding: 1.5,
        },
        styles: {
            lineColor: [0, 0, 0],
            lineWidth: 0.2,
            fontSize: 9, // Diperbesar proporsional
            cellPadding: 1.5,
            valign: 'middle'
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 12 }, 
            1: { cellWidth: 68 }, 
            2: { halign: 'center', cellWidth: 15 }, 
            3: { halign: 'right', cellWidth: 35 }, 
            4: { halign: 'right', cellWidth: 40 }, 
        },
        margin: { left: margin.left, right: margin.right },
    });

    currentY = doc.lastAutoTable.finalY || currentY;
    currentY += 7; 
    
    const checkPageOverflow = (y, increment = 5) => { 
        if (y + increment > pageHeight - margin.bottom - 20) {
             if (y > pageHeight - margin.bottom) {
                 return pageHeight - margin.bottom;
             }
        }
        return y + increment;
    };
    
    currentY = checkPageOverflow(currentY, 0);

    // --- 5. SUMMARY & TOTAL (FONT 130%) ---
    const diskonLain = Number(transaksi.diskonLain || 0);
    const biayaTentu = Number(transaksi.biayaTentu || 0);
    const totalTagihanFinal = Number(transaksi.totalTagihan || 0); 
    const totalItemDiskon = subtotalBruto - subtotalNet; 
    const grandTotalDiskon = totalItemDiskon + diskonLain;
    const sisaTagihan = totalTagihanFinal - (transaksi.jumlahTerbayar || 0);

    const totalColValueX = pageWidth - margin.right; 
    const totalColLabelX = totalColValueX - 50; 
    
    let summaryY = currentY;

    // Total Buku (Kiri)
    doc.setFontSize(9); 
    doc.setFont('helvetica', 'bold');
    doc.text('Total Buku:', margin.left, summaryY);
    doc.setFont('helvetica', 'normal');
    doc.text(String(totalBuku), margin.left + 25, summaryY, { align: 'left' });

    // Ringkasan Angka (Kanan)
    doc.setFontSize(9); 
    doc.setFont('helvetica', 'normal'); 
    doc.text('Subtotal:', totalColLabelX, summaryY); 
    doc.text(formatNumber(subtotalBruto), totalColValueX, summaryY, { align: 'right' }); 
    
    summaryY = checkPageOverflow(summaryY, 5);

    // Tampilkan Total Diskon (Jika Ada)
    if (grandTotalDiskon > 0) {
        doc.setFont('helvetica', 'normal');
        doc.text('Total Diskon:', totalColLabelX, summaryY); 
        const diskonStr = `(${formatNumber(grandTotalDiskon)})`; 
        doc.text(diskonStr, totalColValueX, summaryY, { align: 'right' }); 
        summaryY = checkPageOverflow(summaryY, 5);
    }
    
    if (biayaTentu > 0) {
        doc.setFont('helvetica', 'normal');
        doc.text('Biaya Tambahan:', totalColLabelX, summaryY);
        doc.text(formatNumber(biayaTentu), totalColValueX, summaryY, { align: 'right' }); 
        summaryY = checkPageOverflow(summaryY, 5);
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Total Tagihan:', totalColLabelX, summaryY);
    doc.text(formatNumber(totalTagihanFinal), totalColValueX, summaryY, { align: 'right' }); 

    if (!isInvoice) {
        summaryY = checkPageOverflow(summaryY, 5);
        
        doc.setFontSize(9); 
        doc.setFont('helvetica', 'normal');
        doc.text('Total Terbayar:', totalColLabelX, summaryY);
        doc.text(formatNumber(transaksi.jumlahTerbayar || 0), totalColValueX, summaryY, { align: 'right' }); 
        
        summaryY = checkPageOverflow(summaryY, 5);
        
        doc.setFontSize(9); 
        doc.setFont('helvetica', 'bold');
        doc.text('Sisa Tagihan:', totalColLabelX, summaryY);
        doc.text(formatNumber(sisaTagihan), totalColValueX, summaryY, { align: 'right' }); 
    }

    // --- 6. SYARAT & KETENTUAN (RAPI) ---
    // Menggunakan splitTextToSize untuk wrapping teks panjang
    let leftColumnY = summaryY; 
    
    leftColumnY = checkPageOverflow(leftColumnY, 10); 
    doc.setFontSize(8); 
    doc.setFont('helvetica', 'bold');
    doc.text('Syarat & Ketentuan:', margin.left, leftColumnY);
    
    leftColumnY = checkPageOverflow(leftColumnY, 4); 
    doc.setFontSize(8); 
    doc.setFont('helvetica', 'normal');

    // Menyiapkan teks S&K agar rapi dengan penomoran
    const termsText = terms.map((t, i) => `${i + 1}. ${t}`).join('\n');
    const maxWidthTerms = 100; // Lebar maks kolom S&K (agar tidak nabrak total)
    const termsLines = doc.splitTextToSize(termsText, maxWidthTerms);

    doc.text(termsLines, margin.left, leftColumnY);
    
    // Hitung tinggi teks terms untuk menyesuaikan posisi link
    const termsHeight = termsLines.length * 3.5; 
    leftColumnY += termsHeight;

    // --- Link ---
    leftColumnY = checkPageOverflow(leftColumnY, 6); 
    doc.setFontSize(7); 
    doc.setTextColor(120, 120, 120); 
    const linkLabel = 'Lihat dokumen ini secara online:';
    
    doc.text(linkLabel, margin.left, leftColumnY);
    leftColumnY = checkPageOverflow(leftColumnY, 3.5); 
    doc.textWithLink(link, margin.left, leftColumnY, { url: link }); 
    doc.setTextColor(0, 0, 0); 

    return doc;
};

// --- EKSPOR FUNGSI ---
export const generateInvoicePDF = (transaksi) =>
    buildDoc(transaksi, 'invoice').output('datauristring');

export const generateNotaPDF = (transaksi) =>
    buildDoc(transaksi, 'nota').output('datauristring');