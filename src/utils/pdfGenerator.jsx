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

// --- MODIFIKASI: Helper baru untuk format angka saja ---
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
    
    // --- 1. PENGATURAN KERTAS DINAMIS ---
    // --- MODIFIKASI: Selalu gunakan A4 Portrait ---
    let doc, margin;

    // A4 Portrait
    doc = new jsPDF('portrait', 'mm', 'a4'); // 210 x 297 mm
    margin = { top: 20, right: 20, bottom: 30, left: 20 }; // Bottom margin lebih besar untuk footer

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let currentY = margin.top;

    const isInvoice = type === 'invoice';
    const title = isInvoice ? 'INVOICE' : 'KWITANSI PEMBAYARAN';
    const link = `${baseURL}/${isInvoice ? 'invoice' : 'nota'}/${transaksi.id}`;

    // --- 2. HEADER ---
    doc.setFontSize(14); // <--- Diperbesar
    doc.setFont('helvetica', 'bold');
    doc.text(companyInfo.nama, margin.left, currentY);
    doc.setFontSize(8.4); // <--- Diperkecil (dari 12)
    doc.text(title, pageWidth - margin.right, currentY, { align: 'right' });
    currentY += 4.2; // <--- Spasi dikurangi (dari 6)
    doc.setFontSize(6.3); // <--- Diperkecil (dari 9)
    doc.setFont('helvetica', 'normal');
    
    // Alamat (bisa beberapa baris)140
    const alamatLines = doc.splitTextToSize(companyInfo.alamat +` ${companyInfo.hp}` ,  140);
    doc.text(alamatLines, margin.left, currentY);
    currentY += (alamatLines.length * 3); // Spasi dinamis (dari 4)

    
   //  currentY += 2.2; // <--- Spasi dikurangi (dari 6)
    doc.setLineWidth(0.2);
    doc.setDrawColor(0, 0, 0);
    doc.line(margin.left, currentY, pageWidth - margin.right, currentY);
    currentY += 5; // <--- Spasi dikurangi (dari 7)

    // --- 3. INFO PELANGGAN & TRANSAKS ---
    // Penjajaran kolom info yang lebih rapi
    const infoRightColX = pageWidth / 2 + 10; // Posisi label kolom kanan
    const infoRightColValueX = infoRightColX + 25; // Posisi nilai kolom kanan
    doc.setFontSize(7); // <--- Diperkecil (dari 10)
    doc.setFont('helvetica', 'bold');
    doc.text('Kepada Yth:', margin.left, currentY);
    
    // --- MODIFIKASI: Label dinamis berdasarkan tipe ---
    const noDokumenLabel = isInvoice ? 'No. Invoice:' : 'No. Nota:';
    doc.text(noDokumenLabel, infoRightColX, currentY);
    
    doc.setFont('helvetica', 'normal');
    doc.text(transaksi.nomorInvoice || '-', infoRightColValueX, currentY);
    currentY += 3.5; // Spasi antar baris (dari 5)
    doc.text(transaksi.namaPelanggan || '-', margin.left, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text('Tanggal:', infoRightColX, currentY);
    
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(transaksi.tanggal), infoRightColValueX, currentY);
    currentY += 3.5; // Spasi baru (dari 5)
    doc.text(transaksi.telepon || '-', margin.left, currentY); // <-- MODIFIKASI: Tampilkan telepon
    currentY += 7; // <--- Spasi dikurangi (dari 10)

    // --- 4. TABEL ITEM ---
    // (Logika perhitungan diskon rahasia tidak berubah)
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

        // --- MODIFIKASI: Hitung subtotal bruto untuk TAMPILAN ---
        const item_subtotal_bruto = qty * hs_bruto;

        totalBuku += qty;
        subtotalBruto += item_subtotal_bruto; // Akumulasi total bruto
        subtotalNet += item_subtotal_net; // Akumulasi total net (untuk perhitungan diskon)
        
        // --- MODIFIKASI: Tampilkan harga dan subtotal BRUTO (sebelum diskon) ---
        return [i + 1, item.judulBuku || '-', qty, formatNumber(hs_bruto), formatNumber(item_subtotal_bruto)];
    });

    autoTable(doc, {
        head,
        body,
        startY: currentY,
        theme: 'grid',
        headStyles: {
            fillColor: [255, 255, 255], // <-- MODIFIKASI: Set menjadi putih (tanpa warna)
            textColor: [0, 0, 0],
            lineColor: [0, 0, 0],
            lineWidth: 0.2,
            halign: 'center',
            fontSize: 6.3, // <--- Diperkecil (dari 9)
            fontStyle: 'bold', // Header dibuat bold
        },
        styles: {
            lineColor: [0, 0, 0],
            lineWidth: 0.2,
            fontSize: 6.3, // <--- Diperkecil (dari 9)
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 }, // No
            1: { cellWidth: 70 }, // Judul Buku
            2: { halign: 'center', cellWidth: 15 }, // Qty
            3: { halign: 'right', cellWidth: 35 }, // Harga
            4: { halign: 'right', cellWidth: 40 }, // Subtotal
        },
        margin: { left: margin.left, right: margin.right },
        didDrawPage: (data) => {
            // Kita akan atur currentY setelah tabel selesai
        }
    });

    currentY = doc.lastAutoTable.finalY || currentY; // Dapatkan Y-pos terakhir dari tabel
    
    currentY += 5; // <--- Spasi dikurangi (dari 7)
    
    // Helper untuk cek jika 'currentY' akan meluap (terutama di A4)
    // Disederhanakan: kita asumsikan summary cukup pendek
    // Jika tidak, kita perlu logika addPage() yang lebih kompleks
    const checkPageOverflow = (y, increment = 3.5) => { // <--- Default dikurangi (dari 5)
        if (y + increment > pageHeight - margin.bottom - 20) { // Cek 20mm sebelum footer
            // Jika meluap, paksa ke bawah (untuk A4 mungkin perlu addPage())
             if (y > pageHeight - margin.bottom) {
                 return pageHeight - margin.bottom;
             }
        }
        return y + increment;
    };
    
    currentY = checkPageOverflow(currentY, 0); // Cek posisi saat ini

    // --- 5. SUMMARY & TOTAL ---
    
    // (Logika perhitungan tidak berubah)
    const diskonLain = Number(transaksi.diskonLain || 0);
    const biayaTentu = Number(transaksi.biayaTentu || 0);
    const totalTagihanFinal = Number(transaksi.totalTagihan || 0); 
    const totalItemDiskon = subtotalBruto - subtotalNet; 
    const grandTotalDiskon = totalItemDiskon + diskonLain;
    const sisaTagihan = totalTagihanFinal - (transaksi.jumlahTerbayar || 0);

    // --- Bagian Total Rupiah (Kanan) ---
    // Penjajaran Kanan Rapi
    // --- MODIFIKASI: Penyesuaian X-pos untuk "Rp." ---
    const totalColValueX = pageWidth - margin.right; // Posisi X untuk nilai (Rata Kanan)
    // const totalColCurrencyX = totalColValueX - 35;  // <-- MODIFIKASI: Dihapus
    const totalColLabelX = totalColValueX - 55; // <-- MODIFIKASI: Jarak ditambah (dari 40 ke 55)
    
    let summaryY = currentY; // Pakai Y terpisah untuk kolom kanan

    // --- MODIFIKASI BARU: Total Buku dipindah ke kiri ---
    doc.setFontSize(6.3); // Ukuran font sama dengan total di kanan
    doc.setFont('helvetica', 'bold');
    doc.text('Total Buku:', margin.left, summaryY);
    doc.setFont('helvetica', 'normal');
    // Posisikan nilainya sedikit di sebelah kanan label
    doc.text(String(totalBuku), margin.left + 25, summaryY, { align: 'left' });
    // Jangan increment summaryY di sini agar total kanan sejajar

    // --- MODIFIKASI SEBELUMNYA: Total Buku dipindah ke kanan (DIHAPUS DARI SINI) ---
    // --- summaryY = checkPageOverflow(summaryY, 3.5); // <-- Baris ini dihapus

    doc.setFontSize(6.3); // <--- Diperkecil (dari 9)
    doc.setFont('helvetica', 'normal'); 
    doc.text('Subtotal:', totalColLabelX, summaryY); 
    // doc.text('Rp.', totalColCurrencyX, summaryY); // <-- MODIFIKASI: Dihapus
    doc.text(formatNumber(subtotalBruto), totalColValueX, summaryY, { align: 'right' }); // <-- MODIFIKASI: Pakai formatNumber
    summaryY = checkPageOverflow(summaryY, 3.5); // <--- Spasi dikurangi (dari 5)

    // Tampilkan Grand Total Diskon (jika > 0)
    if (grandTotalDiskon > 0) {
        doc.setFont('helvetica', 'normal');
        doc.text('Total Diskon:', totalColLabelX, summaryY); 
        // doc.text('Rp.', totalColCurrencyX, summaryY); // <-- MODIFIKASI: Dihapus
        const diskonStr = `(${formatNumber(grandTotalDiskon)})`; // <-- MODIFIKASI: Pakai formatNumber
        doc.text(diskonStr, totalColValueX, summaryY, { align: 'right' }); 
        summaryY = checkPageOverflow(summaryY, 3.5); // <--- Spasi dikurangi (dari 5)
    }
    
    // Hanya tampilkan jika ada biayaTentu
    if (biayaTentu > 0) {
        doc.setFont('helvetica', 'normal');
        doc.text('Biaya Tambahan:', totalColLabelX, summaryY);
        // doc.text('Rp.', totalColCurrencyX, summaryY); // <-- MODIFIKASI: Dihapus
        doc.text(formatNumber(biayaTentu), totalColValueX, summaryY, { align: 'right' }); // <-- MODIFIKASI: Pakai formatNumber
        summaryY = checkPageOverflow(summaryY, 3.5); // <--- Spasi dikurangi (dari 5)
    }

    // --- MODIFIKASI: Garis pemisah dihapus ---
    // doc.setLineWidth(0.1);
    // doc.line(totalColLabelX, summaryY - 2, totalColValueX, summaryY - 2);

    doc.setFont('helvetica', 'bold');
    doc.text('Total Tagihan:', totalColLabelX, summaryY);
    // doc.text('Rp.', totalColCurrencyX, summaryY); // <-- MODIFIKASI: Dihapus
    doc.text(formatNumber(totalTagihanFinal), totalColValueX, summaryY, { align: 'right' }); // <-- MODIFIKASI: Pakai formatNumber

    if (!isInvoice) {
        summaryY = checkPageOverflow(summaryY, 3.5); // <--- Spasi dikurangi (dari 5)
        
        doc.setFontSize(6.3); // <--- Diperkecil (dari 9)
        doc.setFont('helvetica', 'normal');
        doc.text('Total Terbayar:', totalColLabelX, summaryY);
        // doc.text('Rp.', totalColCurrencyX, summaryY); // <-- MODIFIKASI: Dihapus
        doc.text(formatNumber(transaksi.jumlahTerbayar || 0), totalColValueX, summaryY, { align: 'right' }); // <-- MODIFIKASI: Pakai formatNumber
        summaryY = checkPageOverflow(summaryY, 3.5); // <--- Spasi dikurangi (dari 5)
        doc.setFontSize(6.3); // <--- Diperkecil (dari 9)
        doc.setFont('helvetica', 'bold');
        doc.text('Sisa Tagihan:', totalColLabelX, summaryY);
        // doc.text('Rp.', totalColCurrencyX, summaryY); // <-- MODIFIKASI: Dihapus
        doc.text(formatNumber(sisaTagihan), totalColValueX, summaryY, { align: 'right' }); // <-- MODIFIKASI: Pakai formatNumber
    }

    // --- MODIFIKASI: Syarat & Ketentuan dipindah ke sini ---
    // Posisikan S&K agar tidak tumpang tindih dengan Total Buku di kiri
    // Kita gunakan Y dari item terakhir di kanan
    let leftColumnY = summaryY; 
    
    leftColumnY = checkPageOverflow(leftColumnY, 3.5); // <-- Spasi dikurangi (dari 5)
    doc.setFontSize(5.6); // <--- Diperkecil (dari 8)
    doc.setFont('helvetica', 'bold');
    doc.text('Syarat & Ketentuan:', margin.left, leftColumnY);
    
    leftColumnY = checkPageOverflow(leftColumnY, 3); // <--- Spasi dikurangi (dari 4)
    doc.setFontSize(5.6); // <--- Diperkecil (dari 8)
    doc.setFont('helvetica', 'normal');
    doc.text(terms.slice(0, 2).join('\n'), margin.left, leftColumnY); 

    // --- MODIFIKASI: Link dipindah ke bawah S&K ---
    leftColumnY = checkPageOverflow(leftColumnY, 5); // Spasi sebelum link (dari 7)
    doc.setFontSize(4.9); // <--- Diperkecil (dari 7)
    doc.setTextColor(120, 120, 120); // Abu-abu
    const linkLabel = 'Lihat dokumen ini secara online:';
    
    doc.text(linkLabel, margin.left, leftColumnY);
    leftColumnY = checkPageOverflow(leftColumnY, 2.5); // Spasi antar label dan link (dari 3)
    doc.textWithLink(link, margin.left, leftColumnY, { url: link }); // Align left (default)
    doc.setTextColor(0, 0, 0); // Kembalikan ke hitam

    // --- 6. FOOTER (Stempel & Link) ---
    // Posisikan footer relatif terhadap bagian BAWAH halaman
    const footerStartY = pageHeight - margin.bottom; // Y-posisi dasar footer
    
    // --- MODIFIKASI: Teks S&K dihapus dari sini ---

    // --- MODIFIKASI BARU: Stempel LUNAS DIHAPUS ---
    // if (!isInvoice && sisaTagihan <= 0) {
    //     ... (kode stempel dihapus) ...
    // }

    // --- FOOTER LINK (Rata Kanan) ---
    // --- MODIFIKASI: Dipindah ke atas, di bawah S&K ---

    return doc;
};

// --- EKSPOR FUNGSI ---
export const generateInvoicePDF = (transaksi) =>
    buildDoc(transaksi, 'invoice').output('datauristring');

export const generateNotaPDF = (transaksi) =>
    buildDoc(transaksi, 'nota').output('datauristring');

