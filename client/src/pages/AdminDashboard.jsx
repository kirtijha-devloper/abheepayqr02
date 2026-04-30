import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import MetricCard from '../components/MetricCard';
import { useAppContext } from '../context/AppContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './AdminDashboard.css';

const trendData = [
  { name: '12 Mar', value: 300 },
  { name: '13 Mar', value: 600 },
  { name: '14 Mar', value: 200 },
  { name: '15 Mar', value: 800 },
  { name: '16 Mar', value: 400 },
  { name: '17 Mar', value: 900 },
  { name: '18 Mar', value: 500 },
];

const COLORS = ['#8B5CF6', '#FCA5A5'];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { transactions, merchants, qrCodes, settlements } = useAppContext();

  const metrics = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todaysTxns = (transactions || []).filter(t => {
      if (!t) return false;
      const d = t.date || t.createdAt;
      return d && typeof d === 'string' && d.startsWith(today);
    });
    
    // Derived info for charts based on state
    const successCount = (transactions || []).filter(t => t && t.status === 'Completed').length;
    const failCount = (transactions || []).length - successCount;
    const statusData = [
      { name: 'Success', value: successCount || 1 },
      { name: 'Failed', value: failCount || 0 },
    ];

    const pendingPayoutsTotal = (settlements || [])
      .filter(s => s.status === 'pending')
      .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    
    return {
      todaysCount: todaysTxns.length,
      todaysVolume: todaysTxns.reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0),
      totalMerchants: (merchants || []).length,
      successRate: (transactions || []).length ? ((successCount / transactions.length) * 100).toFixed(1) : '0.0',
      activeQrs: (qrCodes || []).filter(q => q && q.status === 'Active').length,
      statusData,
      successPercent: (transactions || []).length ? Math.round((successCount / transactions.length) * 100) : 0,
      pendingPayoutsTotal
    };
  }, [transactions, merchants, qrCodes, settlements]);
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="dashboard-body animated">
          <div className="dashboard-header-row">
            <div className="title-section">
              <h2>Admin Dashboard</h2>
              <p className="subtitle">Overview of partner performance and transactions</p>
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
              title="ACTIVE QR CODES" 
              value={metrics.activeQrs.toString()} 
              icon="⊞" 
              iconBg="warning"
              period="on-field devices"
              to="/admin/qr-codes"
            />
            <MetricCard 
              title="PENDING PAYOUTS" 
              value={`₹ ${metrics.pendingPayoutsTotal.toLocaleString()}`} 
              icon="💳" 
              iconBg="danger"
              period="requires approval"
              to="/admin/settlements"
            />
          </div>

          <div className="activity-section">
            <div className="activity-card card">
              <div className="activity-header">
                <h3 className="activity-title">Live Transaction Trend</h3>
                <button type="button" className="view-all-link" onClick={() => navigate('/admin/transactions')}>Detailed Analytics</button>
              </div>
              <div className="chart-canvas">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7C6CF8" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#7C6CF8" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} hide />
                    <YAxis hide />
                    <Tooltip contentStyle={{ backgroundColor: '#12131F', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="value" stroke="#7C6CF8" strokeWidth={3} fillOpacity={1} fill="url(#colorTrend)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          <section className="recent-txns-section card">
            <h3 className="section-title">SYSTEM ALERTS & ACTIVITY</h3>
            <div className="activity-list">
                <div className="activity-item">
                    <span className="activity-icon warning">Alert</span>
                    <div className="activity-details">
                        <p>Merchant <strong>Sub-Agent 04</strong> reached 90% of their daily limit.</p>
                        <span className="activity-time">2 mins ago</span>
                    </div>
                </div>
                <div className="activity-item">
                    <span className="activity-icon info">Update</span>
                    <div className="activity-details">
                        <p>New Merchant <strong>Global Tech</strong> registered and awaiting verification.</p>
                        <span className="activity-time">1 hour ago</span>
                    </div>
                </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
