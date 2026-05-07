import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { API_BASE } from '../config';
import './AdminSettingsPage.css'; // Reuse common settings styles

const MerchantSettingsPage = () => {
    const { user } = useAuth();
    const { bankAccounts, addBankAccount, deleteBankAccount } = useAppContext();
    const [activeTab, setActiveTab] = useState('profile');
    const [profile, setProfile] = useState({
        fullName: user?.name || '',
        businessName: '',
        phone: ''
    });
    const [newBank, setNewBank] = useState({
        bankName: '',
        accountName: '',
        accountNumber: '',
        ifscCode: ''
    });
    const [passwords, setPasswords] = useState({
        current: '',
        new: '',
        confirm: ''
    });
    const [tpinForm, setTpinForm] = useState({
        tpin: '',
        confirmTpin: ''
    });
    const [tpinEditable, setTpinEditable] = useState({
        tpin: false,
        confirmTpin: false
    });
    const [message, setMessage] = useState({ type: '', text: '' });

    const showMessage = (type, text) => {
        setMessage({ type, text });
        window.setTimeout(() => {
            setMessage((current) => (current.text === text ? { type: '', text: '' } : current));
        }, 3000);
    };

    useEffect(() => {
        // Fetch profile details
        const fetchProfile = async () => {
            const token = sessionStorage.getItem('authToken');
            try {
                const res = await fetch(`${API_BASE}/users/profile`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setProfile({
                        fullName: data.fullName || '',
                        businessName: data.businessName || '',
                        phone: data.phone || ''
                    });
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchProfile();
    }, []);

    const handleSaveProfile = async () => {
        const token = sessionStorage.getItem('authToken');
        try {
            const res = await fetch(`${API_BASE}/users/profile`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(profile)
            });
            if (res.ok) {
                showMessage('success', 'Profile updated successfully.');
            } else {
                const data = await res.json();
                showMessage('error', data.error || 'Failed to update profile.');
            }
        } catch (err) {
            showMessage('error', 'Error updating profile.');
        }
    };

    const handleChangePassword = async () => {
        if (passwords.new !== passwords.confirm) {
            showMessage('error', 'Passwords do not match.');
            return;
        }
        const token = sessionStorage.getItem('authToken');
        try {
            const res = await fetch(`${API_BASE}/auth/change-password`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    oldPassword: passwords.current, 
                    newPassword: passwords.new 
                })
            });
            if (res.ok) {
                showMessage('success', 'Password changed successfully.');
                setPasswords({ current: '', new: '', confirm: '' });
            } else {
                const data = await res.json();
                showMessage('error', data.error || 'Failed to change password.');
            }
        } catch (err) {
            showMessage('error', 'Error updating password.');
        }
    };

    const handleUpdateTpin = async () => {
        if (tpinForm.tpin.trim().length < 4) {
            showMessage('error', 'Transaction PIN must be at least 4 digits.');
            return;
        }
        if (tpinForm.tpin !== tpinForm.confirmTpin) {
            showMessage('error', 'Transaction PIN values do not match.');
            return;
        }
        const token = sessionStorage.getItem('authToken');
        try {
            const res = await fetch(`${API_BASE}/auth/tpin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    tpin: tpinForm.tpin
                })
            });
            if (res.ok) {
                showMessage('success', 'Transaction PIN updated successfully.');
                setTpinForm({ tpin: '', confirmTpin: '' });
                setTpinEditable({ tpin: false, confirmTpin: false });
            } else {
                const data = await res.json();
                showMessage('error', data.error || 'Failed to update transaction PIN.');
            }
        } catch (err) {
            showMessage('error', 'Error updating transaction PIN.');
        }
    };

    const handleAddBank = async () => {
        // Relaxed for testing
        if (!newBank.bankName) {
            showMessage('error', 'Bank Name is required.');
            return;
        }
        const res = await addBankAccount(newBank);
        if (res.success) {
            showMessage('success', 'Bank account added.');
            setNewBank({ bankName: '', accountName: '', accountNumber: '', ifscCode: '' });
        } else {
            showMessage('error', 'Failed to add bank account.');
        }
    };

    const handleDeleteBank = async (id) => {
        if (window.confirm("Remove this bank account?")) {
            await deleteBankAccount(id);
        }
    };

    return (
        <div className="dashboard-layout">
            <Sidebar />
            <div className="main-content">
                <Header title="Account Settings" />
                <main className="dashboard-body animated">
                    <div className="settings-container-v2">
                        <div className="settings-sidebar-v2">
                            {[
                                { id: 'profile', label: 'My Profile', icon: '👤' },
                                { id: 'banks', label: 'Bank Accounts', icon: '🏦' },
                                { id: 'security', label: 'Security', icon: '🛡️' }
                            ].map(tab => (
                                <button 
                                    key={tab.id}
                                    className={`sidebar-tab-v2 ${activeTab === tab.id ? 'active' : ''}`}
                                    onClick={() => setActiveTab(tab.id)}
                                >
                                    <span className="tab-icon">{tab.icon}</span>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="settings-content-v2">
                            {message.text && (
                                <div
                                    style={{
                                        marginBottom: '16px',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                                        background: message.type === 'success' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                                        color: message.type === 'success' ? '#34d399' : '#fca5a5',
                                        fontSize: '14px',
                                        fontWeight: 600
                                    }}
                                >
                                    {message.text}
                                </div>
                            )}
                            {activeTab === 'profile' && (
                                <div className="portal-card card animated-fade-in">
                                    <div className="portal-header">
                                        <h3>Profile Information</h3>
                                        <p>Update your personal and business details.</p>
                                    </div>
                                    <div className="portal-content">
                                        <div className="form-grid-v2">
                                            <div className="form-group-v2">
                                                <label>Full Name</label>
                                                <input 
                                                    type="text" 
                                                    className="premium-input"
                                                    value={profile.fullName}
                                                    onChange={e => setProfile({...profile, fullName: e.target.value})}
                                                />
                                            </div>
                                            <div className="form-group-v2">
                                                <label>Business Name</label>
                                                <input 
                                                    type="text" 
                                                    className="premium-input"
                                                    value={profile.businessName}
                                                    onChange={e => setProfile({...profile, businessName: e.target.value})}
                                                />
                                            </div>
                                            <div className="form-group-v2">
                                                <label>Phone Number</label>
                                                <input 
                                                    type="text" 
                                                    className="premium-input"
                                                    value={profile.phone}
                                                    onChange={e => setProfile({...profile, phone: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                        <button className="premium-btn primary" onClick={handleSaveProfile} style={{ marginTop: '24px' }}>
                                            Save Changes
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'banks' && (
                                <div className="portal-card card animated-fade-in">
                                    <div className="portal-header">
                                        <h3>Whitelisted Bank Accounts</h3>
                                        <p>Manage accounts where you receive settlements.</p>
                                    </div>
                                    <div className="portal-content">
                                        <div className="bank-list" style={{ marginBottom: '32px' }}>
                                            {bankAccounts.length === 0 ? (
                                                <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px' }}>
                                                    No bank accounts added yet.
                                                </div>
                                            ) : (
                                                bankAccounts.map(bank => (
                                                    <div key={bank.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', marginBottom: '12px' }}>
                                                        <div>
                                                            <div style={{ fontWeight: 600 }}>{bank.bankName}</div>
                                                            <div style={{ fontSize: '12px', opacity: 0.7 }}>{bank.accountNumber} • {bank.ifscCode}</div>
                                                        </div>
                                                        <button 
                                                            className="icon-btn-danger" 
                                                            onClick={() => handleDeleteBank(bank.id)}
                                                            style={{ padding: '8px', background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '8px', color: '#ef4444', cursor: 'pointer' }}
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        <div className="add-bank-section" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px' }}>
                                            <h4>Add New Bank Account</h4>
                                            <div className="form-grid-v2" style={{ marginTop: '16px' }}>
                                                <div className="form-group-v2">
                                                    <label>Bank Name</label>
                                                    <input 
                                                        type="text" 
                                                        className="premium-input"
                                                        value={newBank.bankName}
                                                        onChange={e => setNewBank({...newBank, bankName: e.target.value})}
                                                        placeholder="e.g. HDFC Bank"
                                                    />
                                                </div>
                                                <div className="form-group-v2">
                                                    <label>Account Holder Name</label>
                                                    <input 
                                                        type="text" 
                                                        className="premium-input"
                                                        value={newBank.accountName}
                                                        onChange={e => setNewBank({...newBank, accountName: e.target.value})}
                                                    />
                                                </div>
                                                <div className="form-group-v2">
                                                    <label>Account Number</label>
                                                    <input 
                                                        type="text" 
                                                        className="premium-input"
                                                        value={newBank.accountNumber}
                                                        onChange={e => setNewBank({...newBank, accountNumber: e.target.value})}
                                                    />
                                                </div>
                                                <div className="form-group-v2">
                                                    <label>IFSC Code</label>
                                                    <input 
                                                        type="text" 
                                                        className="premium-input"
                                                        value={newBank.ifscCode}
                                                        onChange={e => setNewBank({...newBank, ifscCode: e.target.value})}
                                                    />
                                                </div>
                                            </div>
                                            <button className="premium-btn primary" onClick={handleAddBank} style={{ marginTop: '20px' }}>
                                                Add Bank Account
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'security' && (
                                <div className="portal-card card animated-fade-in">
                                    <div className="portal-header">
                                        <h3>Security Settings</h3>
                                        <p>Manage your account password and security preferences.</p>
                                    </div>
                                    <div className="portal-content">
                                        <div style={{ maxWidth: '400px' }}>
                                            <div className="form-group-v2" style={{ marginBottom: '16px' }}>
                                                <label>Current Password</label>
                                                <input 
                                                    type="password" 
                                                    className="premium-input"
                                                    value={passwords.current}
                                                    onChange={e => setPasswords({...passwords, current: e.target.value})}
                                                />
                                            </div>
                                            <div className="form-group-v2" style={{ marginBottom: '16px' }}>
                                                <label>New Password</label>
                                                <input 
                                                    type="password" 
                                                    className="premium-input"
                                                    value={passwords.new}
                                                    onChange={e => setPasswords({...passwords, new: e.target.value})}
                                                />
                                            </div>
                                            <div className="form-group-v2" style={{ marginBottom: '24px' }}>
                                                <label>Confirm New Password</label>
                                                <input 
                                                    type="password" 
                                                    className="premium-input"
                                                    value={passwords.confirm}
                                                    onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                                                />
                                            </div>
                                            <button className="premium-btn primary" onClick={handleChangePassword}>
                                                Update Password
                                            </button>
                                        </div>

                                        <div className="portal-divider"></div>

                                        <div style={{ maxWidth: '520px' }}>
                                            <div className="portal-header" style={{ padding: 0, marginBottom: '16px' }}>
                                                <h3 style={{ fontSize: '18px', marginBottom: '6px' }}>Add or Change TPIN</h3>
                                                <p>Use a transaction PIN to approve secure payout actions.</p>
                                            </div>
                                            <div className="form-row-grid">
                                                <div className="form-group-v2">
                                                    <label>New TPIN</label>
                                                    <input
                                                        type="password"
                                                        className="premium-input"
                                                        placeholder="Minimum 4 digits"
                                                        value={tpinForm.tpin}
                                                        onChange={e => setTpinForm({ ...tpinForm, tpin: e.target.value })}
                                                        onFocus={() => setTpinEditable((prev) => ({ ...prev, tpin: true }))}
                                                        autoComplete="new-password"
                                                        name="new_tpin_manual"
                                                        readOnly={!tpinEditable.tpin}
                                                        data-lpignore="true"
                                                        data-1p-ignore="true"
                                                    />
                                                </div>
                                                <div className="form-group-v2">
                                                    <label>Confirm TPIN</label>
                                                    <input
                                                        type="password"
                                                        className="premium-input"
                                                        placeholder="Repeat TPIN"
                                                        value={tpinForm.confirmTpin}
                                                        onChange={e => setTpinForm({ ...tpinForm, confirmTpin: e.target.value })}
                                                        onFocus={() => setTpinEditable((prev) => ({ ...prev, confirmTpin: true }))}
                                                        autoComplete="new-password"
                                                        name="confirm_tpin_manual"
                                                        readOnly={!tpinEditable.confirmTpin}
                                                        data-lpignore="true"
                                                        data-1p-ignore="true"
                                                    />
                                                </div>
                                            </div>
                                            <button className="premium-btn primary" onClick={handleUpdateTpin} style={{ marginTop: '20px' }}>
                                                Save TPIN
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default MerchantSettingsPage;
