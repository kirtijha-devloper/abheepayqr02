import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { API_BASE } from '../config';
import { useToast } from '../context/ToastContext';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import './AdminSettingsPage.css';

const defaultPayoutConfig = {
  type: 'flat',
  ranges: [{ min: 0, max: 1000, value: 10 }],
  default: 20,
};

const defaultLocalSettings = {
  appName: 'LeoPay',
  language: 'English (US)',
  timezone: 'IST (India Standard Time) - GMT+5:30',
  notifications: { txnAlerts: true, securityAlerts: true, monthlyReports: false },
};

const featureOptionsByRole = {
  staff: [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'masters', label: 'Masters' },
    { key: 'users', label: 'User List' },
    { key: 'wallet', label: 'Wallet' },
    { key: 'reconciliation', label: 'Reconciliation' },
    { key: 'qr_codes', label: 'QR Codes' },
    { key: 'settlements', label: 'Settlements' },
    { key: 'fund_requests', label: 'Fund Requests' },
    { key: 'ledger', label: 'Ledger' },
    { key: 'reports', label: 'Reports' },
    { key: 'callbacks', label: 'Callbacks' },
    { key: 'support', label: 'Support' },
    { key: 'charges', label: 'Charges' },
    { key: 'settings', label: 'Settings' },
  ],
  master: [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'merchants', label: 'Merchants' },
    { key: 'wallet', label: 'Wallet' },
    { key: 'ledger', label: 'Ledger' },
    { key: 'qr_codes', label: 'QR Codes' },
    { key: 'fund_requests', label: 'Fund Requests' },
    { key: 'settlements', label: 'Settlements' },
    { key: 'reconciliation', label: 'Reconciliation' },
    { key: 'reports', label: 'Reports' },
    { key: 'callbacks', label: 'Callbacks' },
    { key: 'support', label: 'Support' },
    { key: 'charges', label: 'Charges' },
    { key: 'settings', label: 'Settings' },
  ],
  merchant: [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'branches', label: 'Branches' },
    { key: 'qr_codes', label: 'QR Codes' },
    { key: 'settlements', label: 'Settlements' },
    { key: 'fund_requests', label: 'Fund Requests' },
    { key: 'reconciliation', label: 'Reconciliation' },
    { key: 'wallet', label: 'Wallet' },
    { key: 'ledger', label: 'Ledger' },
    { key: 'callbacks', label: 'Callbacks' },
    { key: 'support', label: 'Support' },
    { key: 'charges', label: 'Charges' },
    { key: 'settings', label: 'Settings' },
    { key: 'reports', label: 'Reports' },
  ],
  branch: [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'qr_codes', label: 'QR Codes' },
    { key: 'wallet', label: 'Wallet' },
    { key: 'ledger', label: 'Ledger' },
    { key: 'support', label: 'Support' },
    { key: 'settings', label: 'Settings' },
  ],
};

