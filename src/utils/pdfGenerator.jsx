import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const companyInfo = {
    nama : "CV. GANGSAR MULIA UTAMA",
    alamat :"Jl. Kalicari Dalam I No.4, Kalicari, Kec. Pedurungan, Kota Semarang, Jawa Tengah 50198",
    hp : "0882-0069-05391" 
};

const baseURL = 'https://aplikasimasiko.web.app/transaksijualbuku';

const formatCurrency = (value) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(value || 0);

const formatDate = (timestamp) =>
    new Date(timestamp || 0).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });

const terms = [
    'Barang yang sudah dibeli tidak dapat dikembalikan atau ditukar.',
    'Pembayaran dianggap lunas apabila dana sudah masuk ke rekening kami.',
    'Keterlambatan pembayaran akan dikenakan denda (jika ada, sesuai kesepakatan).',
    'Harap periksa kembali barang saat diterima. Komplain maks. 1x24 jam.',
];

const buildDoc = (transaksi, type) => {
    const doc = new jsPDF();
    const isInvoice = type === 'invoice';
    const title = isInvoice ? 'INVOICE' : 'NOTA PEMBAYARAN';
    const link = `${baseURL}/${isInvoice ? 'invoice' : 'nota'}/${transaksi.id}`;

    // --- PENGATURAN MARGIN DAN UKURAN HALAMAN ---
    const margin = { top: 18, right: 14, bottom: 18, left: 14 };
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Gunakan 'cursor' untuk posisi Y agar otomatis
    let currentY = margin.top;

    // --- HEADER ---
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(companyInfo.nama, margin.left, currentY);

    doc.setFontSize(18);
    doc.text(title, pageWidth - margin.right, currentY, { align: 'right' });

    currentY += 5;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    // Menggunakan text-splitting untuk alamat yang panjang
    const alamatLines = doc.splitTextToSize(companyInfo.alamat, pageWidth - margin.left - margin.right);
    doc.text(alamatLines, margin.left, currentY);
    currentY += (alamatLines.length * 5); // Sesuaikan Y berdasarkan jumlah baris alamat
    doc.text(`HP: ${companyInfo.hp}`, margin.left, currentY);
    currentY += 10; // Beri spasi sebelum garis

    doc.setLineWidth(0.5);
    doc.setDrawColor(0, 0, 0); // Garis hitam
    doc.line(margin.left, currentY, pageWidth - margin.right, currentY);
    currentY += 7;

    // --- INFO PELANGGAN & TRANSAKSI ---
    const rightColX = pageWidth - margin.right - 70; // Posisi untuk kolom kanan

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Kepada Yth:', margin.left, currentY);
    doc.text('No. Invoice:', rightColX, currentY);
    
    doc.setFont('helvetica', 'normal');
    doc.text(transaksi.namaPelanggan || '-', margin.left, currentY + 5);
    doc.text(transaksi.nomorInvoice || '-', rightColX + 25, currentY);

    doc.setFont('helvetica', 'bold');
    doc.text('Tanggal:', rightColX, currentY + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(transaksi.tanggal), rightColX + 25, currentY + 5);

    currentY += 15; // Spasi sebelum tabel

    // --- TABEL ITEM ---
    const head = [['No', 'Judul Buku', 'Qty', 'Harga', 'Diskon', 'Subtotal']];
    let totalBuku = 0;
    const body = (transaksi.items || []).map((item, i) => {
        const qty = Number(item.jumlah || 0);
        const hs = Number(item.hargaSatuan || 0);
        const disc = Number(item.diskonPersen || 0);
        const subtotal = qty * (hs * (1 - disc / 100));
        totalBuku += qty;
        return [i + 1, item.judulBuku || '-', qty, formatCurrency(hs), `${disc}%`, formatCurrency(subtotal)];
    });

    autoTable(doc, {
        head,
        body,
        startY: currentY,
        theme: 'grid',
        // Style Hitam Putih
        headStyles: { 
            fillColor: [255, 255, 255], 
            textColor: [0, 0, 0], 
            lineColor: [0, 0, 0],
            lineWidth: 0.5,
            halign: 'center' 
        },
        styles: {
            lineColor: [0, 0, 0],
            lineWidth: 0.5,
        },
        // Lebar kolom disesuaikan agar pas dengan printableWidth (182)
        // Total: 10 + 62 + 15 + 35 + 20 + 40 = 182
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { cellWidth: 62 },
            2: { halign: 'center', cellWidth: 15 },
            3: { halign: 'right', cellWidth: 35 },
            4: { halign: 'center', cellWidth: 20 },
            5: { halign: 'right', cellWidth: 40 },
        },
        margin: { left: margin.left, right: margin.right },
    });

    currentY = (doc.lastAutoTable?.finalY || currentY) + 10; // Update Y setelah tabel
    const sisaTagihan = (transaksi.totalTagihan || 0) - (transaksi.jumlahTerbayar || 0);

    // --- SUMMARY & TOTAL ---
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Total Buku:', margin.left, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(String(totalBuku), margin.left + 25, currentY);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Total Tagihan:', rightColX, currentY);
    doc.text(formatCurrency(transaksi.totalTagihan || 0), pageWidth - margin.right, currentY, { align: 'right' });

    if (!isInvoice) {
        currentY += 7;
        doc.setFont('helvetica', 'normal');
        doc.text('Total Terbayar:', rightColX, currentY);
        doc.text(formatCurrency(transaksi.jumlahTerbayar || 0), pageWidth - margin.right, currentY, { align: 'right' });

        currentY += 7;
        doc.setFont('helvetica', 'bold');
        doc.text('Sisa Tagihan:', rightColX, currentY);
        doc.text(formatCurrency(sisaTagihan), pageWidth - margin.right, currentY, { align: 'right' });
    }

    currentY += 15; // Spasi sebelum info pembayaran

    // --- SYARAT & KETENTUAN ---
    // Info bank dihapus karena tidak ada di companyInfo baru
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Syarat & Ketentuan:', margin.left, currentY);
    currentY += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(terms.join('\n'), margin.left, currentY);

    // Stempel LUNAS (jika nota dan sudah lunas)
    if (!isInvoice && sisaTagihan <= 0) {
        doc.setFontSize(50);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0); // Warna hitam
        doc.text('LUNAS', pageWidth / 2, pageHeight / 2 + 30, { align: 'center', angle: -30 });
    }

    // --- FOOTER LINK ---
    const linkY = pageHeight - margin.bottom;
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0); // Teks hitam
    const linkLabel = 'Lihat dokumen ini secara online:';
    doc.textWithLink(linkLabel, margin.left, linkY, { url: link });
    // Typo diperbaiki: titik di awal baris dihapus
    doc.text(link, margin.left, linkY + 4);

    return doc;
};

export const generateInvoicePDF = (transaksi) =>
    buildDoc(transaksi, 'invoice').output('datauristring');

export const generateNotaPDF = (transaksi) =>
    buildDoc(transaksi, 'nota').output('datauristring');

