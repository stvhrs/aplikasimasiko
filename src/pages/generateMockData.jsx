const PENERBIT_LIST = [
  "Erlangga",
  "Gramedia Pustaka Utama",
  "Tiga Serangkai",
  "Penerbit Andi",
  "Mizan Pustaka",
  "Bumi Aksara",
  "Yudhistira",
  "Intan Pariwara",
  "Quadra",
  "Penerbit Bintang",
];

const TIPE_BUKU_LIST = [
  "Buku Teks Utama (BTU)",
  "Buku Teks Pendamping (BTP)",
  "LKS (Lembar Kerja Siswa)",
  "Non Teks",
  "Buku Guru (BG)",
  "Umum",
  "SK (Surat Keputusan)",
  "SK HET (Harga Eceran Tertinggi)",
  "Tematik",
];

// Daftar Mapel komprehensif (SD, SMP, SMA, SMK, Muatan Lokal)
const MAPEL_LIST = [
  // SD
  "Matematika",
  "Bahasa Indonesia",
  "Pendidikan Pancasila",
  "Agama",
  "Seni Budaya",
  "Penjas",
  "Tematik Terpadu",
  // SMP
  "IPA Terpadu",
  "IPS Terpadu",
  "Bahasa Inggris",
  "Informatika",
  "Prakarya",
  // SMA (Wajib & Peminatan)
  "Fisika",
  "Kimia",
  "Biologi",
  "Sejarah Indonesia",
  "Geografi",
  "Sosiologi",
  "Ekonomi",
  "Sejarah Peminatan",
  "Matematika Peminatan",
  "Sastra Indonesia",
  "Sastra Inggris",
  // Mapel dari User
  "Bahasa Jawa", // Muatan Lokal
  "Seni Rupa", // Seni
  "Seni Musik", // Seni
  "IPA (IPAS)", // Kurikulum Merdeka
  "Dasar Program Keahlian (SMK)", // Koding/Kejuruan
];

const KELAS_LIST = [
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12",
];
const PERUNTUKAN_LIST = ["Siswa", "Guru", "Umum"];
const SPEK_KERTAS_LIST = ["HVS", "Bookpaper", "Art Paper", "N/A"];

// --- Helper Functions ---

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- Fungsi Generator Utama ---

export function generateBooks(count = 1000) {
  const books = [];
  const generatedCodes = new Set(); // Untuk memastikan kode buku unik

  for (let i = 0; i < count; i++) {
    const mapel = randomChoice(MAPEL_LIST);
    const kelas = randomChoice(KELAS_LIST);
    const tipeBuku = randomChoice(TIPE_BUKU_LIST);
    const spekKertas = randomChoice(SPEK_KERTAS_LIST);
    
    // Generate kode buku unik
    let kodeBuku;
    do {
      kodeBuku = randomInt(10000, 99999).toString();
    } while (generatedCodes.has(kodeBuku));
    generatedCodes.add(kodeBuku);

    // Judul yang lebih dinamis
    const judul = `${tipeBuku} ${mapel} - Kelas ${kelas}`;

    const book = {
      // id: (i + 1).toString(), // Opsional: untuk ID unik
      judul: judul,
      kelas: kelas,
      kode_buku: kodeBuku,
      mapel: mapel,
      penerbit: randomChoice(PENERBIT_LIST),
      peruntukan: randomChoice(PERUNTUKAN_LIST),
      spek: spekKertas === "N/A" ? "Buku Digital" : "Buku Cetak",
      spek_kertas: spekKertas,
      harga_zona_1: tipeBuku === "LKS (Lembar Kerja Siswa)" ? randomInt(15000, 40000) : randomInt(45000, 150000),
      harga_zona_3: tipeBuku === "LKS (Lembar Kerja Siswa)" ? randomInt(15000, 40000) : randomInt(45000, 150000),
      harga_zona_3: tipeBuku === "LKS (Lembar Kerja Siswa)" ? randomInt(15000, 40000) : randomInt(45000, 150000),
      harga_zona_4: tipeBuku === "LKS (Lembar Kerja Siswa)" ? randomInt(15000, 40000) : randomInt(45000, 150000),

      stok: randomInt(0, 500),
      harga_zona_5a: tipeBuku === "LKS (Lembar Kerja Siswa)" ? randomInt(15000, 40000) : randomInt(45000, 150000),
      tipe_buku: tipeBuku,
      harga_zona_5b: tipeBuku === "LKS (Lembar Kerja Siswa)" ? randomInt(15000, 40000) : randomInt(45000, 150000),
      updatedAt: Date.now() - randomInt(0, 1000 * 60 * 60 * 24 * 365), // Timestamp acak dalam 1 tahun terakhir
    };

    books.push(book);
  }

  return books;
}