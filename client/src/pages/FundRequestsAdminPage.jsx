import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAppContext } from '../context/AppContext';
import './MerchantsPage.css'; // Reusing filter-tabs styles

const FundRequestsAdminPage = () => {
  const { fundRequests, fetchFundRequests, approveFundRequest, rejectFundRequest } = useAppContext();
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    setLoading(true);
    await fetchFundRequests(); // The backend currently returns all or filtered in fundRequests.ts
    // Note: fundRequests.ts handles filtering by role, but we might need to filter by status on frontend
    setLoading(false);
  };

  const handleApprove = async (id) => {
    if (!window.confirm("Approve this fund credit?")) return;
    setActionLoading(id);
    await approveFundRequest(id);
    setActionLoading(null);
  };

  const handleReject = async (id) => {
    const reason = window.prompt("Reason for rejection:");
    if (reason === null) return;
    setActionLoading(id);
    await rejectFundRequest(id, reason);
    setActionLoading(null);
  };

  const filteredRequests = (fundRequests || []).filter(r => 
    filter === 'all' ? true : r.status === filter
  );

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="dashboard-body animated">
          <div className="merchants-header" style={{ marginBottom: '24px' }}>
            <div className="merchants-title">
              <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 8px 0', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Fund Addition Requests
              </h2>
              <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>Review and approve manual fund credit requests from merchants.</p>
            </div>
            <div className="merchant-filter-group">
              {['pending', 'approved', 'rejected', 'all'].map(tab => (
                <button 
                  key={tab}
                  className={`merchant-filter-btn ${filter === tab ? 'active' : ''}`}
                  onClick={() => setFilter(tab)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="merchants-table-card card animated-fade-in">
            <div className="table-responsive">
              <table className="merchants-table">
                <thead>
                  <tr>
                    <th>Requester Identity</th>
                    <th>Destination Bank</th>
                    <th>Credit Amount</th>
                    <th>Payment Reference</th>
                    <th>Request Status</th>
                    <th style={{ textAlign: 'right' }}>Management</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '100px 0' }}>
                      <div className="shimmer" style={{ width: '40px', height: '40px', borderRadius: '50%', margin: '0 auto 16px' }}></div>
                      <p style={{ color: '#94a3b8' }}>Synchronizing fund requests...</p>
                    </td></tr>
                  ) : filteredRequests.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '100px 0' }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📥</div>
                      <p style={{ color: '#94a3b8', fontSize: '16px' }}>No fund requests found for this filter.</p>
                    </td></tr>
                  ) : filteredRequests.map(r => (
                    <tr key={r.id}>
                      <td>
                        <div className="merchant-name-cell">
                          <div className="merchant-avatar" style={{ background: 'linear-gradient(135deg, #10b98133, #05966933)', color: '#34d399' }}>
                            {(r.requesterName || 'U').charAt(0)}
                          </div>
                          <div className="merchant-name-info">
                            <div className="m-name">{r.requesterName}</div>
                            <div className="m-email" style={{ fontSize: '11px', opacity: 0.6 }}>{r.requesterRole?.toUpperCase()}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ color: '#fff', fontSize: '13px' }}>{r.bankName || 'Company Bank'}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: '700', fontSize: '15px', color: '#fff' }}>₹ {Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#60a5fa' }}>{r.paymentReference}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(r.paymentDate).toLocaleDateString()}</div>
                      </td>
                      <td>
                        <span className={`status-pill ${r.status?.toLowerCase() === 'approved' ? 'active' : r.status?.toLowerCase() === 'rejected' ? 'suspended' : 'pending'}`}>
                          {r.status?.toUpperCase()}
                        </span>
                        {r.status === 'rejected' && r.rejectionReason && (
                          <div style={{ fontSize: '10px', color: '#94a3b8', maxWidth: '150px', marginTop: '4px', fontStyle: 'italic' }}>
                            {r.rejectionReason}
                          </div>
                        )}
                        {r.status === 'approved' && r.approverName && (
                          <div style={{ fontSize: '10px', color: '#4ade80', marginTop: '4px' }}>
                            By {r.approverName}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {r.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button 
                              className="action-btn login-btn" 
                              onClick={() => handleApprove(r.id)}
                              disabled={actionLoading === r.id}
                              style={{ padding: '8px 16px', fontSize: '12px', background: '#10b98122', color: '#34d399', border: '1px solid #10b98144' }}
                            >
                              Approve
                            </button>
                            <button 
                              className="action-btn danger-btn" 
                              onClick={() => handleReject(r.id)}
                              disabled={actionLoading === r.id}
                              style={{ padding: '8px 16px', fontSize: '12px' }}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Processed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default FundRequestsAdminPage;
