import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { API_BASE } from '../config';
import './AdminLedgerPage.css';

const formatCurrency = (value) =>
  `Rs ${Math.abs(Number(value) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const toExcel = (rows, headers) =>
  [headers.join('\t'), ...rows.map((row) => headers.map((header) => String(row[header] ?? '')).join('\t'))].join('\n');

const prettifyType = (value) =>
  (value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const DEFAULT_ROLE_OPTIONS = ['admin', 'staff', 'master', 'merchant', 'branch'];
const DEFAULT_TRANSACTION_TYPE_OPTIONS = [
  'bank_deposit',
  'branchx_payout',
  'branchx_payout_debit',
  'branchx_payout_refund',
  'commission',
  'fund_request_approved',
  'fund_request_failed',
  'fund_request_pending',
  'payout',
  'pg_add',
  'qr_settlement',
  'refund',
  'top_up',
  'transfer',
  'wallet',
];

const HIDDEN_TRANSACTION_TYPES = new Set([
  'hold',
  'payout',
  'pg_add',
  'refund',
  'top_up',
  'transfer',
  'transfer_credit',
  'transfer_hold',
  'unhold',
]);

const prettifyLedgerType = (value) => {
  if (value === 'qr_settlement') return 'Pay-In';
  return prettifyType(value);
};

const mergeOptions = (defaults, incoming) =>
  Array.from(
    new Set(
      [...(defaults || []), ...((incoming || []).filter(Boolean))]
        .map((value) => String(value || '').toLowerCase())
        .filter((value) => value && !HIDDEN_TRANSACTION_TYPES.has(value))
    )
  ).sort((a, b) => a.localeCompare(b));

const AdminLedgerPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ totalCount: 0, totalAmount: 0, totalCredit: 0, totalDebit: 0 });
  const [roleOptions, setRoleOptions] = useState([]);
  const [typeOptions, setTypeOptions] = useState([]);
  const [roleFilter, setRoleFilter] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = sessionStorage.getItem('authToken');
      const params = new URLSearchParams();
      if (roleFilter) params.set('role', roleFilter);
      if (transactionType) params.set('transactionType', transactionType);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const query = params.toString();
      const res = await fetch(`${API_BASE}/reports/admin/ledger${query ? `?${query}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to load ledger');
      const data = await res.json();
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setSummary(data.summary || { totalCount: 0, totalAmount: 0, totalCredit: 0, totalDebit: 0 });
      setRoleOptions(mergeOptions(DEFAULT_ROLE_OPTIONS, Array.isArray(data.filters?.roles) ? data.filters.roles : []));
      setTypeOptions(
        mergeOptions(
          DEFAULT_TRANSACTION_TYPE_OPTIONS,
          Array.isArray(data.filters?.transactionTypes)
            ? data.filters.transactionTypes
            : Array.isArray(data.availableTransactionTypes)
              ? data.availableTransactionTypes
              : []
        )
      );
    } catch (error) {
      console.error('Ledger fetch failed', error);
      setError('Unable to load ledger data from the backend right now.');
      setRows([]);
      setSummary({ totalCount: 0, totalAmount: 0, totalCredit: 0, totalDebit: 0 });
      setRoleOptions(DEFAULT_ROLE_OPTIONS);
      setTypeOptions(DEFAULT_TRANSACTION_TYPE_OPTIONS);
    } finally {
      setLoading(false);
    }
  }, [endDate, roleFilter, startDate, transactionType]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const exportRows = useMemo(
    () =>
      rows.map((row, index) => ({
        serial: index + 1,
        dateTime: row.createdAt ? new Date(row.createdAt).toLocaleString() : '',
        userName: row.userName,
        userPhone: row.userPhone,
        role: row.role,
        transactionType: row.transactionType,
        source: row.sourceLabel,
        description: row.description,
        reference: row.reference,
        status: row.status,
        amount: `${row.direction === 'debit' ? '-' : '+'}${formatCurrency(row.amount)}`,
        balanceAfter: row.balanceAfter == null ? '' : formatCurrency(row.balanceAfter)
      })),
    [rows]
  );

  const handleExport = () => {
    const headers = ['serial', 'dateTime', 'userName', 'userPhone', 'role', 'transactionType', 'source', 'description', 'reference', 'status', 'amount', 'balanceAfter'];
    downloadFile(toExcel(exportRows, headers), `admin_ledger_${Date.now()}.xls`, 'application/vnd.ms-excel');
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="dashboard-body animated">
          <section className="ledger-hero card">
            <div>
              <p className="ledger-eyebrow">Admin Ledger</p>
              <h2>Unified Ledger Report</h2>
              <p className="ledger-subtitle">Wallet entries, service transactions, and fund request movements in one admin view.</p>
            </div>
            <button className="ledger-export-btn" onClick={handleExport}>Export Excel</button>
          </section>

          <section className="ledger-stats-grid">
            <div className="ledger-stat card">
              <span>Total Rows</span>
              <strong>{summary.totalCount}</strong>
            </div>
            <div className="ledger-stat card">
              <span>Net Amount</span>
              <strong>{formatCurrency(summary.totalAmount)}</strong>
            </div>
            <div className="ledger-stat card">
              <span>Total Credit</span>
              <strong className="credit-text">{formatCurrency(summary.totalCredit)}</strong>
            </div>
            <div className="ledger-stat card">
              <span>Total Debit</span>
              <strong className="debit-text">{formatCurrency(summary.totalDebit)}</strong>
            </div>
          </section>

          <section className="ledger-filters card">
            <div className="ledger-filter-group">
              <label>Search by Role</label>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">All roles</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>{prettifyType(role)}</option>
                ))}
              </select>
            </div>
            <div className="ledger-filter-group">
              <label>Transaction Type</label>
              <select value={transactionType} onChange={(e) => setTransactionType(e.target.value)}>
                <option value="">Every transaction type</option>
                {typeOptions.map((type) => (
                  <option key={type} value={type}>{prettifyLedgerType(type)}</option>
                ))}
              </select>
            </div>
            <div className="ledger-filter-group">
              <label>Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="ledger-filter-group">
              <label>End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </section>

          {error ? (
            <section className="ledger-error card">
              <strong>Ledger load failed</strong>
              <span>{error}</span>
            </section>
          ) : null}

          <section className="ledger-table-card card">
            <div className="ledger-table-head">
              <h3>Transaction List</h3>
              <button className="ledger-refresh-btn" onClick={fetchLedger}>Refresh</button>
            </div>

            <div className="table-responsive">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date &amp; Time</th>
                    <th>User Details</th>
                    <th>Role</th>
                    <th>Type</th>
                    <th>Source</th>
                    <th>Description</th>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Balance After</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="11" className="ledger-empty">Loading ledger entries...</td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan="11" className="ledger-empty">No ledger transactions found for the selected filters.</td>
                    </tr>
                  ) : (
                    rows.map((row, index) => (
                      <tr key={row.id}>
                        <td>{index + 1}</td>
                        <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '--'}</td>
                        <td>
                          <div className="ledger-user-cell">
                            <strong>{row.userName || '--'}</strong>
                            <span>{row.userPhone || row.userEmail || '--'}</span>
                          </div>
                        </td>
                        <td><span className="ledger-role-pill">{prettifyType(row.role)}</span></td>
                        <td><span className="ledger-type-pill">{prettifyLedgerType(row.transactionType)}</span></td>
                        <td>{row.sourceLabel}</td>
                        <td className="ledger-description">{row.description || '--'}</td>
                        <td>{row.reference || '--'}</td>
                        <td><span className={`ledger-status-pill ${(row.status || 'pending').toLowerCase()}`}>{row.status || 'pending'}</span></td>
                        <td className={row.direction === 'debit' ? 'debit-text' : 'credit-text'}>
                          {row.direction === 'debit' ? '-' : '+'}{formatCurrency(row.amount)}
                        </td>
                        <td>{row.balanceAfter == null ? '--' : formatCurrency(row.balanceAfter)}</td>
                      </tr>
                    ))
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

export default AdminLedgerPage;
