import React, { useState, useEffect, useMemo } from 'react';
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
    const [downlineDefaults, setDownlineDefaults] = useState([]);
    const [slabs, setSlabs] = useState([]); // Default global slabs
    const [allUsers, setAllUsers] = useState([]); // For search suggestion
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('override');
    
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
    const [serviceKey, setServiceKey] = useState('payout');

    const parseErrorResponse = async (res, fallbackMessage) => {
        try {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const data = await res.json();
                return data?.error || data?.message || fallbackMessage;
            }

            const text = (await res.text()).trim();
            return text || fallbackMessage;
        } catch {
            return fallbackMessage;
        }
    };

    const fetchData = async () => {
        try {
            const token = sessionStorage.getItem('authToken');
            const headers = { 'Authorization': `Bearer ${token}` };
            const canSearchAllUsers = currentUser?.role === 'admin' || currentUser?.role === 'staff';

            const requests = [
                fetch(`${API_BASE}/commission/overrides`, { headers }),
                fetch(`${API_BASE}/commission/slabs`, { headers }),
                fetch(`${API_BASE}/commission/downline-defaults`, { headers }),
            ];

            if (canSearchAllUsers) {
                requests.push(fetch(`${API_BASE}/users/all`, { headers }));
            }

            const [ovRes, slabRes, defaultsRes, usersRes] = await Promise.all(requests);

            if (ovRes.ok) {
                setOverrides(await ovRes.json());
            } else {
                console.error('Failed to fetch overrides:', await parseErrorResponse(ovRes, 'Unknown error'));
            }

            if (slabRes.ok) {
                setSlabs(await slabRes.json());
            } else {
                const slabError = await parseErrorResponse(slabRes, 'Failed to fetch slabs');
                console.error('Failed to fetch slabs:', slabError);
                error(`Slabs load failed: ${slabError}`);
            }

            if (defaultsRes.ok) {
                setDownlineDefaults(await defaultsRes.json());
            } else {
                console.error('Failed to fetch downline defaults:', await parseErrorResponse(defaultsRes, 'Unknown error'));
            }

            if (usersRes?.ok) {
                setAllUsers(await usersRes.json());
            } else if (canSearchAllUsers && usersRes) {
                console.error('Failed to fetch users:', await parseErrorResponse(usersRes, 'Unknown error'));
            }

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (currentUser?.role !== 'admin' && currentUser?.role !== 'staff') {
            setAllUsers(Array.isArray(merchants) ? merchants : []);
        }
    }, [currentUser?.role, merchants]);

    const handleOpenOverride = (userObj) => {
        setModalMode('override');
        setTargetUser(userObj);
        setChargeType('percent');
        setChargeValue('');
        setMinAmount('0');
        setMaxAmount('999999');
        setServiceKey('payout');
        setShowModal(true);
        setSearchQuery('');
        setShowSuggestions(false);
    };

    const handleOpenGlobalSlab = () => {
        setModalMode('global');
        setTargetUser(null);
        setTargetRole('merchant');
        setChargeType('percent');
        setChargeValue('');
        setMinAmount('0');
        setMaxAmount('999999');
        setServiceKey('payout');
        setShowModal(true);
    };

    const handleOpenDownlineDefault = () => {
        setModalMode('downline-default');
        setTargetUser(null);
        setTargetRole(currentUser?.role === 'admin' || currentUser?.role === 'staff' ? 'master' : currentUser?.role === 'master' ? 'merchant' : 'branch');
        setChargeType('percent');
        setChargeValue('');
        setMinAmount('0');
        setMaxAmount('999999');
        setServiceKey('payout');
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
            if (modalMode === 'global') {
                // Save Global Default Slab
                const res = await fetch(`${API_BASE}/commission/slabs`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        role: targetRole,
                        service_key: serviceKey,
                        min_amount: Number(minAmount),
                        max_amount: Number(maxAmount),
                        charge_type: chargeType,
                        charge_value: Number(chargeValue),
                    })
                });
                if (res.ok) {
                    success("Global slab added.");
                    setShowModal(false);
                    fetchData();
                } else {
                    error(await parseErrorResponse(res, "Failed to add global slab."));
                }
            } else if (modalMode === 'downline-default') {
                const res = await fetch(`${API_BASE}/commission/downline-defaults`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        target_role: targetRole,
                        service_key: serviceKey,
                        service_label: serviceKey === 'payout' ? 'Downline Payout Charge' : serviceKey === 'branchx_payout' ? 'Downline BranchX Charge' : 'Downline Collection Charge',
                        min_amount: Number(minAmount),
                        max_amount: Number(maxAmount),
                        charge_type: chargeType,
                        charge_value: Number(chargeValue),
                        commission_type: 'percent',
                        commission_value: 0
                    })
                });
                if (res.ok) {
                    success("Downline default saved.");
                    setShowModal(false);
                    fetchData();
                } else {
                    error(await parseErrorResponse(res, "Failed to save downline default."));
                }
            } else {
                // Save User Override Slab
                const res = await fetch(`${API_BASE}/commission/overrides`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        target_user_id: targetUser.userId || targetUser.id,
                        service_key: serviceKey,
                        service_label: serviceKey === 'payout' ? 'Transfer Charge' : serviceKey === 'branchx_payout' ? 'BranchX Payout Charge' : 'Collection Charge',
                        min_amount: Number(minAmount),
                        max_amount: Number(maxAmount),
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
                    error(await parseErrorResponse(res, "Failed to save override."));
                }
            }
        } catch (err) {
            console.error(err);
            error("Connection error. Please try again.");
        }
    };

    const handleDeleteSlab = async (id, type = 'override') => {
        if (!window.confirm("Delete this slab?")) return;
        try {
            const token = sessionStorage.getItem('authToken');
            const endpoint = type === 'global' ? `slabs/${id}` : type === 'downline-default' ? `downline-defaults/${id}` : `overrides/${id}`;
            const res = await fetch(`${API_BASE}/commission/${endpoint}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                success("Slab removed.");
                fetchData();
            }
        } catch (err) {
            console.error(err);
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
            console.error(err);
            error("Update failed");
        }
    };

    const suggestions = useMemo(() => allUsers.filter(u => 
        (u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
         u.email?.toLowerCase().includes(searchQuery.toLowerCase())) &&
        u.role !== 'admin'
    ).slice(0, 5), [allUsers, searchQuery]);

    const defaultCharges = slabs;
    
    const myDownlineDefaults = useMemo(() => 
        downlineDefaults.filter(d => (currentUser?.role === 'admin' || currentUser?.role === 'staff' ? true : d.owner_user_id === currentUser?.id)),
        [downlineDefaults, currentUser]
    );
    const canManageDownlineDefaults = ['admin', 'staff', 'master', 'merchant'].includes(currentUser?.role);
    const canCreateGlobalSlabs = currentUser?.role === 'admin' || currentUser?.role === 'staff';
    const defaultTargetLabel = currentUser?.role === 'admin' || currentUser?.role === 'staff'
        ? 'Masters'
        : currentUser?.role === 'master'
            ? 'Merchants'
            : 'Branches';

    return (
        <div className="dashboard-layout">
            <Sidebar />
            <div className="main-content">
                <Header title="Management & Charges" />
                <main className="dashboard-body animated">
                    
                    <div className="charges-header">
                        <div className="charges-title">
                            <h2>Charge Configuration</h2>
                            <p>Only admin or staff admin can create slab ranges. Everyone else can only override charges on those existing slabs.</p>
                        </div>
                        
                        <div className="charges-search-container">
                            <div className="merchant-search-wrap">
                                <span className="merchant-search-icon">🔎</span>
                                <input 
                                    type="text" 
                                    placeholder="Search any user to override..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    style={{ width: '100%' }}
                                />
                            </div>
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
                                {canCreateGlobalSlabs && <button className="add-slab-btn" onClick={handleOpenGlobalSlab}>+ Add Default Slab</button>}
                            </div>
                            <div className="charges-card animated-fade-in" style={{ background: 'rgba(99, 102, 241, 0.05)' }}>
                                <div className="table-responsive">
                                    <table className="charges-table">
                                        <thead>
                                            <tr>
                                                <th>User Role</th>
                                                <th>Service</th>
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
                                                    <td><span className={`status-pill ${['payout', 'branchx_payout'].includes(slab.serviceKey) ? 'active' : 'info'}`} style={{ fontSize: '10px' }}>{slab.serviceKey.replace('_', ' ').toUpperCase()}</span></td>
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

                    {canManageDownlineDefaults && (
                        <>
                            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3><span>↳</span> Default Charges For My {defaultTargetLabel}</h3>
                                <button className="add-slab-btn" onClick={handleOpenDownlineDefault}>+ Add Downline Default</button>
                            </div>
                            <div className="charges-card animated-fade-in" style={{ background: 'rgba(34, 197, 94, 0.05)' }}>
                                <div className="table-responsive">
                                    <table className="charges-table">
                                        <thead>
                                            <tr>
                                                <th>Applies To</th>
                                                <th>Service</th>
                                                <th>Range (Min - Max)</th>
                                                <th>Charge Type</th>
                                                <th>Value</th>
                                                <th style={{ textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {myDownlineDefaults.length === 0 ? (
                                                <tr><td colSpan="5" style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>No downline defaults configured yet.</td></tr>
                                            ) : myDownlineDefaults.map((item) => (
                                                <tr key={item.id}>
                                                    <td><strong style={{ color: '#fff', textTransform: 'capitalize' }}>{item.target_role?.replace('_', ' ')}</strong></td>
                                                    <td><span className={`status-pill ${['payout', 'branchx_payout'].includes(item.service_key) ? 'active' : 'info'}`} style={{ fontSize: '10px' }}>{item.service_key?.replace('_', ' ').toUpperCase()}</span></td>
                                                    <td><span style={{ color: '#94a3b8', fontSize: '12px' }}>{item.min_amount} - {item.max_amount >= 9999999 ? '∞' : item.max_amount}</span></td>
                                                    <td>{item.charge_type === 'percent' ? 'Percent (%)' : 'Flat (INR)'}</td>
                                                    <td>{item.charge_type === 'percent' ? `${item.charge_value}%` : `₹${item.charge_value}`}</td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <button className="delete-btn-v2" onClick={() => handleDeleteSlab(item.id, 'downline-default')}>Delete</button>
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
                                            const userSlabs = overrides.filter(o => o.target_user_id === merchant.userId);
                                            const matchingDownlineDefault = myDownlineDefaults.find((item) => item.target_role === merchant.role);
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
                                                                <span style={{ color: '#64748b', fontSize: '12px' }}>
                                                                    {matchingDownlineDefault ? 'Using Your Downline Default' : 'Using Global Defaults'}
                                                                </span>
                                                            ) : userSlabs.map(slab => (
                                                                <div key={slab.id} className="slab-badge">
                                                                    <span style={{ color: '#fff', opacity: 0.5 }}>{slab.service_key?.toUpperCase()}: </span>
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
                            <h3>{modalMode === 'global' ? 'Add Global Default' : modalMode === 'downline-default' ? 'Add Downline Default' : 'Override Amount Slab'}</h3>
                            <button className="close-modal" onClick={() => setShowModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body hide-scrollbar">
                            {modalMode === 'override' && (
                                <div style={{ marginBottom: '20px', padding: '12px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '4px' }}>Target User</div>
                                    <div style={{ color: '#fff', fontWeight: 600 }}>{targetUser?.fullName}</div>
                                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>{targetUser?.email}</div>
                                </div>
                            )}

                            <div className="modal-grid">
                                {modalMode !== 'override' && (
                                    <div className="form-group full-width">
                                        <label className="callback-label">Target Role</label>
                                        <select className="form-input-box" value={targetRole} onChange={(e) => setTargetRole(e.target.value)}>
                                            {(modalMode === 'global' ? ['master', 'merchant', 'branch'] : currentUser?.role === 'admin' || currentUser?.role === 'staff' ? ['master'] : currentUser?.role === 'master' ? ['merchant'] : ['branch']).map((roleOption) => (
                                                <option key={roleOption} value={roleOption}>{roleOption.charAt(0).toUpperCase() + roleOption.slice(1)}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                
                                <div className="form-group full-width">
                                    <label className="callback-label">Service Type</label>
                                    <select className="form-input-box" value={serviceKey} onChange={(e) => setServiceKey(e.target.value)}>
                                        <option value="payout">Settlement (Payout)</option>
                                        <option value="branchx_payout">BranchX Payout Charge</option>
                                        <option value="collection">Fund Request (Collection)</option>
                                    </select>
                                </div>
                                
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
                                {modalMode === 'global' ? 'Create Slab' : modalMode === 'downline-default' ? 'Save Default' : 'Apply Override'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChargesPage;
