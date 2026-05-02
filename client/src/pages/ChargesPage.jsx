import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { API_BASE } from '../config';
import './ChargesPage.css'; 
import './MerchantsPage.css'; // Modal styles reside here

const ChargesPage = () => {
    const { user: currentUser } = useAuth();
    const { merchants } = useAppContext(); // Direct downlines
    const { success, error } = useToast();
    
    const [overrides, setOverrides] = useState([]);
    const [slabs, setSlabs] = useState([]); // Default global slabs
    const [allUsers, setAllUsers] = useState([]); // For search suggestion
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isGlobalModal, setIsGlobalModal] = useState(false);
    
    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Modal State (for adding/editing a slab)
    const [targetUser, setTargetUser] = useState(null);
    const [targetRole, setTargetRole] = useState('merchant');
    const [chargeType, setChargeType] = useState('percent');
    const [chargeValue, setChargeValue] = useState('');
    const [minAmount, setMinAmount] = useState('0');
    const [maxAmount, setMaxAmount] = useState('999999');

    const fetchData = async () => {
        try {
            const token = sessionStorage.getItem('authToken');
            const headers = { 'Authorization': `Bearer ${token}` };

            const [ovRes, slabRes, usersRes] = await Promise.all([
                fetch(`${API_BASE}/commission/overrides`, { headers }),
                fetch(`${API_BASE}/commission/slabs`, { headers }),
                fetch(`${API_BASE}/users/all`, { headers })
            ]);

            if (ovRes.ok) setOverrides(await ovRes.json());
            if (slabRes.ok) setSlabs(await slabRes.json());
            if (usersRes.ok) setAllUsers(await usersRes.json());

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenOverride = (userObj) => {
        setIsGlobalModal(false);
        setTargetUser(userObj);
        setChargeType('percent');
        setChargeValue('');
        setMinAmount('0');
        setMaxAmount('999999');
        setShowModal(true);
        setSearchQuery('');
        setShowSuggestions(false);
    };

    const handleOpenGlobalSlab = () => {
        setIsGlobalModal(true);
        setTargetUser(null);
        setTargetRole('merchant');
        setChargeType('percent');
        setChargeValue('');
        setMinAmount('0');
        setMaxAmount('999999');
        setShowModal(true);
    };

    const handleSaveSlab = async () => {
        if (Number(chargeValue) < 0) return error("Charge value cannot be negative.");
        if (Number(minAmount) < 0 || Number(maxAmount) <= Number(minAmount)) {
            return error("Invalid range. Max must be greater than Min.");
        }

        const token = sessionStorage.getItem('authToken');
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        try {
            if (isGlobalModal) {
                // Save Global Default Slab
                const res = await fetch(`${API_BASE}/commission/slabs`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        role: targetRole,
                        service_key: 'payout',
                        min_amount: Number(minAmount),
                        max_amount: Number(max_amount),
                        charge_type: chargeType,
                        charge_value: Number(chargeValue),
                    })
                });
                if (res.ok) {
                    success("Global slab added.");
                    setShowModal(false);
                    fetchData();
                } else {
                    error("Failed to add global slab.");
                }
            } else {
                // Save User Override Slab
                const res = await fetch(`${API_BASE}/commission/overrides`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        target_user_id: targetUser.userId || targetUser.id,
                        service_key: 'payout',
                        service_label: 'Transfer Charge',
                        min_amount: Number(minAmount),
                        max_amount: Number(max_amount),
                        charge_type: chargeType,
                        charge_value: Number(chargeValue),
                        commission_type: 'percent', 
                        commission_value: 0
                    })
                });
                if (res.ok) {
                    success("Override saved.");
                    setShowModal(false);
                    fetchData();
                } else {
                    error("Failed to save override.");
                }
            }
        } catch (err) {
            error("Server error");
        }
    };

    const handleDeleteSlab = async (id, type = 'override') => {
        if (!window.confirm("Delete this slab?")) return;
        try {
            const token = sessionStorage.getItem('authToken');
            const endpoint = type === 'global' ? `slabs/${id}` : `overrides/${id}`;
            const res = await fetch(`${API_BASE}/commission/${endpoint}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                success("Slab removed.");
                fetchData();
            }
        } catch (err) {
            error("Delete failed");
        }
    };

    const handleUpdateDefault = async (slabId, val, type) => {
        try {
            const token = sessionStorage.getItem('authToken');
            const res = await fetch(`${API_BASE}/commission/slabs/${slabId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    charge_value: Number(val),
                    charge_type: type
                })
            });
            if (res.ok) {
                success("Updated.");
                fetchData();
            }
        } catch (err) {
            error("Update failed");
        }
    };

    const suggestions = allUsers.filter(u => 
        (u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
         u.email?.toLowerCase().includes(searchQuery.toLowerCase())) &&
        u.role !== 'admin'
    ).slice(0, 5);

    const defaultCharges = slabs.filter(s => s.serviceKey === 'payout');

    return (
        <div className="dashboard-layout">
            <Sidebar />
            <div className="main-content">
                <Header title="Management & Charges" />
                <main className="dashboard-body animated">
                    
                    <div className="charges-header">
                        <div className="charges-title">
                            <h2>Charge Configuration</h2>
                            <p>Global defaults and manual user overrides.</p>
                        </div>
                        
                        <div className="charges-search-container">
                            <input 
                                type="text" 
                                className="charge-input" 
                                placeholder="🔍 Search any user to override..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setShowSuggestions(true);
                                }}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            />
                            {showSuggestions && searchQuery && (
                                <div className="search-suggestions">
                                    {suggestions.length === 0 ? (
                                        <div style={{ padding: '12px', color: '#64748b' }}>No users found.</div>
                                    ) : (
                                        suggestions.map(s => (
                                            <div key={s.userId} className="suggestion-item" onClick={() => handleOpenOverride(s)}>
                                                <div className="user-avatar-small" style={{ width: '32px', height: '32px' }}>{s.fullName?.charAt(0)}</div>
                                                <div>
                                                    <div style={{ fontSize: '13px', color: '#fff' }}>{s.fullName}</div>
                                                    <div style={{ fontSize: '11px', color: '#64748b' }}>{s.role} • {s.email}</div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Default Charges Section */}
                    {(currentUser?.role === 'admin' || currentUser?.role === 'staff') && (
                        <>
                            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3><span>⚙️</span> Default Global Charges (By Role)</h3>
                                <button className="add-slab-btn" onClick={handleOpenGlobalSlab}>+ Add Default Slab</button>
                            </div>
                            <div className="charges-card animated-fade-in" style={{ background: 'rgba(99, 102, 241, 0.05)' }}>
                                <div className="table-responsive">
                                    <table className="charges-table">
                                        <thead>
                                            <tr>
                                                <th>User Role</th>
                                                <th>Range (Min - Max)</th>
                                                <th>Charge Type</th>
                                                <th>Value</th>
                                                <th style={{ textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {defaultCharges.map(slab => (
                                                <tr key={slab.id}>
                                                    <td><strong style={{ color: '#fff', textTransform: 'capitalize' }}>{slab.role.replace('_', ' ')}</strong></td>
                                                    <td>
                                                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                                                            {slab.minAmount} - {slab.maxAmount >= 9999999 ? '∞' : slab.maxAmount}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <select 
                                                            className="charge-input" 
                                                            style={{ width: '130px', padding: '4px' }}
                                                            value={slab.chargeType}
                                                            onChange={(e) => handleUpdateDefault(slab.id, slab.chargeValue, e.target.value)}
                                                        >
                                                            <option value="percent">Percent (%)</option>
                                                            <option value="flat">Flat (INR)</option>
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input 
                                                            className="charge-input" 
                                                            style={{ width: '90px', padding: '4px' }}
                                                            type="number" 
                                                            value={slab.chargeValue}
                                                            onChange={(e) => handleUpdateDefault(slab.id, e.target.value, slab.chargeType)}
                                                        />
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <button className="delete-btn-v2" onClick={() => handleDeleteSlab(slab.id, 'global')}>Delete</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Manual Overrides Section */}
                    <div className="section-header">
                        <h3><span>✏️</span> Manual Overrides (User Specific)</h3>
                    </div>

                    <div className="charges-card animated-fade-in">
                        {loading ? (
                            <div style={{ padding: '60px', textAlign: 'center' }}>
                                <div className="route-loader-spinner" style={{ margin: '0 auto 20px' }}></div>
                                <p style={{ color: '#94a3b8' }}>Loading overrides...</p>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="charges-table">
                                    <thead>
                                        <tr>
                                            <th>Member Identity</th>
                                            <th>Role</th>
                                            <th>Active Amount Slabs</th>
                                            <th style={{ textAlign: 'right' }}>Management</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {merchants.length === 0 ? (
                                            <tr><td colSpan="4" style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>No user overrides configured yet.</td></tr>
                                        ) : merchants.map(merchant => {
                                            const userSlabs = overrides.filter(o => o.target_user_id === merchant.userId && o.service_key === 'payout');
                                            return (
                                                <tr key={merchant.userId}>
                                                    <td>
                                                        <div className="user-cell">
                                                            <div className="user-avatar-small">{(merchant.fullName || 'U').charAt(0).toUpperCase()}</div>
                                                            <div className="user-info-text">
                                                                <span className="user-name">{merchant.fullName || 'Unnamed'}</span>
                                                                <span className="user-email">{merchant.email}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td><span className="role-tag">{merchant.role}</span></td>
                                                    <td>
                                                        <div className="slabs-list">
                                                            {userSlabs.length === 0 ? (
                                                                <span style={{ color: '#64748b', fontSize: '12px' }}>Using Global Defaults</span>
                                                            ) : userSlabs.map(slab => (
                                                                <div key={slab.id} className="slab-badge">
                                                                    <span>₹{slab.min_amount} - ₹{slab.max_amount >= 999999 ? '∞' : slab.max_amount}: </span>
                                                                    <strong>{slab.charge_type === 'percent' ? `${slab.charge_value}%` : `₹${slab.charge_value}`}</strong>
                                                                    <button className="remove-slab" onClick={() => handleDeleteSlab(slab.id)}>&times;</button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <button className="add-btn-v2" onClick={() => handleOpenOverride(merchant)}>+ Add Slab</button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-container" style={{ maxWidth: '500px' }}>
                        <div className="modal-header-gradient">
                            <h3>{isGlobalModal ? 'Add Global Default' : 'Override Amount Slab'}</h3>
                            <button className="close-modal" onClick={() => setShowModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body hide-scrollbar">
                            {!isGlobalModal && (
                                <div style={{ marginBottom: '20px', padding: '12px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '4px' }}>Target User</div>
                                    <div style={{ color: '#fff', fontWeight: 600 }}>{targetUser?.fullName}</div>
                                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>{targetUser?.email}</div>
                                </div>
                            )}

                            <div className="modal-grid">
                                {isGlobalModal && (
                                    <div className="form-group full-width">
                                        <label className="callback-label">Target Role</label>
                                        <select className="form-input-box" value={targetRole} onChange={(e) => setTargetRole(e.target.value)}>
                                            <option value="master">Master</option>
                                            <option value="merchant">Merchant</option>
                                            <option value="branch">Branch</option>
                                        </select>
                                    </div>
                                )}
                                
                                <div className="form-group">
                                    <label className="callback-label">Min Amount (₹)</label>
                                    <input type="number" className="form-input-box" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="0" />
                                </div>
                                <div className="form-group">
                                    <label className="callback-label">Max Amount (₹)</label>
                                    <input type="number" className="form-input-box" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="999999" />
                                </div>
                                <div className="form-group full-width">
                                    <label className="callback-label">Charge Type</label>
                                    <select className="form-input-box" value={chargeType} onChange={(e) => setChargeType(e.target.value)}>
                                        <option value="percent">Percentage (%)</option>
                                        <option value="flat">Flat (Rs)</option>
                                    </select>
                                </div>
                                <div className="form-group full-width">
                                    <label className="callback-label">Charge Value</label>
                                    <input type="number" className="form-input-box" value={chargeValue} onChange={(e) => setChargeValue(e.target.value)} placeholder="0.00" />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={() => setShowModal(false)}>Close</button>
                            <button className="btn-create" onClick={handleSaveSlab}>
                                {isGlobalModal ? 'Create Slab' : 'Apply Override'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChargesPage;
