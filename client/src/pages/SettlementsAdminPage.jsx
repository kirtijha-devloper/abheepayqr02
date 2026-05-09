import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { normalizeLegacyRoleText } from '../utils/roleLabels';
import './MerchantsPage.css'; // Reuse table styles

const SettlementsAdminPage = () => {
  const { fetchSettlements, settlements, approveSettlement, rejectSettlement } = useAppContext();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'staff';
  const { success, error } = useToast();
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchSettlements(filter);
      setLoading(false);
    };
    load();
  }, [filter]);

  const handleApprove = async (id) => {
    if (!window.confirm("Are you sure you want to approve this settlement?")) return;
    const res = await approveSettlement(id);
    if (res.success) success('Settlement approved.');
    else error('Failed to approve settlement.');
  };

  const handleReject = async (id) => {
    const reason = prompt("Enter reason for rejection:");
    if (reason === null) return;
    const res = await rejectSettlement(id, reason);
    if (res.success) success('Settlement rejected and funds refunded.');
    else error('Failed to reject settlement.');
  };

  const getBankDisplay = (bankJson) => {
    try {
      if (!bankJson) return "N/A";
      const details = JSON.parse(bankJson);
      return (
        <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
          <div><strong>{details.bankName}</strong></div>
          <div>{details.accountNumber}</div>
          <div style={{ opacity: 0.7 }}>{details.ifscCode}</div>
        </div>
      );
    } catch {
      return "Invalid Data";
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="dashboard-body animated">
          <div className="merchants-header" style={{ marginBottom: '24px' }}>
            <div className="merchants-title">
              <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 8px 0', color: 'var(--text-h)' }}>
                {isAdmin ? 'Settlement Management' : 'Settlement Report'}
              </h2>
              <p style={{ color: 'var(--text-mute)', margin: 0, fontSize: '14px' }}>
                {isAdmin 
                  ? 'Review and process bank withdrawal requests from the Payout Wallet, including configured charges.' 
                  : 'Track your bank withdrawal history and status.'}
              </p>
            </div>
            <div className="merchant-filter-group">
              {['all', 'pending', 'success', 'failed'].map(tab => (
                <button 
                  key={tab}
                  className={`merchant-filter-btn ${filter === tab ? 'active' : ''}`}
                  onClick={() => setFilter(tab)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {tab === 'all' ? 'All' : tab === 'success' ? 'Approved' : tab === 'failed' ? 'Rejected' : 'Pending'}
                </button>
              ))}
            </div>
          </div>

          <div className="merchants-table-card card animated-fade-in">
            <div className="table-responsive">
              <table className="merchants-table">
                <thead>
                  <tr>
                    <th>Distributor Identity</th>
                    <th>Withdrawal Amount</th>
                    <th>Destination Bank</th>
                    <th>Request Date</th>
                    <th>Current Status</th>
                    {isAdmin && <th style={{ textAlign: 'right' }}>Management</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '100px 0' }}>
                      <div className="shimmer" style={{ width: '40px', height: '40px', borderRadius: '50%', margin: '0 auto 16px' }}></div>
                      <p style={{ color: 'var(--text-mute)' }}>Synchronizing settlement records...</p>
                    </td></tr>
                  ) : settlements.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '100px 0' }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📥</div>
                      <p style={{ color: 'var(--text-mute)', fontSize: '16px' }}>No settlement requests found for this filter.</p>
                    </td></tr>
                  ) : (
                    settlements.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div className="merchant-name-cell">
                             <div className="merchant-avatar" style={{ background: 'var(--primary-dim)', color: 'var(--primary)' }}>
                              {(s.user?.profile?.fullName || 'U').charAt(0)}
                            </div>
                            <div className="merchant-name-info">
                              <div className="m-name">{normalizeLegacyRoleText(s.user?.profile?.fullName || 'Unknown Distributor')}</div>
                              <div className="m-email" style={{ fontSize: '11px', opacity: 0.6 }}>MID: {s.userId?.substring(0,8)}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-h)' }}>₹{Number(s.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                          {s.fee > 0 && <div style={{ fontSize: '11px', color: '#ef4444' }}>Fee: ₹{Number(s.fee).toFixed(2)}</div>}
                          {s.fee > 0 && <div style={{ fontSize: '11px', color: 'var(--text-mute)' }}>Total debit: ₹{(Number(s.amount || 0) + Number(s.fee || 0)).toFixed(2)}</div>}
                          {Array.isArray(s.chargeDistributions) && s.chargeDistributions.length > 0 && (
                            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {s.chargeDistributions.map((dist) => (
                                <div key={`${s.id}-${dist.userId}`} style={{ fontSize: '10px', color: '#60a5fa' }}>
                                  {dist.name} ({dist.role}): ₹{Number(dist.amount || 0).toFixed(2)}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>{getBankDisplay(s.payoutBankDetails)}</td>
                        <td>
                          <div style={{ color: 'var(--text-h)', fontSize: '13px' }}>{new Date(s.createdAt).toLocaleDateString()}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-mute)' }}>{new Date(s.createdAt).toLocaleTimeString()}</div>
                        </td>
                        <td>
                          <span className={`status-pill ${s.status === 'success' ? 'active' : s.status === 'failed' ? 'suspended' : 'pending'}`}>
                            {s.status === 'success' ? 'APPROVED' : s.status === 'failed' ? 'REJECTED' : 'PENDING'}
                          </span>
                          {s.status === 'failed' && s.description && (
                            <div style={{ fontSize: '10px', color: 'var(--text-mute)', maxWidth: '150px', marginTop: '4px', fontStyle: 'italic' }}>
                              {s.description.replace('Rejected: ', '')}
                            </div>
                          )}
                        </td>
                        {isAdmin && (
                          <td style={{ textAlign: 'right' }}>
                            {s.status === 'pending' ? (
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button className="action-btn login-btn" onClick={() => handleApprove(s.id)} style={{ padding: '8px 16px', fontSize: '12px', background: 'var(--bg-input)', color: 'var(--success)', border: '1px solid var(--border)' }}>
                                  Approve
                                </button>
                                <button className="action-btn danger-btn" onClick={() => handleReject(s.id)} style={{ padding: '8px 16px', fontSize: '12px' }}>
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--text-mute)' }}>Processed</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SettlementsAdminPage;
