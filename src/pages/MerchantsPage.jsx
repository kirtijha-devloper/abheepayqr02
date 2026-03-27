import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import './MerchantsPage.css';

const MerchantsPage = () => {
  const [showModal, setShowModal] = useState(false);
  const { merchants, addMerchant, updateMerchantStatus, deleteMerchant } = useAppContext();
  const { getImpersonateToken } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('All');

  const [formData, setFormData] = useState({
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
    callbackUrl: 'https://your-server.com/payment/webhook'
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLoginAs = async (m) => {
    const result = await getImpersonateToken(m.id);
    if (result.success) {
      window.open(`${window.location.origin}/?token=${result.token}`, '_blank');
    } else {
      alert(result.message || 'Failed to login as merchant');
    }
  };

  const handleCreate = (e) => {
    e.preventDefault();
    const newMerchant = {
      mid: `MID-${Math.floor(1000000 + Math.random() * 9000000)}`,
      name: `${formData.firstName} ${formData.lastName}`.trim() || formData.businessName,
      email: formData.email,
      wallet: '₹0.00',
      status: 'Active',
    };
    addMerchant(newMerchant);
    setShowModal(false);
    // Reset form
    setFormData({
      firstName: '', lastName: '', email: '', phone: '', password: '', 
      businessName: '', address: '', city: '', state: '', pincode: '', 
      panNumber: '', aadhaarNumber: '', callbackUrl: 'https://your-server.com/payment/webhook'
    });
  };

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
                <span className="merchant-search-icon">🔍</span>
                <input 
                  type="text" 
                  placeholder="Filter merchants by MID, name, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="txn-filters">
                {['All', 'Active', 'Inactive'].map(tab => (
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
                  {merchants.filter(m => {
                    if (activeTab !== 'All' && m.status !== activeTab) return false;
                    const nameMatch = m.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
                    const emailMatch = m.email?.toLowerCase().includes(searchTerm.toLowerCase());
                    if (searchTerm && !nameMatch && !emailMatch) return false;
                    return true;
                  }).map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="merchant-name-cell">
                          <div className="merchant-avatar">{m.fullName?.charAt(0) || '?'}</div>
                          <div className="merchant-name-info">
                            <div className="m-name">{m.fullName}</div>
                            <div className="m-email">{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="mid-badge">{m.mid || 'MID-102938'}</span></td>
                      <td className="volume-cell">₹ {m.walletBalance || '0.00'}</td>
                      <td><span className={`status-pill ${m.status?.toLowerCase() || 'active'}`}>{m.status}</span></td>
                      <td style={{fontSize: '12px', fontWeight: '600'}}>1.2%</td>
                      <td>
                        <div className="merchant-actions">
                          <button className="action-btn login-btn" onClick={() => handleLoginAs(m)}>Login</button>
                          <button className="action-btn" onClick={() => updateMerchantStatus(m.id, m.status?.toLowerCase() === 'active' ? 'inactive' : 'active')}>Toggle</button>
                          <button className="action-btn danger-btn" onClick={() => deleteMerchant(m.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="txn-table-footer">
              <span className="txn-count-text">Displaying {merchants.length} registered merchants</span>
              <div className="pagination-v2">
                <button className="nav-btn-v2">Prev</button>
                <button className="nav-num-v2 active">1</button>
                <button className="nav-btn-v2">Next</button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header-gradient">
              <h3>Add Merchant</h3>
              <button className="close-modal" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="modal-grid">
                  <div className="form-group">
                    <input type="text" name="firstName" placeholder="First Name *" className="form-input-box" required onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <input type="text" name="lastName" placeholder="Last Name" className="form-input-box" onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <input type="email" name="email" placeholder="Email *" className="form-input-box" required onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <input type="text" name="phone" placeholder="Phone" className="form-input-box" onChange={handleChange} />
                  </div>
                  <div className="form-group full-width">
                    <div className="password-input-wrapper">
                      <input type="password" name="password" placeholder="Password *" className="form-input-box" required onChange={handleChange} />
                      <span className="eye-icon">👁️</span>
                    </div>
                  </div>
                  <div className="form-group full-width">
                    <input type="text" name="businessName" placeholder="Business Name" className="form-input-box" onChange={handleChange} />
                  </div>
                  <div className="form-group full-width">
                    <input type="text" name="address" placeholder="Address" className="form-input-box" onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <input type="text" name="city" placeholder="City" className="form-input-box" onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <input type="text" name="state" placeholder="State" className="form-input-box" onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <input type="text" name="pincode" placeholder="Pincode" className="form-input-box" onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <input type="text" name="panNumber" placeholder="PAN Number" className="form-input-box" onChange={handleChange} />
                  </div>
                  <div className="form-group full-width">
                    <input type="text" name="aadhaarNumber" placeholder="Aadhaar Number" className="form-input-box" onChange={handleChange} />
                  </div>
                  <div className="form-group full-width">
                    <label style={{ fontSize: '0.6875rem', fontWeight: '600', color: '#9CA3AF', marginBottom: '4px' }}>Callback URL</label>
                    <input type="text" name="callbackUrl" value={formData.callbackUrl} className="form-input-box" onChange={handleChange} />
                    <p className="help-text">POST endpoint for payment status notifications</p>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-create">Create Merchant</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MerchantsPage;
