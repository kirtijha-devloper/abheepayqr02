import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { API_BASE } from '../config';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import './HierarchyUsersPage.css';
import './MerchantsPage.css'; // Reuse MerchantsPage styles

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
    parentId: '',
};

const HierarchyUsersPage = () => {
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRole, setSelectedRole] = useState('master'); 
    const [searchTerm, setSearchTerm] = useState('');
    const [activeStatusTab, setActiveStatusTab] = useState('All');
    const { success, error } = useToast();
    const { getImpersonateToken } = useAuth();
    const { updateMerchantStatus, deleteMerchant, updateMerchant } = useAppContext();

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [formData, setFormData] = useState(emptyForm);

    const fetchAllUsers = async () => {
        try {
            const token = sessionStorage.getItem('authToken');
            const res = await fetch(`${API_BASE}/users/all`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setAllUsers(data);
            }
        } catch (err) {
            error("Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllUsers();
    }, []);

    const filteredUsers = useMemo(() => allUsers.filter(u => {
        if (u.role !== selectedRole) return false;
        
        const normalizedStatus = (u.status || 'active').toLowerCase();
        if (activeStatusTab !== 'All' && normalizedStatus !== activeStatusTab.toLowerCase()) return false;

        const term = searchTerm.toLowerCase();
        const nameMatch = u.fullName?.toLowerCase().includes(term);
        const emailMatch = u.email?.toLowerCase().includes(term);
        const phoneMatch = u.phone?.includes(term);
        
        return !searchTerm || nameMatch || emailMatch || phoneMatch;
    }), [allUsers, selectedRole, activeStatusTab, searchTerm]);

    const roles = [
        { key: 'master', label: 'Masters', icon: '👑', desc: 'Top-level partners managing downlines.' },
        { key: 'merchant', label: 'Merchants', icon: '🏪', desc: 'Direct retailers and business owners.' },
        { key: 'branch', label: 'Branches', icon: '📍', desc: 'Sub-outlets under merchants.' }
    ];

    const handleLoginAs = async (targetUserId) => {
        try {
            const token = await getImpersonateToken(targetUserId);
            if (token) {
                sessionStorage.setItem('authToken', token);
                window.location.href = '/dashboard';
            }
        } catch (err) {
            error("Impersonation failed");
        }
    };

    const handleToggleStatus = async (user) => {
        const currentStatus = (user.status || 'active').toLowerCase();
        const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
        const res = await updateMerchantStatus(user.userId || user.id, nextStatus);
        if (res?.success) {
            success(`User marked as ${nextStatus}`);
            fetchAllUsers();
        } else {
            error(res?.error || "Status update failed");
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm("Are you sure you want to delete this user?")) return;
        const res = await deleteMerchant(userId);
        if (res?.success) {
            success("User deleted successfully");
            fetchAllUsers();
        } else {
            error(res?.error || "Deletion failed");
        }
    };

    const handleEdit = (user) => {
        setSelectedUser(user);
        setIsEditing(true);
        const names = (user.fullName || '').split(' ');
        setFormData({
            ...emptyForm,
            firstName: names[0] || '',
            lastName: names.slice(1).join(' ') || '',
            email: user.email || '',
            phone: user.phone || '',
            businessName: user.businessName || '',
            callbackUrl: user.callbackUrl || '',
            payoutChargeType: user.payoutOverride?.chargeType || 'flat',
            payoutChargeValue: user.payoutOverride?.chargeValue || 0,
        });
        setShowModal(true);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        const res = await updateMerchant(selectedUser.userId || selectedUser.id, {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            businessName: formData.businessName,
            callbackUrl: formData.callbackUrl,
            payoutChargeType: formData.payoutChargeType,
            payoutChargeValue: formData.payoutChargeValue,
        });

        if (res.success) {
            success('User updated successfully');
            setShowModal(false);
            fetchAllUsers();
        } else {
            error(res.error || 'Update failed');
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="dashboard-layout">
            <Sidebar />
            <div className="main-content">
                <Header title="Network Hierarchy" />
                <main className="dashboard-body animated">
                    <div className="hierarchy-container">
                        
                        {/* Compact Role Selector (Step 1) */}
                        <div className="role-cards-grid">
                            {roles.map(role => (
                                <div 
                                    key={role.key} 
                                    className={`role-card ${selectedRole === role.key ? 'active' : ''}`}
                                    onClick={() => setSelectedRole(role.key)}
                                >
                                    <div className="role-count">
                                        {allUsers.filter(u => u.role === role.key).length}
                                    </div>
                                    <div className="role-icon-circle">{role.icon}</div>
                                    <h3>{role.label}</h3>
                                    <p>{role.desc}</p>
                                </div>
                            ))}
                        </div>

                        {/* Professional Table Card (Step 2 - Matching Merchants Page) */}
                        <div className="merchants-table-card">
                            <div className="merchants-toolbar">
                                <div className="merchant-search-panel">
                                    <label className="merchant-search-label" htmlFor="merchant-search">
                                        Search Users
                                    </label>
                                    <div className="merchant-search-wrap">
                                        <span className="merchant-search-icon">🔎</span>
                                        <input 
                                            id="merchant-search"
                                            type="text" 
                                            placeholder={`Name, email, phone`} 
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <span className="merchant-search-meta">
                                        {filteredUsers.length} result{filteredUsers.length === 1 ? '' : 's'}
                                    </span>
                                </div>
                                <div className="merchant-filter-group">
                                    {['All', 'Active', 'Inactive'].map(tab => (
                                        <button 
                                            key={tab}
                                            className={`merchant-filter-btn ${activeStatusTab === tab ? 'active' : ''}`}
                                            onClick={() => setActiveStatusTab(tab)}
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
                                            <th>ID</th>
                                            <th>Member Identity</th>
                                            <th>Wallet Balance</th>
                                            <th>Status</th>
                                            <th>Commission</th>
                                            <th>Quick Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                         {loading ? (
                                            <tr>
                                                <td colSpan="6" style={{ padding: '80px', textAlign: 'center' }}>
                                                    <div className="route-loader-spinner" style={{ margin: '0 auto 20px' }}></div>
                                                    <p style={{ color: '#64748b' }}>Synchronizing network...</p>
                                                </td>
                                            </tr>
                                        ) : filteredUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" style={{ padding: '80px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '48px', marginBottom: '15px', opacity: 0.1 }}>👥</div>
                                                    <p style={{ color: '#64748b' }}>No matching {selectedRole}s found.</p>
                                                </td>
                                            </tr>
                                        ) : filteredUsers.map((user, index) => (
                                            <tr key={user.userId}>
                                                <td>
                                                    <span className="mid-badge">LEO{String(index + 1).padStart(3, '0')}</span>
                                                </td>
                                                <td>
                                                    <div className="merchant-name-cell">
                                                        <div className="merchant-avatar">
                                                            {(user.fullName || 'U').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="merchant-name-info">
                                                            <div className="m-name">{user.fullName || 'Unnamed'}</div>
                                                            <div className="m-email">{user.email}</div>
                                                            {user.phone && <div className="m-email" style={{opacity: 0.8}}>{user.phone}</div>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="volume-cell">
                                                    Rs {Number(user.walletBalance || 0).toFixed(2)}
                                                </td>
                                                <td>
                                                    <span className={`status-pill ${(user.status || 'active').toLowerCase()}`} onClick={() => handleToggleStatus(user)} style={{cursor: 'pointer'}}>
                                                        {user.status || 'Active'}
                                                    </span>
                                                </td>
                                                <td className="commission-cell">
                                                    {user.payoutOverride ? (
                                                        <span className="commission-value">
                                                            {user.payoutOverride.chargeType === 'flat' ? `Rs ${user.payoutOverride.chargeValue}` : `${user.payoutOverride.chargeValue}%`}
                                                        </span>
                                                    ) : <span style={{opacity: 0.5}}>Global</span>}
                                                </td>
                                                <td>
                                                    <div className="merchant-actions">
                                                        <button className="action-btn login-btn" onClick={() => handleLoginAs(user.userId)}>Login</button>
                                                        <button className="action-btn" onClick={() => handleEdit(user)}>Edit</button>
                                                        
                                                        <button className="action-btn danger-btn" onClick={() => handleDeleteUser(user.userId)}>Delete</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="txn-table-footer">
                                <span className="txn-count-text">Showing {filteredUsers.length} {selectedRole}s</span>
                                <div className="pagination-v2">
                                    <button className="nav-btn-v2" disabled>Prev</button>
                                    <button className="nav-num-v2 active">1</button>
                                    <button className="nav-btn-v2" disabled>Next</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* Reuse Edit Modal from Merchants Page logic */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-header-gradient">
                            <h3>Edit Member: {selectedUser?.fullName}</h3>
                            <button className="close-modal" onClick={() => setShowModal(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleUpdate}>
                            <div className="modal-body">
                                <div className="modal-grid">
                                    <div className="form-group">
                                        <input type="text" name="firstName" value={formData.firstName} placeholder="First Name *" className="form-input-box" required onChange={handleChange} />
                                    </div>
                                    <div className="form-group">
                                        <input type="text" name="lastName" value={formData.lastName} placeholder="Last Name" className="form-input-box" onChange={handleChange} />
                                    </div>
                                    <div className="form-group full-width">
                                        <input type="email" name="email" value={formData.email} placeholder="Email *" className="form-input-box" required onChange={handleChange} />
                                    </div>
                                    <div className="form-group full-width">
                                        <input type="text" name="phone" value={formData.phone} placeholder="Phone" className="form-input-box" onChange={handleChange} />
                                    </div>
                                    <div className="form-group full-width">
                                        <input type="text" name="businessName" value={formData.businessName} placeholder="Business Name" className="form-input-box" onChange={handleChange} />
                                    </div>
                                    <div className="form-group full-width">
                                        <label className="callback-label">Callback URL</label>
                                        <input type="text" name="callbackUrl" value={formData.callbackUrl} placeholder="Webhook URL" className="form-input-box" onChange={handleChange} />
                                    </div>

                                    <div className="form-group full-width payout-charge-block">
                                        <label className="payout-charge-label">PAYOUT CHARGES (CUSTOM)</label>
                                        <div className="payout-charge-row">
                                            <select name="payoutChargeType" className="form-input-box" value={formData.payoutChargeType} onChange={handleChange}>
                                                <option value="flat">Flat (Rs)</option>
                                                <option value="percentage">Percentage (%)</option>
                                            </select>
                                            <input type="number" name="payoutChargeValue" className="form-input-box" value={formData.payoutChargeValue} onChange={handleChange} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn-create">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HierarchyUsersPage;
