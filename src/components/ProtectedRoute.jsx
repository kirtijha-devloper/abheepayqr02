import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, requiredRole }) => {
    const { isAuthenticated, user, loading } = useAuth();

    if (loading) {
        return <div style={{height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>Loading...</div>; // Could be a real spinner component
    }

    if (!isAuthenticated) {
        // Redirect to appropriate login page based on what they were trying to access
        return <Navigate to={requiredRole === 'admin' ? "/admin/login" : "/login"} replace />;
    }

    const normalizeRole = (r) => r === 'retailer' ? 'merchant' : r;
    const userRole = normalizeRole(user?.role);
    const expectedRole = normalizeRole(requiredRole);

    if (requiredRole && userRole !== expectedRole) {
        // User logged in but wrong role (e.g., merchant trying to access admin)
        return <Navigate to={userRole === 'admin' ? "/admin/dashboard" : "/dashboard"} replace />;
    }

    return children;
};

export default ProtectedRoute;
