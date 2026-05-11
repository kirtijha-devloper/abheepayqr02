import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import TpinModal from '../components/TpinModal';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import './BeneficiariesPage.css';

const defaultQuote = { amount: 0, charge: 0, netAmount: 0, walletRequired: 0 };
const initialForm = { bankName: '', accountName: '', accountNumber: '', ifscCode: '' };

const formatCurrency = (value) =>
  `Rs ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const maskAccount = (value) => {
  const digits = String(value || '').trim();
  if (!digits) return '--';
  if (digits.length <= 4) return digits;
  return `${'•'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
};

const formatDateTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString();
};

const BeneficiariesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error } = useToast();
  const {
    wallet,
    bankAccounts,
    addBankAccount,
    updateBankAccount,
    deleteBankAccount,
    verifyBranchXBeneficiary,
    getBranchXPayoutQuote,
    requestBranchXPayout,
  } = useAppContext();

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [formLoading, setFormLoading] = useState(false);

  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [selectedBank, setSelectedBank] = useState(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [branchxRemark, setBranchxRemark] = useState('');
  const [branchxTpin, setBranchxTpin] = useState('');
  const [branchxTpinEditable, setBranchxTpinEditable] = useState(false);
  const [branchxTransferMode, setBranchxTransferMode] = useState('IMPS');
  const [verifyingId, setVerifyingId] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quote, setQuote] = useState(defaultQuote);
  const [search, setSearch] = useState('');
  const [showTpinModal, setShowTpinModal] = useState(false);

  const routePrefix = user?.role === 'master' ? '/master' : '';

  const filteredAccounts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return bankAccounts;

    return bankAccounts.filter((item) =>
      [
        item.bankName,
        item.accountName,
        item.accountNumber,
        item.ifscCode,
        item.providerRef,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    );
  }, [bankAccounts, search]);

  const summary = useMemo(() => {
    const total = bankAccounts.length;
    const verified = bankAccounts.filter((item) => item.isVerified).length;
    const pending = total - verified;
    return { total, verified, pending };
  }, [bankAccounts]);

  const resetForm = () => {
    setEditingBank(null);
    setFormData(initialForm);
    setShowFormModal(false);
  };

  const openAddModal = () => {
    setEditingBank(null);
    setFormData(initialForm);
    setShowFormModal(true);
  };

  const openEditModal = (bank) => {
    setEditingBank(bank);
    setFormData({
      bankName: bank.bankName || '',
      accountName: bank.accountName || '',
      accountNumber: bank.accountNumber || '',
      ifscCode: bank.ifscCode || '',
    });
    setShowFormModal(true);
  };

  const handleSaveBeneficiary = async () => {
    if (!formData.bankName.trim() || !formData.accountName.trim() || !formData.accountNumber.trim() || !formData.ifscCode.trim()) {
      error('Please fill all beneficiary details.');
      return;
    }

    setFormLoading(true);
    const payload = {
      bankName: formData.bankName.trim(),
      accountName: formData.accountName.trim(),
      accountNumber: formData.accountNumber.trim(),
      ifscCode: formData.ifscCode.trim().toUpperCase(),
    };

    const res = editingBank
      ? await updateBankAccount(editingBank.id, payload)
      : await addBankAccount(payload);

    setFormLoading(false);

    if (res.success) {
      success(editingBank ? 'Beneficiary updated successfully.' : 'Beneficiary added successfully.');
      resetForm();
      return;
    }

    error(res.error || 'Unable to save beneficiary.');
  };

  const handleDeleteBeneficiary = async (bank) => {
    if (!window.confirm(`Delete beneficiary ${bank.accountName || bank.bankName}?`)) return;
    await deleteBankAccount(bank.id);
    success('Beneficiary deleted.');
  };

  const handleVerifyBeneficiary = async (bank) => {
    setVerifyingId(bank.id);
    const res = await verifyBranchXBeneficiary(bank.id);
    setVerifyingId('');

    if (res.success) {
      success('Beneficiary verified successfully.');
      if (selectedBank?.id === bank.id) {
        setSelectedBank(res.data || { ...bank, isVerified: true });
      }
      return;
    }

    error(res.error || 'Beneficiary verification failed.');
  };

  const openPayoutModal = (bank) => {
    setSelectedBank(bank);
    setPayoutAmount('');
    setBranchxRemark('');
    setBranchxTpin('');
    setBranchxTpinEditable(false);
    setBranchxTransferMode('IMPS');
    setQuote(defaultQuote);
    setShowPayoutModal(true);
  };

  const closePayoutModal = () => {
    setShowPayoutModal(false);
    setSelectedBank(null);
    setPayoutAmount('');
    setBranchxRemark('');
    setBranchxTpin('');
    setBranchxTpinEditable(false);
    setBranchxTransferMode('IMPS');
    setQuote(defaultQuote);
    setQuoteLoading(false);
  };

  const handleAmountBlur = async () => {
    const amount = Number(payoutAmount) || 0;
    if (!amount) {
      setQuote(defaultQuote);
      return;
    }

    setQuoteLoading(true);
    const res = await getBranchXPayoutQuote(amount);
    setQuoteLoading(false);

    if (res.success) {
      setQuote(res.data || defaultQuote);
    } else {
      setQuote(defaultQuote);
      error(res.error || 'Unable to fetch payout quote.');
    }
  };

  const handleSubmitPayout = async () => {
    const amount = Number(payoutAmount) || 0;
    if (!selectedBank) return error('Please choose a beneficiary.');
    if (amount <= 0) return error('Enter a valid payout amount.');
    if (!selectedBank.isVerified) return error('Please verify this beneficiary first.');
    if (!branchxTpin.trim()) return error('Enter your transaction PIN.');
    if ((Number(quote.walletRequired) || 0) > Number(wallet?.eWalletBalance || 0)) {
      return error('Insufficient payout wallet balance.');
    }

    if (!window.confirm(`Confirm payout of ${formatCurrency(amount)} to ${selectedBank.accountName || selectedBank.bankName}?`)) {
      return;
    }

    setPayoutLoading(true);
    const res = await requestBranchXPayout({
      amount,
      beneficiaryId: selectedBank.id,
      tpin: branchxTpin.trim(),
      confirmVerified: true,
      remark: branchxRemark.trim(),
      transferMode: branchxTransferMode,
    });
    setPayoutLoading(false);

    if (res.success) {
      success('Payout submitted successfully. Provider callback is pending.');
      closePayoutModal();
      return;
    }

    error(res.error || 'Payout request failed.');
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="dashboard-body animated">
          <section className="beneficiary-topbar">
            <div className="beneficiary-topbar-search">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by beneficiary, account, IFSC, bank"
              />
            </div>
            <div className="beneficiary-topbar-actions">
              <button type="button" className="beneficiary-secondary-btn" onClick={() => navigate(`${routePrefix}/wallet`)}>
                Back To Wallet
              </button>
              <button type="button" className="beneficiary-secondary-btn" onClick={() => setShowTpinModal(true)}>
                Generate T-PIN
              </button>
              <button type="button" className="beneficiary-primary-btn" onClick={openAddModal}>
                + Add Beneficiary
              </button>
            </div>
          </section>

          <section className="beneficiary-hero card">
            <div>
              <div className="beneficiary-heading-row">
                <h2>Payout Beneficiaries</h2>
                <span className="beneficiary-wallet-chip">Payout Wallet: {formatCurrency(wallet?.eWalletBalance || 0)}</span>
              </div>
              <p>Manage saved beneficiaries, verify them for BranchX, and start payouts directly from this page.</p>
            </div>
            <div className="beneficiary-balance-grid">
              <div className="beneficiary-balance-card">
                <span>Wallet Balance</span>
                <strong>{formatCurrency(wallet?.balance || 0)}</strong>
              </div>
              <div className="beneficiary-balance-card">
                <span>Payout Wallet</span>
                <strong>{formatCurrency(wallet?.eWalletBalance || 0)}</strong>
              </div>
              <div className="beneficiary-balance-card">
                <span>Total Balance</span>
                <strong>{formatCurrency((Number(wallet?.balance || 0) + Number(wallet?.eWalletBalance || 0)))}</strong>
              </div>
            </div>
          </section>

          <section className="beneficiary-tpin-note">
            <strong>T-PIN note:</strong> Use the Generate T-PIN button to create or update your payout PIN before making any payout transfer.
          </section>

          <section className="beneficiary-stats">
            <div className="beneficiary-stat card">
              <span>Total Beneficiaries</span>
              <strong>{summary.total}</strong>
            </div>
            <div className="beneficiary-stat card success">
              <span>Verified</span>
              <strong>{summary.verified}</strong>
            </div>
            <div className="beneficiary-stat card warning">
              <span>Pending Verification</span>
              <strong>{summary.pending}</strong>
            </div>
          </section>

          <section className="beneficiary-table-card card">
            <div className="beneficiary-table-head">
              <div>
                <h3>Saved Beneficiaries</h3>
                <p>{filteredAccounts.length} record{filteredAccounts.length === 1 ? '' : 's'} visible</p>
              </div>
              <button type="button" className="beneficiary-primary-btn compact" onClick={openAddModal}>
                Add New
              </button>
            </div>

            <div className="table-responsive">
              <table className="beneficiary-table">
                <thead>
                  <tr>
                    <th>Beneficiary Name</th>
                    <th>Account Detail</th>
                    <th>Bank Info</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="beneficiary-empty">
                        {bankAccounts.length === 0 ? 'No beneficiaries added yet.' : 'No beneficiaries match your search.'}
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((bank) => (
                      <tr key={bank.id}>
                        <td>
                          <div className="beneficiary-name-cell">
                            <strong>{bank.accountName || '--'}</strong>
                            <span>ID: {bank.id.slice(0, 8)}</span>
                          </div>
                        </td>
                        <td>
                          <div className="beneficiary-account-cell">
                            <strong>{maskAccount(bank.accountNumber)}</strong>
                            <span>IFSC: {bank.ifscCode || '--'}</span>
                          </div>
                        </td>
                        <td>
                          <div className="beneficiary-bank-cell">
                            <strong>{bank.bankName || '--'}</strong>
                            <span>Added: {formatDateTime(bank.createdAt)}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`beneficiary-status-pill ${bank.isVerified ? 'verified' : 'pending'}`}>
                            {bank.isVerified ? 'Verified' : 'Pending'}
                          </span>
                        </td>
                        <td>
                          <div className="beneficiary-action-row">
                            <button type="button" className="action-btn pay" onClick={() => openPayoutModal(bank)}>
                              Pay
                            </button>
                            {!bank.isVerified ? (
                              <button
                                type="button"
                                className="action-btn verify"
                                onClick={() => handleVerifyBeneficiary(bank)}
                                disabled={verifyingId === bank.id}
                              >
                                {verifyingId === bank.id ? 'Verifying...' : 'Verify'}
                              </button>
                            ) : null}
                            <button type="button" className="action-btn edit" onClick={() => openEditModal(bank)}>
                              Edit
                            </button>
                            <button type="button" className="action-btn delete" onClick={() => handleDeleteBeneficiary(bank)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {showFormModal ? (
        <div className="beneficiary-modal-overlay" onClick={resetForm}>
          <div className="beneficiary-modal card" onClick={(event) => event.stopPropagation()}>
            <div className="beneficiary-modal-head">
              <div>
                <p>{editingBank ? 'Update existing beneficiary details' : 'Create a payout beneficiary'}</p>
                <h3>{editingBank ? 'Edit Beneficiary' : 'Add Beneficiary'}</h3>
              </div>
              <button type="button" className="beneficiary-close-btn" onClick={resetForm}>×</button>
            </div>

            <div className="beneficiary-form-grid">
              <label>
                <span>Account Holder Name</span>
                <input type="text" value={formData.accountName} onChange={(event) => setFormData((prev) => ({ ...prev, accountName: event.target.value }))} />
              </label>
              <label>
                <span>Bank Name</span>
                <input type="text" value={formData.bankName} onChange={(event) => setFormData((prev) => ({ ...prev, bankName: event.target.value }))} />
              </label>
              <label>
                <span>Account Number</span>
                <input type="text" value={formData.accountNumber} onChange={(event) => setFormData((prev) => ({ ...prev, accountNumber: event.target.value }))} />
              </label>
              <label>
                <span>IFSC Code</span>
                <input type="text" value={formData.ifscCode} onChange={(event) => setFormData((prev) => ({ ...prev, ifscCode: event.target.value.toUpperCase() }))} />
              </label>
            </div>

            {editingBank ? (
              <div className="beneficiary-hint">
                Editing a beneficiary resets its verification status, so you can verify the updated details again before payout.
              </div>
            ) : null}

            <div className="beneficiary-modal-actions">
              <button type="button" className="beneficiary-secondary-btn" onClick={resetForm}>
                Cancel
              </button>
              <button type="button" className="beneficiary-primary-btn" onClick={handleSaveBeneficiary} disabled={formLoading}>
                {formLoading ? 'Saving...' : editingBank ? 'Save Changes' : 'Add Beneficiary'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPayoutModal && selectedBank ? (
        <div className="beneficiary-modal-overlay" onClick={closePayoutModal}>
          <div className="beneficiary-modal card payout-modal" onClick={(event) => event.stopPropagation()}>
            <div className="beneficiary-modal-head">
              <div>
                <p>BranchX payout to selected beneficiary</p>
                <h3>{selectedBank.accountName || selectedBank.bankName}</h3>
              </div>
              <button type="button" className="beneficiary-close-btn" onClick={closePayoutModal}>×</button>
            </div>

            <div className="beneficiary-selected-card">
              <strong>{selectedBank.bankName || '--'}</strong>
              <span>{maskAccount(selectedBank.accountNumber)} • {selectedBank.ifscCode || '--'}</span>
              <span className={`beneficiary-status-pill ${selectedBank.isVerified ? 'verified' : 'pending'}`}>
                {selectedBank.isVerified ? 'Verified' : 'Pending Verification'}
              </span>
            </div>

            {!selectedBank.isVerified ? (
              <div className="beneficiary-inline-warning">
                This beneficiary must be verified before payout.
                <button type="button" className="action-btn verify" onClick={() => handleVerifyBeneficiary(selectedBank)} disabled={verifyingId === selectedBank.id}>
                  {verifyingId === selectedBank.id ? 'Verifying...' : 'Verify Now'}
                </button>
              </div>
            ) : null}

            <div className="beneficiary-form-grid single">
              <label>
                <span>Amount</span>
                <input type="number" placeholder="0.00" value={payoutAmount} onChange={(event) => setPayoutAmount(event.target.value)} onBlur={handleAmountBlur} />
              </label>
              <label>
                <span>Transfer Mode</span>
                <select value={branchxTransferMode} onChange={(event) => setBranchxTransferMode(event.target.value)}>
                  <option value="IMPS">IMPS</option>
                  <option value="NEFT">NEFT</option>
                  <option value="RTGS">RTGS</option>
                </select>
              </label>
              <label>
                <span>Remark</span>
                <input type="text" placeholder="Optional payout remark" value={branchxRemark} onChange={(event) => setBranchxRemark(event.target.value)} />
              </label>
              <label>
                <span>Transaction PIN</span>
                <input
                  type="password"
                  placeholder="Enter TPIN"
                  value={branchxTpin}
                  onChange={(event) => setBranchxTpin(event.target.value)}
                  onFocus={() => setBranchxTpinEditable(true)}
                  autoComplete="new-password"
                  name="beneficiary_tpin_manual"
                  readOnly={!branchxTpinEditable}
                  data-lpignore="true"
                  data-1p-ignore="true"
                />
              </label>
            </div>

            <div className="beneficiary-quote-card">
              <div><span>Charge</span><strong>{quoteLoading ? 'Loading...' : formatCurrency(quote.charge || 0)}</strong></div>
              <div><span>Net Transfer</span><strong>{quoteLoading ? 'Loading...' : formatCurrency(quote.netAmount || 0)}</strong></div>
              <div><span>Total Deduction</span><strong>{quoteLoading ? 'Loading...' : formatCurrency(quote.walletRequired || 0)}</strong></div>
            </div>

            <div className="beneficiary-modal-actions">
              <button type="button" className="beneficiary-secondary-btn" onClick={() => setShowTpinModal(true)}>
                Generate T-PIN
              </button>
              <button
                type="button"
                className="beneficiary-primary-btn"
                onClick={handleSubmitPayout}
                disabled={
                  payoutLoading ||
                  !selectedBank.isVerified ||
                  !branchxTpin.trim() ||
                  !Number(payoutAmount) ||
                  quoteLoading ||
                  (Number(quote.walletRequired || 0) > Number(wallet?.eWalletBalance || 0))
                }
              >
                {payoutLoading ? 'Processing...' : 'Submit Payout'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <TpinModal
        isOpen={showTpinModal}
        onClose={() => setShowTpinModal(false)}
        title="Generate T-PIN"
        description="Use your account password to create or update your 4-digit payout T-PIN."
      />
    </div>
  );
};

export default BeneficiariesPage;
