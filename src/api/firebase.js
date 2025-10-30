 
import { initializeApp } from "firebase/app";
import { getDatabase } from 'firebase/database';
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAEEE0DoyOAMYHSuftJOYG6hE1OQrkimPM",
  authDomain: "gudanggalatama.firebaseapp.com",
  databaseURL: "https://gudanggalatama-default-rtdb.firebaseio.com",
  projectId: "gudanggalatama",
  storageBucket: "gudanggalatama.firebasestorage.app",
  messagingSenderId: "197812694747",
  appId: "1:197812694747:web:6edecc32373c4d676726fe",
  measurementId: "G-W5F7PRNZNR"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const storage = getStorage(app);
export { app }; // ✅ tambahkan baris ini
