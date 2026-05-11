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
const PAYOUT_TYPES = new Set(['branchx_payout', 'branchx_payout_debit', 'branchx_payout_refund', 'payout', 'payout_debit', 'payout_refund']);

const HIDDEN_TRANSACTION_TYPES = new Set([
  'hold',
  'pg_add',
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

const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : '--');

const maskAccountNumber = (value) => {
  const digits = String(value || '').trim();
  if (!digits) return '--';
  if (digits.length <= 4) return digits;
  return `••••${digits.slice(-4)}`;
};

const computeDisplayBalance = (row) => {
  if (row.balanceAfter == null) return null;
  const amount = Math.abs(Number(row.amount) || 0);
  return row.direction === 'credit' ? row.balanceAfter - amount : row.balanceAfter + amount;
};

const getPayInSource = (row) => {
  if (row.serviceKey === 'qr_settlement') return 'QR';
  return row.sourceLabel || 'Wallet';
};

const getPayInType = (row) => {
  if (row.serviceKey === 'qr_settlement') return 'Pay-In';
  if (PAYOUT_TYPES.has(row.transactionType)) return 'Transfer to Payout Wallet';
  return prettifyType(row.transactionType);
};

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
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [activeView, setActiveView] = useState('ledger');
  const [search, setSearch] = useState('');

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

  useEffect(() => {
    if (activeView === 'payin') {
      setTransactionType('');
    }
    setSearch('');
    setPage(1);
  }, [activeView]);

  const exportRows = useMemo(
    () =>
      rows.map((row, index) => ({
        serial: index + 1,
        dateTime: row.createdAt ? new Date(row.createdAt).toLocaleString() : '',
        orderId: row.orderId || row.reference || row.id,
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

  const visibleRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return rows
      .filter((row) => {
        if (activeView === 'payout') return PAYOUT_TYPES.has(row.transactionType);
        if (activeView === 'payin') return row.serviceKey === 'qr_settlement';
        return true;
      })
      .filter((row) => {
        if (!keyword) return true;
        const haystack = [
          row.orderId,
          row.reference,
          row.description,
          row.sourceLabel,
          row.transactionType,
          row.status,
          row.slip?.bankRef,
          row.slip?.accountName,
          row.slip?.bankName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(keyword);
      });
  }, [activeView, rows, search]);

  const payInSummary = useMemo(() => {
    const payInRows = rows.filter((row) => row.serviceKey === 'qr_settlement');
    const payoutRows = rows.filter((row) => PAYOUT_TYPES.has(row.transactionType));
    const totalPayIn = payInRows.reduce((sum, row) => sum + Math.abs(Number(row.amount) || 0), 0);
    const payInNet = payInRows.reduce((sum, row) => sum + Math.max(0, Number(row.amount) || 0), 0);
    const payInCommission = payInRows.reduce((sum, row) => sum + Math.abs(Number(row.fee) || 0), 0);
    const totalPayout = payoutRows.reduce((sum, row) => sum + Math.abs(Number(row.amount) || 0), 0);
    const payoutCharge = payoutRows.reduce((sum, row) => sum + Math.abs(Number(row.fee) || 0), 0);

    return { totalPayIn, payInNet, payInCommission, totalPayout, payoutCharge };
  }, [rows]);

  const handleExport = () => {
    const headers = ['serial', 'dateTime', 'orderId', 'transactionType', 'source', 'status', 'walletKind', 'reference', 'description', 'amount', 'balanceAfter'];
    downloadFile(toExcel(exportRows, headers), `user_ledger_${Date.now()}.xls`, 'application/vnd.ms-excel');
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setTransactionType('');
    setStatus('');
    setSearch('');
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
              <div className="user-ledger-tabs">
                <button type="button" className={activeView === 'ledger' ? 'active' : ''} onClick={() => setActiveView('ledger')}>Ledger</button>
                <button type="button" className={activeView === 'payout' ? 'active' : ''} onClick={() => setActiveView('payout')}>Payout Ledger</button>
                <button type="button" className={activeView === 'payin' ? 'active' : ''} onClick={() => setActiveView('payin')}>Pay-In</button>
              </div>
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
                <label>{activeView === 'payin' ? 'Search' : 'Transaction Type'}</label>
                {activeView === 'payin' ? (
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search current report view" />
                ) : (
                  <select value={transactionType} onChange={(e) => setTransactionType(e.target.value)}>
                    <option value="">All Types</option>
                    {transactionTypes.map((type) => (
                      <option key={type} value={type}>{prettifyType(type)}</option>
                    ))}
                  </select>
                )}
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

          {activeView === 'payin' ? (
            <section className="user-ledger-payin-stats">
              <div className="user-ledger-stat-card success">
                <span>Total Pay-In</span>
                <strong>{formatCurrency(payInSummary.totalPayIn)}</strong>
                <small>Successful QR credits</small>
              </div>
              <div className="user-ledger-stat-card primary">
                <span>Pay-In Net</span>
                <strong>{formatCurrency(payInSummary.payInNet)}</strong>
                <small>Credited through QR</small>
              </div>
              <div className="user-ledger-stat-card info">
                <span>Pay-In Commission</span>
                <strong>{formatCurrency(payInSummary.payInCommission)}</strong>
                <small>Commission on pay-in entries</small>
              </div>
              <div className="user-ledger-stat-card danger">
                <span>Total Payout</span>
                <strong>{formatCurrency(payInSummary.totalPayout)}</strong>
                <small>Total payout processed</small>
              </div>
              <div className="user-ledger-stat-card warning">
                <span>Payout Charge</span>
                <strong>{formatCurrency(payInSummary.payoutCharge)}</strong>
                <small>Total payout charges</small>
              </div>
            </section>
          ) : null}

          <section className="user-ledger-table-card card">
            <div className="user-ledger-table-head">
              <h3>{activeView === 'payin' ? 'Pay-In Entries' : activeView === 'payout' ? 'Payout Entries' : 'Ledger Entries'}</h3>
              <span>{visibleRows.length} records</span>
            </div>

            <div className="table-responsive">
              <table className="user-ledger-table">
                <thead>
                  {activeView === 'payin' ? (
                    <tr>
                      <th>Date</th>
                      <th>Source</th>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Opening Balance</th>
                      <th>Credit</th>
                      <th>Debit</th>
                      <th>Closing Balance</th>
                      <th>Status</th>
                    </tr>
                  ) : (
                    <tr>
                      <th>Date &amp; Time</th>
                      <th>Order ID</th>
                      <th>Type</th>
                      <th>Source</th>
                      <th>Status</th>
                      <th>Reference</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Balance After</th>
                      <th>Slip</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={activeView === 'payin' ? 9 : 10} className="user-ledger-empty">Loading ledger entries...</td>
                    </tr>
                  ) : visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={activeView === 'payin' ? 9 : 10} className="user-ledger-empty">No ledger entries found for these filters.</td>
                    </tr>
                  ) : (
                    visibleRows.map((row) => {
                      const openingBalance = computeDisplayBalance(row);
                      return activeView === 'payin' ? (
                        <tr key={row.id}>
                          <td>{formatDateTime(row.createdAt)}</td>
                          <td>{getPayInSource(row)}</td>
                          <td><span className="user-ledger-type-pill">{getPayInType(row)}</span></td>
                          <td className="user-ledger-desc">{row.description || row.orderId || '--'}</td>
                          <td>{openingBalance == null ? '--' : formatCurrency(openingBalance)}</td>
                          <td className="credit-text">{row.direction === 'credit' ? formatCurrency(row.amount) : '--'}</td>
                          <td className="debit-text">{row.direction === 'debit' ? formatCurrency(row.amount) : '--'}</td>
                          <td>{row.balanceAfter == null ? '--' : formatCurrency(row.balanceAfter)}</td>
                          <td><span className={`user-ledger-status-pill ${row.status}`}>{prettifyType(row.status)}</span></td>
                        </tr>
                      ) : (
                        <tr key={row.id}>
                          <td>{formatDateTime(row.createdAt)}</td>
                          <td className="user-ledger-order-id">{row.orderId || row.reference || '--'}</td>
                          <td><span className="user-ledger-type-pill">{prettifyType(row.transactionType)}</span></td>
                          <td>{row.sourceLabel}</td>
                          <td><span className={`user-ledger-status-pill ${row.status}`}>{prettifyType(row.status)}</span></td>
                          <td>{row.reference || '--'}</td>
                          <td className="user-ledger-desc">{row.description || '--'}</td>
                          <td className={row.direction === 'debit' ? 'debit-text' : 'credit-text'}>
                            {row.direction === 'debit' ? '-' : '+'}{formatCurrency(row.amount)}
                          </td>
                          <td>{row.balanceAfter == null ? '--' : formatCurrency(row.balanceAfter)}</td>
                          <td>
                            {row.slip ? (
                              <button type="button" className="user-ledger-slip-btn" onClick={() => setSelectedSlip(row)}>
                                View Slip
                              </button>
                            ) : (
                              <span className="user-ledger-slip-na">--</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
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

          {selectedSlip ? (
            <div className="user-ledger-slip-overlay" onClick={() => setSelectedSlip(null)}>
              <div className="user-ledger-slip-modal card" onClick={(event) => event.stopPropagation()}>
                <div className="user-ledger-slip-header">
                  <div>
                    <p className="user-ledger-slip-eyebrow">Payout Slip</p>
                    <h3>{selectedSlip.orderId || selectedSlip.reference || 'Order Details'}</h3>
                  </div>
                  <button type="button" className="user-ledger-slip-close" onClick={() => setSelectedSlip(null)}>×</button>
                </div>

                <div className="user-ledger-slip-grid">
                  <div><span>Date & Time</span><strong>{formatDateTime(selectedSlip.slip?.createdAt || selectedSlip.createdAt)}</strong></div>
                  <div><span>Order ID</span><strong>{selectedSlip.slip?.orderId || selectedSlip.orderId || '--'}</strong></div>
                  <div><span>Status</span><strong>{prettifyType(selectedSlip.slip?.status || selectedSlip.status)}</strong></div>
                  <div><span>Amount</span><strong>{formatCurrency(selectedSlip.slip?.amount || selectedSlip.amount)}</strong></div>
                  <div><span>Charge</span><strong>{formatCurrency(selectedSlip.slip?.fee || 0)}</strong></div>
                  <div><span>Transfer Mode</span><strong>{selectedSlip.slip?.transferMode || '--'}</strong></div>
                  <div><span>Provider</span><strong>{selectedSlip.slip?.provider || '--'}</strong></div>
                  <div><span>Provider Status</span><strong>{selectedSlip.slip?.providerStatus || '--'}</strong></div>
                  <div><span>Beneficiary</span><strong>{selectedSlip.slip?.accountName || selectedSlip.slip?.beneficiary || '--'}</strong></div>
                  <div><span>Bank</span><strong>{selectedSlip.slip?.bankName || selectedSlip.slip?.bank || '--'}</strong></div>
                  <div><span>Account No.</span><strong>{maskAccountNumber(selectedSlip.slip?.accountNumber)}</strong></div>
                  <div><span>IFSC</span><strong>{selectedSlip.slip?.ifscCode || '--'}</strong></div>
                  <div><span>Reference</span><strong>{selectedSlip.slip?.reference || selectedSlip.reference || '--'}</strong></div>
                  <div><span>Bank Ref</span><strong>{selectedSlip.slip?.bankRef || '--'}</strong></div>
                </div>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
};

export default UserLedgerPage;
