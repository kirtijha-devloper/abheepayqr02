import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { API_BASE } from '../config';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import './AdminReportsPage.css';

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
  const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map(row => headers.map(header => escape(row[header])).join(','))].join('\n');
};

const toExcel = (rows, headers) => {
  return [headers.join('\t'), ...rows.map(row => headers.map(header => String(row[header] ?? '')).join('\t'))].join('\n');
};

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
  { key: 'amount', label: 'Amount (Rs)', format: value => `Rs${Number(value).toLocaleString()}` },
  { key: 'paymentMode', label: 'Mode' },
  { key: 'paymentReference', label: 'Reference' },
  { key: 'status', label: 'Status' },
  { key: 'approverName', label: 'Approved By' },
  { key: 'createdAt', label: 'Date', format: value => (value ? new Date(value).toLocaleDateString() : '--') },
];

const settlementCols = [
  { key: 'serviceType', label: 'Type' },
  { key: 'amount', label: 'Amount (Rs)', format: value => `Rs${Number(value).toLocaleString()}` },
  { key: 'fee', label: 'Fee', format: value => `Rs${Number(value || 0).toFixed(2)}` },
  { key: 'status', label: 'Status' },
  { key: 'description', label: 'Description' },
  { key: 'createdAt', label: 'Date', format: value => (value ? new Date(value).toLocaleDateString() : '--') },
];

const userCols = [
  { key: 'fullName', label: 'Name' },
  { key: 'role', label: 'Role' },
  { key: 'email', label: 'Email' },
  { key: 'walletBalance', label: 'Wallet (Rs)', format: value => `Rs${Number(value || 0).toLocaleString()}` },
  { key: 'status', label: 'Status' },
  { key: 'kycStatus', label: 'KYC' },
];

