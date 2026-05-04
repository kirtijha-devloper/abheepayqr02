import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { API_BASE } from '../config';
import { useToast } from '../context/ToastContext';
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

const AdminSettingsPage = () => {
  const navigate = useNavigate();
  const { success, error } = useToast();
  const [activeTab, setActiveTab] = useState('payouts');
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
        }
      } catch (err) {
        console.error('Failed to load DB settings', err);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    localStorage.setItem('leopayAdminSettings', JSON.stringify(settings));
    const authToken = sessionStorage.getItem('authToken');
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(dbSettings),
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

  const handleReset = () => {
    setSettings(defaultLocalSettings);
    setDbSettings({ payout_config: JSON.stringify(defaultPayoutConfig) });
  };

  const tabs = [
    { id: 'payouts', label: 'Payout Charges', icon: 'PC' },
    { id: 'notifications', label: 'Notifications', icon: 'NT' },
    { id: 'security', label: 'Security', icon: 'SC' },
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
                <button className="docs-link-btn" onClick={() => navigate('/docs')}>View Documentation</button>
              </div>
            </div>

            <div className="settings-main-portal">
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
                        <input type="password" placeholder="Current password" className="premium-input" />
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
