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
    
    if (data.metodeBayar) {
        doc.setFont('helvetica', 'bold'); doc.text('Metode:', infoX, rightY + 5);
        doc.setFont('helvetica', 'normal'); doc.text(data.metodeBayar, infoX + 25, rightY + 5);
    }

    currentY += 10;

    // --- 3. TABEL LIST INVOICE YANG DIBAYARKAN ---
    const head = [['No', 'No. Invoice', 'Keterangan', 'Jumlah Bayar']];
    let body = [];

    if (data.listInvoices && Array.isArray(data.listInvoices) && data.listInvoices.length > 0) {
            body = data.listInvoices.map((inv, i) => {
            const amount = Number(inv.jumlahBayar || inv.amount || 0);

            // --- PERBAIKAN DI SINI ---
            // Logika: Cek keterangan item dulu -> Cek keterangan global (data.keterangan) -> baru strip
            const noteToShow = inv.keterangan || data.keterangan || '-';

            return [
                i + 1,
                inv.noInvoice || inv.idInvoice || '-',      
                noteToShow,                                  // Menggunakan logic fallback baru
                formatCurrency(amount)                       
            ];
            });
    } else {
        // Jika list kosong, tapi ada keterangan global, tampilkan di baris dummy
        const noteGlobal = data.keterangan || 'Pembayaran tanpa detail invoice';
        body = [['1', '-', noteGlobal, formatCurrency(data.totalBayar || data.jumlah || 0)]];
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
            3: { halign: 'right', cellWidth: 40 } 
        }
    });

    // --- 4. SUMMARY FOOTER ---
    currentY = doc.lastAutoTable.finalY + 5;
    const rightX = pageWidth - margin.right;
    
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
    
    // (Opsional) Jika Anda tidak ingin keterangan muncul double (di tabel + di footer),
    // Anda bisa menghapus bagian ini, atau biarkan saja sebagai catatan tambahan.
    // if (data.keterangan) {
    //     doc.setFontSize(8); doc.setFont('helvetica', 'italic');
    //     doc.text(`Catatan: ${data.keterangan}`, margin.left, footerY - 10);
    // }
    
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    // doc.text(terms[0], margin.left, footerY);
    // doc.text(terms[1], margin.left, footerY + 4);

    return doc;
};

export const generateNotaPembayaranPDF = (data) => buildDoc(data).output('datauristring');