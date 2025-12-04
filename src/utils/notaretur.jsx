import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const companyInfo = {
    nama: "CV. GANGSAR MULIA UTAMA",
    alamat: "Jl. Kalicari Dalam I No.4, Kalicari, Kec. Pedurungan, Kota Semarang, Jawa Tengah 50198, ",
    hp: "0882-0069-05391"
};

const terms = [
    'Bukti retur ini sah dan diterbitkan oleh sistem.',
    'Barang yang diretur telah mengurangi tagihan atau stok sesuai ketentuan.',
];

// --- HELPER ---
const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(value || 0);
const formatDate = (timestamp) => new Date(timestamp || 0).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute:'2-digit' });

/**
 * Generator PDF Khusus Nota Retur
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
    doc.text("NOTA RETUR", pageWidth - margin.right, currentY, { align: 'right' });
    
    currentY += 6;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    const alamatLines = doc.splitTextToSize(companyInfo.alamat +` ${companyInfo.hp}` , 140);
    doc.text(alamatLines, margin.left, currentY);
    currentY += (alamatLines.length * 4.5) + 2; 

    doc.setLineWidth(0.2); doc.line(margin.left, currentY, pageWidth - margin.right, currentY);
    currentY += 8; 

    // --- 2. INFO TRANSAKSI ---
    const idDokumen = data.id || '-';
    const refDokumen = data.idTransaksi || data.nomorInvoice || '-'; // ID Invoice Asal

    let namaPelanggan = data.namaPelanggan;
    if (!namaPelanggan && data.keterangan) {
        // Fallback: Coba ambil nama dari keterangan jika ada
        const match = data.keterangan.match(/\((.*?)\)$/);
        namaPelanggan = match ? match[1] : "-"; 
    }

    const infoX = pageWidth / 2 + 10;
    
    doc.setFontSize(10); 
    
    // Kiri
    doc.setFont('helvetica', 'bold'); doc.text('No. Retur:', margin.left, currentY);
    doc.setFont('helvetica', 'normal'); doc.text(idDokumen, margin.left + 30, currentY);
    currentY += 5;
    
    doc.setFont('helvetica', 'bold'); doc.text('Ref. Invoice:', margin.left, currentY);
    doc.setFont('helvetica', 'normal'); doc.text(String(refDokumen), margin.left + 30, currentY);
    currentY += 5;

    // Kanan
    const rightY = currentY - 10;
    doc.setFont('helvetica', 'bold'); doc.text('Tanggal:', infoX, rightY);
    doc.setFont('helvetica', 'normal'); doc.text(formatDate(data.tanggal), infoX + 25, rightY);
    
    if (namaPelanggan && namaPelanggan !== '-') {
        doc.setFont('helvetica', 'bold'); doc.text('Pelanggan:', infoX, rightY + 5);
        doc.setFont('helvetica', 'normal'); doc.text(namaPelanggan, infoX + 25, rightY + 5);
    }

    currentY += 10;

    // --- 3. TABEL ITEM RETUR ---
    const head = [['No', 'Item Buku', 'Qty', 'Harga', 'Subtotal']];
    let body = [];

    // Cek apakah ada detail item yang tersimpan lengkap (Struktur Baru)
    if (data.itemsReturDetail && Array.isArray(data.itemsReturDetail) && data.itemsReturDetail.length > 0) {
            body = data.itemsReturDetail.map((item, i) => {
            const harga = Number(item.hargaSatuan || item.harga || 0);
            const qty = Number(item.jumlah || item.qty || 0);
            const disc = Number(item.diskonPersen || item.diskon || 0);
            // Subtotal per item setelah diskon
            const sub = harga * qty * (1);

            return [
                i + 1,
                item.judulBuku || item.idBuku,
                qty,
                formatCurrency(harga),
                formatCurrency(sub)
            ];
            });
    } 
    // Fallback ke data lama (String Ringkas)
    else if (data.itemsReturRingkas) {
        const itemsStr = data.itemsReturRingkas.split(', ');
        body = itemsStr.map((str, i) => {
            const match = str.match(/(.*)\s\(x(\d+)\)/); 
            const nama = match ? match[1] : str;
            const qty = match ? match[2] : '-';
            return [i + 1, nama, qty, '-', '-']; 
        });
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
            2: { halign: 'center', cellWidth: 15 }, // Qty Center
            3: { halign: 'right' }, // Harga Kanan
            4: { halign: 'right' }  // Subtotal Kanan
        }
    });

    // --- 4. SUMMARY FOOTER ---
    currentY = doc.lastAutoTable.finalY + 5;
    const rightX = pageWidth - margin.right;
    
    const totalDiskon = Number(data.totalDiskon || 0);
    const netRefund = Math.abs(data.jumlah || 0);
    // Estimasi nilai barang total (Net Refund + Diskon jika ada)
    const subTotal = (data.nilaiBarangRetur || netRefund) + totalDiskon;

    const summaryData = [
        { label: 'Total Nilai Barang:', value: formatCurrency(subTotal) },
        totalDiskon > 0 ? { label: 'Total Potongan Retur:', value: `(${formatCurrency(totalDiskon)})` } : null,
        { label: 'Total Pengembalian:', value: formatCurrency(netRefund), bold: true },
    ].filter(Boolean);

    summaryData.forEach(row => {
        doc.setFontSize(10);
        doc.setFont('helvetica', row.bold ? 'bold' : 'normal');
        doc.text(row.label, rightX - 45, currentY, { align: 'right' });
        doc.text(row.value, rightX, currentY, { align: 'right' });
        currentY += 5;
    });

    // --- 5. FOOTER KETERANGAN ---
    const footerY = doc.internal.pageSize.getHeight() - margin.bottom;
    
    if (data.keterangan) {
        doc.setFontSize(8); doc.setFont('helvetica', 'italic');
        doc.text(`Catatan: ${data.keterangan}`, margin.left, footerY - 10);
    }
    
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    // doc.text(terms[0], margin.left, footerY);

    return doc;
};

export const generateNotaReturPDF = (data) => buildDoc(data).output('datauristring');