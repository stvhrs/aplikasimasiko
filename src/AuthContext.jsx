import React, { createContext, useState, useEffect, useContext, useRef } from 'react'; // 1. Import useRef
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { Spin, Layout, message } from 'antd'; // Import Spin dan message

// Create the context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => {
    return useContext(AuthContext);
};

// Provider component
export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true); // Start loading initially
    const auth = getAuth(); // Get the auth instance

    // 2. Buat Ref untuk menyimpan ID timer
    const logoutTimerRef = useRef(null);

    useEffect(() => {
        // --- Helper untuk membersihkan timer ---
        const clearLogoutTimer = () => {
            if (logoutTimerRef.current) {
                clearTimeout(logoutTimerRef.current);
                logoutTimerRef.current = null;
                console.log("Timer logout otomatis dibersihkan.");
            }
        };

        // Listen for authentication state changes
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            console.log("Auth State Changed:", user ? `User logged in: ${user.email}` : "User logged out");
            setCurrentUser(user);
            setLoading(false); // Stop loading once the initial check is done

            // 3. Logika Timer Logout Otomatis
            clearLogoutTimer(); // Selalu bersihkan timer yang ada setiap status berubah

            if (user) {
                // Jika pengguna LOGIN, atur timer baru
                const twelveHoursInMs = 12 * 60 * 60 * 1000; // 43.200.000 ms

                console.log(`Timer logout otomatis diatur untuk 12 jam ke depan.`);

                logoutTimerRef.current = setTimeout(() => {
                    console.log("Sesi 12 jam berakhir. Melakukan logout otomatis.");
                    message.warning("Sesi Anda telah berakhir. Harap login kembali.", 5);
                    signOut(auth);
                }, twelveHoursInMs);

            }
            // Jika 'user' adalah null (logout), timer sudah dibersihkan di atas.
        });

        // Cleanup subscription dan timer saat component unmount
        return () => {
            unsubscribe();
            clearLogoutTimer(); // Pastikan timer bersih saat unmount
        };

    }, [auth]);

    const login = (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
    };

    const logout = () => {
        // Saat logout manual, onAuthStateChanged akan terpicu,
        // 'user' menjadi null, dan timer akan otomatis dibersihkan oleh logika di atas.
        return signOut(auth);
    };

    // Value to be passed down through context
    const value = {
        currentUser,
        login,
        logout,
    };

    // Show loading indicator during initial auth check
    if (loading) {
        return (
            <Layout style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin size="large" tip="Memeriksa autentikasi..." />
            </Layout>
        );
    }

    // Render children once loading is complete
    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};