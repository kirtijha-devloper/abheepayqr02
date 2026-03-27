import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import './WalletPage.css';

const WalletPage = () => {
  const [activeTab, setActiveTab] = useState('All');
  const { user } = useAuth();
  const { wallet, walletHistory, addFunds, requestFunds, requestSettlement, bankAccounts, getSystemSetting } = useAppContext();
  
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutFee, setPayoutFee] = useState(0);
  const [payoutTotal, setPayoutTotal] = useState(0);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [chargeType, setChargeType] = useState('flat');
  const [chargeValue, setChargeValue] = useState(0);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [showFundModal, setShowFundModal] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [fundRemarks, setFundRemarks] = useState('');
  const [fundLoading, setFundLoading] = useState(false);

  const handleOpenPayout = async () => {
    if (bankAccounts.length === 0) {
        alert("Please add a bank account in Settings first.");
        return;
    }
    const configStr = await getSystemSetting('payout_config');
    let config = { type: 'flat', ranges: [], default: 0 };
    try {
        if (configStr) config = JSON.parse(configStr);
    } catch (e) {}
    
    setChargeType(config.type || 'flat');
    // We'll store the whole ranges array in a temporary state if needed, 
    // but for the preview we just need to re-calculate based on the amount.
    // Let's just store the config itself for easier use in useEffect.
    setChargeValue(config); 
    setShowPayoutModal(true);
  };

  useEffect(() => {
    const amt = Number(payoutAmount) || 0;
    let fee = 0;
    const config = chargeValue && typeof chargeValue === 'object' ? chargeValue : { ranges: [], default: 0, type: 'flat' };
    
    const applicableRange = config.ranges?.find(r => amt >= r.min && amt <= r.max);
    
    if (applicableRange) {
      fee = config.type === 'percentage' ? amt * (applicableRange.value / 100) : applicableRange.value;
    } else {
      fee = amt > 0 ? (config.type === 'percentage' ? amt * (config.default / 100) : config.default) : 0;
    }
    
    setPayoutFee(fee);
    setPayoutTotal(amt + fee);
  }, [payoutAmount, chargeValue]);

  const handleConfirmPayout = async () => {
    if (!payoutAmount || Number(payoutAmount) <= 0) return alert("Enter valid amount");
    if (!selectedBankId) return alert("Please select a bank account");
    if (payoutTotal > wallet.balance) return alert("Insufficient wallet balance");

    setPayoutLoading(true);
    const res = await requestSettlement(payoutAmount, selectedBankId);
    setPayoutLoading(false);

    if (res.success) {
      alert("Settlement request submitted successfully! Funds are on hold pending approval.");
      setShowPayoutModal(false);
      setPayoutAmount('');
    } else {
      alert(res.error || "Request failed");
    }
  };

  const handleConfirmFundRequest = async () => {
    if (!fundAmount || Number(fundAmount) <= 0) return alert("Enter valid amount");
    setFundLoading(true);
    const res = await requestFunds(fundAmount, fundRemarks);
    setFundLoading(true);
    if (res.success) {
      alert("Fund request submitted! Please deposit the amount to the company bank account. Your wallet will be credited once admin approves.");
      setShowFundModal(false);
      setFundAmount('');
      setFundRemarks('');
    } else {
      alert(res.error || "Request failed");
    }
    setFundLoading(false);
  };

  const filteredTransactions = (walletHistory || []).filter(t => {
      if (!t) return false;
      if (activeTab === 'All') return true;
      const isDebit = Number(t.amount) < 0;
      if (activeTab === 'Debit') return isDebit;
      if (activeTab === 'Credit') return !isDebit;
      return true;
  });

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="dashboard-body animated">
          <div className="wallet-header-section">
            <div className="text-section">
              <h2>Wallet & Settlements</h2>
              <p>Manage your funds and request manual settlements.</p>
            </div>
          </div>

          <div className="wallet-balance-card">
            <div className="balance-info-wrapper">
              <div className="balance-label">CURRENT BALANCE</div>
              <div className="balance-value">₹ {(Number(wallet?.balance) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
              <div className="balance-stats-row">
                <div className="stat-badge">
                  <span className="stat-label">Currency:</span>
                  <span className="stat-value">{wallet?.currency || 'INR'}</span>
                </div>
                <div className="stat-badge">
                  <span className="stat-label">Status:</span>
                  <span className="stat-value" style={{color: 'var(--success)'}}>Active</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {/* Only show Settlement for Merchants */}
              {user?.role !== 'admin' && (
                <>
                  <button 
                    className="request-funds-btn" 
                    onClick={() => setShowFundModal(true)}
                    style={{ background: 'var(--primary)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 24px', borderRadius: '12px', color: '#fff', fontWeight: '600' }}
                  >
                    <span>➕</span> Add Money
                  </button>
                  <button 
                    className="request-funds-btn" 
                    onClick={handleOpenPayout}
                    style={{ background: 'var(--success)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 24px', borderRadius: '12px', color: '#fff', fontWeight: '600' }}
                  >
                    <span>💸</span> Request Settlement
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Payout Modal */}
          {showPayoutModal && (
            <div className="modal-overlay" style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
              padding: '20px'
            }}>
              <div className="payout-modal card animated-scale-up" style={{
                width: '100%', maxWidth: '420px', background: '#0f172a', 
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px',
                padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '20px' }}>Withdraw Funds</h3>
                  <button onClick={() => setShowPayoutModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
                </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Select Bank Account</label>
                    <select 
                      value={selectedBankId}
                      onChange={e => setSelectedBankId(e.target.value)}
                      style={{
                        width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px', padding: '12px', color: '#fff', fontSize: '14px'
                      }}
                    >
                      <option value="">-- Choose Account --</option>
                      {bankAccounts.map(b => (
                        <option key={b.id} value={b.id}>{b.bankName} - {b.accountNumber}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Amount to Request (₹)</label>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      value={payoutAmount}
                      onChange={e => setPayoutAmount(e.target.value)}
                      style={{
                        width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px', padding: '16px', color: '#fff', fontSize: '24px', fontWeight: '700'
                      }}
                    />
                  </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '14px' }}>Admin Fee ({chargeType === 'flat' ? `₹${chargeValue} flat` : `${chargeValue}%`})</span>
                    <span style={{ color: '#ef4444', fontWeight: '600' }}>+ ₹{payoutFee.toFixed(2)}</span>
                  </div>
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', marginBottom: '12px' }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#fff', fontWeight: '600' }}>Total Deduction</span>
                    <span style={{ color: '#fff', fontWeight: '800', fontSize: '18px' }}>₹{payoutTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    onClick={() => setShowPayoutModal(false)}
                    style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleConfirmPayout}
                    disabled={payoutLoading || !payoutAmount || payoutTotal > (Number(wallet?.balance) || 0)}
                    style={{ 
                      flex: 1, padding: '14px', borderRadius: '12px', border: 'none', 
                      background: 'var(--primary)', color: '#fff', fontWeight: '700', cursor: 'pointer',
                      opacity: (payoutLoading || !payoutAmount || payoutTotal > (Number(wallet?.balance) || 0)) ? 0.5 : 1
                    }}
                  >
                    {payoutLoading ? "Processing..." : "Confirm Payout"}
                  </button>
                </div>
                {payoutTotal > (Number(wallet?.balance) || 0) && (
                  <p style={{ color: '#ef4444', fontSize: '12px', textAlign: 'center', marginTop: '12px', margin: '12px 0 0 0' }}>
                    Insufficient balance for this payout.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Fund Request Modal */}
          {showFundModal && (
            <div className="modal-overlay" style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
              padding: '20px'
            }}>
              <div className="payout-modal card animated-scale-up" style={{
                width: '100%', maxWidth: '420px', background: '#0f172a', 
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px',
                padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '20px' }}>Add Funds to Wallet</h3>
                  <button onClick={() => setShowFundModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Amount to Add (₹)</label>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    value={fundAmount}
                    onChange={e => setFundAmount(e.target.value)}
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px', padding: '16px', color: '#fff', fontSize: '24px', fontWeight: '700'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Remarks (UTR / Ref No.)</label>
                  <textarea 
                    placeholder="Enter payment details..."
                    value={fundRemarks}
                    onChange={e => setFundRemarks(e.target.value)}
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px', padding: '12px', color: '#fff', fontSize: '14px', minHeight: '80px', resize: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    onClick={() => setShowFundModal(false)}
                    style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleConfirmFundRequest}
                    disabled={fundLoading || !fundAmount}
                    style={{ 
                      flex: 1, padding: '14px', borderRadius: '12px', border: 'none', 
                      background: 'var(--primary)', color: '#fff', fontWeight: '700', cursor: 'pointer',
                      opacity: (fundLoading || !fundAmount) ? 0.5 : 1
                    }}
                  >
                    {fundLoading ? "Requesting..." : "Submit Request"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="wallet-history-section card">
            <div className="history-toolbar">
              <h3 className="history-title">Funds Movement History</h3>
              <div className="txn-filters">
                {['All', 'Debit', 'Credit'].map(tab => (
                  <button 
                    key={tab} 
                    className={`txn-pill-filter ${activeTab === tab ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="table-responsive">
              <table className="wallet-table">
                <thead>
                  <tr>
                    <th>Entry Date</th>
                    <th>Record ID</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Balance Post Txn</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((item, idx) => (
                    <tr key={idx}>
                      <td className="date-cell">{new Date(item.createdAt).toLocaleString()}</td>
                      <td className="ref-cell">{item.id.substring(0, 12)}...</td>
                      <td>
                        <span className={`status-pill ${item.type ? item.type.toLowerCase() : ''}`}>
                          {(item.type || '').toUpperCase()}
                        </span>
                      </td>
                      <td className={`amount-cell ${(item.type || '').toLowerCase()}`}>
                        {item.type === 'debit' || Number(item.amount) < 0 ? '-' : '+'}₹{Math.abs(Number(item.amount) || 0).toFixed(2)}
                      </td>
                      <td className="after-cell">₹ { (Number(item.toBalanceAfter) || 0).toFixed(2) }</td>
                      <td className="note-cell">{item.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
                        <div className="txn-table-footer">
               <span className="txn-count-text">Showing {filteredTransactions.length} of {walletHistory.length} records</span>
              <div className="pagination-v2">
                <button className="nav-btn-v2">Prev</button>
                <button className="nav-num-v2 active">1</button>
                <button className="nav-btn-v2">Next</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default WalletPage;
