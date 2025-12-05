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
    const refDokumen = data.nomorInvoice || data.idTransaksi || '-'; 

    let namaPelanggan = data.namaPelanggan;
    if (!namaPelanggan && data.keterangan) {
        const match = data.keterangan.match(/\((.*?)\)$/);
        namaPelanggan = match ? match[1] : "-"; 
    }

    const infoX = pageWidth / 2 + 10;
    
    doc.setFontSize(10); 
    doc.setFont('helvetica', 'bold'); doc.text('No. Retur:', margin.left, currentY);
    doc.setFont('helvetica', 'normal'); doc.text(idDokumen, margin.left + 30, currentY);
    currentY += 5;
    
    doc.setFont('helvetica', 'bold'); doc.text('Ref. Invoice:', margin.left, currentY);
    doc.setFont('helvetica', 'normal'); doc.text(String(refDokumen), margin.left + 30, currentY);
    currentY += 5;

    const rightY = currentY - 10;
    doc.setFont('helvetica', 'bold'); doc.text('Tanggal:', infoX, rightY);
    doc.setFont('helvetica', 'normal'); doc.text(formatDate(data.tanggal), infoX + 25, rightY);
    
    if (namaPelanggan && namaPelanggan !== '-') {
        doc.setFont('helvetica', 'bold'); doc.text('Pelanggan:', infoX, rightY + 5);
        doc.setFont('helvetica', 'normal'); doc.text(namaPelanggan, infoX + 25, rightY + 5);
    }

    currentY += 10;

    // --- 3. TABEL ITEM RETUR ---
  // --- 3. TABEL ITEM RETUR ---
    const head = [['No', 'Item Buku', 'Qty', 'Harga', 'Subtotal']];
    let body = [];
    let calculatedTotal = 0;

    // 1. Normalisasi Data: Pastikan kita punya Array, apapun format aslinya
    let listItems = data.itemsReturDetail;

    // Jaga-jaga jika data dari database berupa string JSON (misal: "[{...}, {...}]")
    if (typeof listItems === 'string') {
        try {
            listItems = JSON.parse(listItems);
        } catch (e) {
            console.error("Gagal parse JSON itemsReturDetail", e);
            listItems = [];
        }
    }

    // Jaga-jaga jika data berupa Object (bukan Array) seperti format Firebase Realtime DB
    if (listItems && typeof listItems === 'object' && !Array.isArray(listItems)) {
        listItems = Object.values(listItems);
    }

    // --- LOGIKA UTAMA ---
    if (Array.isArray(listItems) && listItems.length > 0) {
        // OPSI A: Jika data sudah berupa Array Detail
        body = listItems.map((item, i) => {
            const judul = item.judulBuku || item.judul || item.nama_buku || '-'; // Tambahkan variasi nama field
            const qty = Number(item.qty || item.quantity || item.jumlah || 0);
            
            const harga = Number(item.hargaSatuan || item.harga || 0);
            let sub = Number(item.subtotal || 0);

            // Hitung subtotal manual jika 0/null
            if (!sub && harga > 0 && qty > 0) {
                sub = harga * qty;
            }

            calculatedTotal += sub;

            return [
                i + 1,
                judul,
                qty,
                formatCurrency(harga),
                formatCurrency(sub)
            ];
        });
    } 
    else if (data.itemsReturRingkas) {
        // OPSI B: Jika data hanya berupa String panjang (Fallback)
        // Gunakan Regex koma (,) diikuti spasi opsional agar lebih aman
        const itemsStr = data.itemsReturRingkas.split(/,\s*/); 
        
        body = itemsStr.map((str, i) => {
            // Coba ambil format "Judul Buku (x2)"
            const match = str.match(/(.*)\s\(x(\d+)\)/);
            const nama = match ? match[1] : str;
            const qty = match ? match[2] : '1'; // Default qty 1 jika tidak ada (x..)
            
            return [i + 1, nama, qty, '-', '-'];
        });
    }

    // --- RENDER TABEL ---
    autoTable(doc, {
        startY: currentY,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], lineWidth: 0.1, halign: 'center' },
        styles: { fontSize: 9, cellPadding: 2, valign: 'middle' }, // valign middle agar rapi
        columnStyles: { 
            0: { halign: 'center', cellWidth: 10 }, 
            1: { cellWidth: 'auto' }, // Biarkan kolom nama buku fleksibel
            2: { halign: 'center', cellWidth: 15 }, 
            3: { halign: 'right', cellWidth: 25 }, 
            4: { halign: 'right', cellWidth: 25 }
        },
        // Pastikan tabel tidak menabrak footer halaman jika item sangat banyak
        margin: { bottom: 30 }
    });
    // --- 4. SUMMARY FOOTER ---
    currentY = doc.lastAutoTable.finalY + 5;
    const rightX = pageWidth - margin.right;
    
    // Ambil Total dari data parent
    let netRefund = Math.abs(Number(data.jumlah || data.totalHarga || 0));
    
    // JIKA Total Parent 0 (atau null), PAKAI TOTAL HITUNGAN DARI TABEL DI ATAS
    if (netRefund === 0 && calculatedTotal > 0) {
        netRefund = calculatedTotal;
    }

    const summaryData = [
        { label: 'Total Pengembalian:', value: formatCurrency(netRefund), bold: true },
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
    
    if (data.keterangan) {
        doc.setFontSize(8); doc.setFont('helvetica', 'italic');
        doc.text(`Catatan: ${data.keterangan}`, margin.left, footerY - 10);
    }
    
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(terms[0], margin.left, footerY);
    doc.text(terms[1], margin.left, footerY + 4);

    return doc;
};

export const generateNotaReturPDF = (data) => buildDoc(data).output('datauristring');