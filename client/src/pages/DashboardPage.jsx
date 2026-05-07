import React, { useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import MetricCard from '../components/MetricCard';
import { useAppContext } from '../context/AppContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './DashboardPage.css';

const FILTER_TO_DAYS = { '7D': 7, '14D': 14, '30D': 30, '90D': 90 };

const DashboardPage = () => {
  const [activeFilter, setActiveFilter] = useState('7D');
  const { transactions, qrCodes } = useAppContext();

  const metrics = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const safeTransactions = Array.isArray(transactions) ? transactions : [];
    const todaysTxns = safeTransactions.filter((txn) => {
      const rawDate = txn?.date || txn?.createdAt;
      return rawDate && String(rawDate).startsWith(today);
    });

    const creditTransactions = safeTransactions.filter((txn) => String(txn?.type || '').toLowerCase() === 'credit');
    const successTransactions = safeTransactions.filter((txn) => {
      const normalized = String(txn?.status || '').toLowerCase();
      return normalized === 'completed' || normalized === 'success';
    });

    return {
      todaysCount: todaysTxns.length,
      todaysVolume: todaysTxns.reduce((sum, txn) => sum + (Math.abs(Number(txn?.amount) || 0)), 0),
      totalCount: safeTransactions.length,
      totalVolume: creditTransactions.reduce((sum, txn) => sum + (Math.abs(Number(txn?.amount) || 0)), 0),
      successRate: safeTransactions.length ? ((successTransactions.length / safeTransactions.length) * 100).toFixed(1) : '0.0',
      activeQrs: (qrCodes || []).filter((qr) => qr && String(qr.status || '').toLowerCase() === 'active').length,
    };
  }, [transactions, qrCodes]);

  const trendData = useMemo(() => {
    const totalDays = FILTER_TO_DAYS[activeFilter] || 7;
    const safeTransactions = Array.isArray(transactions) ? transactions : [];
    const days = [];

    for (let i = totalDays - 1; i >= 0; i -= 1) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const label = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

      const value = safeTransactions
        .filter((txn) => {
          const rawDate = txn?.date || txn?.createdAt;
          return rawDate && String(rawDate).startsWith(dateKey);
        })
        .reduce((sum, txn) => sum + (Math.abs(Number(txn?.amount) || 0)), 0);

      days.push({ name: label, value });
    }

    return days;
  }, [activeFilter, transactions]);

  const statusBreakdown = useMemo(() => {
    const counts = (Array.isArray(transactions) ? transactions : []).reduce((acc, txn) => {
      const key = String(txn?.status || 'pending').toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

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
                  onClick={() => setActiveFilter(filter)}
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
              icon="Tx"
              iconBg="accent"
              period="today"
              to="/transactions"
            />
            <MetricCard
              title="TODAY'S VOLUME"
              value={`Rs ${metrics.todaysVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              icon="Rs"
              iconBg="success"
              period="today"
              to="/transactions"
            />
            <MetricCard
              title="TOTAL TXNS"
              value={metrics.totalCount.toString()}
              icon="Tr"
              iconBg="warning"
              period="live total"
              to="/transactions"
            />
            <MetricCard
              title="TOTAL VOLUME"
              value={`Rs ${metrics.totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              icon="Vol"
              iconBg="danger"
              period="live volume"
              to="/transactions"
            />
            <MetricCard
              title="SUCCESS RATE"
              value={`${metrics.successRate}%`}
              icon="OK"
              iconBg="success"
              period="live performance"
              to="/transactions"
            />
            <MetricCard
              title="ACTIVE QR CODES"
              value={metrics.activeQrs.toString()}
              icon="QR"
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
                  <AreaChart data={trendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7C6CF8" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#7C6CF8" stopOpacity={0} />
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
                {statusBreakdown.length === 0 ? (
                  <p>No live transaction data available yet.</p>
                ) : (
                  <div style={{ width: '100%' }}>
                    {statusBreakdown.map(([status, count]) => (
                      <div key={status} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ textTransform: 'capitalize' }}>{status}</span>
                        <strong>{count}</strong>
                      </div>
                    ))}
                  </div>
                )}
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
                  {(transactions || []).slice(0, 5).map((txn) => (
                    <tr key={txn.id}>
                      <td className="rrn-text">{txn.id}</td>
                      <td><span style={{ textTransform: 'capitalize' }}>{txn.type}</span></td>
                      <td className="amount-text" style={{ color: txn.type === 'credit' ? '#10B981' : '#EF4444' }}>
                        {txn.type === 'debit' ? '-' : '+'}Rs {Math.abs(Number(txn.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td><span className={`status-badge ${String(txn.status || '').toLowerCase()}`}>{txn.status}</span></td>
                      <td className="date-text" style={{ fontSize: '12px' }}>{new Date(txn.date || txn.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {(!transactions || transactions.length === 0) && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No transactions found.</td>
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
