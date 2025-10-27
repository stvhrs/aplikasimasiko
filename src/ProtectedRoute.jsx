import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext'; // Sesuaikan path

const ProtectedRoute = ({ children }) => {
    const { currentUser } = useAuth();
    const location = useLocation();

    if (!currentUser) {
        // Redirect them to the /login page, but save the current location they were
        // trying to go to in the state property. This allows us to send them
        // along to that page after they login, which is a nicer user experience
        // than dropping them off on the home page.
        console.log("Protected Route: No user found, redirecting to login from", location.pathname);
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // If logged in, render the child component
    return children;
};

export default ProtectedRoute;
