import React, { createContext, useState, useEffect, useContext } from 'react';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { Spin, Layout } from 'antd'; // Import Spin for loading indicator

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

    useEffect(() => {
        // Listen for authentication state changes
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            console.log("Auth State Changed:", user ? `User logged in: ${user.email}` : "User logged out");
            setCurrentUser(user);
            setLoading(false); // Stop loading once the initial check is done
        });

        // Cleanup subscription on unmount
        return unsubscribe;
    }, [auth]);

    const login = (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
    };

    const logout = () => {
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
