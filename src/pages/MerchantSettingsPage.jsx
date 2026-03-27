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

    useEffect(() => {
        // Fetch profile details
        const fetchProfile = async () => {
            const token = sessionStorage.getItem('authToken');
            try {
                const res = await fetch(`${API_BASE}/auth/profile`, {
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
            const res = await fetch(`${API_BASE}/auth/profile`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(profile)
            });
            if (res.ok) {
                alert('Profile updated successfully!');
            } else {
                alert('Failed to update profile.');
            }
        } catch (err) {
            alert('Error updating profile.');
        }
    };

    const handleChangePassword = async () => {
        if (passwords.new !== passwords.confirm) return alert("Passwords do not match");
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
                alert('Password changed successfully!');
                setPasswords({ current: '', new: '', confirm: '' });
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to change password.');
            }
        } catch (err) {
            alert('Error updating password.');
        }
    };

    const handleAddBank = async () => {
        if (!newBank.bankName || !newBank.accountNumber) return alert("Fill required fields");
        const res = await addBankAccount(newBank);
        if (res.success) {
            alert("Bank account added!");
            setNewBank({ bankName: '', accountName: '', accountNumber: '', ifscCode: '' });
        } else {
            alert("Failed to add bank account");
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
