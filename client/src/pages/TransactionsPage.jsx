import React, { useState, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAppContext } from '../context/AppContext';
import './TransactionsPage.css';

import { API_BASE } from '../config';

const TransactionsPage = () => {
  const { transactions } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [resendingId, setResendingId] = useState(null);

  const handleRetryCallback = async (txnId) => {
    setResendingId(txnId);
    try {
      const token = sessionStorage.getItem('authToken');
      const res = await fetch(`${API_BASE}/callback-logs/resend/${txnId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Retry failed");
      alert("Callback re-triggered successfully!");
    } catch (err) {
      console.error("Callback retry failed:", err);
      alert("Failed to re-trigger callback.");
    } finally {
      setResendingId(null);
    }
  };

  const filteredTransactions = useMemo(() => {
    return (transactions || []).filter(tx => {
      if (!tx) return false;
      const txId = (tx.id || '').toString().toLowerCase();
      const txDesc = (tx.description || '').toString().toLowerCase();
      const matchesSearch = txId.includes(searchTerm.toLowerCase()) || txDesc.includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || tx.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [transactions, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: (filteredTransactions || []).length,
      volume: (filteredTransactions || []).reduce((sum, tx) => {
          const amt = Number(tx.amount) || 0;
          return sum + (tx.type === 'credit' ? amt : -amt);
      }, 0)
    };
  }, [filteredTransactions]);

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Header />
        
        <main className="dashboard-body animated">
          <div className="transactions-page-header">
            <div className="transactions-title">
              <h2>Transaction History</h2>
              <p>Monitor and manage all your platform activities in real-time.</p>
            </div>
            
            <div className="transactions-header-actions">
              <button className="export-btn">
                <span>📊</span> Export CSV
              </button>
            </div>
          </div>

          <div className="txn-table-card card">
            <div className="txn-toolbar">
              <div className="txn-search-wrap">
                <span className="txn-search-icon">🔍</span>
                <input 
                  type="text" 
                  className="txn-search-input" 
                  placeholder="Search by ID or description..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="txn-filters">
                {['All', 'Completed', 'Pending', 'Failed'].map(filter => (
                  <button 
                    key={filter}
                    className={`txn-pill-filter ${statusFilter === filter ? 'active' : ''}`}
                    onClick={() => setStatusFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="table-responsive">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>RRN No</th>
                    <th>Trans. ID</th>
                    <th>Description</th>
                    <th>Mobile</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Done By</th>
                    <th>Status</th>
                    <th>Callback</th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredTransactions || []).map(tx => (
                    <tr key={tx.id}>
                      <td>{tx.createdAt || tx.date ? new Date(tx.createdAt || tx.date).toLocaleString() : '—'}</td>
                      <td className="txn-id-cell">{(tx.refId || (tx.id || '').slice(0, 8)) || '—'}</td>
                      <td>{tx.clientRefId || '—'}</td>
                      <td>{tx.description || '—'}</td>
                      <td>{tx.consumer || '—'}</td>
                      <td><span style={{textTransform: 'capitalize'}}>{tx.type || '—'}</span></td>
                      <td className={`txn-amount-cell ${(tx.type || '').toLowerCase() === 'credit' ? 'txn-amount-credit' : 'txn-amount-debit'}`}>
                        {tx.type === 'debit' || Number(tx.amount) < 0 ? '-' : '+'}₹ {Math.abs(Number(tx.amount) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                      <td>{tx.sender || '—'}</td>
                      <td>
                        <span className={`status-badge ${(tx.status || 'Pending').toLowerCase()}`}>
                          {tx.status || 'Pending'}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="txn-retry-btn"
                          disabled={resendingId === tx.id}
                          onClick={() => handleRetryCallback(tx.id)}
                        >
                          {resendingId === tx.id ? '...' : '↪'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{textAlign: 'center', padding: '3rem', color: 'var(--text-mute)'}}>
                        No transactions match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="txn-table-footer">
              <div className="txn-count-text">
                Showing {filteredTransactions.length} of {transactions.length} records
              </div>
              <div className="txn-summary-text" style={{fontWeight: '600', color: 'var(--text-h)'}}>
                Net Flow: ₹ {stats.volume.toLocaleString(undefined, {minimumFractionDigits: 2})}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default TransactionsPage;
