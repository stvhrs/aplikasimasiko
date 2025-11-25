import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';
import { currencyFormatter } from './formatters'; 

export const generateMutasiPdf = (
  dataTransaksi, 
  infoPeriode, 
  balanceMap, // Parameter ini dibiarkan ada agar tidak error di MutasiPage, meski tidak dipakai di tabel
  kategoriMasuk, 
  kategoriKeluar
) => {
  const doc = new jsPDF();

  // --- 1. Header PDF ---
  doc.setFontSize(18);
  doc.text('Laporan Mutasi Keuangan', 14, 22);

  doc.setFontSize(11);
  doc.setTextColor(100);
  
  let periodText = 'Semua Periode';
  if (infoPeriode?.dateRange && infoPeriode.dateRange[0]) {
    const start = dayjs(infoPeriode.dateRange[0]).format('DD MMM YYYY');
    const end = dayjs(infoPeriode.dateRange[1]).format('DD MMM YYYY');
    periodText = `${start} - ${end}`;
  }
  
  doc.text(`Periode: ${periodText}`, 14, 30);
  doc.setFontSize(9);
  doc.text(`Dicetak pada: ${dayjs().format('DD MMM YYYY HH:mm')}`, 14, 36);

  // --- 2. Persiapan Data Tabel Utama ---
  const tableRows = [];
  let totalMasuk = 0;
  let totalKeluar = 0;

  // Sort data berdasarkan tanggal
  const sortedData = [...dataTransaksi].sort((a, b) => {
    const tA = a.tanggal || a.tanggalBayar || 0;
    const tB = b.tanggal || b.tanggalBayar || 0;
    return tA - tB;
  });

  sortedData.forEach((item, index) => {
    const tanggal = dayjs(item.tanggal || item.tanggalBayar).format('DD/MM/YYYY');
    const isMasuk = item.tipe === 'pemasukan';
    
    let namaKategori = item.kategori;
    if (isMasuk && kategoriMasuk) {
        namaKategori = kategoriMasuk[item.kategori] || item.kategori;
    } else if (!isMasuk && kategoriKeluar) {
        namaKategori = kategoriKeluar[item.kategori] || item.kategori;
    }
    namaKategori = namaKategori || item.tipeMutasi || '-';

    const nominal = Number(item.jumlah) || 0;
    const nominalMasuk = isMasuk ? nominal : 0;
    const nominalKeluar = !isMasuk ? Math.abs(nominal) : 0;

    totalMasuk += nominalMasuk;
    totalKeluar += nominalKeluar;

    // Push data tanpa kolom saldo
    tableRows.push([
      index + 1,
      tanggal,
      namaKategori,
      item.keterangan || '-',
      nominalMasuk ? currencyFormatter(nominalMasuk) : '-',
      nominalKeluar ? currencyFormatter(nominalKeluar) : '-',
    ]);
  });

  // --- 3. Render Tabel Transaksi (Tanpa Saldo) ---
  autoTable(doc, {
    startY: 45,
    head: [['No', 'Tanggal', 'Kategori', 'Keterangan', 'Masuk', 'Keluar']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [22, 119, 255] },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      4: { halign: 'right' }, // Masuk
      5: { halign: 'right' }, // Keluar
    },
    // Simpan posisi Y terakhir setelah tabel selesai
    didDrawPage: (data) => {
        doc.lastAutoTable = data; 
    }
  });

  // --- 4. Render Tabel Rekapitulasi (Baru) ---
  
  // Ambil posisi Y terakhir dari tabel sebelumnya + margin 10
  const finalY = doc.lastAutoTable.finalY + 10;
  const selisih = totalMasuk - totalKeluar;

  autoTable(doc, {
    startY: finalY,
    head: [['RINGKASAN', 'NOMINAL']],
    body: [
        ['Total Pemasukan', currencyFormatter(totalMasuk)],
        ['Total Pengeluaran', currencyFormatter(totalKeluar)],
        ['Surplus / (Defisit)', currencyFormatter(selisih)]
    ],
    theme: 'plain', // Tampilan lebih bersih
    tableWidth: 80, // Lebar tabel kecil saja
    margin: { left: 14 }, // Rata kiri
    headStyles: { 
        fillColor: [240, 240, 240], 
        textColor: 0, 
        fontStyle: 'bold',
        lineWidth: 0.1,
        lineColor: 200
    },
    bodyStyles: {
        lineWidth: 0.1,
        lineColor: 200
    },
    columnStyles: {
        1: { halign: 'right', fontStyle: 'bold' }
    },
    didParseCell: (data) => {
        // Warnai baris surplus/defisit
        if (data.row.index === 2 && data.section === 'body') {
             if (selisih >= 0) {
                 data.cell.styles.textColor = [0, 128, 0]; // Hijau
             } else {
                 data.cell.styles.textColor = [255, 0, 0]; // Merah
             }
        }
    }
  });

  // --- 5. Output ---
  const fileName = `Laporan_Mutasi_${dayjs().format('YYYYMMDD_HHmm')}.pdf`;
  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);

  return { blobUrl, fileName };
};