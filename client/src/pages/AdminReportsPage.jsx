import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { API_BASE } from '../config';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';

const STATUS_COLORS = {
  pending: '#F59E0B',
  approved: '#10B981',
  rejected: '#EF4444',
  success: '#10B981',
  failed: '#EF4444',
};

const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const toCSV = (rows, headers) => {
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
};

// Simple Excel (TSV-based, opens in Excel)
const toExcel = (rows, headers) => {
  return [headers.join('\t'), ...rows.map(r => headers.map(h => String(r[h] ?? '')).join('\t'))].join('\n');
};

const ReportTable = ({ title, rows, columns, onDownloadCSV, onDownloadExcel, loading }) => (
  <div className="card" style={{ marginBottom: '24px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#e2e8f0', letterSpacing: '0.05em' }}>{title}</h3>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={onDownloadCSV} style={btnStyle('#1e293b', '#38bdf8')}>⬇ CSV</button>
        <button onClick={onDownloadExcel} style={btnStyle('#1e293b', '#a78bfa')}>⬇ Excel</button>
      </div>
    </div>
    <div style={{ overflowX: 'auto' }}>
      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>Loading...</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>No records found</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr>
              {columns.map(c => (
                <th key={c.key} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {columns.map(c => (
                  <td key={c.key} style={{ padding: '10px 16px', color: c.key === 'status' ? (STATUS_COLORS[row[c.key]] || '#e2e8f0') : '#cbd5e1', whiteSpace: 'nowrap' }}>
                    {c.format ? c.format(row[c.key], row) : (row[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </div>
);

const btnStyle = (bg, color) => ({
  background: bg,
  color,
  border: `1px solid ${color}33`,
  borderRadius: '6px',
  padding: '6px 14px',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
});

const TABS = ['Fund Requests', 'Settlements', 'All Users'];

const fundReqCols = [
  { key: 'requesterName', label: 'Requester' },
  { key: 'requesterRole', label: 'Role' },
  { key: 'amount', label: 'Amount (₹)', format: v => `₹${Number(v).toLocaleString()}` },
  { key: 'paymentMode', label: 'Mode' },
  { key: 'paymentReference', label: 'Reference' },
  { key: 'status', label: 'Status' },
  { key: 'approverName', label: 'Approved By' },
  { key: 'createdAt', label: 'Date', format: v => v ? new Date(v).toLocaleDateString() : '—' },
];

const settlementCols = [
  { key: 'serviceType', label: 'Type' },
  { key: 'amount', label: 'Amount (₹)', format: v => `₹${Number(v).toLocaleString()}` },
  { key: 'fee', label: 'Fee', format: v => `₹${Number(v || 0).toFixed(2)}` },
  { key: 'status', label: 'Status' },
  { key: 'description', label: 'Description' },
  { key: 'createdAt', label: 'Date', format: v => v ? new Date(v).toLocaleDateString() : '—' },
];

const userCols = [
  { key: 'fullName', label: 'Name' },
  { key: 'role', label: 'Role' },
  { key: 'email', label: 'Email' },
  { key: 'walletBalance', label: 'Wallet (₹)', format: v => `₹${Number(v || 0).toLocaleString()}` },
  { key: 'status', label: 'Status' },
  { key: 'kycStatus', label: 'KYC' },
];

const AdminReportsPage = () => {
  const { uploadReport } = useAppContext();
  const { success, error } = useToast();
  const [activeTab, setActiveTab] = useState(0);
  const [fundRequests, setFundRequests] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = React.useRef(null);

  const getHeaders = () => {
    const token = sessionStorage.getItem('authToken');
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [frRes, stRes, usersRes] = await Promise.all([
        fetch(`${API_BASE}/reports/admin/fund-requests`, { headers: getHeaders() }),
        fetch(`${API_BASE}/reports/admin/settlements`, { headers: getHeaders() }),
        fetch(`${API_BASE}/users/all`, { headers: getHeaders() }),
      ]);

      if (frRes.ok) setFundRequests(await frRes.json());
      if (stRes.ok) setSettlements(await stRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
    } catch (e) {
      console.error('Admin reports fetch failed', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredFR = useMemo(() => fundRequests.filter(r =>
    (!roleFilter || r.requesterRole === roleFilter) &&
    (!statusFilter || r.status === statusFilter)
  ), [fundRequests, roleFilter, statusFilter]);

  const filteredSt = useMemo(() => settlements.filter(r => !statusFilter || r.status === statusFilter), [settlements, statusFilter]);

  const filteredUsers = useMemo(() => users.filter(u => !roleFilter || u.role === roleFilter), [users, roleFilter]);

  const handleDownload = (rows, cols, baseName, type) => {
    const headers = cols.map(c => c.key);
    const flat = rows.map(r => Object.fromEntries(cols.map(c => [c.key, c.format ? c.format(r[c.key], r) : r[c.key]])));
    if (type === 'csv') {
      downloadFile(toCSV(flat, headers), `${baseName}_${Date.now()}.csv`, 'text/csv');
    } else {
      downloadFile(toExcel(flat, headers), `${baseName}_${Date.now()}.xls`, 'application/vnd.ms-excel');
    }
  };

  const handleUploadClick = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const handleReportUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    setUploadStatus('Uploading report...');
    const result = await uploadReport(file);
    setUploading(false);

    if (result.success) {
      const details = result.data || {};
      const statusLine = [
        `Processed ${details.processed || 0}`,
        details.skipped ? `Skipped ${details.skipped}` : null,
        details.errors ? `Errors ${details.errors}` : null,
      ].filter(Boolean).join(', ');
      setUploadStatus(`Upload complete. ${statusLine}`);
      success(`Upload complete. ${statusLine}`);
      fetchAll();
      return;
    }

    setUploadStatus(`Upload failed: ${result.error}`);
    error(`Upload failed: ${result.error}`);
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="dashboard-body animated">
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".csv, .xlsx, .xls"
            onChange={handleReportUpload}
          />
          <div className="dashboard-header-row">
            <div className="title-section">
              <h2>Admin Reports</h2>
              <p className="subtitle">Full visibility across all levels — fund requests, settlements, and user data</p>
              {uploadStatus && <p className="subtitle" style={{ marginTop: '6px', color: '#94a3b8' }}>{uploadStatus}</p>}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={handleUploadClick} style={btnStyle('#1e293b', '#a78bfa')}>
                {uploading ? 'Uploading...' : 'Upload Report'}
              </button>
              <button onClick={fetchAll} style={btnStyle('#1e293b', '#38bdf8')}>↻ Refresh</button>
            </div>
          </div>

          {/* Filters */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 500 }}>FILTER:</span>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 10px', fontSize: '13px' }}
            >
              <option value="">All Roles</option>
              <option value="master">Master</option>
              <option value="merchant">Merchant</option>
              <option value="branch">Branch</option>
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 10px', fontSize: '13px' }}
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            {(roleFilter || statusFilter) && (
              <button onClick={() => { setRoleFilter(''); setStatusFilter(''); }} style={btnStyle('#1e293b', '#ef4444')}>✕ Clear</button>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
            {TABS.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                style={{
                  background: activeTab === i ? 'rgba(124,58,237,0.3)' : 'transparent',
                  color: activeTab === i ? '#a78bfa' : '#64748b',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 20px',
                  fontSize: '13px',
                  fontWeight: activeTab === i ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {tab}
                {tab === 'Fund Requests' && fundRequests.filter(r => r.status === 'pending').length > 0 && (
                  <span style={{ marginLeft: '6px', background: '#ef4444', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '10px' }}>
                    {fundRequests.filter(r => r.status === 'pending').length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeTab === 0 && (
            <ReportTable
              title={`FUND REQUESTS — ALL LEVELS (${filteredFR.length})`}
              rows={filteredFR}
              columns={fundReqCols}
              loading={loading}
              onDownloadCSV={() => handleDownload(filteredFR, fundReqCols, 'fund_requests', 'csv')}
              onDownloadExcel={() => handleDownload(filteredFR, fundReqCols, 'fund_requests', 'xls')}
            />
          )}

          {activeTab === 1 && (
            <ReportTable
              title={`SETTLEMENTS — ALL LEVELS (${filteredSt.length})`}
              rows={filteredSt}
              columns={settlementCols}
              loading={loading}
              onDownloadCSV={() => handleDownload(filteredSt, settlementCols, 'settlements', 'csv')}
              onDownloadExcel={() => handleDownload(filteredSt, settlementCols, 'settlements', 'xls')}
            />
          )}

          {activeTab === 2 && (
            <ReportTable
              title={`ALL USERS (${filteredUsers.length})`}
              rows={filteredUsers}
              columns={userCols}
              loading={loading}
              onDownloadCSV={() => handleDownload(filteredUsers, userCols, 'all_users', 'csv')}
              onDownloadExcel={() => handleDownload(filteredUsers, userCols, 'all_users', 'xls')}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminReportsPage;
