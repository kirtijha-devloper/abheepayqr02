import React, { useState, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import MetricCard from '../components/MetricCard';
import { useAppContext } from '../context/AppContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './DashboardPage.css';

const graphData = {
  '7D': [
    { name: '15 Mar', value: 4, zero: 0 },
    { name: '16 Mar', value: 2, zero: 0 },
    { name: '17 Mar', value: 1, zero: 0 },
  ],
  '14D': [
    { name: '04 Mar', value: 1, zero: 0 },
    { name: '08 Mar', value: 8, zero: 0 },
    { name: '12 Mar', value: 3, zero: 0 },
    { name: '17 Mar', value: 1, zero: 0 },
  ],
  '30D': [
    { name: 'Feb', value: 10, zero: 0 },
    { name: 'Mar', value: 15, zero: 0 },
  ],
  '90D': [
    { name: 'Jan', value: 20, zero: 0 },
    { name: 'Feb', value: 10, zero: 0 },
    { name: 'Mar', value: 15, zero: 0 },
  ]
};

const DashboardPage = () => {
  const [activeFilter, setActiveFilter] = useState('7D');
  const [data, setData] = useState(graphData['7D']);
  const { transactions, qrCodes } = useAppContext();

  // Metrics Calculations
  const metrics = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todaysTxns = transactions.filter(t => {
      const d = t.date || t.createdAt;
      return d && typeof d === 'string' && d.startsWith(today);
    });
    
    return {
      todaysCount: todaysTxns.length,
      todaysVolume: todaysTxns.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0),
      totalCount: transactions.length,
      totalVolume: transactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0),
      successRate: transactions.length ? ((transactions.filter(t => t.status === 'Completed').length / transactions.length) * 100).toFixed(1) : '0.0',
      activeQrs: qrCodes.filter(q => q.status === 'Active').length
    };
  }, [transactions, qrCodes]);

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    setData(graphData[filter]);
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Header />
        
        <main className="dashboard-body animated">
          <div className="dashboard-header-row">
            <div className="title-section">
              <h2>Overview</h2>
              <p className="subtitle">Welcome back, here's what's happening today.</p>
            </div>
            
            <div className="time-filter-container">
              {['7D', '14D', '30D', '90D'].map((filter) => (
                <button 
                   key={filter}
                   className={`filter-btn ${activeFilter === filter ? 'active' : ''}`}
                   onClick={() => handleFilterChange(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <section className="metrics-grid-perfect">
            <MetricCard 
              title="TODAY'S TXNS" 
              value={metrics.todaysCount.toString()} 
              icon="▦" 
              iconBg="accent"
              change="+12.5%"
              period="vs yesterday"
              to="/transactions"
            />
            <MetricCard 
              title="TODAY'S VOLUME" 
              value={`₹ ${metrics.todaysVolume.toLocaleString(undefined, {minimumFractionDigits: 2})}`} 
              icon="₹" 
              iconBg="success"
              change="+8.2%"
              period="vs yesterday"
              to="/transactions"
            />
            <MetricCard 
              title="TOTAL TXNS" 
              value={metrics.totalCount.toString()} 
              icon="⇄" 
              iconBg="warning"
              change="+3.1%"
              period="this month"
              to="/transactions"
            />
            <MetricCard 
              title="TOTAL VOLUME" 
              value={`₹ ${metrics.totalVolume.toLocaleString(undefined, {minimumFractionDigits: 2})}`} 
              icon="💹" 
              iconBg="danger"
              change="-1.4%"
              period="this month"
              to="/transactions"
            />
            <MetricCard 
              title="SUCCESS RATE" 
              value={`${metrics.successRate}%`} 
              icon="✓" 
              iconBg="success"
              change="+0.5%"
              period="avg performance"
              to="/transactions"
            />
             <MetricCard 
              title="ACTIVE QR CODES" 
              value={metrics.activeQrs.toString()} 
              icon="⊞" 
              iconBg="accent"
              period="currently live"
              to="/qr-codes"
            />
          </section>

          <div className="charts-grid-perfect">
            <div className="chart-card card">
              <h3 className="chart-title">Transaction Volume Performance</h3>
              <div className="chart-canvas">
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7C6CF8" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#7C6CF8" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorAccent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#22D3EE" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                    <XAxis 
                        dataKey="name" 
                        fontSize={11} 
                        fontWeight={500}
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748b' }}
                        dy={10}
                    />
                    <YAxis 
                        fontSize={11} 
                        fontWeight={500}
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748b' }}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#12131F', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                      itemStyle={{ color: '#fff', fontSize: '12px' }}
                      labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontSize: '11px' }}
                      cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }} 
                    />
                    <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#7C6CF8" 
                        strokeWidth={3} 
                        fillOpacity={1} 
                        fill="url(#colorValue)"
                        animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="chart-card card">
              <h3 className="chart-title">Transaction Breakdown</h3>
              <div className="empty-chart-state">
                <p>Detailed analytics arriving soon.</p>
              </div>
            </div>
          </div>

          <section className="recent-txns-section card">
            <h3 className="section-title">RECENT TRANSACTIONS</h3>
            <div className="table-responsive">
              <table className="pixel-perfect-table">
                <thead>
                  <tr>
                    <th>Ref No (RRN)</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 5).map(tx => (
                    <tr key={tx.id}>
                      <td className="rrn-text">{tx.id}</td>
                      <td><span style={{textTransform: 'capitalize'}}>{tx.type}</span></td>
                      <td className="amount-text" style={{color: tx.type === 'credit' ? '#10B981' : '#EF4444'}}>
                         {tx.type === 'debit' ? '-' : '+'}₹ {Math.abs(tx.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                      <td><span className={`status-badge ${tx.status.toLowerCase()}`}>{tx.status}</span></td>
                      <td className="date-text" style={{fontSize: '12px'}}>{new Date(tx.date || tx.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                      <tr>
                          <td colSpan="5" style={{textAlign: 'center', padding: '2rem'}}>No transactions found.</td>
                      </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;