const AdminSettingsPage = () => {
  const navigate = useNavigate();
  const { success, error } = useToast();
  const { user } = useAuth();
  const { bankAccounts, addBankAccount, deleteBankAccount } = useAppContext();
  const [activeTab, setActiveTab] = useState('profile');
  const [allUsers, setAllUsers] = useState([]);
  const [selectedFeatureUserId, setSelectedFeatureUserId] = useState('');
  const [featureAccessMap, setFeatureAccessMap] = useState({});
  const [newBank, setNewBank] = useState({
    bankName: '',
    accountName: '',
    accountNumber: '',
    ifscCode: ''
  });
  const [dbSettings, setDbSettings] = useState({
    payout_config: JSON.stringify(defaultPayoutConfig),
  });
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('leopayAdminSettings');
    return saved ? JSON.parse(saved) : defaultLocalSettings;
  });

  const parsedConfig = (() => {
    try {
      return JSON.parse(dbSettings.payout_config);
    } catch (e) {
      return defaultPayoutConfig;
    }
  })();

  const updateConfig = (newConfig) => {
    setDbSettings({ ...dbSettings, payout_config: JSON.stringify(newConfig) });
  };

  useEffect(() => {
    const fetchSettings = async () => {
      const authToken = sessionStorage.getItem('authToken');
      try {
        const res = await fetch(`${API_BASE}/settings`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setDbSettings({
            payout_config: data.payout_config || JSON.stringify(defaultPayoutConfig),
          });
          const featureKeys = Object.keys(data).filter((key) => key.startsWith('feature_access_'));
          const featureMap = {};
          featureKeys.forEach((key) => {
            const userId = key.replace('feature_access_', '');
            try {
              featureMap[userId] = JSON.parse(data[key]);
            } catch {
              featureMap[userId] = [];
            }
          });
          setFeatureAccessMap(featureMap);
        }
      } catch (err) {
        console.error('Failed to load DB settings', err);
      }
    };

    fetchSettings();
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      const authToken = sessionStorage.getItem('authToken');
      try {
        const res = await fetch(`${API_BASE}/users/all`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          const eligibleUsers = Array.isArray(data)
            ? data.filter((item) => item.role !== 'admin')
            : [];
          setAllUsers(eligibleUsers);
          if (!selectedFeatureUserId && eligibleUsers.length > 0) {
            setSelectedFeatureUserId(eligibleUsers[0].userId || eligibleUsers[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load users for feature access', err);
      }
    };

    if (user?.role === 'admin') {
      fetchUsers();
    }
  }, [user?.role, selectedFeatureUserId]);

  const handleSave = async () => {
    localStorage.setItem('leopayAdminSettings', JSON.stringify(settings));
    const authToken = sessionStorage.getItem('authToken');
    try {
      const featureSettingsPayload = Object.entries(featureAccessMap).reduce((acc, [userId, features]) => {
        acc[`feature_access_${userId}`] = JSON.stringify(features);
        return acc;
      }, {});
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ ...dbSettings, ...featureSettingsPayload }),
      });
      if (res.ok) {
        success('Settings saved successfully.');
      } else {
        error('Failed to save some system settings.');
      }
    } catch (err) {
      console.error(err);
      error('Error saving settings to network.');
    }
  };

  const handleAddBank = async () => {
    if (!newBank.bankName) {
        error('Bank Name is required.');
        return;
    }
    const res = await addBankAccount(newBank);
    if (res.success) {
        success('Bank account added.');
        setNewBank({ bankName: '', accountName: '', accountNumber: '', ifscCode: '' });
    } else {
        error(res.error || 'Failed to add bank account.');
    }
  };

  const handleDeleteBank = async (id) => {
    if (window.confirm("Remove this bank account?")) {
        await deleteBankAccount(id);
        success('Bank account removed.');
    }
  };

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

  // Profile state
  const [profileName, setProfileName] = useState(user?.name || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleUpdateName = async () => {
    if (!profileName.trim()) { error('Name cannot be empty.'); return; }
    setIsSavingProfile(true);
    const token = sessionStorage.getItem('authToken');
    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fullName: profileName.trim() }),
      });
      if (res.ok) {
        success('Name updated successfully.');
      } else {
        const data = await res.json();
        error(data.error || 'Failed to update name.');
      }
    } catch (err) {
      error('Error updating name.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      error('Passwords do not match.');
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
        success('Password changed successfully.');
        setPasswords({ current: '', new: '', confirm: '' });
      } else {
        const data = await res.json();
        error(data.error || 'Failed to change password.');
      }
    } catch (err) {
      error('Error updating password.');
    }
  };

  const handleUpdateTpin = async () => {
    if (tpinForm.tpin.trim().length < 4) {
      error('Transaction PIN must be at least 4 digits.');
      return;
    }
    if (tpinForm.tpin !== tpinForm.confirmTpin) {
      error('Transaction PIN values do not match.');
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
        success('Transaction PIN updated successfully.');
        setTpinForm({ tpin: '', confirmTpin: '' });
        setTpinEditable({ tpin: false, confirmTpin: false });
      } else {
        const data = await res.json();
        error(data.error || 'Failed to update transaction PIN.');
      }
    } catch (err) {
      error('Error updating transaction PIN.');
    }
  };

  const handleReset = () => {
    setSettings(defaultLocalSettings);
    setDbSettings({ payout_config: JSON.stringify(defaultPayoutConfig) });
  };

  const selectedFeatureUser = allUsers.find((item) => (item.userId || item.id) === selectedFeatureUserId) || null;
  const selectedFeatureOptions = featureOptionsByRole[selectedFeatureUser?.role] || [];
  const selectedFeatureValues = featureAccessMap[selectedFeatureUserId] || selectedFeatureOptions.map((item) => item.key);

  const toggleFeatureAccess = (featureKey, enabled) => {
    if (!selectedFeatureUserId) return;
    setFeatureAccessMap((prev) => {
      const current = prev[selectedFeatureUserId] || selectedFeatureOptions.map((item) => item.key);
      const next = enabled
        ? Array.from(new Set([...current, featureKey]))
        : current.filter((item) => item !== featureKey);
      return {
        ...prev,
        [selectedFeatureUserId]: next,
      };
    });
  };

  const setAllFeatureAccess = (enabled) => {
    if (!selectedFeatureUserId) return;
    setFeatureAccessMap((prev) => ({
      ...prev,
      [selectedFeatureUserId]: enabled ? selectedFeatureOptions.map((item) => item.key) : [],
    }));
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: 'PR' },
    { id: 'banks', label: 'Bank Accounts', icon: 'BA' },
    { id: 'notifications', label: 'Notifications', icon: 'NT' },
    { id: 'security', label: 'Security', icon: 'SC' },
    ...(user?.role === 'admin' ? [{ id: 'features', label: 'Feature Access', icon: 'FA' }] : []),
  ];

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="dashboard-body animated">
          <div className="settings-header">
            <div className="text-section">
              <h2>System Settings</h2>
              <p>Configure platform preferences, security, and settlement accounts.</p>
            </div>
          </div>

          <div className="settings-grid">
            <div className="settings-nav-sidebar">
              <div className="settings-nav-card card">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`setting-tab-item ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <span className="tab-icon">{tab.icon}</span>
                    <span className="tab-label">{tab.label}</span>
                    {activeTab === tab.id && <span className="active-indicator"></span>}
                  </button>
                ))}
              </div>

              <div className="settings-info-box">
                <h4>Settlements Info</h4>
                <p>Whitelisted accounts are used for manual and automated payouts.</p>
                <button className="docs-link-btn" onClick={() => navigate('/admin/settlements')}>Manage Settlements</button>
              </div>
            </div>

            <div className="settings-main-portal">
              {activeTab === 'profile' && (
                <div className="portal-card card animated-fade-in">
                  <div className="portal-header">
                    <h3>Profile</h3>
                    <p>Update your display name and account details.</p>
                  </div>
                  <div className="portal-content">
                    <div className="form-grid-v2">
                      <div className="form-group-v2 full-width">
                        <label>Display Name</label>
                        <div className="profile-header-info" style={{ marginBottom: '8px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                           <span style={{ color: 'var(--text-mute)', fontSize: '13px' }}>Current: </span>
                           <strong style={{ color: 'var(--text-h)', fontSize: '15px' }}>{user?.name || 'Not set'}</strong>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <input
                            type="text"
                            className="premium-input"
                            placeholder="Enter new display name"
                            value={profileName}
                            onChange={e => setProfileName(e.target.value)}
                          />
                          <button
                            className="settings-save-btn"
                            onClick={handleUpdateName}
                            disabled={isSavingProfile}
                            style={{ padding: '0 24px', height: '48px', whiteSpace: 'nowrap' }}
                          >
                            {isSavingProfile ? 'Saving...' : 'Update Name'}
                          </button>
                        </div>
                      </div>

                      <div className="form-group-v2">
                        <label>Email Address</label>
                        <input
                          type="text"
                          className="premium-input payout-readonly-input"
                          value={user?.email || ''}
                          disabled
                        />
                        <p className="settings-helper-text">Email cannot be changed.</p>
                      </div>

                      <div className="form-group-v2">
                        <label>User Role</label>
                        <input
                          type="text"
                          className="premium-input payout-readonly-input"
                          value={user?.role ? user.role.toUpperCase() : ''}
                          disabled
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'banks' && (
                <div className="portal-card card animated-fade-in">
                  <div className="portal-header">
                    <h3>Settlement Bank Accounts</h3>
                    <p>Manage whitelisted accounts where you receive your payouts and commissions.</p>
                  </div>
                  <div className="portal-content">
                    <div className="bank-list-v2">
                      {bankAccounts.length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🏦</div>
                          <p style={{ color: 'var(--text-mute)', fontSize: '14px' }}>No bank accounts linked to your profile.</p>
                        </div>
                      ) : (
                        bankAccounts.map(bank => (
                          <div key={bank.id} className="bank-item-v2">
                            <div className="bank-info-v2">
                              <div className="bank-name">{bank.bankName}</div>
                              <div className="bank-details">
                                {bank.accountNumber} <span style={{ opacity: 0.3, margin: '0 8px' }}>|</span> {bank.ifscCode}
                              </div>
                              <div className="holder-name">{bank.accountName}</div>
                            </div>
                            <button 
                              className="action-btn danger-btn" 
                              onClick={() => handleDeleteBank(bank.id)}
                            >
                              Remove
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="portal-divider"></div>

                    <div className="add-bank-form-v2">
                      <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Link New Account</h4>
                      <div className="form-row-grid">
                        <div className="form-group-v2">
                          <label>Bank Name</label>
                          <input 
                            type="text" 
                            className="premium-input" 
                            placeholder="e.g. State Bank of India"
                            value={newBank.bankName}
                            onChange={e => setNewBank({...newBank, bankName: e.target.value})}
                          />
                        </div>
                        <div className="form-group-v2">
                          <label>Account Holder Name</label>
                          <input 
                            type="text" 
                            className="premium-input" 
                            placeholder="As per bank records"
                            value={newBank.accountName}
                            onChange={e => setNewBank({...newBank, accountName: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="form-row-grid" style={{ marginTop: '16px' }}>
                        <div className="form-group-v2">
                          <label>Account Number</label>
                          <input 
                            type="text" 
                            className="premium-input" 
                            placeholder="Enter full account number"
                            value={newBank.accountNumber}
                            onChange={e => setNewBank({...newBank, accountNumber: e.target.value})}
                          />
                        </div>
                        <div className="form-group-v2">
                          <label>IFSC Code</label>
                          <input 
                            type="text" 
                            className="premium-input" 
                            placeholder="e.g. SBIN0001234"
                            value={newBank.ifscCode}
                            onChange={e => setNewBank({...newBank, ifscCode: e.target.value})}
                          />
                        </div>
                      </div>
                      <button 
                        className="premium-btn primary" 
                        onClick={handleAddBank}
                        style={{ marginTop: '24px', width: 'auto', padding: '12px 32px' }}
                      >
                        Add Bank Account
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="portal-card card animated-fade-in">
                  <div className="portal-header">
                    <h3>Notification Channels</h3>
                    <p>Control how and when you receive system alerts.</p>
                  </div>
                  <div className="portal-content">
                    <div className="option-list">
                      {[
                        { key: 'txnAlerts', label: 'Transaction Success Alerts', desc: 'Receive instant alerts for every processed payment.' },
                        { key: 'securityAlerts', label: 'Security and Login Alerts', desc: 'Get notified of new logins or suspicious activities.' },
                        { key: 'monthlyReports', label: 'Monthly Performance Reports', desc: 'Summary of volume, commission and growth.' },
                      ].map((item) => (
                        <div className="option-item" key={item.key}>
                          <div className="option-info">
                            <div className="option-label">{item.label}</div>
                            <div className="option-desc">{item.desc}</div>
                          </div>
                          <label className="premium-switch">
                            <input
                              type="checkbox"
                              checked={settings.notifications[item.key]}
                              onChange={(e) => setSettings({ ...settings, notifications: { ...settings.notifications, [item.key]: e.target.checked } })}
                            />
                            <span className="switch-slider"></span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="portal-card card animated-fade-in">
                  <div className="portal-header">
                    <h3>Account Security</h3>
                    <p>Protect your credentials and enable advanced guards.</p>
                  </div>
                  <div className="portal-content">
                    <div className="security-section">
                      <div className="form-group-v2">
                        <label>Current Password</label>
                        <input 
                          type="password" 
                          placeholder="Current password" 
                          className="premium-input" 
                          value={passwords.current}
                          onChange={e => setPasswords({...passwords, current: e.target.value})}
                        />
                      </div>
                      <div className="form-row-grid">
                        <div className="form-group-v2">
                          <label>New Password</label>
                          <input 
                            type="password" 
                            placeholder="Min 8 characters" 
                            className="premium-input" 
                            value={passwords.new}
                            onChange={e => setPasswords({...passwords, new: e.target.value})}
                          />
                        </div>
                        <div className="form-group-v2">
                          <label>Confirm Password</label>
                          <input 
                            type="password" 
                            placeholder="Repeat new password" 
                            className="premium-input" 
                            value={passwords.confirm}
                            onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                          />
                        </div>
                      </div>
                      <button className="premium-btn primary" onClick={handleChangePassword} style={{ marginTop: '20px', width: 'auto', padding: '12px 32px' }}>Update Password</button>
                    </div>

                    <div className="portal-divider"></div>

                    <div className="security-section">
                      <div className="portal-header" style={{ padding: 0, marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '18px', marginBottom: '6px' }}>Add or Change TPIN</h3>
                        <p>Use a transaction PIN to authorize secure payout actions.</p>
                      </div>
                      <div className="form-row-grid">
                        <div className="form-group-v2">
                          <label>New TPIN</label>
                          <input
                            type="password"
                            placeholder="Minimum 4 digits"
                            className="premium-input"
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
                            placeholder="Repeat TPIN"
                            className="premium-input"
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
                      <button className="premium-btn primary" onClick={handleUpdateTpin} style={{ marginTop: '20px', width: 'auto', padding: '12px 32px' }}>
                        Save TPIN
                      </button>
                    </div>

                    <div className="portal-divider"></div>

                    <div className="option-item">
                      <div className="option-info">
                        <div className="option-label">Two-Factor Authentication</div>
                        <div className="option-desc">Add an extra layer of security via mobile OTP.</div>
                      </div>
                      <label className="premium-switch">
                        <input type="checkbox" defaultChecked />
                        <span className="switch-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'features' && (
                <div className="portal-card card animated-fade-in">
                  <div className="portal-header">
                    <h3>User Feature Access</h3>
                    <p>Pause or restore sidebar features for individual users. Disabled features disappear from their sidebar and route access.</p>
                  </div>
                  <div className="portal-content">
                    <div className="form-group-v2 full-width" style={{ marginBottom: '20px' }}>
                      <label>Select User</label>
                      <select
                        className="premium-input"
                        value={selectedFeatureUserId}
                        onChange={(e) => setSelectedFeatureUserId(e.target.value)}
                      >
                        {allUsers.map((item) => (
                          <option key={item.userId || item.id} value={item.userId || item.id}>
                            {(item.fullName || item.email)} ({String(item.role || '').toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedFeatureUser ? (
                      <>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                          <button className="settings-save-btn" onClick={() => setAllFeatureAccess(true)}>
                            Enable All
                          </button>
                          <button className="settings-cancel-btn" onClick={() => setAllFeatureAccess(false)}>
                            Pause All
                          </button>
                        </div>

                        <div className="option-list">
                          {selectedFeatureOptions.map((item) => (
                            <div className="option-item" key={item.key}>
                              <div className="option-info">
                                <div className="option-label">{item.label}</div>
                                <div className="option-desc">
                                  {selectedFeatureValues.includes(item.key)
                                    ? 'Active: this feature is visible and accessible.'
                                    : 'Paused: this feature is hidden and blocked for the selected user.'}
                                </div>
                              </div>
                              <label className="premium-switch">
                                <input
                                  type="checkbox"
                                  checked={selectedFeatureValues.includes(item.key)}
                                  onChange={(e) => toggleFeatureAccess(item.key, e.target.checked)}
                                />
                                <span className="switch-slider"></span>
                              </label>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="settings-helper-text">No eligible users available.</p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'payouts' && (
                <div className="portal-card card animated-fade-in">
                  <div className="portal-header">
                    <h3>Merchant Payout Rules</h3>
                    <p>Configure how much merchants are charged for bank withdrawals based on the amount range.</p>
                  </div>
                  <div className="portal-content">
                    <div className="payout-config-block">
                      <label className="settings-section-label">Global Charge Mode</label>
                      <select
                        className="premium-select"
                        value={parsedConfig.type}
                        onChange={(e) => updateConfig({ ...parsedConfig, type: e.target.value })}
                      >
                        <option value="flat">Flat Fee (Rs)</option>
                        <option value="percentage">Percentage (%)</option>
                      </select>
                    </div>

                    <div className="payout-config-block payout-ranges-header-block">
                      <label className="settings-section-label">Charge Ranges</label>
                      <div className="payout-range-head">
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>From (Rs)</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>To (Rs)</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{parsedConfig.type === 'flat' ? 'Fee (Rs)' : 'Fee (%)'}</span>
                        <span></span>
                      </div>
                    </div>

                    <div className="payout-ranges-list">
                      {parsedConfig.ranges.map((range, index) => {
                        const autoMin = index === 0 ? 0 : (parsedConfig.ranges[index - 1].max + 1);
                        return (
                          <div key={index} className="payout-range-row">
                            <input type="number" className="premium-input payout-readonly-input" value={autoMin} readOnly />
                            <input
                              type="number"
                              className="premium-input"
                              placeholder="Max (Rs)"
                              min={autoMin + 1}
                              value={range.max || ''}
                              onChange={(e) => {
                                const val = Math.max(autoMin + 1, Number(e.target.value) || 0);
                                const newRanges = [...parsedConfig.ranges];
                                newRanges[index] = { ...newRanges[index], min: autoMin, max: val };
                                for (let i = index + 1; i < newRanges.length; i += 1) {
                                  const prevMax = newRanges[i - 1].max;
                                  newRanges[i] = { ...newRanges[i], min: prevMax + 1 };
                                  if (newRanges[i].max <= newRanges[i].min) {
                                    newRanges[i].max = newRanges[i].min + 1;
                                  }
                                }
                                updateConfig({ ...parsedConfig, ranges: newRanges });
                              }}
                            />
                            <input
                              type="number"
                              className="premium-input"
                              placeholder={parsedConfig.type === 'flat' ? 'e.g. 10' : 'e.g. 2'}
                              min={0}
                              value={range.value || ''}
                              onChange={(e) => {
                                const val = Math.max(0, Number(e.target.value) || 0);
                                const newRanges = [...parsedConfig.ranges];
                                newRanges[index] = { ...newRanges[index], value: val };
                                updateConfig({ ...parsedConfig, ranges: newRanges });
                              }}
                            />
                            <button
                              onClick={() => {
                                const newRanges = parsedConfig.ranges.filter((_, i) => i !== index);
                                updateConfig({ ...parsedConfig, ranges: newRanges });
                              }}
                              className="payout-delete-btn"
                            >
                              X
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => {
                        const lastMax = parsedConfig.ranges.length > 0
                          ? parsedConfig.ranges[parsedConfig.ranges.length - 1].max
                          : 0;
                        const newMin = lastMax + 1;
                        updateConfig({
                          ...parsedConfig,
                          ranges: [...parsedConfig.ranges, { min: newMin, max: newMin + 999, value: 0 }],
                        });
                      }}
                      className="payout-add-btn"
                    >
                      Add New Range
                    </button>

                    <div className="payout-default-block">
                      <label className="settings-section-label">Default Fee (if no range matches)</label>
                      <p className="settings-helper-text">Applied when the merchant withdrawal amount does not fall in any range above.</p>
                      <input
                        type="number"
                        className="premium-input payout-default-input"
                        min={0}
                        value={parsedConfig.default ?? ''}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          updateConfig({ ...parsedConfig, default: val });
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="portal-actions">
                <button className="settings-cancel-btn" onClick={handleReset}>Reset to Default</button>
                <button className="settings-save-btn" onClick={handleSave}>Apply Settings</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
