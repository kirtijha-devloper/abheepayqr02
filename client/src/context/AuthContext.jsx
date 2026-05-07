import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const AuthContext = createContext();
import { API_BASE } from '../config';

// Synchronous intercept to prevent React Router redirect race condition!
if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
        sessionStorage.setItem('authToken', tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {

            const token = sessionStorage.getItem('authToken');
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/auth/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setUser({
                        id: data.userId,
                        email: data.email,
                        role: data.role,
                        name: data.profile?.fullName,
                        partnerId: data.profile?.id?.slice(0, 8), // Fallback MID
                        permissions: data.permissions || null,
                        allowedPages: data.allowedPages || [],
                        enabledFeatures: data.enabledFeatures || [],
                    });
                } else {
                    sessionStorage.removeItem('authToken');
                    setUser(null);
                }
            } catch (err) {
                console.error("Auth check failed", err);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    const login = useCallback(async (email, password) => {
        if (!email || !password) return { success: false, message: 'Please enter both email and password.' };

        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            if (res.ok) {
                sessionStorage.setItem('authToken', data.token);
                setUser(data.user);
                return { success: true, role: data.user.role };
            } else {
                return { success: false, message: data.error || 'Login failed' };
            }
        } catch (err) {
            return { success: false, message: 'Server error. Please try again.' };
        }
    }, []);

    const getImpersonateToken = useCallback(async (merchantId) => {
        try {
            const token = sessionStorage.getItem('authToken');
            const res = await fetch(`${API_BASE}/auth/login-as/${merchantId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                return { success: true, token: data.token };
            } else {
                return { success: false, message: data.error };
            }
        } catch (err) {
            return { success: false, message: 'Server error' };
        }
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        sessionStorage.removeItem('authToken');
    }, []);

    const value = useMemo(() => ({
        user,
        login,
        logout,
        getImpersonateToken,
        isAuthenticated: !!user,
        loading
    }), [user, login, logout, getImpersonateToken, loading]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