const ReportTable = ({ title, rows, columns, onDownloadCSV, onDownloadExcel, loading }) => (
  <div className="card admin-reports-table-card">
    <div className="admin-reports-table-header">
      <h3 className="admin-reports-table-title">{title}</h3>
      <div className="admin-reports-table-actions">
        <button onClick={onDownloadCSV} style={btnStyle('#1e293b', '#38bdf8')}>CSV</button>
        <button onClick={onDownloadExcel} style={btnStyle('#1e293b', '#a78bfa')}>Excel</button>
      </div>
    </div>
    <div className="admin-reports-table-wrap">
      {loading ? (
        <div className="admin-reports-empty-state">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="admin-reports-empty-state">No records found</div>
      ) : (
        <table className="admin-reports-table">
          <thead>
            <tr>
              {columns.map(column => (
                <th key={column.key} className="admin-reports-table-head">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id || index} className="admin-reports-table-row">
                {columns.map(column => (
                  <td
                    key={column.key}
                    className={`admin-reports-table-cell ${column.key === 'status' ? 'admin-reports-table-cell-status' : ''}`}
                    style={column.key === 'status' ? { color: STATUS_COLORS[row[column.key]] || '#1e293b' } : undefined}
                  >
                    {column.format ? column.format(row[column.key], row) : (row[column.key] ?? '--')}
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
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [fundRequestsRes, settlementsRes, usersRes] = await Promise.all([
        fetch(`${API_BASE}/reports/admin/fund-requests`, { headers: getHeaders() }),
        fetch(`${API_BASE}/reports/admin/settlements`, { headers: getHeaders() }),
        fetch(`${API_BASE}/users/all`, { headers: getHeaders() }),
      ]);

      if (fundRequestsRes.ok) setFundRequests(await fundRequestsRes.json());
      if (settlementsRes.ok) setSettlements(await settlementsRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
    } catch (fetchError) {
      console.error('Admin reports fetch failed', fetchError);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAll();
    }, 0);

    return () => clearTimeout(timer);
  }, [fetchAll]);

  const filteredFR = useMemo(
    () => fundRequests.filter(row => (!roleFilter || row.requesterRole === roleFilter) && (!statusFilter || row.status === statusFilter)),
    [fundRequests, roleFilter, statusFilter],
  );

  const filteredSt = useMemo(
    () => settlements.filter(row => !statusFilter || row.status === statusFilter),
    [settlements, statusFilter],
  );

  const filteredUsers = useMemo(
    () => users.filter(user => !roleFilter || user.role === roleFilter),
    [users, roleFilter],
  );

  const handleDownload = (rows, columns, baseName, type) => {
    const headers = columns.map(column => column.key);
    const flat = rows.map(row => Object.fromEntries(columns.map(column => [column.key, column.format ? column.format(row[column.key], row) : row[column.key]])));
    if (type === 'csv') {
      downloadFile(toCSV(flat, headers), `${baseName}_${Date.now()}.csv`, 'text/csv');
    } else {
      downloadFile(toExcel(flat, headers), `${baseName}_${Date.now()}.xls`, 'application/vnd.ms-excel');
    }
  };

  const handleUploadClick = () => {
    if (!uploading) fileInputRef.current?.click();
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

  const pendingFundRequests = fundRequests.filter(row => row.status === 'pending').length;

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

          <div className="dashboard-header-row admin-reports-page-header">
            <div className="title-section">
              <h2>Admin Reports</h2>
              <p className="subtitle">Full visibility across all levels - fund requests, settlements, and user data</p>
              {uploadStatus && <p className="subtitle admin-reports-upload-note">{uploadStatus}</p>}
            </div>
            <div className="admin-reports-header-actions">
              <button onClick={handleUploadClick} style={btnStyle('#1e293b', '#a78bfa')}>
                {uploading ? 'Uploading...' : 'Upload Report'}
              </button>
              <button onClick={fetchAll} style={btnStyle('#1e293b', '#38bdf8')}>Refresh</button>
            </div>
          </div>

          <div className="card admin-reports-filters-card">
            <span className="admin-reports-filter-label">FILTER:</span>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="admin-reports-filter-select">
              <option value="">All Roles</option>
              <option value="master">Super Distributor</option>
              <option value="merchant">Distributor</option>
              <option value="branch">Branch</option>
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="admin-reports-filter-select">
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            {(roleFilter || statusFilter) && (
              <button onClick={() => { setRoleFilter(''); setStatusFilter(''); }} style={btnStyle('#1e293b', '#ef4444')}>
                Clear
              </button>
            )}
          </div>

          <div className="admin-reports-tabs">
            {TABS.map((tab, index) => (
              <button
                key={tab}
                onClick={() => setActiveTab(index)}
                className={`admin-reports-tab ${activeTab === index ? 'active' : ''}`}
              >
                {tab}
                {tab === 'Fund Requests' && pendingFundRequests > 0 && (
                  <span className="admin-reports-tab-badge">{pendingFundRequests}</span>
                )}
              </button>
            ))}
          </div>

          {activeTab === 0 && (
            <ReportTable
              title={`Fund Requests - All Levels (${filteredFR.length})`}
              rows={filteredFR}
              columns={fundReqCols}
              loading={loading}
              onDownloadCSV={() => handleDownload(filteredFR, fundReqCols, 'fund_requests', 'csv')}
              onDownloadExcel={() => handleDownload(filteredFR, fundReqCols, 'fund_requests', 'xls')}
            />
          )}

          {activeTab === 1 && (
            <ReportTable
              title={`Settlements - All Levels (${filteredSt.length})`}
              rows={filteredSt}
              columns={settlementCols}
              loading={loading}
              onDownloadCSV={() => handleDownload(filteredSt, settlementCols, 'settlements', 'csv')}
              onDownloadExcel={() => handleDownload(filteredSt, settlementCols, 'settlements', 'xls')}
            />
          )}

          {activeTab === 2 && (
            <ReportTable
              title={`All Users (${filteredUsers.length})`}
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
