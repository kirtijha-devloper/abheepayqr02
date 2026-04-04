import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import './MerchantsPage.css';

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  businessName: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  panNumber: '',
  aadhaarNumber: '',
  callbackUrl: '',
  payoutChargeType: 'flat',
  payoutChargeValue: 0,
};

const titleCase = (value = '') => value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : 'Active';

const MerchantsPage = () => {
  const [showModal, setShowModal] = useState(false);
  const { merchants, addMerchant, updateMerchant, updateMerchantStatus, deleteMerchant } = useAppContext();
  const { getImpersonateToken } = useAuth();
  const { success, error } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const itemsPerPage = 8;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const closeModal = () => {
    setShowModal(false);
    setIsEditing(false);
    setSelectedMerchant(null);
    setFormData(emptyForm);
  };

  const handleLoginAs = async (merchant) => {
    const result = await getImpersonateToken(merchant.id);
    if (result.success) {
      window.open(`${window.location.origin}/?token=${result.token}`, '_blank');
    } else {
      error(result.message || 'Failed to login as merchant');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    if (isEditing && selectedMerchant) {
      const res = await updateMerchant(selectedMerchant.id, {
        fullName: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        phone: formData.phone,
        businessName: formData.businessName,
        callbackUrl: formData.callbackUrl || null,
        payoutChargeType: formData.payoutChargeType,
        payoutChargeValue: Number(formData.payoutChargeValue),
      });

      if (!res.success) {
        error(res.error || 'Failed to update merchant');
        return;
      }

      success('Merchant updated successfully.');
      closeModal();
      return;
    }

    const res = await addMerchant({
      name: `${formData.firstName} ${formData.lastName}`.trim() || formData.businessName,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      businessName: formData.businessName,
      callbackUrl: formData.callbackUrl,
    });

    if (!res.success) {
      error(res.error || 'Failed to create merchant');
      return;
    }

    success('Merchant created successfully.');
    closeModal();
  };

  const handleEdit = (merchant) => {
    setSelectedMerchant(merchant);
    setIsEditing(true);
    const names = (merchant.fullName || '').split(' ');
    setFormData({
      firstName: names[0] || '',
      lastName: names.slice(1).join(' ') || '',
      email: merchant.email || '',
      phone: merchant.phone || '',
      password: '',
      businessName: merchant.businessName || '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      panNumber: '',
      aadhaarNumber: '',
      callbackUrl: merchant.callbackUrl || '',
      payoutChargeType: merchant.payoutOverride?.chargeType || 'flat',
      payoutChargeValue: merchant.payoutOverride?.chargeValue || 0,
    });
    setShowModal(true);
  };

  const handleToggleStatus = async (merchant) => {
    const currentStatus = (merchant.status || 'active').toLowerCase();
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const res = await updateMerchantStatus(merchant.id, nextStatus);

    if (!res?.success) {
      error(res?.error || 'Failed to update merchant status');
      return;
    }

    success(`Merchant marked as ${nextStatus}.`);
  };

  const filteredMerchants = merchants.filter((merchant) => {
    const normalizedStatus = (merchant.status || 'active').toLowerCase();
    if (activeTab !== 'All' && normalizedStatus !== activeTab.toLowerCase()) return false;
    const term = searchTerm.toLowerCase();
    const nameMatch = merchant.fullName?.toLowerCase().includes(term);
    const emailMatch = merchant.email?.toLowerCase().includes(term);
    return !searchTerm || nameMatch || emailMatch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredMerchants.length / itemsPerPage));
  const paginatedMerchants = filteredMerchants.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, merchants.length]);

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
          <div className="merchants-header">
            <div className="merchants-title">
              <h2>Merchants Fleet</h2>
              <p>Onboard and manage platform merchant sub-agents.</p>
            </div>
            <button className="add-merchant-btn" onClick={() => setShowModal(true)}>
              <span>+</span> New Merchant
            </button>
          </div>

          <div className="merchants-table-card">
            <div className="merchants-toolbar">
              <div className="merchant-search-wrap">
                <span className="merchant-search-icon">Search</span>
                <input
                  type="text"
                  placeholder="Filter merchants by MID, name, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="merchant-filter-group">
                {['All', 'Active', 'Inactive'].map((tab) => (
                  <button
                    key={tab}
                    className={`merchant-filter-btn ${activeTab === tab ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="table-responsive">
              <table className="merchants-table">
                <thead>
                  <tr>
                    <th>Merchant Identity</th>
                    <th>Merchant Code (MID)</th>
                    <th>Wallet Balance</th>
                    <th>Status</th>
                    <th>Commission</th>
                    <th>Quick Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMerchants.map((merchant) => {
                    const currentStatus = (merchant.status || 'active').toLowerCase();
                    return (
                      <tr key={merchant.id}>
                        <td>
                          <div className="merchant-name-cell">
                            <div className="merchant-avatar">{merchant.fullName?.charAt(0) || '?'}</div>
                            <div className="merchant-name-info">
                              <div className="m-name">{merchant.fullName}</div>
                              <div className="m-email">{merchant.email}</div>
                            </div>
                          </div>
                        </td>
                        <td><span className="mid-badge">{merchant.mid || 'MID-102938'}</span></td>
                        <td className="volume-cell">Rs {merchant.walletBalance || '0.00'}</td>
                        <td><span className={`status-pill ${currentStatus}`}>{titleCase(currentStatus)}</span></td>
                        <td className="commission-cell">
                          {merchant.payoutOverride ? (
                            <span className="commission-value">
                              {merchant.payoutOverride.chargeType === 'flat' ? `Rs ${merchant.payoutOverride.chargeValue}` : `${merchant.payoutOverride.chargeValue}%`}
                            </span>
                          ) : 'Global'}
                        </td>
                        <td>
                          <div className="merchant-actions">
                            <button className="action-btn login-btn" onClick={() => handleLoginAs(merchant)}>Login</button>
                            <button className="action-btn" onClick={() => handleEdit(merchant)}>Edit</button>
                            <button className="action-btn" onClick={() => handleToggleStatus(merchant)}>Toggle</button>
                            <button className="action-btn danger-btn" onClick={() => deleteMerchant(merchant.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredMerchants.length === 0 && (
                    <tr>
                      <td colSpan="6" className="merchants-empty-state">
                        No merchants found for the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="txn-table-footer">
              <span className="txn-count-text">Showing {paginatedMerchants.length} of {filteredMerchants.length} merchants</span>
              <div className="pagination-v2">
                <button className="nav-btn-v2" type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>Prev</button>
                <button className="nav-num-v2 active" type="button">{currentPage}</button>
                <button className="nav-btn-v2" type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages || filteredMerchants.length === 0}>Next</button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header-gradient">
              <h3>{isEditing ? 'Edit Merchant' : 'Add Merchant'}</h3>
              <button className="close-modal" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="modal-grid">
                  <div className="form-group">
                    <input type="text" name="firstName" value={formData.firstName} placeholder="First Name *" className="form-input-box" required onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <input type="text" name="lastName" value={formData.lastName} placeholder="Last Name" className="form-input-box" onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <input type="email" name="email" value={formData.email} placeholder="Email *" className="form-input-box" required onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <input type="text" name="phone" value={formData.phone} placeholder="Phone" className="form-input-box" onChange={handleChange} />
                  </div>
                  {!isEditing && (
                    <div className="form-group full-width">
                      <div className="password-input-wrapper">
                        <input type="password" name="password" value={formData.password} placeholder="Password *" className="form-input-box" required onChange={handleChange} />
                        <span className="eye-icon">Show</span>
                      </div>
                    </div>
                  )}
                  <div className="form-group full-width">
                    <input type="text" name="businessName" value={formData.businessName} placeholder="Business Name" className="form-input-box" onChange={handleChange} />
                  </div>
                  <div className="form-group full-width">
                    <input type="text" name="address" value={formData.address} placeholder="Address" className="form-input-box" onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <input type="text" name="city" value={formData.city} placeholder="City" className="form-input-box" onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <input type="text" name="state" value={formData.state} placeholder="State" className="form-input-box" onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <input type="text" name="pincode" value={formData.pincode} placeholder="Pincode" className="form-input-box" onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <input type="text" name="panNumber" value={formData.panNumber} placeholder="PAN Number" className="form-input-box" onChange={handleChange} />
                  </div>
                  <div className="form-group full-width">
                    <input type="text" name="aadhaarNumber" value={formData.aadhaarNumber} placeholder="Aadhaar Number" className="form-input-box" onChange={handleChange} />
                  </div>
                  <div className="form-group full-width">
                    <label className="callback-label">Callback URL</label>
                    <input type="text" name="callbackUrl" value={formData.callbackUrl} placeholder="https://your-domain.com/payment/webhook" className="form-input-box" onChange={handleChange} />
                    <p className="help-text">POST endpoint for payment status notifications</p>
                  </div>

                  <div className="form-group full-width payout-charge-block">
                    <label className="payout-charge-label">PAYOUT CHARGES (CUSTOM)</label>
                    <div className="payout-charge-row">
                      <select
                        name="payoutChargeType"
                        className="form-input-box"
                        value={formData.payoutChargeType}
                        onChange={handleChange}
                      >
                        <option value="flat">Flat (Rs)</option>
                        <option value="percentage">Percentage (%)</option>
                      </select>
                      <input
                        type="number"
                        name="payoutChargeValue"
                        placeholder="Charge Value"
                        className="form-input-box"
                        value={formData.payoutChargeValue}
                        onChange={handleChange}
                      />
                    </div>
                    <p className="help-text">Override global payout charges for this merchant.</p>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-create">{isEditing ? 'Save Changes' : 'Create Merchant'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MerchantsPage;
