import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import MetricCard from '../components/MetricCard';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { formatRoleLabel, formatRolePlural } from '../utils/roleLabels';
import './AdminDashboard.css';

const MasterDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { transactions, merchants, qrCodes, fundRequests, wallet } = useAppContext();

  const metrics = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todaysTxns = (transactions || []).filter((t) => {
      const d = t?.date || t?.createdAt;
      return d && String(d).startsWith(today);
    });
    const successCount = (transactions || []).filter((t) => t?.status === 'Completed' || t?.status === 'success').length;
    const pendingRequests = (fundRequests || []).filter((r) => r?.status === 'pending').length;

    const trendMap = {};
    (transactions || []).forEach((t) => {
      const day = (t?.createdAt || '').slice(0, 10);
      if (day) trendMap[day] = (trendMap[day] || 0) + Math.abs(Number(t?.amount) || 0);
    });

    const trendData = Object.entries(trendMap).slice(-7).map(([date, value]) => ({
      name: date.slice(5),
      value,
    }));

    return {
      todaysCount: todaysTxns.length,
      todaysVolume: todaysTxns.reduce((sum, t) => sum + Math.abs(Number(t?.amount) || 0), 0),
      totalMerchants: (merchants || []).length,
      successRate: (transactions || []).length ? ((successCount / transactions.length) * 100).toFixed(1) : '0.0',
      pendingRequests,
      walletBalance: Number(wallet?.balance || 0),
      trendData: trendData.length ? trendData : [{ name: 'No data', value: 0 }],
      activeQrs: (qrCodes || []).filter((q) => q && (q.status || '').toLowerCase() === 'active').length,
    };
  }, [transactions, merchants, qrCodes, fundRequests, wallet]);

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="dashboard-body animated">
          <div className="dashboard-header-row">
            <div className="title-section">
              <h2>{formatRoleLabel('master')} Dashboard</h2>
              <p className="subtitle">Manage your distributor network and monitor performance</p>
            </div>
          </div>

          <div className="admin-hero-banner" style={{ background: 'var(--primary)' }}>
            <div className="admin-hero-text">
              <h2>Welcome, {user?.name || formatRoleLabel('master')}</h2>
              <p>Your network has <span>{metrics.totalMerchants}</span> {formatRolePlural('merchant').toLowerCase()} active today.</p>
            </div>
            <div className="admin-hero-stats">
              <div className="admin-hero-stat">
                <span className="admin-hero-stat-value">₹ {metrics.todaysVolume.toLocaleString()}</span>
                <span className="admin-hero-stat-label">TODAY'S VOLUME</span>
              </div>
              <div className="admin-hero-stat">
                <span className="admin-hero-stat-value">{metrics.todaysCount}</span>
                <span className="admin-hero-stat-label">TODAY'S TRANSACTIONS</span>
              </div>
              <button className="admin-cta-btn" onClick={() => navigate('/master/fund-requests')}>
                {metrics.pendingRequests > 0 ? `${metrics.pendingRequests} Pending Settlements` : 'View Settlements'}
              </button>
            </div>
          </div>

          <div className="admin-metrics-grid">
            <MetricCard
              title="MY WALLET"
              value={`₹ ${metrics.walletBalance.toLocaleString()}`}
              icon="💳"
              iconBg="success"
              period="available balance"
              to="/master/wallet"
            />
            <MetricCard
              title={`TOTAL ${formatRolePlural('merchant').toUpperCase()}`}
              value={metrics.totalMerchants.toString()}
              icon="👥"
              iconBg="accent"
              period="under your network"
              to="/master/merchants"
            />
            <MetricCard
              title="SUCCESS RATE"
              value={`${metrics.successRate}%`}
              icon="✓"
              iconBg="success"
              period="transaction success"
              to="/master/transactions"
            />
            <MetricCard
              title="PENDING SETTLEMENTS"
              value={metrics.pendingRequests.toString()}
              icon="📥"
              iconBg="danger"
              period="awaiting your approval"
              to="/master/fund-requests"
            />
          </div>

          <div className="activity-section">
            <div className="activity-card card">
              <div className="activity-header">
                <h3 className="activity-title">Network Transaction Trend</h3>
                <button type="button" className="view-all-link" onClick={() => navigate('/master/transactions')}>
                  View All
                </button>
              </div>
              <div className="chart-canvas">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={metrics.trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="masterTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-h)' }} />
                    <Area type="monotone" dataKey="value" stroke="#7C3AED" strokeWidth={3} fillOpacity={1} fill="url(#masterTrend)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <section className="recent-txns-section card">
            <h3 className="section-title">RECENT DISTRIBUTOR ACTIVITY</h3>
            <div className="activity-list">
              {(merchants || []).slice(0, 5).map((member, index) => (
                <div className="activity-item" key={member?.id || index}>
                  <span className="activity-icon info">{formatRoleLabel('merchant')}</span>
                  <div className="activity-details">
                    <p><strong>{member?.fullName || member?.businessName || formatRoleLabel('merchant')}</strong> - {member?.status || 'active'}</p>
                    <span className="activity-time">Wallet: ₹{Number(member?.walletBalance || 0).toLocaleString()}</span>
                  </div>
                  <button
                    className="view-all-link"
                    style={{ fontSize: '12px' }}
                    onClick={() => navigate('/master/merchants')}
                  >
                    Manage →
                  </button>
                </div>
              ))}
              {(!merchants || merchants.length === 0) && (
                <p style={{ color: '#64748b', padding: '16px 0', textAlign: 'center' }}>
                  No distributors yet. <button className="view-all-link" onClick={() => navigate('/master/merchants')}>Add one →</button>
                </p>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default MasterDashboard;
