import {
  ref,
  get,
  push,
  update,
  remove,
  query,
  orderByChild
} from 'firebase/database';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { db, storage } from '../../../api/firebase'; // Pastikan path ini benar

const DB_PATH = 'mutasi';

/**
 * ========================================================================
 * Helper Internal
 * ========================================================================
 */

/**
 * Meng-upload file bukti ke Firebase Storage
 * @param {File} file - Objek file dari input
 * @returns {Promise<string>} - URL download file yang telah di-upload
 */
const handleUpload = async (file) => {
  if (!file) return null;
  
  const fileName = `${uuidv4()}-${file.name}`;
  const fileRef = storageRef(storage, `bukti_mutasi/${fileName}`);
  
  // Upload file
  await uploadBytes(fileRef, file);
  
  // Dapatkan URL download
  const downloadUrl = await getDownloadURL(fileRef);
  return downloadUrl;
};

/**
 * Menghapus file bukti dari Firebase Storage dengan aman
 * @param {string} fileUrl - URL download file yang akan dihapus
 */
const handleDeleteFile = async (fileUrl) => {
  if (!fileUrl) return;

  try {
    const fileRef = storageRef(storage, fileUrl);
    await deleteObject(fileRef);
  } catch (error) {
    // Seringkali error jika file tidak ada atau URL tidak valid
    // Kita tangkap error ini agar proses lain (misal delete database)
    // tetap berjalan.
    console.warn("Gagal menghapus file lama di storage:", error.message);
  }
};


/**
 * ========================================================================
 * API Publik (CRUD Functions)
 * ========================================================================
 */

/**
 * Mengambil semua data mutasi, diurutkan dari terbaru
 * @returns {Promise<Array>} - Array data mutasi
 */
export const getMutasi = async () => {
  const dbRef = query(ref(db, DB_PATH), orderByChild('tanggal'));
  const snapshot = await get(dbRef);
  
  if (!snapshot.exists()) {
    return []; // Kembalikan array kosong jika tidak ada data
  }
  
  const data = snapshot.val();
  
  // Ubah objek dari RTDB menjadi array dan urutkan (descending)
  return Object.keys(data)
    .map(key => ({
      id: key,
      ...data[key]
    }))
    .reverse(); // .reverse() karena orderByChild('tanggal') mengurutkan ascending
};

/**
 * Membuat data mutasi baru
 * @param {Object} mutasiData - Objek data mutasi (tanpa file)
 * @param {File | null} buktiFile - Objek file bukti dari input, atau null
 * @returns {Promise<Object>} - Objek data yang baru dibuat (termasuk ID baru)
 */
export const createMutasi = async (mutasiData, buktiFile) => {
  const dataToSave = { ...mutasiData };

  // 1. Upload file jika ada
  if (buktiFile) {
    dataToSave.buktiUrl = await handleUpload(buktiFile);
  }
  
  // 2. Simpan data ke Realtime Database
  const dbRef = ref(db, DB_PATH);
  const newEntry = await push(dbRef, dataToSave);
  
  // 3. Kembalikan data lengkap dengan ID barunya
  return { id: newEntry.key, ...dataToSave };
};

/**
 * Memperbarui data mutasi yang ada
 * @param {string} id - ID dari mutasi yang akan diperbarui
 * @param {Object} mutasiData - Objek data baru
 * @param {File | null} buktiFile - File bukti BARU (jika ada yg diganti)
 * @returns {Promise<Object>} - Objek data yang telah diperbarui
 */
export const updateMutasi = async (id, mutasiData, buktiFile) => {
  const dbRef = ref(db, `${DB_PATH}/${id}`);
  const dataToUpdate = { ...mutasiData };

  // 1. Ambil data lama untuk cek URL bukti sebelumnya
  const snapshot = await get(dbRef);
  const oldData = snapshot.val();
  const oldBuktiUrl = oldData?.buktiUrl || null;

  // 2. Logika penanganan file
  if (buktiFile) {
    // Ada file BARU di-upload
    dataToUpdate.buktiUrl = await handleUpload(buktiFile);
    // Hapus file LAMA jika ada
    if (oldBuktiUrl) {
      await handleDeleteFile(oldBuktiUrl);
    }
  } else if (mutasiData.buktiUrl === null && oldBuktiUrl) {
    // File dihapus (dari 'null' di form)
    await handleDeleteFile(oldBuktiUrl);
  } else if (oldBuktiUrl) {
    // Tidak ada file baru, pertahankan URL lama
    dataToUpdate.buktiUrl = oldBuktiUrl;
  }
  
  // 3. Update data di Realtime Database
  await update(dbRef, dataToUpdate);
  
  return { id, ...dataToUpdate };
};

/**
 * Menghapus data mutasi
 * @param {string} id - ID dari mutasi yang akan dihapus
 * @returns {Promise<null>}
 */
export const deleteMutasi = async (id) => {
  const dbRef = ref(db, `${DB_PATH}/${id}`);
  
  // 1. Ambil data untuk cek URL bukti
  const snapshot = await get(dbRef);
  if (!snapshot.exists()) {
    console.warn(`Mutasi ${id} tidak ditemukan untuk dihapus.`);
    return null;
  }
  
  const buktiUrl = snapshot.val().buktiUrl;

  // 2. Hapus file dari Storage jika ada
  if (buktiUrl) {
    await handleDeleteFile(buktiUrl);
  }
  
  // 3. Hapus data dari Realtime Database
  await remove(dbRef);
  
  return null;
};