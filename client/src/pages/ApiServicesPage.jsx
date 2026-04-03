import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAppContext } from '../context/AppContext';
import { copyTextToClipboard } from '../utils/clipboard';
import './DashboardPage.css';

const ApiServicesPage = () => {
  const { apiKeys, generateApiKey } = useAppContext();
  const [copied, setCopied] = useState(null);

  const handleCopy = async (value, label) => {
    const ok = await copyTextToClipboard(value);
    setCopied(ok ? label : 'Copy failed');
    window.setTimeout(() => setCopied(null), 1500);
  };

  const handleGenerate = () => {
    generateApiKey('sandbox');
    generateApiKey('production');
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Header title="API Services" />
        <main className="dashboard-body">
          <div className="card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>Developer API Keys</h2>
              <button className="btn-primary" type="button" onClick={handleGenerate}>Generate New Key</button>
            </div>

            {copied && (
              <div style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {copied === 'Copy failed' ? 'Copy failed. Please try again.' : `${copied} copied.`}
              </div>
            )}
            
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label>Sandbox API Key</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <input type="text" className="input-field" value={apiKeys?.sandbox || ''} readOnly />
                <button className="btn-secondary" type="button" onClick={() => handleCopy(apiKeys?.sandbox || '', 'Sandbox API key')}>Copy</button>
              </div>
            </div>

            <div className="form-group">
              <label>Production API Key</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <input type="text" className="input-field" value={apiKeys?.production || ''} readOnly />
                <button className="btn-secondary" type="button" onClick={() => handleCopy(apiKeys?.production || '', 'Production API key')}>Copy</button>
              </div>
            </div>
          </div>

          <div className="metrics-grid" style={{ marginTop: '2rem' }}>
             <div className="card" style={{ padding: '1.5rem' }}>
                <h3>Webhook Settings</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>Configure URLs to receive real-time payment notifications.</p>
                <button className="btn-secondary" style={{ marginTop: '1rem' }}>Configure Webhooks</button>
             </div>
             <div className="card" style={{ padding: '1.5rem' }}>
                <h3>API Documentation</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>Read our comprehensive guides and API reference.</p>
                <button className="btn-secondary" style={{ marginTop: '1rem' }}>View Docs</button>
             </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ApiServicesPage;
