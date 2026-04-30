import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const AppContext = createContext();
import { API_BASE } from '../config';

export const AppProvider = ({ children }) => {
    const [wallet, setWallet] = useState({ balance: 0, eWalletBalance: 0 });
    const [merchants, setMerchants] = useState([]);
    const [qrCodes, setQrCodes] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [settlements, setSettlements] = useState([]); // For Admin Payouts
    const [fundRequests, setFundRequests] = useState([]); // For Admin Add Money
    const [transactions, setTransactions] = useState([]); // Service Transactions
    const [walletHistory, setWalletHistory] = useState([]); // Wallet Movement History
    const [reports, setReports] = useState([]);
    const [mappingTrace, setMappingTrace] = useState([]);
    const [loading, setLoading] = useState(true);
    const { isAuthenticated, user } = useAuth();

    const getHeaders = useCallback(() => {
        const token = sessionStorage.getItem('authToken');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }, []);

    const fetchData = useCallback(async () => {
        const token = sessionStorage.getItem('authToken');
        if (!token) return;

        try {
            const results = await Promise.allSettled([
                fetch(`${API_BASE}/wallet`, { headers: getHeaders() }),
                fetch(`${API_BASE}/users`, { headers: getHeaders() }),
                fetch(`${API_BASE}/qrcodes`, { headers: getHeaders() }),
                fetch(`${API_BASE}/transactions`, { headers: getHeaders() }),
                fetch(`${API_BASE}/wallet/transactions`, { headers: getHeaders() })
            ]);

            // Process each result independently
            if (results[0].status === 'fulfilled' && results[0].value.ok) {
                const data = await results[0].value.json();
                setWallet(data || { balance: 0, eWalletBalance: 0 });
            }

            if (results[1].status === 'fulfilled' && results[1].value.ok) {
                const data = await results[1].value.json();
                if (Array.isArray(data)) {
                    setMerchants(data.filter((user) => user.role !== 'admin'));
                }
            }

            if (results[2].status === 'fulfilled' && results[2].value.ok) {
                const data = await results[2].value.json();
                if (Array.isArray(data)) setQrCodes(data);
            }

            if (results[3].status === 'fulfilled' && results[3].value.ok) {
                const data = await results[3].value.json();
                if (Array.isArray(data)) setTransactions(data);
            }

            if (results[4].status === 'fulfilled' && results[4].value.ok) {
                const data = await results[4].value.json();
                if (Array.isArray(data)) setWalletHistory(data);
            }

            // Fetch Bank Accounts for Merchant separately
            const bankRes = await fetch(`${API_BASE}/bank-accounts`, { headers: getHeaders() });
            if (bankRes.ok) {
                const data = await bankRes.json();
                setBankAccounts(data);
            }
        } catch (err) {
            console.error("Failed to fetch data", err);
        } finally {
            setLoading(false);
        }
    }, [getHeaders]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchData();
        }
    }, [fetchData, isAuthenticated, user?.id]);

    const addFunds = async (amount) => {
        try {
            const res = await fetch(`${API_BASE}/wallet/pg-add`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ amount })
            });
            if (res.ok) await fetchData();
        } catch (err) {
            console.error("Add funds failed", err);
        }
    };

    const requestFunds = async (amount, reason) => {
        try {
            const res = await fetch(`${API_BASE}/fund-requests`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ 
                    amount: Number(amount), 
                    remarks: reason || "Manual fund request from wallet" 
                })
            });
            const data = await res.json();
            if (res.ok) {
                await fetchData();
                return { success: true, data };
            } else {
                return { success: false, error: data.error };
            }
        } catch (err) {
            console.error("Fund request failed", err);
            return { success: false, error: "Server error" };
        }
    };

    const fetchFundRequests = async () => {
        try {
            const res = await fetch(`${API_BASE}/fund-requests`, {
                headers: getHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setFundRequests(data);
                return data;
            }
        } catch (err) {
            console.error("Fetch fund requests failed", err);
        }
    };

    const fetchReports = useCallback(async ({ limit = 100, status } = {}) => {
        try {
            const params = new URLSearchParams();
            if (limit) params.set("limit", limit.toString());
            if (status) params.set("status", status);
            const queryString = params.toString() ? `?${params.toString()}` : "";
            const res = await fetch(`${API_BASE}/reports${queryString}`, {
                headers: getHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setReports(data.transactions || []);
                return data;
            }
            console.error("Fetch reports failed:", await res.text());
        } catch (err) {
            console.error("Fetch reports failed", err);
        }
        setReports([]);
        return { transactions: [], stats: { totalCount: 0, totalVolume: 0, statusCounts: {} } };
    }, [getHeaders]);

    const fetchMappingTrace = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/reports/mapping-trace`, {
                headers: getHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setMappingTrace(Array.isArray(data.entries) ? data.entries : []);
                return data.entries || [];
            }
            console.error("Fetch mapping trace failed:", await res.text());
        } catch (err) {
            console.error("Fetch mapping trace failed", err);
        }
        setMappingTrace([]);
        return [];
    }, [getHeaders]);

    const approveFundRequest = async (id) => {
        try {
            const res = await fetch(`${API_BASE}/fund-requests/${id}/approve`, {
                method: 'PATCH',
                headers: getHeaders()
            });
            if (res.ok) {
                await fetchFundRequests();
                await fetchData();
                return { success: true };
            }
        } catch (err) {
            return { success: false };
        }
    };

    const rejectFundRequest = async (id, reason) => {
        try {
            const res = await fetch(`${API_BASE}/fund-requests/${id}/reject`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({ reason })
            });
            if (res.ok) {
                await fetchFundRequests();
                return { success: true };
            }
        } catch (err) {
            return { success: false };
        }
    };

    const addMerchant = async (merchant) => {
        try {
            const res = await fetch(`${API_BASE}/users`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    email: merchant.email,
                    password: merchant.password,
                    full_name: merchant.name,
                    role: 'retailer',
                    business_name: merchant.businessName || merchant.name,
                    phone: merchant.phone || '',
                    callbackUrl: merchant.callbackUrl || null
                })
            });
            const data = await res.json();
            if (res.ok) {
                await fetchData();
                return { success: true, data };
            }
            return { success: false, error: data.error || 'Failed to create merchant' };
        } catch (err) {
            console.error("Add merchant failed", err);
            return { success: false, error: "Network error" };
        }
    };

    const updateMerchant = async (id, merchantData) => {
        try {
            const res = await fetch(`${API_BASE}/users/${id}`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify(merchantData)
            });
            if (res.ok) {
                await fetchData();
                return { success: true };
            }
            const data = await res.json();
            return { success: false, error: data.error };
        } catch (err) {
            console.error("Update merchant failed", err);
            return { success: false, error: "Network error" };
        }
    };

    const updateMerchantStatus = async (id, status) => {
        try {
            const res = await fetch(`${API_BASE}/users/${id}/status`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                await fetchData();
                return { success: true };
            }
            const data = await res.json();
            return { success: false, error: data.error || 'Failed to update merchant status' };
        } catch (err) {
            console.error("Update merchant status failed", err);
            return { success: false, error: "Network error" };
        }
    };

    const deleteMerchant = async (id) => {
        if (!window.confirm("Are you sure you want to delete this merchant?")) return { success: false };
        try {
            const res = await fetch(`${API_BASE}/users/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            if (res.ok) {
                await fetchData();
                return { success: true };
            } else {
                const data = await res.json();
                return { success: false, error: data.error || 'Failed to delete merchant' };
            }
        } catch (err) {
            console.error("Delete merchant failed", err);
            return { success: false, error: 'Network error' };
        }
    };

    // --- Bank Account Management ---
    const addBankAccount = async (bankData) => {
        try {
            const res = await fetch(`${API_BASE}/bank-accounts`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(bankData)
            });
            if (res.ok) {
                await fetchData();
                return { success: true };
            }
            return { success: false };
        } catch (err) {
            return { success: false };
        }
    };

    const deleteBankAccount = async (id) => {
        try {
            const res = await fetch(`${API_BASE}/bank-accounts/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            if (res.ok) await fetchData();
        } catch (err) {
            console.error("Delete bank account failed", err);
        }
    };

    // --- Settlement Management ---
    const requestSettlement = async (amount, bankAccountId) => {
        try {
            const res = await fetch(`${API_BASE}/wallet/payout`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ amount, bankAccountId })
            });
            const data = await res.json();
            if (res.ok) {
                await fetchData();
                return { success: true, data };
            } else {
                return { success: false, error: data.error };
            }
        } catch (err) {
            return { success: false, error: "Network error" };
        }
    };

    const fetchSettlements = async (status = '') => {
        try {
            const res = await fetch(`${API_BASE}/wallet/settlements${status ? `?status=${status}` : ''}`, {
                headers: getHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setSettlements(data);
                return data;
            }
        } catch (err) {
            console.error("Fetch settlements failed", err);
        }
    };

    const approveSettlement = async (id) => {
        try {
            const res = await fetch(`${API_BASE}/wallet/settlements/${id}/approve`, {
                method: 'POST',
                headers: getHeaders()
            });
            if (res.ok) {
                await fetchSettlements('pending');
                return { success: true };
            }
        } catch (err) {
            return { success: false };
        }
    };

    const rejectSettlement = async (id, reason) => {
        try {
            const res = await fetch(`${API_BASE}/wallet/settlements/${id}/reject`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ reason })
            });
            if (res.ok) {
                await fetchSettlements('pending');
                return { success: true };
            }
        } catch (err) {
            return { success: false };
        }
    };

    const addQrCode = async (formData) => {
        try {
            const token = sessionStorage.getItem('authToken');
            const res = await fetch(`${API_BASE}/qrcodes`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (res.ok) await fetchData();
        } catch (err) {
            console.error("Add QR code failed", err);
        }
    };

    const bulkAddQrCodes = async (formData) => {
        try {
            const token = sessionStorage.getItem('authToken');
            const res = await fetch(`${API_BASE}/qrcodes/bulk`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (res.ok) await fetchData();
            return await res.json();
        } catch (err) {
            console.error("Bulk QR onboarding failed", err);
            return { success: false, error: "Server error" };
        }
    };

    const updateQrCode = async (id, qrData) => {
        try {
            const res = await fetch(`${API_BASE}/qrcodes/${id}`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify(qrData)
            });
            if (res.ok) {
                await fetchData();
                return { success: true };
            }
            const errData = await res.json();
            console.error("Update QR failed server-side:", errData);
            return { success: false, error: errData.error || 'Update failed' };
        } catch (err) {
            console.error("Update QR network error:", err);
            return { success: false, error: 'Network error' };
        }
    };

    const deleteQrCode = async (id) => {
        if (!window.confirm("Are you sure you want to delete this QR code?")) return;
        try {
            const res = await fetch(`${API_BASE}/qrcodes/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            if (res.ok) await fetchData();
        } catch (err) {
            console.error("Delete QR code failed", err);
        }
    };

    const assignQrByTid = async (tid, merchantId) => {
        try {
            const res = await fetch(`${API_BASE}/qrcodes/assign-by-tid`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ tid, merchantId })
            });
            const data = await res.json();
            if (res.ok) {
                await fetchData();
                return { success: true, data };
            }
            return { success: false, error: data.error };
        } catch (err) {
            console.error("Assign QR by TID failed", err);
            return { success: false, error: "Server error" };
        }
    };

    const assignQrByIds = async (ids, merchantId) => {
        try {
            const res = await fetch(`${API_BASE}/qrcodes/assign-by-ids`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ ids, merchantId })
            });
            const data = await res.json();
            if (res.ok) {
                await fetchData();
                return { success: true, data };
            }
            return { success: false, error: data.error };
        } catch (err) {
            console.error("Assign QR by IDs failed", err);
            return { success: false, error: "Server error" };
        }
    };

    const unassignQrCode = async (id) => {
        try {
            const res = await fetch(`${API_BASE}/qrcodes/${id}/unassign`, {
                method: 'POST',
                headers: getHeaders()
            });
            const data = await res.json();
            if (res.ok) {
                await fetchData();
                return { success: true, data };
            }
            return { success: false, error: data.error };
        } catch (err) {
            console.error("Unassign QR failed", err);
            return { success: false, error: "Server error" };
        }
    };


    const uploadReport = async (file) => {
        const formData = new FormData();
        formData.append('report', file);

        try {
            const token = sessionStorage.getItem('authToken');
            const res = await fetch(`${API_BASE}/reports/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }, // No content-type for FormData
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                await fetchData();
                await fetchReports();
                return { success: true, data };
            }
            return { success: false, error: data.error };
        } catch (err) {
            console.error("Report upload failed", err);
            return { success: false, error: "Server error" };
        }
    };

    const generateApiKey = (environment = 'sandbox') => {
        return environment === 'production' ? 'tl_live_backend_gen_key' : 'tl_test_backend_gen_key';
    };

    const getSystemSetting = async (key) => {
        try {
            // We fetch all settings for now since it's a small map
            const res = await fetch(`${API_BASE}/settings`, {
                headers: getHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                return data[key];
            }
        } catch (err) {
            console.error("Failed to fetch setting", err);
        }
        return null; // or default
    };

    return (
        <AppContext.Provider value={{
            wallet,
            merchants,
            qrCodes,
            transactions,
            walletHistory,
            loading,
            addFunds,
            requestFunds,
            addMerchant, updateMerchant, updateMerchantStatus, deleteMerchant,
            addBankAccount, deleteBankAccount, bankAccounts,
            requestSettlement, fetchSettlements, settlements,
            approveSettlement, rejectSettlement,
            approveFundRequest, rejectFundRequest, fundRequests,
            bulkAddQrCodes, addQrCode, assignQrByTid, assignQrByIds,
            unassignQrCode,
            updateQrCode,
            deleteQrCode,
            uploadReport,
            reports,
            fetchReports,
            mappingTrace,
            fetchMappingTrace,
            generateApiKey,
            getSystemSetting,
            fetchData
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
