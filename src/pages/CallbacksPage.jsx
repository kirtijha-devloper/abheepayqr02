import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import './CallbacksPage.css';

const CallbacksPage = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [callbackUrl, setCallbackUrl] = useState('');
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const API_BASE = 'http://localhost:4001/api';

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = sessionStorage.getItem('authToken');
            const [profileRes, logsRes] = await Promise.all([
                fetch(`${API_BASE}/auth/profile`, { 
                    headers: { 'Authorization': `Bearer ${token}` },
                    credentials: 'include' 
                }).then(r => r.json()),
                fetch(`${API_BASE}/callback-logs`, { 
                    headers: { 'Authorization': `Bearer ${token}` },
                    credentials: 'include' 
                }).then(r => r.json())
            ]);
            setCallbackUrl(profileRes.callbackUrl || '');
            setLogs(logsRes || []);
        } catch (err) {
            console.error("Fetch error:", err);
            setMessage({ type: 'error', text: 'Failed to load callback data.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveUrl = async () => {
        if (!callbackUrl.startsWith('http')) {
            setMessage({ type: 'error', text: 'Please enter a valid URL starting with http:// or https://' });
            return;
        }
        setSaving(true);
        try {
            const token = sessionStorage.getItem('authToken');
            const res = await fetch(`${API_BASE}/users/profile`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ callbackUrl }),
                credentials: 'include'
            });
            if (!res.ok) throw new Error("Update failed");
            setMessage({ type: 'success', text: 'Callback URL updated successfully!' });
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to update URL.' });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        }
    };

    const handleResend = async (txnId) => {
        try {
            const token = sessionStorage.getItem('authToken');
            const res = await fetch(`${API_BASE}/callback-logs/resend/${txnId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                credentials: 'include'
            });
            if (!res.ok) throw new Error("Resend failed");
            setMessage({ type: 'success', text: 'Callback re-sent successfully!' });
            fetchData();
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to re-send callback.' });
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'success': return '#10b981';
            case 'failed': return '#ef4444';
            case 'pending': return '#f59e0b';
            default: return '#64748b';
        }
    };

    return (
        <div className="dashboard-layout">
            <Sidebar />
            <div className="main-content">
                <Header />
                <main className="dashboard-body animated">
                    <div className="callbacks-container">
                        <header className="page-header">
                            <div>
                                <h1>Transaction Callbacks</h1>
                                <p>Automated reporting to your system whenever a payment is received.</p>
                            </div>
                        </header>

                        {!isAdmin && (
                            <section className="settings-card">
                                <h2>API Webhook Settings</h2>
                                <p>Set a URL where our system will send a JSON POST request for every settled transaction.</p>
                                
                                <div className="url-input-group">
                                    <input 
                                        type="url" 
                                        placeholder="https://your-api.com/webhooks/payments"
                                        value={callbackUrl}
                                        onChange={(e) => setCallbackUrl(e.target.value)}
                                    />
                                    <button 
                                        onClick={handleSaveUrl} 
                                        disabled={saving}
                                        className="btn-primary"
                                    >
                                        {saving ? 'Updating...' : 'Save Configuration'}
                                    </button>
                                </div>
                                {message.text && (
                                    <div className={`status-msg ${message.type}`}>
                                        {message.text}
                                    </div>
                                )}
                            </section>
                        )}

                        <section className="logs-section">
                            <div className="section-header">
                                <h2>Recent Delivery Logs</h2>
                                <button onClick={fetchData} className="btn-icon">Refresh ⟳</button>
                            </div>

                            <div className="logs-table-wrapper">
                                <table className="logs-table">
                                    <thead>
                                        <tr>
                                            <th>Timestamp</th>
                                            {isAdmin && <th>Merchant</th>}
                                            <th>Transaction</th>
                                            <th>Amount</th>
                                            <th>Status</th>
                                            <th>Response</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan="6" className="text-center">Loading logs...</td></tr>
                                        ) : logs.length === 0 ? (
                                            <tr><td colSpan="6" className="text-center">No callback logs found.</td></tr>
                                        ) : logs.map(log => (
                                            <tr key={log.id}>
                                                <td className="time-col">
                                                    {new Date(log.createdAt).toLocaleString()}
                                                </td>
                                                {isAdmin && (
                                                    <td className="merchant-col">
                                                        <div className="merchant-info">
                                                            <span className="m-name">{log.transaction.user?.profile?.businessName || log.transaction.user?.profile?.fullName}</span>
                                                            <span className="m-email">{log.transaction.user?.email}</span>
                                                        </div>
                                                    </td>
                                                )}
                                                <td>
                                                    <div className="txn-info">
                                                        <span className="txn-id">{log.transaction.refId || log.transactionId.slice(0,8)}</span>
                                                        <span className="txn-type">{log.transaction.serviceType}</span>
                                                    </div>
                                                </td>
                                                <td className="amount-col">₹{log.transaction.amount}</td>
                                                <td>
                                                    <span className="status-badge" style={{ backgroundColor: getStatusColor(log.status) }}>
                                                        {log.status.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="response-col">
                                                    <code title={log.response}>{log.statusCode || '---'}: {log.response || 'No response'}</code>
                                                </td>
                                                <td>
                                                    <button 
                                                        onClick={() => handleResend(log.transactionId)}
                                                        className="btn-text"
                                                    >
                                                        Resend ↪
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default CallbacksPage;
