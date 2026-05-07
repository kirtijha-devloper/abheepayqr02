import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { API_BASE } from '../config';
import './UserLedgerPage.css';

const formatCurrency = (value) =>
  `Rs ${Math.abs(Number(value) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const prettifyType = (value) =>
  (value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const DEFAULT_TRANSACTION_TYPES = [
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
  'qr_settlement_credit',
  'refund',
  'top_up',
  'transfer',
  'wallet',
];

const DEFAULT_STATUS_OPTIONS = ['success', 'pending', 'failed'];

const HIDDEN_TRANSACTION_TYPES = new Set([
  'hold',
  'payout',
  'pg_add',
  'qr_settlement_credit',
  'refund',
  'top_up',
  'transfer',
  'transfer_credit',
  'transfer_hold',
  'unhold',
]);

const mergeOptions = (defaults, incoming) =>
  Array.from(
    new Set(
      [...(defaults || []), ...((incoming || []).filter(Boolean))]
        .map((value) => String(value || '').toLowerCase())
        .filter((value) => value && !HIDDEN_TRANSACTION_TYPES.has(value))
    )
  ).sort((a, b) => a.localeCompare(b));

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

const UserLedgerPage = () => {
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState({ totalBalance: 0, availableBalance: 0, holdBalance: 0 });
  const [rows, setRows] = useState([]);
  const [transactionTypes, setTransactionTypes] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [status, setStatus] = useState('');

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('authToken');
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
      });

      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (transactionType) params.set('transactionType', transactionType);
      if (status) params.set('status', status);

      const res = await fetch(`${API_BASE}/wallet/ledger?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to load user ledger');
      const data = await res.json();

      setBalances(data.balances || { totalBalance: 0, availableBalance: 0, holdBalance: 0 });
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setTransactionTypes(mergeOptions(DEFAULT_TRANSACTION_TYPES, Array.isArray(data.filters?.availableTransactionTypes) ? data.filters.availableTransactionTypes : []));
      setStatusOptions(mergeOptions(DEFAULT_STATUS_OPTIONS, Array.isArray(data.filters?.availableStatuses) ? data.filters.availableStatuses : []));
      setTotalRecords(Number(data.pagination?.totalRecords) || 0);
      setTotalPages(Number(data.pagination?.totalPages) || 1);
    } catch (error) {
      console.error('User ledger fetch failed', error);
      setRows([]);
      setBalances({ totalBalance: 0, availableBalance: 0, holdBalance: 0 });
      setTransactionTypes(DEFAULT_TRANSACTION_TYPES);
      setStatusOptions(DEFAULT_STATUS_OPTIONS);
      setTotalRecords(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [endDate, page, pageSize, startDate, status, transactionType]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  useEffect(() => {
    setPage(1);
  }, [startDate, endDate, transactionType, status, pageSize]);

  const exportRows = useMemo(
    () =>
      rows.map((row, index) => ({
        serial: index + 1,
        dateTime: row.createdAt ? new Date(row.createdAt).toLocaleString() : '',
        transactionType: row.transactionType,
        source: row.sourceLabel,
        status: row.status,
        walletKind: row.walletKind,
        reference: row.reference,
        description: row.description,
        amount: `${row.direction === 'debit' ? '-' : '+'}${formatCurrency(row.amount)}`,
        balanceAfter: row.balanceAfter == null ? '' : formatCurrency(row.balanceAfter)
      })),
    [rows]
  );

  const handleExport = () => {
    const headers = ['serial', 'dateTime', 'transactionType', 'source', 'status', 'walletKind', 'reference', 'description', 'amount', 'balanceAfter'];
    downloadFile(toExcel(exportRows, headers), `user_ledger_${Date.now()}.xls`, 'application/vnd.ms-excel');
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setTransactionType('');
    setStatus('');
    setPageSize(50);
    setPage(1);
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="dashboard-body animated">
          <section className="user-ledger-title-row">
            <div>
              <h2>Passbook / Ledger</h2>
            </div>
            <div className="user-ledger-balance-grid">
              <div className="user-ledger-balance-box card">
                <span>Main Balance</span>
                <strong>{formatCurrency(balances.totalBalance)}</strong>
              </div>
              <div className="user-ledger-balance-box payout card">
                <span>Payout Balance</span>
                <strong>{formatCurrency(balances.availableBalance)}</strong>
              </div>
            </div>
          </section>

          <section className="user-ledger-filters card">
            <div className="user-ledger-filter-grid">
              <div className="user-ledger-filter">
                <label>From Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="user-ledger-filter">
                <label>To Date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="user-ledger-filter">
                <label>Transaction Type</label>
                <select value={transactionType} onChange={(e) => setTransactionType(e.target.value)}>
                  <option value="">All Types</option>
                  {transactionTypes.map((type) => (
                    <option key={type} value={type}>{prettifyType(type)}</option>
                  ))}
                </select>
              </div>
              <div className="user-ledger-filter">
                <label>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">All Statuses</option>
                  {statusOptions.map((statusValue) => (
                    <option key={statusValue} value={statusValue}>{prettifyType(statusValue)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="user-ledger-actions-row">
              <div className="user-ledger-page-size">
                <label>Rows per page:</label>
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                  {[25, 50, 100].map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>

              <div className="user-ledger-buttons">
                <button type="button" className="user-ledger-reset-btn" onClick={handleReset}>Reset</button>
                <button type="button" className="user-ledger-export-btn" onClick={handleExport}>Export</button>
              </div>
            </div>
          </section>

          <section className="user-ledger-table-card card">
            <div className="user-ledger-table-head">
              <h3>Ledger Entries</h3>
              <span>{totalRecords} records</span>
            </div>

            <div className="table-responsive">
              <table className="user-ledger-table">
                <thead>
                  <tr>
                    <th>Date &amp; Time</th>
                    <th>Type</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Reference</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Balance After</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="user-ledger-empty">Loading ledger entries...</td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="user-ledger-empty">No ledger entries found for these filters.</td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '--'}</td>
                        <td><span className="user-ledger-type-pill">{prettifyType(row.transactionType)}</span></td>
                        <td>{row.sourceLabel}</td>
                        <td><span className={`user-ledger-status-pill ${row.status}`}>{prettifyType(row.status)}</span></td>
                        <td>{row.reference || '--'}</td>
                        <td className="user-ledger-desc">{row.description || '--'}</td>
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

            <div className="user-ledger-pagination">
              <span>Page {page} of {totalPages}</span>
              <div className="user-ledger-pagination-controls">
                <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>Prev</button>
                <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages}>Next</button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default UserLedgerPage;
