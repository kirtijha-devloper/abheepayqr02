/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import './WalletPage.css';

const defaultPayoutConfig = { type: 'flat', ranges: [], default: 0 };
const defaultBranchXQuote = { amount: 0, charge: 0, netAmount: 0, walletRequired: 0 };

const WalletPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const { user } = useAuth();
  const { success, error, info } = useToast();
  const {
    wallet,
    walletHistory,
    requestFunds,
    requestSettlement,
    bankAccounts,
    getSystemSetting,
    getBranchXPayoutQuote,
    verifyBranchXBeneficiary,
    requestBranchXPayout
  } = useAppContext();

  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutMode, setPayoutMode] = useState('manual');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutFee, setPayoutFee] = useState(0);
  const [payoutTotal, setPayoutTotal] = useState(0);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutConfig, setPayoutConfig] = useState(defaultPayoutConfig);
  const [branchxQuote, setBranchxQuote] = useState(defaultBranchXQuote);
  const [branchxQuoteLoading, setBranchxQuoteLoading] = useState(false);
  const [branchxRemark, setBranchxRemark] = useState('');
  const [branchxTpin, setBranchxTpin] = useState('');
  const [branchxTpinEditable, setBranchxTpinEditable] = useState(false);
  const [branchxTransferMode, setBranchxTransferMode] = useState('IMPS');
  const [verifyingBeneficiary, setVerifyingBeneficiary] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [showFundModal, setShowFundModal] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [fundRemarks, setFundRemarks] = useState('');
  const [fundLoading, setFundLoading] = useState(false);
  const itemsPerPage = 10;

  const handleOpenPayout = async () => {
    if (bankAccounts.length === 0) {
      info('Please add a bank account in Settings first.');
      const settingsPath = user?.role === 'admin' || user?.role === 'staff'
        ? '/admin/settings'
        : user?.role === 'master'
          ? '/master/settings'
          : '/settings';
      navigate(settingsPath);
      return;
    }

    const configStr = await getSystemSetting('payout_config');
    let config = defaultPayoutConfig;
    try {
      if (configStr) config = JSON.parse(configStr);
    } catch {
      config = defaultPayoutConfig;
    }

    setPayoutConfig(config);
    setPayoutMode('manual');
    setSelectedBankId('');
    setPayoutAmount('');
    setBranchxQuote(defaultBranchXQuote);
    setBranchxRemark('');
    setBranchxTpin('');
    setBranchxTpinEditable(false);
    setBranchxTransferMode('IMPS');
    setShowPayoutModal(true);
  };

  const selectedBank = bankAccounts.find((bank) => bank.id === selectedBankId) || null;

  useEffect(() => {
    if (payoutMode !== 'manual') return;
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
  }, [payoutAmount, payoutConfig, payoutMode]);

  useEffect(() => {
    let cancelled = false;

    const loadQuote = async () => {
      if (payoutMode !== 'branchx') return;
      const amount = Number(payoutAmount) || 0;
      if (amount <= 0) {
        setBranchxQuote(defaultBranchXQuote);
        setPayoutFee(0);
        setPayoutTotal(0);
        return;
      }

      setBranchxQuoteLoading(true);
      const res = await getBranchXPayoutQuote(amount);
      if (cancelled) return;

      if (res.success) {
        const quote = res.data || defaultBranchXQuote;
        setBranchxQuote(quote);
        setPayoutFee(Number(quote.charge) || 0);
        setPayoutTotal(Number(quote.walletRequired) || 0);
      } else {
        setBranchxQuote(defaultBranchXQuote);
        setPayoutFee(0);
        setPayoutTotal(0);
      }
      setBranchxQuoteLoading(false);
    };

    loadQuote();

    return () => {
      cancelled = true;
    };
  }, [getBranchXPayoutQuote, payoutAmount, payoutMode]);

  const handleConfirmPayout = async () => {
    if (!payoutAmount || Number(payoutAmount) <= 0) return error('Enter a valid amount.');
    if (!selectedBankId) return error('Please select a bank account.');

    if (payoutMode === 'branchx') {
      if (!selectedBank?.isVerified) return error('Please verify this beneficiary before using BranchX payout.');
      if (!branchxTpin.trim()) return error('Enter your transaction PIN.');
      if (payoutTotal > Number(wallet?.eWalletBalance || 0)) return error('Insufficient payout wallet balance.');
      if (!window.confirm(`Confirm BranchX payout of Rs ${Number(payoutAmount).toFixed(2)} to ${selectedBank?.accountName || selectedBank?.bankName || 'this beneficiary'}?`)) {
        return;
      }

      setPayoutLoading(true);
      const res = await requestBranchXPayout({
        amount: Number(payoutAmount),
        beneficiaryId: selectedBankId,
        tpin: branchxTpin.trim(),
        confirmVerified: true,
        remark: branchxRemark,
        transferMode: branchxTransferMode
      });
      setPayoutLoading(false);

      if (res.success) {
        success('BranchX payout submitted successfully. Status is pending provider callback.');
        setShowPayoutModal(false);
        setPayoutAmount('');
        setSelectedBankId('');
        setBranchxRemark('');
        setBranchxTpin('');
        setBranchxTpinEditable(false);
        setBranchxQuote(defaultBranchXQuote);
      } else {
        error(res.error || 'BranchX payout failed.');
      }
      return;
    }

    const isAdmin = user?.role === 'admin';
    const checkBalance = isAdmin ? (wallet?.balance || 0) : (wallet?.eWalletBalance || 0);
    if (payoutTotal > Number(checkBalance)) return error(`Insufficient ${isAdmin ? 'wallet' : 'payout wallet'} balance.`);
    if (!window.confirm(`Confirm manual settlement request of Rs ${Number(payoutAmount).toFixed(2)} to ${selectedBank?.accountName || selectedBank?.bankName || 'this bank account'}?`)) {
      return;
    }

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

  const handleVerifyBeneficiary = async () => {
    if (!selectedBankId) return error('Please select a bank account first.');
    setVerifyingBeneficiary(true);
    const res = await verifyBranchXBeneficiary(selectedBankId);
    setVerifyingBeneficiary(false);

    if (res.success) {
      success('Beneficiary verified for BranchX payout.');
    } else {
      error(res.error || 'Beneficiary verification failed.');
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
              <p>Manage your funds, request manual settlements, or send BranchX payouts.</p>
            </div>
          </div>

          <div className="wallet-balance-card" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', background: 'transparent', padding: 0, boxShadow: 'none' }}>
            {/* Main Wallet */}
            <div className="balance-info-wrapper card" style={{ flex: 1, minWidth: '300px', padding: '24px', borderRadius: '16px', background: 'var(--bg-card-2)' }}>
              <div className="balance-label" style={{ color: 'var(--text-mute)', fontSize: '14px', fontWeight: '600' }}>{user?.role === 'admin' ? 'WALLET BALANCE' : 'MAIN WALLET BALANCE'}</div>
              <div className="balance-value" style={{ fontSize: '32px', fontWeight: '800', margin: '12px 0', color: 'var(--text-h)' }}>
                Rs {(Number(wallet?.balance) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="wallet-actions" style={{ marginTop: '20px' }}>
                {user?.role !== 'admin' && (
                  <button className="request-funds-btn" onClick={() => setShowFundModal(true)} style={{ width: '100%' }}>
                    Transfer to Payout Wallet
                  </button>
                )}
              </div>
            </div>

            {/* Payout Wallet (Only for non-admins) */}
            {user?.role !== 'admin' && (
              <div className="balance-info-wrapper card" style={{ flex: 1, minWidth: '300px', padding: '24px', borderRadius: '16px', background: 'var(--bg-card-2)' }}>
                <div className="balance-label" style={{ color: 'var(--text-mute)', fontSize: '14px', fontWeight: '600' }}>PAYOUT WALLET BALANCE</div>
                <div className="balance-value" style={{ fontSize: '32px', fontWeight: '800', margin: '12px 0', color: 'var(--text-h)' }}>
                  Rs {(Number(wallet?.eWalletBalance) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className="wallet-actions" style={{ marginTop: '20px' }}>
                  <button className="request-funds-btn request-settlement-btn" onClick={handleOpenPayout} style={{ width: '100%', background: 'var(--primary)' }}>
                    <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>💸</span> Payout Options
                  </button>
                </div>
              </div>
            )}
          </div>

          {showPayoutModal && (
            <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
              <div className="payout-modal card animated-scale-up" style={{ width: '100%', maxWidth: '420px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '24px', padding: '32px', boxShadow: 'var(--shadow-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h3 style={{ margin: 0, color: 'var(--text-h)', fontSize: '20px' }}>Payout Options</h3>
                  <button onClick={() => setShowPayoutModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-mute)', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                  <button
                    type="button"
                    onClick={() => setPayoutMode('manual')}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      border: payoutMode === 'manual' ? '1px solid var(--primary)' : '1px solid var(--border)',
                      background: payoutMode === 'manual' ? 'var(--primary-dim)' : 'var(--bg-input)',
                      color: 'var(--text-h)',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Manual Settlement
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayoutMode('branchx')}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      border: payoutMode === 'branchx' ? '1px solid var(--success)' : '1px solid var(--border)',
                      background: payoutMode === 'branchx' ? 'var(--success-bg)' : 'var(--bg-input)',
                      color: 'var(--text-h)',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    BranchX Payout
                  </button>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-mute)', marginBottom: '8px' }}>
                    {payoutMode === 'branchx' ? 'Select Beneficiary Account' : 'Select Bank Account'}
                  </label>
                  <select
                    value={selectedBankId}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', color: 'var(--text-h)', fontSize: '14px' }}
                  >
                    <option value="">-- Choose Account --</option>
                    {bankAccounts.map((bank) => (
                      <option key={bank.id} value={bank.id}>{bank.bankName} - {bank.accountNumber}</option>
                    ))}
                  </select>
                </div>

                {payoutMode === 'branchx' && selectedBank ? (
                  <div style={{ background: 'var(--bg-card-2)', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                      <div>
                        <div style={{ color: 'var(--text-h)', fontWeight: '700', marginBottom: '4px' }}>{selectedBank.accountName || selectedBank.bankName}</div>
                        <div style={{ color: 'var(--text-mute)', fontSize: '13px' }}>
                          Status: {selectedBank.isVerified ? 'Verified' : 'Not Verified'}
                        </div>
                      </div>
                      {!selectedBank.isVerified ? (
                        <button
                          type="button"
                          onClick={handleVerifyBeneficiary}
                          disabled={verifyingBeneficiary}
                          style={{ padding: '10px 14px', borderRadius: '10px', border: 'none', background: '#10b981', color: 'var(--text-h)', fontWeight: '700', cursor: 'pointer', opacity: verifyingBeneficiary ? 0.6 : 1 }}
                        >
                          {verifyingBeneficiary ? 'Verifying...' : 'Verify'}
                        </button>
                      ) : (
                        <span style={{ color: '#10b981', fontSize: '13px', fontWeight: '700' }}>Ready</span>
                      )}
                    </div>
                  </div>
                ) : null}

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-mute)', marginBottom: '8px' }}>
                    {payoutMode === 'branchx' ? 'Amount to Send (Rs)' : 'Amount to Request (Rs)'}
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', color: 'var(--text-h)', fontSize: '24px', fontWeight: '700' }}
                  />
                </div>

                {payoutMode === 'branchx' ? (
                  <>
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-mute)', marginBottom: '8px' }}>Transfer Mode</label>
                      <select
                        value={branchxTransferMode}
                        onChange={(e) => setBranchxTransferMode(e.target.value)}
                        style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', color: 'var(--text-h)', fontSize: '14px' }}
                      >
                        <option value="IMPS">IMPS</option>
                        <option value="NEFT">NEFT</option>
                        <option value="RTGS">RTGS</option>
                      </select>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-mute)', marginBottom: '8px' }}>Remark</label>
                      <input
                        type="text"
                        placeholder="Optional payout remark"
                        value={branchxRemark}
                        onChange={(e) => setBranchxRemark(e.target.value)}
                        style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', color: 'var(--text-h)', fontSize: '14px' }}
                      />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-mute)', marginBottom: '8px' }}>Transaction PIN</label>
                      <input
                        type="password"
                        placeholder="Enter TPIN"
                        value={branchxTpin}
                        onChange={(e) => setBranchxTpin(e.target.value)}
                        onFocus={() => setBranchxTpinEditable(true)}
                        autoComplete="new-password"
                        name="branchx_tpin_manual"
                        readOnly={!branchxTpinEditable}
                        data-lpignore="true"
                        data-1p-ignore="true"
                        style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', color: 'var(--text-h)', fontSize: '14px' }}
                      />
                    </div>
                  </>
                ) : null}

                <div style={{ background: 'var(--bg-card-2)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: 'var(--text-mute)', fontSize: '14px' }}>
                      {payoutMode === 'branchx' ? 'BranchX Charge' : 'Transfer Fee'}
                    </span>
                    <span style={{ color: '#10b981', fontWeight: '600' }}>Rs {payoutFee.toFixed(2)}</span>
                  </div>
                  {payoutMode === 'branchx' ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span style={{ color: 'var(--text-mute)', fontSize: '14px' }}>Net Transfer Amount</span>
                      <span style={{ color: 'var(--text-h)', fontWeight: '600' }}>
                        {branchxQuoteLoading ? 'Loading...' : `Rs ${(Number(branchxQuote.netAmount) || 0).toFixed(2)}`}
                      </span>
                    </div>
                  ) : null}
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', marginBottom: '12px' }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-h)', fontWeight: '600' }}>Total Deduction</span>
                    <span style={{ color: 'var(--text-h)', fontWeight: '800', fontSize: '18px' }}>Rs {payoutTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => setShowPayoutModal(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-h)', fontWeight: '600', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmPayout}
                    disabled={
                      payoutLoading ||
                      !payoutAmount ||
                      (
                        payoutMode === 'branchx'
                          ? !selectedBank?.isVerified || !branchxTpin || payoutTotal > Number(wallet?.eWalletBalance || 0) || branchxQuoteLoading
                          : payoutTotal > Number(user?.role === 'admin' ? (wallet?.balance || 0) : (wallet?.eWalletBalance || 0))
                      )
                    }
                    style={{
                      flex: 1,
                      padding: '14px',
                      borderRadius: '12px',
                      border: 'none',
                      background: 'var(--primary)',
                      color: 'var(--text-h)',
                      fontWeight: '700',
                      cursor: 'pointer',
                      opacity: (
                        payoutLoading ||
                        !payoutAmount ||
                        (
                          payoutMode === 'branchx'
                            ? !selectedBank?.isVerified || !branchxTpin || payoutTotal > Number(wallet?.eWalletBalance || 0) || branchxQuoteLoading
                            : payoutTotal > Number(user?.role === 'admin' ? (wallet?.balance || 0) : (wallet?.eWalletBalance || 0))
                        )
                      ) ? 0.5 : 1
                    }}
                  >
                    {payoutLoading ? 'Processing...' : payoutMode === 'branchx' ? 'Submit BranchX Payout' : 'Confirm Manual Settlement'}
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
              <div className="payout-modal card animated-scale-up" style={{ width: '100%', maxWidth: '420px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '24px', padding: '32px', boxShadow: 'var(--shadow-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h3 style={{ margin: 0, color: 'var(--text-h)', fontSize: '20px' }}>Transfer to Payout Wallet</h3>
                  <button onClick={() => setShowFundModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-mute)', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-mute)', marginBottom: '8px' }}>Amount to Transfer (Rs)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px', color: 'var(--text-h)', fontSize: '24px', fontWeight: '700' }}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-mute)', marginBottom: '8px' }}>Remarks (UTR / Ref No.)</label>
                  <textarea
                    placeholder="Enter payment details..."
                    value={fundRemarks}
                    onChange={(e) => setFundRemarks(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', color: 'var(--text-h)', fontSize: '14px', minHeight: '80px', resize: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => setShowFundModal(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-h)', fontWeight: '600', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmFundRequest}
                    disabled={fundLoading || !fundAmount}
                    style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: 'var(--primary)', color: 'var(--text-h)', fontWeight: '700', cursor: 'pointer', opacity: (fundLoading || !fundAmount) ? 0.5 : 1 }}
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
                      <td colSpan="7" className="wallet-empty-state">
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
