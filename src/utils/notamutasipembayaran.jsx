import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const companyInfo = {
    nama: "CV. GANGSAR MULIA UTAMA",
    alamat: "Jl. Kalicari Dalam I No.4, Kalicari, Kec. Pedurungan, Kota Semarang, Jawa Tengah 50198, ",
    hp: "0882-0069-05391"
};

const terms = [
    'Bukti pembayaran ini sah dan diterbitkan oleh sistem.',
    'Harap simpan bukti ini sebagai referensi transaksi yang valid.',
];

// --- HELPER ---
const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(value || 0);
const formatDate = (timestamp) => new Date(timestamp || 0).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute:'2-digit' });

/**
 * Generator PDF Khusus Nota Pembayaran
 */
const buildDoc = (data) => {
    const doc = new jsPDF('portrait', 'mm', 'a4'); 
    const margin = { top: 20, right: 20, bottom: 30, left: 20 };
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = margin.top;

    // --- 1. HEADER ---
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(companyInfo.nama, margin.left, currentY);
    
    doc.setFontSize(12); 
    doc.text("NOTA PEMBAYARAN", pageWidth - margin.right, currentY, { align: 'right' });
    
    currentY += 6;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    const alamatLines = doc.splitTextToSize(companyInfo.alamat +` ${companyInfo.hp}` , 140);
    doc.text(alamatLines, margin.left, currentY);
    currentY += (alamatLines.length * 4.5) + 2; 

    doc.setLineWidth(0.2); doc.line(margin.left, currentY, pageWidth - margin.right, currentY);
    currentY += 8; 

    // --- 2. INFO TRANSAKSI ---
    const idDokumen = data.id || '-';
    // Gunakan namaPelanggan langsung dari data object
    const namaPelanggan = data.namaPelanggan || 'Umum';

    const infoX = pageWidth / 2 + 10;
    
    doc.setFontSize(10); 
    
    // Kiri: Info Pelanggan & No Bayar
    doc.setFont('helvetica', 'bold'); doc.text('No. Bayar:', margin.left, currentY);
    doc.setFont('helvetica', 'normal'); doc.text(idDokumen, margin.left + 30, currentY);
    currentY += 5;
    
    doc.setFont('helvetica', 'bold'); doc.text('Pelanggan:', margin.left, currentY);
    doc.setFont('helvetica', 'normal'); doc.text(namaPelanggan, margin.left + 30, currentY);
    currentY += 5;

    // Kanan: Tanggal & Metode (Optional)
    const rightY = currentY - 10;
    doc.setFont('helvetica', 'bold'); doc.text('Tanggal:', infoX, rightY);
    doc.setFont('helvetica', 'normal'); doc.text(formatDate(data.tanggal), infoX + 25, rightY);
    
    // Jika ada info metode pembayaran
    if (data.metodeBayar) {
        doc.setFont('helvetica', 'bold'); doc.text('Metode:', infoX, rightY + 5);
        doc.setFont('helvetica', 'normal'); doc.text(data.metodeBayar, infoX + 25, rightY + 5);
    }

    currentY += 10;

    // --- 3. TABEL LIST INVOICE YANG DIBAYARKAN ---
    // Struktur Kolom: No | No. Invoice | Catatan/Keterangan Invoice | Nominal Dibayar
    const head = [['No', 'No. Invoice', 'Keterangan', 'Jumlah Bayar']];
    let body = [];

    // Mengambil data dari 'listInvoices' (sesuaikan key ini dengan data inputmu)
    if (data.listInvoices && Array.isArray(data.listInvoices) && data.listInvoices.length > 0) {
            body = data.listInvoices.map((inv, i) => {
            const amount = Number(inv.jumlahBayar || inv.amount || 0);

            return [
                i + 1,
                inv.noInvoice || inv.idInvoice || '-',       // Nomor Invoice
                inv.keterangan || '-',                       // Catatan per invoice (misal: Cicilan 1)
                formatCurrency(amount)                       // Nominal
            ];
            });
    } else {
        // Fallback jika data kosong
        body = [['-', '-', 'Tidak ada data invoice', formatCurrency(0)]];
    }

    // Render Table
    autoTable(doc, {
        startY: currentY,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], lineWidth: 0.1, halign: 'center' },
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: { 
            0: { halign: 'center', cellWidth: 10 }, 
            1: { cellWidth: 50 }, 
            3: { halign: 'right', cellWidth: 40 }   // Jumlah Bayar Rata Kanan
        }
    });

    // --- 4. SUMMARY FOOTER ---
    currentY = doc.lastAutoTable.finalY + 5;
    const rightX = pageWidth - margin.right;
    
    // Total Pembayaran (Bisa dari summary data atau hitung ulang dari item)
    const totalBayar = Number(data.totalBayar || data.jumlah || 0);

    const summaryData = [
        { label: 'Total Pembayaran:', value: formatCurrency(totalBayar), bold: true },
    ];

    summaryData.forEach(row => {
        doc.setFontSize(10);
        doc.setFont('helvetica', row.bold ? 'bold' : 'normal');
        doc.text(row.label, rightX - 45, currentY, { align: 'right' });
        doc.text(row.value, rightX, currentY, { align: 'right' });
        currentY += 5;
    });

    // --- 5. FOOTER KETERANGAN ---
    const footerY = doc.internal.pageSize.getHeight() - margin.bottom;
    
    // Keterangan Global (Catatan Pembayaran)
    if (data.keterangan) {
        doc.setFontSize(8); doc.setFont('helvetica', 'italic');
        doc.text(`Catatan: ${data.keterangan}`, margin.left, footerY - 10);
    }
    
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(terms[0], margin.left, footerY);
    doc.text(terms[1], margin.left, footerY + 4);

    return doc;
};

export const generateNotaPembayaranPDF = (data) => buildDoc(data).output('datauristring');