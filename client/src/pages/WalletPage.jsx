import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import './WalletPage.css';

const defaultPayoutConfig = { type: 'flat', ranges: [], default: 0 };

const WalletPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const { user } = useAuth();
  const { success, error, info } = useToast();
  const { wallet, walletHistory, requestFunds, requestSettlement, bankAccounts, getSystemSetting } = useAppContext();

  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutFee, setPayoutFee] = useState(0);
  const [payoutTotal, setPayoutTotal] = useState(0);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutConfig, setPayoutConfig] = useState(defaultPayoutConfig);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [showFundModal, setShowFundModal] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [fundRemarks, setFundRemarks] = useState('');
  const [fundLoading, setFundLoading] = useState(false);
  const itemsPerPage = 10;

  const handleOpenPayout = async () => {
    if (bankAccounts.length === 0) {
      info('Please add a bank account in Settings first.');
      const settingsPath = (user?.role === 'admin' || user?.role === 'staff' || user?.role === 'master') ? '/admin/settings' : '/settings';
      navigate(settingsPath);
      return;
    }

    const configStr = await getSystemSetting('payout_config');
    let config = defaultPayoutConfig;
    try {
      if (configStr) config = JSON.parse(configStr);
    } catch (e) {
      config = defaultPayoutConfig;
    }

    setPayoutConfig(config);
    setSelectedBankId('');
    setPayoutAmount('');
    setShowPayoutModal(true);
  };

  useEffect(() => {
    const amount = Number(payoutAmount) || 0;
    const applicableRange = payoutConfig.ranges?.find((range) => amount >= range.min && amount <= range.max);

    let fee = 0;
    if (applicableRange) {
      fee = payoutConfig.type === 'percentage'
        ? amount * (applicableRange.value / 100)
        : applicableRange.value;
    } else if (amount > 0) {
      fee = payoutConfig.type === 'percentage'
        ? amount * ((payoutConfig.default || 0) / 100)
        : (payoutConfig.default || 0);
    }

    setPayoutFee(fee);
    setPayoutTotal(amount + fee);
  }, [payoutAmount, payoutConfig]);

  const chargeLabel = payoutConfig.type === 'percentage'
    ? `${payoutConfig.default || 0}% default`
    : `Rs ${payoutConfig.default || 0} default`;

  const handleConfirmPayout = async () => {
    if (!payoutAmount || Number(payoutAmount) <= 0) return error('Enter a valid amount.');
    if (!selectedBankId) return error('Please select a bank account.');
    const isAdmin = user?.role === 'admin';
    const checkBalance = isAdmin ? (wallet?.balance || 0) : (wallet?.eWalletBalance || 0);
    if (payoutTotal > Number(checkBalance)) return error(`Insufficient ${isAdmin ? 'wallet' : 'payout wallet'} balance.`);

    setPayoutLoading(true);
    const res = await requestSettlement(payoutAmount, selectedBankId);
    setPayoutLoading(false);

    if (res.success) {
      success('Settlement request submitted successfully. Funds are on hold pending approval.');
      setShowPayoutModal(false);
      setPayoutAmount('');
      setSelectedBankId('');
    } else {
      error(res.error || 'Settlement request failed.');
    }
  };

  const handleConfirmFundRequest = async () => {
    if (!fundAmount || Number(fundAmount) <= 0) return error('Enter a valid amount.');
    setFundLoading(true);
    const res = await requestFunds(fundAmount, fundRemarks);
    setFundLoading(false);

    if (res.success) {
      success('Fund request submitted. Your wallet will be credited once the admin approves it.');
      setShowFundModal(false);
      setFundAmount('');
      setFundRemarks('');
    } else {
      error(res.error || 'Fund request failed.');
    }
  };

  const filteredTransactions = (walletHistory || []).filter((item) => {
    if (!item) return false;
    if (activeTab === 'All') return true;
    const isDebit = Number(item.amount) < 0;
    if (activeTab === 'Debit') return isDebit;
    if (activeTab === 'Credit') return !isDebit;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / itemsPerPage));
  const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, walletHistory.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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

          <div className="wallet-balance-card" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', background: 'transparent', padding: 0, boxShadow: 'none' }}>
            {/* Main Wallet */}
            <div className="balance-info-wrapper card" style={{ flex: 1, minWidth: '300px', padding: '24px', borderRadius: '16px', background: 'linear-gradient(135deg, #1e293b, #0f172a)' }}>
              <div className="balance-label" style={{ color: '#94a3b8', fontSize: '14px', fontWeight: '600' }}>{user?.role === 'admin' ? 'WALLET BALANCE' : 'MAIN WALLET BALANCE'}</div>
              <div className="balance-value" style={{ fontSize: '32px', fontWeight: '800', margin: '12px 0', color: '#fff' }}>
                Rs {(Number(wallet?.balance) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="wallet-actions" style={{ marginTop: '20px' }}>
                {user?.role === 'admin' ? (
                  <button className="request-funds-btn request-settlement-btn" onClick={handleOpenPayout} style={{ width: '100%', background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                    <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>💸</span> Request Settlement (Bank)
                  </button>
                ) : (
                  <button className="request-funds-btn" onClick={() => setShowFundModal(true)} style={{ width: '100%' }}>
                    Transfer to Payout Wallet
                  </button>
                )}
              </div>
            </div>

            {/* Payout Wallet (Only for non-admins) */}
            {user?.role !== 'admin' && (
              <div className="balance-info-wrapper card" style={{ flex: 1, minWidth: '300px', padding: '24px', borderRadius: '16px', background: 'linear-gradient(135deg, #1e293b, #0f172a)' }}>
                <div className="balance-label" style={{ color: '#94a3b8', fontSize: '14px', fontWeight: '600' }}>PAYOUT WALLET BALANCE</div>
                <div className="balance-value" style={{ fontSize: '32px', fontWeight: '800', margin: '12px 0', color: '#fff' }}>
                  Rs {(Number(wallet?.eWalletBalance) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className="wallet-actions" style={{ marginTop: '20px' }}>
                  <button className="request-funds-btn request-settlement-btn" onClick={handleOpenPayout} style={{ width: '100%', background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                    <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>💸</span> Request Settlement (Bank)
                  </button>
                </div>
              </div>
            )}
          </div>

          {showPayoutModal && (
            <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
              <div className="payout-modal card animated-scale-up" style={{ width: '100%', maxWidth: '420px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '20px' }}>Withdraw Funds</h3>
                  <button onClick={() => setShowPayoutModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Select Bank Account</label>
                  <select
                    value={selectedBankId}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px', color: '#fff', fontSize: '14px' }}
                  >
                    <option value="">-- Choose Account --</option>
                    {bankAccounts.map((bank) => (
                      <option key={bank.id} value={bank.id}>{bank.bankName} - {bank.accountNumber}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Amount to Request (Rs)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px', color: '#fff', fontSize: '24px', fontWeight: '700' }}
                  />
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '14px' }}>Transfer Fee</span>
                    <span style={{ color: '#10b981', fontWeight: '600' }}>Free</span>
                  </div>
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', marginBottom: '12px' }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#fff', fontWeight: '600' }}>Total Deduction</span>
                    <span style={{ color: '#fff', fontWeight: '800', fontSize: '18px' }}>Rs {payoutTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => setShowPayoutModal(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', fontWeight: '600', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmPayout}
                    disabled={payoutLoading || !payoutAmount || payoutTotal > Number(user?.role === 'admin' ? (wallet?.balance || 0) : (wallet?.eWalletBalance || 0))}
                    style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: '700', cursor: 'pointer', opacity: (payoutLoading || !payoutAmount || payoutTotal > Number(user?.role === 'admin' ? (wallet?.balance || 0) : (wallet?.eWalletBalance || 0))) ? 0.5 : 1 }}
                  >
                    {payoutLoading ? 'Processing...' : 'Confirm Payout'}
                  </button>
                </div>
                {payoutTotal > Number(user?.role === 'admin' ? (wallet?.balance || 0) : (wallet?.eWalletBalance || 0)) && (
                  <p style={{ color: '#ef4444', fontSize: '12px', textAlign: 'center', margin: '12px 0 0 0' }}>
                    Insufficient balance for this payout.
                  </p>
                )}
              </div>
            </div>
          )}

          {showFundModal && (
            <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
              <div className="payout-modal card animated-scale-up" style={{ width: '100%', maxWidth: '420px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '20px' }}>Transfer to Payout Wallet</h3>
                  <button onClick={() => setShowFundModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Amount to Transfer (Rs)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px', color: '#fff', fontSize: '24px', fontWeight: '700' }}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Remarks (UTR / Ref No.)</label>
                  <textarea
                    placeholder="Enter payment details..."
                    value={fundRemarks}
                    onChange={(e) => setFundRemarks(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px', color: '#fff', fontSize: '14px', minHeight: '80px', resize: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => setShowFundModal(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', fontWeight: '600', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmFundRequest}
                    disabled={fundLoading || !fundAmount}
                    style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: '700', cursor: 'pointer', opacity: (fundLoading || !fundAmount) ? 0.5 : 1 }}
                  >
                    {fundLoading ? 'Requesting...' : 'Submit Request'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="wallet-history-section card">
            <div className="history-toolbar">
              <h3 className="history-title">Funds Movement History</h3>
              <div className="wallet-filter-group">
                {['All', 'Debit', 'Credit'].map((tab) => (
                  <button
                    key={tab}
                    className={`wallet-filter-btn ${activeTab === tab ? 'active' : ''}`}
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
                    <th>Wallet</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Balance Post Txn</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map((item, idx) => (
                    <tr key={idx}>
                      <td className="date-cell">{new Date(item.createdAt).toLocaleString()}</td>
                      <td className="ref-cell">{item.id.substring(0, 12)}...</td>
                      <td>
                        <span className={`status-pill ${['transfer_credit', 'payout', 'payout_refund'].includes(item.type) ? 'payout-wallet' : 'main-wallet'}`}>
                          {['transfer_credit', 'payout', 'payout_refund'].includes(item.type) ? 'Payout' : 'Main'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${item.type ? item.type.toLowerCase() : ''}`}>
                          {(item.type || '').toUpperCase().replace('_', ' ')}
                        </span>
                      </td>
                      <td className={`amount-cell ${(item.type || '').toLowerCase()}`}>
                        {item.type === 'debit' || Number(item.amount) < 0 ? '-' : '+'}Rs {Math.abs(Number(item.amount) || 0).toFixed(2)}
                      </td>
                      <td className="after-cell">Rs {(Number(item.toBalanceAfter) || 0).toFixed(2)}</td>
                      <td className="note-cell">{item.description || 'No note'}</td>
                    </tr>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan="6" className="wallet-empty-state">
                        No wallet records found for this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="txn-table-footer">
              <span className="txn-count-text">Showing {paginatedTransactions.length} of {filteredTransactions.length} records</span>
              <div className="pagination-v2">
                <button className="nav-btn-v2" type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>Prev</button>
                <button className="nav-num-v2 active" type="button">{currentPage}</button>
                <button className="nav-btn-v2" type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages || filteredTransactions.length === 0}>Next</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default WalletPage;
