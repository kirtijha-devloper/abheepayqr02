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
    
    // Modal State
    const [targetUser, setTargetUser] = useState(null);
    const [chargeType, setChargeType] = useState('percent');
    const [chargeValue, setChargeValue] = useState('');

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

    const handleEdit = (downline) => {
        setTargetUser(downline);
        // Find existing override
        const existing = overrides.find(o => o.target_user_id === downline.id && o.service_key === 'payout');
        if (existing) {
            setChargeType(existing.charge_type);
            setChargeValue(existing.charge_value);
        } else {
            setChargeType('percent');
            setChargeValue('');
        }
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!targetUser) return;
        if (Number(chargeValue) < 0) return error("Charge value cannot be negative.");

        try {
            const token = sessionStorage.getItem('authToken');
            const res = await fetch(`${API_BASE}/commission/overrides`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    target_user_id: targetUser.id,
                    service_key: 'payout',
                    service_label: 'Transfer Charge',
                    charge_type: chargeType,
                    charge_value: Number(chargeValue),
                    commission_type: 'percent', // Required by API but unused here
                    commission_value: 0
                })
            });

            if (res.ok) {
                success("Transfer charge updated successfully!");
                setShowModal(false);
                fetchOverrides();
            } else {
                const data = await res.json();
                error(data.error || "Failed to update charge.");
            }
        } catch (err) {
            error("Server error");
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
                            <p>Manage internal transfer fees (Main → Payout) for your direct downline.</p>
                        </div>
                    </div>

                    <div className="charges-card animated-fade-in">
                        {loading ? (
                            <div style={{ padding: '60px', textAlign: 'center' }}>
                                <div className="shimmer" style={{ width: '40px', height: '40px', borderRadius: '50%', margin: '0 auto 16px' }}></div>
                                <p style={{ color: '#94a3b8' }}>Loading downline members...</p>
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
                                            <th>Current Charge</th>
                                            <th style={{ textAlign: 'right' }}>Management</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {merchants.map(merchant => {
                                            const existing = overrides.find(o => o.target_user_id === merchant.id && o.service_key === 'payout');
                                            const chargeText = existing 
                                                ? `${existing.charge_value}${existing.charge_type === 'percent' ? '%' : ' Rs'}` 
                                                : "No Charge (0)";
                                                
                                            return (
                                                <tr key={merchant.id}>
                                                    <td>
                                                        <div className="user-cell">
                                                            <div className="user-avatar-small">
                                                                {(merchant.name || merchant.email || 'U').charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="user-info-text">
                                                                <span className="user-name">{merchant.name || 'Unnamed Member'}</span>
                                                                <span className="user-email">{merchant.email}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="role-badge">
                                                            {merchant.role.replace('_', ' ')}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`charge-badge ${existing ? 'active' : 'unset'}`}>
                                                            {existing ? '✓' : '•'} {chargeText}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <button 
                                                            onClick={() => handleEdit(merchant)}
                                                            className="set-charge-btn"
                                                        >
                                                            Configure
                                                        </button>
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
                <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(4, 6, 15, 0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="charge-modal-container animated-scale-up">
                        <button className="modal-close-btn" onClick={() => setShowModal(false)}>&times;</button>
                        
                        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <div className="user-avatar-small" style={{ width: '60px', height: '60px', fontSize: '1.5rem', margin: '0 auto 1rem' }}>
                                {(targetUser.name || 'U').charAt(0)}
                            </div>
                            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>Update Transfer Charge</h3>
                            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>Setting charge for <strong>{targetUser.name || targetUser.email}</strong></p>
                        </div>

                        <div className="charge-form-group">
                            <label>Charge Calculation Type</label>
                            <select 
                                className="charge-input charge-select"
                                value={chargeType} 
                                onChange={(e) => setChargeType(e.target.value)}
                            >
                                <option value="percent">Percentage (%)</option>
                                <option value="flat">Flat Amount (INR)</option>
                            </select>
                        </div>

                        <div className="charge-form-group">
                            <label>Fee Value</label>
                            <div className="charge-input-wrapper">
                                <input 
                                    className="charge-input"
                                    type="number" 
                                    placeholder={chargeType === 'percent' ? "e.g. 2.0" : "e.g. 50"} 
                                    value={chargeValue}
                                    onChange={(e) => setChargeValue(e.target.value)}
                                />
                                <span style={{ position: 'absolute', right: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>
                                    {chargeType === 'percent' ? '%' : '₹'}
                                </span>
                            </div>
                        </div>

                        <button onClick={handleSave} className="charge-save-btn">
                            Save Configuration
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChargesPage;
