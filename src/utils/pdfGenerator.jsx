// src/utils/pdfGenerator.js
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const companyInfo = {
  nama: 'CV Aplikasi Mas Iko',
  alamat: 'Gemolong, Sragen, Jawa Tengah',
  hp: '0851-7448-4832',
  bank: 'BCA: 123456789 (a.n. CV Aplikasi Mas Iko)',
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

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(companyInfo.nama, 14, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(companyInfo.alamat, 14, 25);
  doc.text(`HP: ${companyInfo.hp}`, 14, 30);

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 200, 20, { align: 'right' });

  doc.setLineWidth(0.5);
  doc.line(14, 35, 200, 35);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Kepada Yth:', 14, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(transaksi.namaPelanggan || '-', 14, 47);

  doc.setFont('helvetica', 'bold');
  doc.text('No. Invoice:', 130, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(transaksi.nomorInvoice || '-', 155, 42);

  doc.setFont('helvetica', 'bold');
  doc.text('Tanggal:', 130, 47);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(transaksi.tanggal), 155, 47);

  const head = [['No', 'Judul Buku', 'Qty', 'Harga Satuan', 'Diskon', 'Subtotal']];
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
    startY: 55,
    theme: 'grid',
    headStyles: { fillColor: [22, 160, 133], halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 70 },
      2: { halign: 'center', cellWidth: 20 },
      3: { halign: 'right', cellWidth: 35 },
      4: { halign: 'center', cellWidth: 25 },
      5: { halign: 'right', cellWidth: 35 },
    },
  });

  const finalY = (doc.lastAutoTable?.finalY || 55) + 10;
  const sisaTagihan = (transaksi.totalTagihan || 0) - (transaksi.jumlahTerbayar || 0);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Total Buku:', 14, finalY);
  doc.setFont('helvetica', 'normal');
  doc.text(String(totalBuku), 40, finalY);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Total Tagihan:', 140, finalY);
  doc.text(formatCurrency(transaksi.totalTagihan || 0), 200, finalY, { align: 'right' });

  if (!isInvoice) {
    doc.setFont('helvetica', 'normal');
    doc.text('Total Terbayar:', 140, finalY + 7);
    doc.text(formatCurrency(transaksi.jumlahTerbayar || 0), 200, finalY + 7, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.text('Sisa Tagihan:', 140, finalY + 14);
    doc.text(formatCurrency(sisaTagihan), 200, finalY + 14, { align: 'right' });
  }

  const paymentY = finalY + (isInvoice ? 10 : 25);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Informasi Pembayaran:', 14, paymentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`Bank: ${companyInfo.bank}`, 14, paymentY + 5);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Syarat & Ketentuan:', 14, paymentY + 15);
  doc.setFont('helvetica', 'normal');
  doc.text(terms.join('\n'), 14, paymentY + 20);

  if (!isInvoice && sisaTagihan <= 0) {
    doc.setFontSize(50);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 150, 0);
    doc.text('LUNAS', 105, 180, { align: 'center', angle: -30 });
    doc.setTextColor(0, 0, 0);
  }

  doc.setFontSize(8);
  doc.setTextColor(0, 0, 255);
  const linkLabel = 'Lihat dokumen ini secara online:';
  doc.textWithLink(linkLabel, 14, 280, { url: link });
  doc.text(link, 14, 284);

  return doc;
};

export const generateInvoicePDF = (transaksi) =>
  buildDoc(transaksi, 'invoice').output('datauristring');

export const generateNotaPDF = (transaksi) =>
  buildDoc(transaksi, 'nota').output('datauristring');
