import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { API_BASE } from '../config';
import './ChargesPage.css'; 

const ChargesPage = () => {
    const { user: currentUser } = useAuth();
    const { merchants } = useAppContext(); // Direct downlines
    const { success, error } = useToast();
    
    const [overrides, setOverrides] = useState([]);
    const [slabs, setSlabs] = useState([]); // Default global slabs
    const [allUsers, setAllUsers] = useState([]); // For search suggestion
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    
    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Modal State (for adding/editing a slab)
    const [targetUser, setTargetUser] = useState(null);
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

    const handleOpenConfig = (userObj) => {
        setTargetUser(userObj);
        setChargeType('percent');
        setChargeValue('');
        setMinAmount('0');
        setMaxAmount('999999');
        setShowModal(true);
        setSearchQuery('');
        setShowSuggestions(false);
    };

    const handleSaveSlab = async () => {
        if (!targetUser) return;
        if (Number(chargeValue) < 0) return error("Charge value cannot be negative.");
        if (Number(minAmount) < 0 || Number(maxAmount) <= Number(minAmount)) {
            return error("Invalid range. Max must be greater than Min.");
        }

        try {
            const token = sessionStorage.getItem('authToken');
            const res = await fetch(`${API_BASE}/commission/overrides`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    target_user_id: targetUser.userId || targetUser.id,
                    service_key: 'payout',
                    service_label: 'Transfer Charge',
                    min_amount: Number(minAmount),
                    max_amount: Number(maxAmount),
                    charge_type: chargeType,
                    charge_value: Number(chargeValue),
                    commission_type: 'percent', 
                    commission_value: 0
                })
            });

            if (res.ok) {
                success("Slab saved successfully!");
                fetchData();
                setChargeValue('');
                setMinAmount(Number(maxAmount) + 1);
                setMaxAmount(Number(maxAmount) + 5000);
            } else {
                const data = await res.json();
                error(data.error || "Failed to save slab.");
            }
        } catch (err) {
            error("Server error");
        }
    };

    const handleDeleteSlab = async (id) => {
        if (!window.confirm("Delete this slab?")) return;
        try {
            const token = sessionStorage.getItem('authToken');
            const res = await fetch(`${API_BASE}/commission/overrides/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                success("Slab deleted.");
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
                success("Default charge updated.");
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
                                            <div key={s.userId} className="suggestion-item" onClick={() => handleOpenConfig(s)}>
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
                    {currentUser?.role === 'admin' && (
                        <>
                            <div className="section-header">
                                <h3><span>⚙️</span> Default Global Charges (By Role)</h3>
                            </div>
                            <div className="charges-card animated-fade-in" style={{ background: 'rgba(99, 102, 241, 0.05)' }}>
                                <div className="table-responsive">
                                    <table className="charges-table">
                                        <thead>
                                            <tr>
                                                <th>User Role</th>
                                                <th>Charge Type</th>
                                                <th>Default Value</th>
                                                <th style={{ textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {defaultCharges.map(slab => (
                                                <tr key={slab.id}>
                                                    <td><strong style={{ color: '#fff', textTransform: 'capitalize' }}>{slab.role.replace('_', ' ')}</strong></td>
                                                    <td>
                                                        <select 
                                                            className="charge-input" 
                                                            style={{ width: '140px', padding: '6px' }}
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
                                                            style={{ width: '100px', padding: '6px' }}
                                                            type="number" 
                                                            value={slab.chargeValue}
                                                            onChange={(e) => {
                                                                // Local update for UI smoothness? Better to just patch.
                                                                handleUpdateDefault(slab.id, e.target.value, slab.chargeType);
                                                            }}
                                                        />
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <span className="charge-badge active">Global Default</span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {defaultCharges.length === 0 && (
                                                <tr><td colSpan="4" style={{ textAlign: 'center', color: '#64748b' }}>No global defaults set.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Manual Overrides Section */}
                    <div className="section-header">
                        <h3><span>✏️</span> Manual Overrides (Active Slabs)</h3>
                    </div>

                    <div className="charges-card animated-fade-in">
                        {loading ? (
                            <div style={{ padding: '60px', textAlign: 'center' }}>
                                <div className="shimmer" style={{ width: '40px', height: '40px', borderRadius: '50%', margin: '0 auto 16px' }}></div>
                                <p style={{ color: '#94a3b8' }}>Loading overrides...</p>
                            </div>
                        ) : merchants.length === 0 ? (
                            <div style={{ padding: '60px', textAlign: 'center' }}>
                                <p style={{ color: '#64748b' }}>Use the search box above to add a manual override for any user.</p>
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
                                        {merchants.map(merchant => {
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
                                                    <td><span className="role-badge">{merchant.role.replace('_', ' ')}</span></td>
                                                    <td>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            {userSlabs.length === 0 ? (
                                                                <span className="charge-badge unset">Using Defaults</span>
                                                            ) : (
                                                                userSlabs.sort((a,b) => a.min_amount - b.min_amount).map(s => (
                                                                    <span key={s.id} className="charge-badge active" style={{ fontSize: '11px', padding: '4px 8px' }}>
                                                                        ₹{Number(s.min_amount)} - ₹{Number(s.max_amount)} → <strong>{s.charge_value}{s.charge_type === 'percent' ? '%' : ' Rs'}</strong>
                                                                    </span>
                                                                ))
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <button onClick={() => handleOpenConfig(merchant)} className="set-charge-btn">Manage Slabs</button>
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

            {/* Modal remains largely same but with userId support */}
            {showModal && targetUser && (
                <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(4, 6, 15, 0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="charge-modal-container animated-scale-up" style={{ maxWidth: '600px', display: 'flex', gap: '32px', padding: '2rem' }}>
                        
                        <div style={{ flex: 1, borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '24px' }}>
                            <h4 style={{ margin: '0 0 1rem 0', color: '#fff' }}>Existing Slabs</h4>
                            <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {overrides.filter(o => o.target_user_id === (targetUser.userId || targetUser.id) && o.service_key === 'payout').length === 0 ? (
                                    <p style={{ color: '#64748b', fontSize: '13px' }}>No custom slabs. Using global defaults.</p>
                                ) : (
                                    overrides.filter(o => o.target_user_id === (targetUser.userId || targetUser.id) && o.service_key === 'payout')
                                        .sort((a,b) => a.min_amount - b.min_amount)
                                        .map(s => (
                                            <div key={s.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <div>
                                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>₹{Number(s.min_amount)} - ₹{Number(s.max_amount)}</div>
                                                    <div style={{ fontWeight: '700', color: '#34d399' }}>{s.charge_value}{s.charge_type === 'percent' ? '%' : ' Rs'}</div>
                                                </div>
                                                <button onClick={() => handleDeleteSlab(s.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '10px' }}>Remove</button>
                                            </div>
                                        ))
                                )}
                            </div>
                        </div>

                        <div style={{ flex: 1.2 }}>
                            <button className="modal-close-btn" onClick={() => setShowModal(false)}>&times;</button>
                            <h4 style={{ margin: '0 0 1.5rem 0', color: '#fff' }}>Override Amount Slab</h4>
                            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '-1rem', marginBottom: '1.5rem' }}>Setting for: <strong>{targetUser.fullName || targetUser.email}</strong></p>
                            
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '1rem' }}>
                                <div className="charge-form-group" style={{ flex: 1, marginBottom: 0 }}>
                                    <label>Min Amount (₹)</label>
                                    <input className="charge-input" type="number" value={minAmount} onChange={e => setMinAmount(e.target.value)} />
                                </div>
                                <div className="charge-form-group" style={{ flex: 1, marginBottom: 0 }}>
                                    <label>Max Amount (₹)</label>
                                    <input className="charge-input" type="number" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} />
                                </div>
                            </div>

                            <div className="charge-form-group">
                                <label>Charge Type</label>
                                <select className="charge-input charge-select" value={chargeType} onChange={e => setChargeType(e.target.value)}>
                                    <option value="percent">Percentage (%)</option>
                                    <option value="flat">Flat Amount (INR)</option>
                                </select>
                            </div>

                            <div className="charge-form-group">
                                <label>Charge Value</label>
                                <input className="charge-input" type="number" value={chargeValue} onChange={e => setChargeValue(e.target.value)} placeholder="0.00" />
                            </div>

                            <button onClick={handleSaveSlab} className="charge-save-btn">Apply Override</button>
                            <button onClick={() => setShowModal(false)} style={{ width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: '14px', padding: '0.8rem', marginTop: '12px', cursor: 'pointer' }}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChargesPage;
