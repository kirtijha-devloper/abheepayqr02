import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { API_BASE } from '../config';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import './HierarchyUsersPage.css';

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

    const filteredUsers = allUsers.filter(u => u.role === selectedRole);

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
        if (!window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
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

                        <div className="users-list-card animated-fade-in">
                            <div className="list-header">
                                <h2>{roles.find(r => r.key === selectedRole)?.label} Management</h2>
                                <div className="joining-date">Found {filteredUsers.length} members in network</div>
                            </div>

                            {loading ? (
                                <div style={{ padding: '80px', textAlign: 'center' }}>
                                    <div className="route-loader-spinner" style={{ margin: '0 auto 20px' }}></div>
                                    <p style={{ color: '#64748b', fontSize: '1.1rem' }}>Synchronizing hierarchy data...</p>
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div style={{ padding: '80px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '64px', marginBottom: '20px', opacity: 0.1 }}>👥</div>
                                    <p style={{ color: '#64748b', fontSize: '1.2rem' }}>No active {selectedRole}s found in your network.</p>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="hierarchy-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '25%' }}>Member Details</th>
                                                <th style={{ width: '15%' }}>MID / Code</th>
                                                <th style={{ width: '15%' }}>Contact & Status</th>
                                                <th style={{ width: '15%' }}>Wallet Balance</th>
                                                <th style={{ width: '15%' }}>Upline Member</th>
                                                <th style={{ textAlign: 'right', width: '15%' }}>Quick Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredUsers.map(user => (
                                                <tr key={user.userId}>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <div className="user-avatar-premium">
                                                                {(user.fullName || 'U').charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <span className="user-name-premium">{user.fullName || 'Unnamed'}</span>
                                                                <span className="user-email-premium">{user.email}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="mid-badge" style={{ fontSize: '12px' }}>{user.mid || `ID-${user.userId?.substring(0,8)}`}</span>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <span style={{ fontSize: '13px', color: '#fff', fontWeight: '500' }}>{user.phone || 'N/A'}</span>
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <span className={`status-pill ${(user.status || 'active').toLowerCase()}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                                                                    {user.status || 'Active'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span style={{ color: '#fff', fontWeight: '600', fontSize: '14px' }}>
                                                            Rs {Number(user.walletBalance || 0).toFixed(2)}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className="upline-badge">
                                                            {user.parentName || 'System Admin'}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <div className="merchant-actions" style={{ justifyContent: 'flex-end' }}>
                                                            <button className="action-btn login-btn" onClick={() => handleLoginAs(user.userId)}>Login</button>
                                                            <button className="action-btn" onClick={() => handleEdit(user)}>Edit</button>
                                                            <button className="action-btn" onClick={() => handleToggleStatus(user)}>Toggle</button>
                                                            <button className="action-btn danger-btn" onClick={() => handleDeleteUser(user.userId)}>Delete</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {showModal && (
                <div className="modal-overlay" style={{ zIndex: 9999 }}>
                    <div className="modal-container" style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div className="modal-header-gradient">
                            <h3>Edit Member: {selectedUser?.fullName}</h3>
                            <button className="close-modal" onClick={() => setShowModal(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleUpdate}>
                            <div className="modal-body hide-scrollbar">
                                <div className="modal-grid">
                                    <div className="form-group">
                                        <label className="callback-label">First Name</label>
                                        <input type="text" name="firstName" value={formData.firstName} className="form-input-box" required onChange={handleChange} />
                                    </div>
                                    <div className="form-group">
                                        <label className="callback-label">Last Name</label>
                                        <input type="text" name="lastName" value={formData.lastName} className="form-input-box" onChange={handleChange} />
                                    </div>
                                    <div className="form-group full-width">
                                        <label className="callback-label">Email Address</label>
                                        <input type="email" name="email" value={formData.email} className="form-input-box" required onChange={handleChange} />
                                    </div>
                                    <div className="form-group full-width">
                                        <label className="callback-label">Phone Number</label>
                                        <input type="text" name="phone" value={formData.phone} className="form-input-box" onChange={handleChange} />
                                    </div>
                                    <div className="form-group full-width">
                                        <label className="callback-label">Business Name</label>
                                        <input type="text" name="businessName" value={formData.businessName} className="form-input-box" onChange={handleChange} />
                                    </div>
                                    <div className="form-group full-width">
                                        <label className="callback-label">Callback URL</label>
                                        <input type="text" name="callbackUrl" value={formData.callbackUrl} className="form-input-box" onChange={handleChange} />
                                    </div>

                                    <div className="form-group full-width payout-charge-block">
                                        <label className="payout-charge-label">PAYOUT CHARGES (CUSTOM OVERRIDE)</label>
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
                            <div className="modal-footer" style={{ background: 'rgba(0,0,0,0.2)' }}>
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
