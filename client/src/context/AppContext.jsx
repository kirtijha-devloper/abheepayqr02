/* eslint-disable no-unused-vars */
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';

const AppContext = createContext();
import { API_BASE } from '../config';

export const AppProvider = ({ children }) => {
    const [wallet, setWallet] = useState({ balance: 0, eWalletBalance: 0, holdBalance: 0 });
    const [merchants, setMerchants] = useState([]);
    const [qrCodes, setQrCodes] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [settlements, setSettlements] = useState([]); // For Admin Payouts
    const [fundRequests, setFundRequests] = useState([]); // For Admin Add Money
    const [transactions, setTransactions] = useState([]); // Service Transactions
    const [walletHistory, setWalletHistory] = useState([]); // Wallet Movement History
    const [reports, setReports] = useState([]);
    const [mappingTrace, setMappingTrace] = useState([]);
    const [staffMembers, setStaffMembers] = useState([]);
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
                fetch(`${API_BASE}/wallet/transactions`, { headers: getHeaders() }),
                fetch(`${API_BASE}/fund-requests`, { headers: getHeaders() }),
                fetch(`${API_BASE}/wallet/settlements?status=pending`, { headers: getHeaders() })
            ]);

            // Process each result independently
            if (results[0].status === 'fulfilled' && results[0].value.ok) {
                const data = await results[0].value.json();
                setWallet(data || { balance: 0, eWalletBalance: 0, holdBalance: 0 });
            }

            if (results[1].status === 'fulfilled' && results[1].value.ok) {
                const data = await results[1].value.json();
                if (Array.isArray(data)) {
                    const filtered = data.filter((user) => {
                        const r = (user.role || '').toLowerCase();
                        return r !== 'admin' && r !== 'staff';
                    });
                    setMerchants(filtered);
                }
            }

            if (user?.role === 'admin' || (user?.role === 'staff' && user?.permissions?.canManageSecurity)) {
                const staffRes = await fetch(`${API_BASE}/staff`, { headers: getHeaders() });
                if (staffRes.ok) {
                    const staffData = await staffRes.json();
                    setStaffMembers(staffData);
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

            if (results[5].status === 'fulfilled' && results[5].value.ok) {
                const data = await results[5].value.json();
                setFundRequests(data);
            }

            if (results[6].status === 'fulfilled' && results[6].value.ok) {
                const data = await results[6].value.json();
                setSettlements(data);
            }

            const bankRes = await fetch(`${API_BASE}/bank-accounts`, { headers: getHeaders() });
            if (bankRes.ok) {
                const data = await bankRes.json();
                setBankAccounts(Array.isArray(data) ? data : []);
            }

        } catch (err) {
            console.error("Failed to fetch data", err);
        } finally {
            setLoading(false);
        }
    }, [getHeaders, user?.role]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchData();
            
            // Set up polling interval for auto-refresh (every 10 seconds)
            const interval = setInterval(() => {
                fetchData();
            }, 10000);

            return () => clearInterval(interval);
        }
    }, [fetchData, isAuthenticated, user?.id]);

    const addFunds = useCallback(async (amount) => {
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
    }, [getHeaders, fetchData]);

    const requestFunds = useCallback(async (amount, reason) => {
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
    }, [getHeaders, fetchData]);

    const fetchFundRequests = useCallback(async () => {
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
    }, [getHeaders]);

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

    const approveFundRequest = useCallback(async (id) => {
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
    }, [getHeaders, fetchFundRequests, fetchData]);

    const rejectFundRequest = useCallback(async (id, reason) => {
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
    }, [getHeaders, fetchFundRequests]);

    const addMerchant = useCallback(async (merchant) => {
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
    }, [getHeaders, fetchData]);

    const updateMerchant = useCallback(async (id, merchantData) => {
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
    }, [getHeaders, fetchData]);

    const updateMerchantStatus = useCallback(async (id, status) => {
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
    }, [getHeaders, fetchData]);

    const deleteMerchant = useCallback(async (id) => {
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
    }, [getHeaders, fetchData]);

    // --- Staff Management ---
    const fetchStaffMembers = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/staff`, { headers: getHeaders() });
            if (res.ok) {
                const data = await res.json();
                setStaffMembers(data);
                return data;
            }
        } catch (err) {
            console.error("Fetch staff members failed", err);
        }
        return [];
    }, [getHeaders]);

    const addStaffMember = useCallback(async (staffData) => {
        try {
            const res = await fetch(`${API_BASE}/staff`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(staffData)
            });
            const data = await res.json();
            if (res.ok) {
                await fetchStaffMembers();
                return { success: true, data };
            }
            return { success: false, error: data.error };
        } catch (err) {
            return { success: false, error: "Network error" };
        }
    }, [getHeaders, fetchStaffMembers]);

    const updateStaffMember = useCallback(async (id, staffData) => {
        try {
            const res = await fetch(`${API_BASE}/staff/${id}`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify(staffData)
            });
            const data = await res.json();
            if (res.ok) {
                await fetchStaffMembers();
                return { success: true, data };
            }
            return { success: false, error: data.error };
        } catch (err) {
            return { success: false, error: "Network error" };
        }
    }, [getHeaders, fetchStaffMembers]);

    const loginAs = useCallback(async (id) => {
        try {
            const res = await fetch(`${API_BASE}/auth/login-as/${id}`, {
                method: 'POST',
                headers: getHeaders()
            });
            const data = await res.json();
            if (res.ok && data.token) {
                // Redirect to home with token in URL to trigger the AuthContext sync logic
                window.location.href = `${window.location.origin}/?token=${data.token}`;
                return { success: true };
            }
            return { success: false, error: data.error || 'Login-as failed' };
        } catch (err) {
            console.error("Login-as failed", err);
            return { success: false, error: "Server error" };
        }
    }, [getHeaders]);

    const deleteStaffMember = useCallback(async (id) => {
        if (!window.confirm("Are you sure you want to delete this staff member?")) return { success: false };
        try {
            const res = await fetch(`${API_BASE}/staff/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            if (res.ok) {
                await fetchStaffMembers();
                return { success: true };
            }
            const data = await res.json();
            return { success: false, error: data.error };
        } catch (err) {
            return { success: false, error: "Network error" };
        }
    }, [getHeaders, fetchStaffMembers]);

    // --- Wallet Hold Management ---
    const holdWallet = useCallback(async (userId, amount, description) => {
        try {
            const res = await fetch(`${API_BASE}/wallet/hold`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ target_user_id: userId, amount, description })
            });
            const data = await res.json();
            if (res.ok) {
                await fetchData();
                return { success: true };
            }
            return { success: false, error: data.error };
        } catch (err) {
            console.error("Hold wallet failed", err);
            return { success: false, error: "Network error" };
        }
    }, [getHeaders, fetchData]);

    const unholdWallet = useCallback(async (userId, amount, description) => {
        try {
            const res = await fetch(`${API_BASE}/wallet/unhold`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ target_user_id: userId, amount, description })
            });
            const data = await res.json();
            if (res.ok) {
                await fetchData();
                return { success: true };
            }
            return { success: false, error: data.error };
        } catch (err) {
            console.error("Unhold wallet failed", err);
            return { success: false, error: "Network error" };
        }
    }, [getHeaders, fetchData]);

    // --- Bank Account Management ---
    const addBankAccount = useCallback(async (bankData) => {
        try {
            const res = await fetch(`${API_BASE}/bank-accounts`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(bankData)
            });
            const data = await res.json();
            if (res.ok) {
                await fetchData();
                return { success: true };
            }
            return { success: false, error: data.error || 'Failed to add bank account' };
        } catch (err) {
            console.error("Add bank account failed", err);
            return { success: false, error: "Network error" };
        }
    }, [getHeaders, fetchData]);

    const deleteBankAccount = useCallback(async (id) => {
        try {
            const res = await fetch(`${API_BASE}/bank-accounts/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            if (res.ok) await fetchData();
        } catch (err) {
            console.error("Delete bank account failed", err);
        }
    }, [getHeaders, fetchData]);

    // --- Settlement Management ---
    const requestSettlement = useCallback(async (amount, bankAccountId) => {
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
    }, [getHeaders, fetchData]);

    const getBranchXPayoutQuote = useCallback(async (amount) => {
        try {
            const params = new URLSearchParams({ amount: String(amount) });
            const res = await fetch(`${API_BASE}/services/payout/quote?${params.toString()}`, {
                headers: getHeaders()
            });
            const data = await res.json();
            if (res.ok && data?.success) {
                return { success: true, data: data.quote };
            }
            return { success: false, error: data?.error || data?.message || 'Failed to fetch BranchX payout quote' };
        } catch (err) {
            return { success: false, error: "Network error" };
        }
    }, [getHeaders]);

    const verifyBranchXBeneficiary = useCallback(async (beneficiaryId) => {
        try {
            const res = await fetch(`${API_BASE}/services/payout/beneficiaries/${beneficiaryId}/verify`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({})
            });
            const data = await res.json();
            if (res.ok && data?.success) {
                await fetchData();
                return { success: true, data: data.beneficiary };
            }
            return { success: false, error: data?.error || data?.message || 'Beneficiary verification failed' };
        } catch (err) {
            return { success: false, error: "Network error" };
        }
    }, [getHeaders, fetchData]);

    const requestBranchXPayout = useCallback(async ({ amount, beneficiaryId, tpin, confirmVerified, remark, transferMode }) => {
        try {
            const res = await fetch(`${API_BASE}/services/payout`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ amount, beneficiaryId, tpin, confirmVerified, remark, transferMode })
            });
            const data = await res.json();
            if (res.ok && data?.success) {
                await fetchData();
                return { success: true, data };
            }
            return { success: false, error: data?.error || data?.message || 'BranchX payout request failed', data };
        } catch (err) {
            return { success: false, error: "Network error" };
        }
    }, [getHeaders, fetchData]);

    const fetchSettlements = useCallback(async (status = '') => {
        try {
            const normalizedStatus = status === 'all' ? '' : status;
            const res = await fetch(`${API_BASE}/wallet/settlements${normalizedStatus ? `?status=${normalizedStatus}` : ''}`, {
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
    }, [getHeaders]);

    const approveSettlement = useCallback(async (id) => {
        try {
            const res = await fetch(`${API_BASE}/wallet/settlements/${id}/approve`, {
                method: 'POST',
                headers: getHeaders()
            });
            if (res.ok) {
                await fetchData();
                return { success: true };
            }
        } catch (err) {
            return { success: false };
        }
    }, [getHeaders, fetchData]);

    const rejectSettlement = useCallback(async (id, reason) => {
        try {
            const res = await fetch(`${API_BASE}/wallet/settlements/${id}/reject`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ reason })
            });
            if (res.ok) {
                await fetchData();
                return { success: true };
            }
        } catch (err) {
            return { success: false };
        }
    }, [getHeaders, fetchData]);

    const addQrCode = useCallback(async (formData) => {
        try {
            const token = sessionStorage.getItem('authToken');
            const res = await fetch(`${API_BASE}/qrcodes`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                await fetchData();
                return { success: true, data };
            }
            return { success: false, error: data?.error || 'Failed to add QR code', data };
        } catch (err) {
            console.error("Add QR code failed", err);
            return { success: false, error: "Server error" };
        }
    }, [fetchData]);

    const bulkAddQrCodes = useCallback(async (formData) => {
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
    }, [fetchData]);

    const updateQrCode = useCallback(async (id, qrData) => {
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
    }, [getHeaders, fetchData]);

    const deleteQrCode = useCallback(async (id) => {
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
    }, [getHeaders, fetchData]);

    const assignQrByTid = useCallback(async (tid, merchantId) => {
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
    }, [getHeaders, fetchData]);

    const assignQrByIds = useCallback(async (ids, merchantId) => {
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
    }, [getHeaders, fetchData]);

    const unassignQrCode = useCallback(async (id) => {
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
    }, [getHeaders, fetchData]);

    const fetchQrReport = useCallback(async (id, filters = {}) => {
        try {
            const params = new URLSearchParams();
            if (filters.startDate) params.set('startDate', filters.startDate);
            if (filters.endDate) params.set('endDate', filters.endDate);
            const queryString = params.toString() ? `?${params.toString()}` : '';
            const res = await fetch(`${API_BASE}/qrcodes/${id}/report${queryString}`, {
                headers: getHeaders()
            });
            const data = await res.json();
            if (res.ok) {
                return { success: true, data };
            }
            return { success: false, error: data?.error || 'Failed to load QR report' };
        } catch (err) {
            console.error("Fetch QR report failed", err);
            return { success: false, error: "Network error" };
        }
    }, [getHeaders]);


    const uploadReport = useCallback(async (file) => {
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
    }, [fetchData, fetchReports]);

    const generateApiKey = useCallback((environment = 'sandbox') => {
        return environment === 'production' ? 'tl_live_backend_gen_key' : 'tl_test_backend_gen_key';
    }, []);

    const getSystemSetting = useCallback(async (key) => {
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
    }, [getHeaders]);

    const contextValue = useMemo(() => ({
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
        getBranchXPayoutQuote, verifyBranchXBeneficiary, requestBranchXPayout,
        approveSettlement, rejectSettlement,
        approveFundRequest, rejectFundRequest, fundRequests, fetchFundRequests,
        bulkAddQrCodes, addQrCode, assignQrByTid, assignQrByIds,
        unassignQrCode,
        fetchQrReport,
        updateQrCode,
        deleteQrCode,
        uploadReport,
        reports,
        fetchReports,
        mappingTrace,
        fetchMappingTrace,
        staffMembers,
        fetchStaffMembers,
        addStaffMember,
        updateStaffMember,
        deleteStaffMember,
        loginAs,
        holdWallet,
        unholdWallet,
        generateApiKey,
        getSystemSetting,
        fetchData
    }), [
        wallet, merchants, qrCodes, transactions, walletHistory, loading,
        addFunds, requestFunds, addMerchant, updateMerchant, updateMerchantStatus,
        deleteMerchant, addBankAccount, deleteBankAccount, bankAccounts,
        requestSettlement, fetchSettlements, settlements, getBranchXPayoutQuote,
        verifyBranchXBeneficiary, requestBranchXPayout, approveSettlement,
        rejectSettlement, approveFundRequest, rejectFundRequest, fundRequests,
        fetchFundRequests, bulkAddQrCodes, addQrCode, assignQrByTid, assignQrByIds,
        unassignQrCode, fetchQrReport, updateQrCode, deleteQrCode, uploadReport, reports,
        fetchReports, mappingTrace, fetchMappingTrace, staffMembers,
        fetchStaffMembers, addStaffMember, updateStaffMember, deleteStaffMember,
        loginAs, holdWallet, unholdWallet, generateApiKey, getSystemSetting, fetchData
    ]);

    return (
        <AppContext.Provider value={contextValue}>
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
