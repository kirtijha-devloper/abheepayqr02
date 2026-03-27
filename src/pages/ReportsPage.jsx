import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAppContext } from '../context/AppContext';
import './ReportsPage.css';

const statusFilters = ['All', 'Completed', 'Pending', 'Failed'];

const ReportsPage = () => {
  const { reports, fetchReports } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);
      await fetchReports({ limit: 200 });
      setLoading(false);
    };

    loadReports();
  }, [fetchReports]);

  const normalizedReports = Array.isArray(reports) ? reports : [];

  const filteredReports = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return normalizedReports.filter((tx) => {
      const onStatus =
        statusFilter === 'All' || (tx.status || 'pending').toLowerCase() === statusFilter.toLowerCase();
      if (!onStatus) return false;

      if (!normalizedSearch) return true;

      const haystack = [tx.refId, tx.clientRefId, tx.description, tx.sender, tx.consumer]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [normalizedReports, searchTerm, statusFilter]);

  const filteredStats = useMemo(() => {
    const stats = { count: 0, volume: 0, statusCounts: {} };
    filteredReports.forEach((tx) => {
      const amount = Number(tx.amount) || 0;
      stats.count += 1;
      stats.volume += amount;
      const key = (tx.status || 'pending').toLowerCase();
      stats.statusCounts[key] = (stats.statusCounts[key] || 0) + 1;
    });
    return {
      count: stats.count,
      volume: Number(stats.volume.toFixed(2)),
      statusCounts: stats.statusCounts
    };
  }, [filteredReports]);

  const lastRunLabel = normalizedReports[0]?.createdAt
    ? new Date(normalizedReports[0].createdAt).toLocaleString()
    : 'No reports yet';

  const formatAmount = (value) => {
    const numberValue = Number(value) || 0;
    const formatted = Math.abs(numberValue).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${numberValue < 0 ? '-' : ''}\u20B9 ${formatted}`;
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="dashboard-body animated">
          <div className="reports-header">
            <div>
              <h2>Manual Reports</h2>
              <p>View the latest reconciliation lines that were uploaded by your admin.</p>
              <p className="reports-subtext">Showing items assigned to your QR list - Last entry {lastRunLabel}</p>
            </div>
            <div className="reports-meta">
              <span className="reports-meta-label">Records fetched</span>
              <strong>{normalizedReports.length}</strong>
            </div>
          </div>

          <div className="reports-stats-grid">
            <div className="reports-stat-card card">
              <div className="stat-title">Processed items</div>
              <div className="stat-value">{filteredStats.count}</div>
              <div className="stat-note">Filtered to {statusFilter === 'All' ? 'all statuses' : statusFilter}</div>
            </div>
            <div className="reports-stat-card card">
              <div className="stat-title">Net value</div>
              <div className="stat-value">{formatAmount(filteredStats.volume)}</div>
              <div className="stat-note">Summed from visible transactions</div>
            </div>
            <div className="reports-stat-card card">
              <div className="stat-title">Status breakdown</div>
              <div className="reports-status-row">
                {['completed', 'pending', 'failed'].map((status) => (
                  <span key={status} className={`status-pill ${status}`}>
                    {statusCountsLabel(status, filteredStats.statusCounts[status] || 0)}
                  </span>
                ))}
              </div>
              <div className="stat-note">Based on current filter</div>
            </div>
          </div>

          <div className="reports-table-card card">
            <div className="reports-table-toolbar">
              <div className="reports-search-wrap">
                <span className="reports-search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search by RRN, description, sender..."
                  className="reports-search-input"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="reports-filters">
                {statusFilters.map((filter) => (
                  <button
                    key={filter}
                    className={`reports-pill ${statusFilter === filter ? 'active' : ''}`}
                    onClick={() => setStatusFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date &amp; time</th>
                    <th>RRN</th>
                    <th>Txn ID</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Mobile</th>
                    <th>Status</th>
                    <th>Done by</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="table-empty-cell">
                        Loading reports...
                      </td>
                    </tr>
                  ) : filteredReports.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="table-empty-cell">
                        No manual report transactions available for this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredReports.map((tx) => (
                      <tr key={tx.id}>
                        <td>{tx.createdAt ? new Date(tx.createdAt).toLocaleString() : '--'}</td>
                        <td className="mono-cell">{tx.refId || '--'}</td>
                        <td>{tx.clientRefId || (tx.id || '').slice(0, 8)}</td>
                        <td>{tx.description || '--'}</td>
                        <td className="txn-amount-cell">{formatAmount(tx.amount)}</td>
                        <td>{tx.consumer || '--'}</td>
                        <td>
                          <span className={`status-pill ${(tx.status || 'pending').toLowerCase()}`}>
                            {tx.status || 'Pending'}
                          </span>
                        </td>
                        <td>{tx.sender || '--'}</td>
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

const statusCountsLabel = (status, value) => `${status} ${value}`;

export default ReportsPage;

