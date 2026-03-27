import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config';
import './AdminSettingsPage.css';

const AdminSettingsPage = () => {
    const { token } = useAuth(); // Need token if we do direct fetch, but let's just use standard fetch with sessionStorage
    const [activeTab, setActiveTab] = useState('general');
    
    // Remote settings state (from DB)
    const [dbSettings, setDbSettings] = useState({
        payout_config: JSON.stringify({
            type: 'flat',
            ranges: [{ min: 0, max: 1000, value: 10 }],
            default: 20
        })
    });

    const parsedConfig = (() => {
        try {
            return JSON.parse(dbSettings.payout_config);
        } catch (e) {
            return { type: 'flat', ranges: [], default: 0 };
        }
    })();

    const updateConfig = (newConfig) => {
        setDbSettings({ ...dbSettings, payout_config: JSON.stringify(newConfig) });
    };

    // Local UI settings state
    const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem('teleringAdminSettings');
        return saved ? JSON.parse(saved) : {
            appName: 'My Application',
            notifications: { txnAlerts: true, securityAlerts: true, monthlyReports: false }
        };
    });

    useEffect(() => {
        // Fetch DB settings
        const fetchSettings = async () => {
            const authToken = sessionStorage.getItem('authToken');
            try {
                const res = await fetch(`${API_BASE}/settings`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setDbSettings({
                        payout_config: data.payout_config || dbSettings.payout_config
                    });
                }
            } catch (err) {
                console.error("Failed to load DB settings", err);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        localStorage.setItem('teleringAdminSettings', JSON.stringify(settings));
        const authToken = sessionStorage.getItem('authToken');
        try {
            const res = await fetch(`${API_BASE}/settings`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}` 
                },
                body: JSON.stringify(dbSettings)
            });
            if (res.ok) {
                alert('Settings saved successfully!');
            } else {
                alert('Failed to save some system settings.');
            }
        } catch (err) {
            console.error(err);
            alert('Error saving settings to network.');
        }
    };

    const tabs = [
        { id: 'payouts', label: 'Payout Charges', icon: '💸' },
        { id: 'notifications', label: 'Notifications', icon: '🔔' },
        { id: 'security', label: 'Security', icon: '🛡️' },
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
              <p>Configure platform preferences, security, and integration hooks.</p>
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
                <h4>Need Help?</h4>
                <p>Read our documentation for advanced configuration guides.</p>
                <button className="docs-link-btn">View Documentation</button>
              </div>
            </div>

            <div className="settings-main-portal">
              {activeTab === 'general' && (
                <div className="portal-card card animated-fade-in">
                  <div className="portal-header">
                    <h3>General Preferences</h3>
                    <p>Core application identity and localization.</p>
                  </div>
                  <div className="portal-content">
                    <div className="form-grid-v2">
                      <div className="form-group-v2">
                        <label>Platform Name</label>
                        <input 
                          type="text" 
                          className="premium-input"
                          value={settings.appName} 
                          onChange={e => setSettings({...settings, appName: e.target.value})} 
                        />
                      </div>
                      <div className="form-group-v2">
                        <label>Default Language</label>
                        <select 
                          className="premium-select"
                          value={settings.language} 
                          onChange={e => setSettings({...settings, language: e.target.value})}
                        >
                          <option>English (US)</option>
                          <option>Hindi (India)</option>
                          <option>Spanish</option>
                        </select>
                      </div>
                      <div className="form-group-v2 full-width">
                        <label>System Timezone</label>
                        <select 
                          className="premium-select"
                          value={settings.timezone} 
                          onChange={e => setSettings({...settings, timezone: e.target.value})}
                        >
                          <option>IST (India Standard Time) - GMT+5:30</option>
                          <option>UTC (Coordinated Universal Time)</option>
                          <option>PST (Pacific Standard Time)</option>
                        </select>
                      </div>
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
                        { key: 'securityAlerts', label: 'Security & Login Alerts', desc: 'Get notified of new logins or suspicious activities.' },
                        { key: 'monthlyReports', label: 'Monthly Performance Reports', desc: 'Summary of volume, commission and growth.' }
                      ].map(item => (
                        <div className="option-item" key={item.key}>
                          <div className="option-info">
                            <div className="option-label">{item.label}</div>
                            <div className="option-desc">{item.desc}</div>
                          </div>
                          <label className="premium-switch">
                            <input 
                              type="checkbox" 
                              checked={settings.notifications[item.key]} 
                              onChange={e => setSettings({...settings, notifications: {...settings.notifications, [item.key]: e.target.checked}})} 
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
                        <input type="password" placeholder="••••••••" className="premium-input" />
                      </div>
                      <div className="form-row-grid">
                        <div className="form-group-v2">
                          <label>New Password</label>
                          <input type="password" placeholder="Min 8 characters" className="premium-input" />
                        </div>
                        <div className="form-group-v2">
                          <label>Confirm Password</label>
                          <input type="password" placeholder="Repeat new password" className="premium-input" />
                        </div>
                      </div>
                      <button className="action-link-btn">Update Password</button>
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

              {activeTab === 'payouts' && (
                <div className="portal-card card animated-fade-in">
                  <div className="portal-header">
                    <h3>Merchant Payout Rules</h3>
                    <p>Configure how much merchants are charged for bank withdrawals based on the amount range.</p>
                  </div>
                  <div className="portal-content">
                    <div style={{ marginBottom: '24px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Global Charge Mode</label>
                      <select 
                        className="premium-select"
                        value={parsedConfig.type} 
                        onChange={e => updateConfig({...parsedConfig, type: e.target.value})}
                      >
                        <option value="flat">Flat Fee (₹)</option>
                        <option value="percentage">Percentage (%)</option>
                      </select>
                    </div>

                    <div className="range-list">
                      <label style={{ display: 'block', marginBottom: '16px', fontWeight: 600 }}>Charge Ranges</label>
                      {parsedConfig.ranges.map((range, index) => (
                        <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
                          <input 
                            type="number" 
                            className="premium-input" 
                            placeholder="Min (₹)" 
                            value={range.min} 
                            onChange={e => {
                                const newRanges = [...parsedConfig.ranges];
                                newRanges[index].min = Number(e.target.value);
                                updateConfig({...parsedConfig, ranges: newRanges});
                            }}
                          />
                          <input 
                            type="number" 
                            className="premium-input" 
                            placeholder="Max (₹)" 
                            value={range.max} 
                            onChange={e => {
                                const newRanges = [...parsedConfig.ranges];
                                newRanges[index].max = Number(e.target.value);
                                updateConfig({...parsedConfig, ranges: newRanges});
                            }}
                          />
                          <input 
                            type="number" 
                            className="premium-input" 
                            placeholder={parsedConfig.type === 'flat' ? 'Fee (₹)' : 'Fee (%)'} 
                            value={range.value} 
                            onChange={e => {
                                const newRanges = [...parsedConfig.ranges];
                                newRanges[index].value = Number(e.target.value);
                                updateConfig({...parsedConfig, ranges: newRanges});
                            }}
                          />
                          <button 
                            className="icon-btn-danger" 
                            onClick={() => {
                                const newRanges = parsedConfig.ranges.filter((_, i) => i !== index);
                                updateConfig({...parsedConfig, ranges: newRanges});
                            }}
                            style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '8px', color: '#ef4444', cursor: 'pointer' }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button 
                        className="add-range-btn" 
                        onClick={() => updateConfig({...parsedConfig, ranges: [...parsedConfig.ranges, { min: 0, max: 0, value: 0 }]})}
                        style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(124,108,248,0.1)', border: '1px dashed var(--primary)', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', marginTop: '8px' }}
                      >
                        + Add New Range
                      </button>
                    </div>

                    <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Default Fee (if no range matches)</label>
                        <input 
                            type="number" 
                            className="premium-input" 
                            value={parsedConfig.default} 
                            onChange={e => updateConfig({...parsedConfig, default: Number(e.target.value)})}
                        />
                    </div>
                  </div>
                </div>
              )}

              {!['notifications', 'security', 'payouts'].includes(activeTab) && (
                <div className="portal-card card animated-fade-in">
                  <div className="empty-portal">
                    <h3>Coming Soon</h3>
                    <p>The {activeTab} settings module is currently under development.</p>
                  </div>
                </div>
              )}

              <div className="portal-actions">
                <button className="settings-cancel-btn">Reset to Default</button>
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
