import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import MetricCard from '../components/MetricCard';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { transactions, merchants, qrCodes, settlements, fundRequests, fetchFundRequests } = useAppContext();
  const [timeRange, setTimeRange] = useState(7); // Default 7 days

  useEffect(() => {
    fetchFundRequests();
  }, [fetchFundRequests]);

  const metrics = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todaysTxns = (transactions || []).filter(t => {
      if (!t) return false;
      const d = t.date || t.createdAt;
      return d && typeof d === 'string' && d.startsWith(today);
    });
    
    const successCount = (transactions || []).filter(t => t && (t.status === 'Completed' || t.status === 'success')).length;
    const successRate = (transactions || []).length ? ((successCount / transactions.length) * 100).toFixed(1) : '0.0';
    
    const pendingPayoutsTotal = (settlements || [])
      .filter(s => (s.status || '').toLowerCase() === 'pending')
      .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

    const pendingFundRequestsCount = (fundRequests || [])
      .filter(f => (f.status || '').toLowerCase() === 'pending').length;
    
    return {
      todaysCount: todaysTxns.length,
      todaysVolume: todaysTxns.reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0),
      totalMerchants: (merchants || []).length,
      successRate,
      activeQrs: (qrCodes || []).filter(q => q && (q.status || '').toLowerCase() !== 'disabled').length,
      pendingPayoutsTotal,
      pendingFundRequestsCount
    };
  }, [transactions, merchants, qrCodes, settlements, fundRequests]);

  const trendData = useMemo(() => {
    const days = [];
    for (let i = timeRange - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      
      const dayVolume = (transactions || [])
        .filter(t => (t.date || t.createdAt || '').startsWith(dateStr))
        .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0);
        
      days.push({ name: dayLabel, value: dayVolume });
    }
    return days;
  }, [transactions, timeRange]);

  const recentAlerts = useMemo(() => {
    const alerts = [
      ...(fundRequests || [])
        .filter(f => (f.status || '').toLowerCase() === 'pending')
        .map(f => ({
          id: f.id,
          type: 'REQ',
          label: 'Fund Request',
          message: `New fund request of ₹${f.amount.toLocaleString()} received from ${f.user?.fullName || 'Merchant'}.`,
          time: new Date(f.createdAt).toLocaleString(),
          path: '/admin/fund-requests'
        })),
      ...(settlements || [])
        .filter(s => (s.status || '').toLowerCase() === 'pending')
        .map(s => ({
          id: s.id,
          type: 'PAY',
          label: 'Settlement',
          message: `Payout request of ₹${s.amount.toLocaleString()} from ${s.user?.profile?.fullName || s.user?.fullName || 'Merchant'}.`,
          time: new Date(s.createdAt).toLocaleString(),
          path: '/admin/settlements'
        }))
    ];
    
    // Sort by time descending
    return alerts.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10);
  }, [fundRequests, settlements]);

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="dashboard-body animated">
          <div className="dashboard-header-row">
            <div className="title-section">
              <h2>{user?.role === 'staff' ? 'Staff Panel' : 'Admin Dashboard'}</h2>
              <p className="subtitle">{user?.role === 'staff' ? 'Manage delegated tasks and view reports' : 'Overview of partner performance and transactions'}</p>
            </div>
          </div>

          <div className="admin-hero-banner">
            <div className="admin-hero-text">
              <h2>Welcome to Admin Central</h2>
              <p>System is running at <span>99.9%</span> uptime today.</p>
            </div>
            <div className="admin-hero-stats">
              <div className="admin-hero-stat">
                <span className="admin-hero-stat-value">₹ {metrics.todaysVolume.toLocaleString()}</span>
                <span className="admin-hero-stat-label">TODAY'S VOLUME</span>
              </div>
              <div className="admin-hero-stat">
                <span className="admin-hero-stat-value">{metrics.todaysCount}</span>
                <span className="admin-hero-stat-label">TOTAL REQUESTS</span>
              </div>
              <button className="admin-cta-btn" onClick={() => navigate('/admin/callbacks')}>
                View System Logs
              </button>
            </div>
          </div>

          <div className="admin-metrics-grid">
            <MetricCard 
              title="TOTAL MERCHANTS" 
              value={metrics.totalMerchants.toString()} 
              icon="👥" 
              iconBg="accent"
              change="+5"
              period="new this week"
              to="/admin/merchants"
            />
            <MetricCard 
              title="SYSTEM SUCCESS" 
              value={`${metrics.successRate}%`} 
              icon="✓" 
              iconBg="success"
              change="+0.2%"
              period="vs last month"
              to="/admin/transactions"
            />
            <MetricCard 
              title="TOTAL ACTIVE QRS" 
              value={metrics.activeQrs.toString()} 
              icon="⊞" 
              iconBg="warning"
              period="on-field devices"
              to="/admin/qr-codes?tab=inventory"
            />
            <MetricCard 
              title="PENDING PAYOUTS" 
              value={`₹ ${metrics.pendingPayoutsTotal.toLocaleString()}`} 
              icon="💳" 
              iconBg="danger"
              period={metrics.pendingPayoutsTotal > 0 ? "requires approval" : "all clear"}
              to="/admin/settlements"
            />
          </div>

          <div className="activity-section">
            <div className="activity-card card">
              <div className="activity-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <h3 className="activity-title">Transaction Volume Trend</h3>
                  <div className="range-selector" style={{ display: 'flex', gap: '8px' }}>
                    {[1, 2, 7, 15, 30].map(r => (
                      <button 
                        key={r}
                        className={`range-btn ${timeRange === r ? 'active' : ''}`}
                        onClick={() => setTimeRange(r)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          background: timeRange === r ? '#6366f1' : 'rgba(255,255,255,0.05)',
                          color: '#fff',
                          border: '1px solid rgba(255,255,255,0.1)',
                          cursor: 'pointer'
                        }}
                      >
                        {r === 1 ? '1D' : r === 2 ? '2D' : `${r}D`}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="button" className="view-all-link" onClick={() => navigate('/admin/transactions')}>Detailed Analytics</button>
              </div>
              <div className="chart-canvas" style={{ padding: '20px' }}>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="name" fontSize={10} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis fontSize={10} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(v) => [`₹${v.toLocaleString()}`, 'Volume']}
                    />
                    <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorTrend)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          <section className="recent-txns-section card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="section-title" style={{ margin: 0 }}>SYSTEM ALERTS & ACTION ITEMS</h3>
              {(metrics.pendingFundRequestsCount + (settlements?.filter(s => s.status === 'pending').length || 0)) > 0 && (
                <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>
                  {metrics.pendingFundRequestsCount + (settlements?.filter(s => s.status === 'pending').length || 0)} PENDING
                </span>
              )}
            </div>
            <div className="activity-list">
              {recentAlerts.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ fontSize: '32px', marginBottom: '10px' }}>✅</div>
                  <p>No new requests or alerts to process.</p>
                </div>
              ) : recentAlerts.map(alert => (
                <div key={`${alert.type}-${alert.id}`} className="activity-item" style={{ cursor: 'pointer' }} onClick={() => navigate(alert.path)}>
                  <span className={`activity-icon ${alert.type === 'REQ' ? 'info' : 'warning'}`}>{alert.type}</span>
                  <div className="activity-details">
                    <p><strong>[{alert.label}]</strong> {alert.message}</p>
                    <span className="activity-time">{alert.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
