import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { API_BASE } from '../config';
import './ChargesPage.css'; 

const ChargesPage = () => {
    const { user } = useAuth();
    const { merchants } = useAppContext(); // Downlines
    const { success, error } = useToast();
    const [overrides, setOverrides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    
    // Modal State (for adding/editing a slab)
    const [targetUser, setTargetUser] = useState(null);
    const [chargeType, setChargeType] = useState('percent');
    const [chargeValue, setChargeValue] = useState('');
    const [minAmount, setMinAmount] = useState('0');
    const [maxAmount, setMaxAmount] = useState('999999');

    const fetchOverrides = async () => {
        try {
            const token = sessionStorage.getItem('authToken');
            const res = await fetch(`${API_BASE}/commission/overrides`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setOverrides(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOverrides();
    }, []);

    const handleOpenConfig = (downline) => {
        setTargetUser(downline);
        // Reset form for a new slab
        setChargeType('percent');
        setChargeValue('');
        setMinAmount('0');
        setMaxAmount('999999');
        setShowModal(true);
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
                    target_user_id: targetUser.userId,
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
                fetchOverrides();
                // Keep modal open to show the updated list, but reset form? 
                // Actually, let's keep it simple and just reset values.
                setChargeValue('');
                setMinAmount(Number(maxAmount) + 1); // Suggest next range
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
                fetchOverrides();
            }
        } catch (err) {
            error("Delete failed");
        }
    };

    return (
        <div className="dashboard-layout">
            <Sidebar />
            <div className="main-content">
                <Header title="Hierarchy Charges" />
                <main className="dashboard-body animated">
                    <div className="charges-header">
                        <div className="charges-title">
                            <h2>Transfer Charges</h2>
                            <p>Configure tiered fees based on transaction amount for your downline.</p>
                        </div>
                    </div>

                    <div className="charges-card animated-fade-in">
                        {loading ? (
                            <div style={{ padding: '60px', textAlign: 'center' }}>
                                <div className="shimmer" style={{ width: '40px', height: '40px', borderRadius: '50%', margin: '0 auto 16px' }}></div>
                                <p style={{ color: '#94a3b8' }}>Loading members...</p>
                            </div>
                        ) : merchants.length === 0 ? (
                            <div style={{ padding: '60px', textAlign: 'center' }}>
                                <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.2 }}>👥</div>
                                <p style={{ color: '#94a3b8' }}>No downline members found.</p>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="charges-table">
                                    <thead>
                                        <tr>
                                            <th>Member Identity</th>
                                            <th>Account Role</th>
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
                                                            <div className="user-avatar-small">
                                                                {(merchant.fullName || merchant.email || 'U').charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="user-info-text">
                                                                <span className="user-name">{merchant.fullName || 'Unnamed Member'}</span>
                                                                <span className="user-email">{merchant.email}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td><span className="role-badge">{merchant.role.replace('_', ' ')}</span></td>
                                                    <td>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            {userSlabs.length === 0 ? (
                                                                <span className="charge-badge unset">No Slabs Configured (0)</span>
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

            {showModal && targetUser && (
                <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(4, 6, 15, 0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="charge-modal-container animated-scale-up" style={{ maxWidth: '600px', display: 'flex', gap: '32px', padding: '2rem' }}>
                        
                        {/* Current Slabs List */}
                        <div style={{ flex: 1, borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '24px' }}>
                            <h4 style={{ margin: '0 0 1rem 0', color: '#fff' }}>Existing Slabs</h4>
                            <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {overrides.filter(o => o.target_user_id === targetUser.userId && o.service_key === 'payout').length === 0 ? (
                                    <p style={{ color: '#64748b', fontSize: '13px' }}>No slabs defined.</p>
                                ) : (
                                    overrides.filter(o => o.target_user_id === targetUser.userId && o.service_key === 'payout')
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

                        {/* Add Slab Form */}
                        <div style={{ flex: 1.2 }}>
                            <button className="modal-close-btn" onClick={() => setShowModal(false)}>&times;</button>
                            <h4 style={{ margin: '0 0 1.5rem 0', color: '#fff' }}>Add New Amount Slab</h4>
                            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '-1rem', marginBottom: '1.5rem' }}>Setting for: <strong>{targetUser.fullName}</strong></p>
                            
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

                            <button onClick={handleSaveSlab} className="charge-save-btn">Add Slab Range</button>
                            <button onClick={() => setShowModal(false)} style={{ width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: '14px', padding: '0.8rem', marginTop: '12px', cursor: 'pointer' }}>Close Configuration</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChargesPage;
