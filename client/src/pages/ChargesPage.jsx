import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { API_BASE } from '../config';
import './ReportsPage.css'; // Reuse existing table styling

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
                    <div className="text-section" style={{ marginBottom: '24px' }}>
                        <h2>Transfer Charges</h2>
                        <p>Set the Main to Payout Wallet transfer charge for your direct downline members.</p>
                    </div>

                    <div className="card" style={{ padding: '24px' }}>
                        {loading ? (
                            <p>Loading downline members...</p>
                        ) : merchants.length === 0 ? (
                            <p className="empty-state">No downline members found.</p>
                        ) : (
                            <div className="table-responsive">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Role</th>
                                            <th>Current Charge</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {merchants.map(merchant => {
                                            const existing = overrides.find(o => o.target_user_id === merchant.id && o.service_key === 'payout');
                                            const chargeText = existing 
                                                ? `${existing.charge_value}${existing.charge_type === 'percent' ? '%' : ' Rs'}` 
                                                : "Not Set (0)";
                                                
                                            return (
                                                <tr key={merchant.id}>
                                                    <td>{merchant.name || merchant.email}</td>
                                                    <td style={{ textTransform: 'capitalize' }}>{merchant.role.replace('_', ' ')}</td>
                                                    <td><span className={`status-pill ${existing ? 'success' : 'pending'}`}>{chargeText}</span></td>
                                                    <td>
                                                        <button 
                                                            onClick={() => handleEdit(merchant)}
                                                            className="action-btn edit-btn"
                                                            style={{ padding: '6px 12px', fontSize: '13px' }}
                                                        >
                                                            Set Charge
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
                <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="card animated-scale-up" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <h3 style={{ margin: 0 }}>Set Charge for {targetUser.name}</h3>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '20px' }}>&times;</button>
                        </div>

                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label>Charge Type</label>
                            <select 
                                value={chargeType} 
                                onChange={(e) => setChargeType(e.target.value)}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', marginTop: '8px' }}
                            >
                                <option value="percent">Percentage (%)</option>
                                <option value="flat">Flat Amount (Rs)</option>
                            </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: '24px' }}>
                            <label>Charge Value</label>
                            <input 
                                type="number" 
                                placeholder="e.g. 2.5" 
                                value={chargeValue}
                                onChange={(e) => setChargeValue(e.target.value)}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', marginTop: '8px' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={handleSave} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>Save Charge</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChargesPage;
