// src/utils/pdfGenerator.js

import { jsPDF } from "jspdf";
import 'jspdf-autotable';
// import logo from '../assets/logo.png'; // <-- SESUAIKAN JIKA ANDA PUNYA LOGO

// --- Informasi Perusahaan ---
const companyInfo = {
    nama: "CV Aplikasi Mas Iko",
    alamat: "Gemolong, Sragen, Jawa Tengah",
    hp: "0851-7448-4832",
    bank: "BCA: 123456789 (a.n. CV Aplikasi Mas Iko)",
};

const baseURL = "aplikasimasiko.web.app/transaksijualbuku";

// --- Helper ---
const formatCurrency = (value) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(value || 0);

const formatDate = (timestamp) =>
    new Date(timestamp || 0).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

// --- Syarat & Ketentuan ---
const terms = [
    "Barang yang sudah dibeli tidak dapat dikembalikan atau ditukar.",
    "Pembayaran dianggap lunas apabila dana sudah masuk ke rekening kami.",
    "Keterlambatan pembayaran akan dikenakan denda (jika ada, sesuai kesepakatan).",
    "Harap periksa kembali barang saat diterima. Komplain maks. 1x24 jam.",
];

// --- Fungsi Utama PDF ---
const generatePDF = (transaksi, type) => {
    const doc = new jsPDF();
    const isInvoice = type === 'invoice';
    const title = isInvoice ? 'INVOICE' : 'NOTA PEMBAYARAN';
    const link = `${baseURL}/${isInvoice ? 'invoice' : 'nota'}/${transaksi.id}`;

    // --- Header ---
    // if (logo) {
    //     doc.addImage(logo, 'PNG', 14, 12, 30, 15); // (logo, format, x, y, width, height)
    // }
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(companyInfo.nama, 14, 20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(companyInfo.alamat, 14, 25);
    doc.text(`HP: ${companyInfo.hp}`, 14, 30);

    // --- Judul Dokumen ---
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(title, 200, 20, { align: 'right' });

    // --- Info Klien & Transaksi ---
    doc.setLineWidth(0.5);
    doc.line(14, 35, 200, 35); // Garis horizontal

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Kepada Yth:", 14, 42);
    doc.setFont("helvetica", "normal");
    doc.text(transaksi.namaPelanggan || '-', 14, 47);
    // (Tambahkan alamat pelanggan jika ada di data transaksi)

    doc.setFont("helvetica", "bold");
    doc.text("No. Invoice:", 130, 42);
    doc.setFont("helvetica", "normal");
    doc.text(transaksi.nomorInvoice || '-', 155, 42);

    doc.setFont("helvetica", "bold");
    doc.text("Tanggal:", 130, 47);
    doc.setFont("helvetica", "normal");
    doc.text(formatDate(transaksi.tanggal), 155, 47);

    // --- Tabel Item ---
    const tableHead = [
        ['No', 'Judul Buku', 'Qty', 'Harga Satuan', 'Diskon', 'Subtotal']
    ];
    let totalBuku = 0;
    const tableBody = transaksi.items.map((item, index) => {
        const subtotal = item.jumlah * (item.hargaSatuan * (1 - (item.diskonPersen || 0) / 100));
        totalBuku += (item.jumlah || 0);
        return [
            index + 1,
            item.judulBuku,
            item.jumlah,
            formatCurrency(item.hargaSatuan),
            `${item.diskonPersen || 0}%`,
            formatCurrency(subtotal)
        ];
    });

    doc.autoTable({
        head: tableHead,
        body: tableBody,
        startY: 55,
        theme: 'grid',
        headStyles: { fillColor: [22, 160, 133], halign: 'center' },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 }, // No
            1: { cellWidth: 70 }, // Judul
            2: { halign: 'center' }, // Qty
            3: { halign: 'right' }, // Harga
            4: { halign: 'center' }, // Diskon
            5: { halign: 'right' }, // Subtotal
        },
        didDrawPage: (data) => {
            // Footer Halaman
            doc.setFontSize(8);
            doc.text(`Halaman ${doc.internal.getNumberOfPages()}`, data.settings.margin.left, 287);
        }
    });

    // --- Total & Pembayaran ---
    const finalY = doc.lastAutoTable.finalY + 10;
    const sisaTagihan = (transaksi.totalTagihan || 0) - (transaksi.jumlahTerbayar || 0);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Total Buku:", 14, finalY);
    doc.setFont("helvetica", "normal");
    doc.text(String(totalBuku), 40, finalY);
    
    // Total di Kanan
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Total Tagihan:", 140, finalY);
    doc.text(formatCurrency(transaksi.totalTagihan), 200, finalY, { align: 'right' });

    if (!isInvoice) { // Tampilkan detail bayar jika ini NOTA
        doc.setFont("helvetica", "normal");
        doc.text("Total Terbayar:", 140, finalY + 7);
        doc.text(formatCurrency(transaksi.jumlahTerbayar), 200, finalY + 7, { align: 'right' });

        doc.setFont("helvetica", "bold");
        doc.text("Sisa Tagihan:", 140, finalY + 14);
        doc.text(formatCurrency(sisaTagihan), 200, finalY + 14, { align: 'right' });
    }

    // --- Info Pembayaran & T&C ---
    const paymentY = finalY + (isInvoice ? 10 : 25);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Informasi Pembayaran:", 14, paymentY);
    doc.setFont("helvetica", "normal");
    doc.text(`Bank: ${companyInfo.bank}`, 14, paymentY + 5);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Syarat & Ketentuan:", 14, paymentY + 15);
    doc.setFont("helvetica", "normal");
    doc.text(terms.join('\n'), 14, paymentY + 20);

    // --- Tanda LUNAS (jika Nota dan Lunas) ---
    if (!isInvoice && sisaTagihan <= 0) {
        doc.setFontSize(50);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 150, 0); // Warna hijau
        doc.text("LUNAS", 105, 180, { align: 'center', angle: -30 });
        doc.setTextColor(0, 0, 0); // Reset warna
    }

    // --- Footer Link ---
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 255);
    doc.textWithLink("Lihat dokumen ini secara online:", 14, 280, { url: link });
    doc.text(link, 14, 284);

    // Kembalikan sebagai data URI untuk iframe
    return doc.output('datauristring');
};

// --- Ekspor Fungsi ---
export const generateInvoicePDF = (transaksi) => generatePDF(transaksi, 'invoice');
export const generateNotaPDF = (transaksi) => generatePDF(transaksi, 'nota');

// --- Fungsi untuk Download (dipakai di halaman publik) ---
export const downloadInvoicePDF = (transaksi) => {
    const doc = jsPDF(); // Panggil ulang untuk generate baru
    generatePDF(transaksi, 'invoice'); // Ini memodifikasi doc
    doc.save(`${transaksi.id || 'invoice'}.pdf`);
};

export const downloadNotaPDF = (transaksi) => {
    const doc = jsPDF();
    generatePDF(transaksi, 'nota');
    doc.save(`${transaksi.id || 'nota'}.pdf`);
};