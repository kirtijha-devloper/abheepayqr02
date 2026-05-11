import React, { useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { QRCodeSVG } from 'qrcode.react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { UPLOADS_BASE } from '../config';
import './QrCodesPage.css';

const formatCurrency = (value) => `Rs ${Number(value || 0).toFixed(2)}`;
const formatCompactUpi = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return 'N/A';
  if (normalized.length <= 4) return normalized;
  return `${normalized.substring(0, 4)}••••`;
};

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
};

const titleCase = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return 'QR';
  return normalized
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

const getQrValueType = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return 'missing';
  if (normalized.startsWith('MANUAL-UPI')) return 'manual';
  if (normalized.startsWith('000201')) return 'raw_emv';
  if (normalized.startsWith('upi://') || normalized.startsWith('UPI://')) return 'upi_uri';
  return normalized.includes('@') ? 'upi_id' : 'unknown';
};

const QrCodesPage = () => {
  const { qrCodes, updateQrCode, fetchQrReport } = useAppContext();
  const { user } = useAuth();
  const { success, error } = useToast();
  const [activeTab, setActiveTab] = useState('My QR');
  const [dynamicAmount, setDynamicAmount] = useState('');
  const [fixingQr, setFixingQr] = useState(null);
  const [manualUpi, setManualUpi] = useState('');
  const [isFixing, setIsFixing] = useState(false);
  const [reportQr, setReportQr] = useState(null);
  const [qrReport, setQrReport] = useState(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportFilters, setReportFilters] = useState({ startDate: '', endDate: '' });

  const [showPreview, setShowPreview] = useState(false);

  const myInventoryQrs = useMemo(() => {
    return qrCodes || [];
  }, [qrCodes]);

  const myDirectQrs = useMemo(() => myInventoryQrs.filter((q) => q.status === 'active'), [myInventoryQrs]);

  const activeQr = useMemo(() => {
    if (myDirectQrs.length === 0) return null;
    const sorted = [...myDirectQrs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sorted[0];
  }, [myDirectQrs]);

  const activeDynamicQr = useMemo(() => {
    if (myDirectQrs.length === 0) return null;
    const sorted = [...myDirectQrs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sorted.find((q) => {
      const valueType = getQrValueType(q.upiId);
      return valueType === 'upi_id' || valueType === 'upi_uri';
    }) || null;
  }, [myDirectQrs]);

  const dynamicQrIssue = useMemo(() => {
    if (activeDynamicQr) return '';
    if (myDirectQrs.length === 0) return 'No active QR is assigned to this user yet.';
    const latestQr = activeQr;
    const valueType = getQrValueType(latestQr?.upiId);
    if (valueType === 'manual') {
      return 'Dynamic QR is not available on placeholder MANUAL-UPI records. Assign a real UPI QR first.';
    }
    if (valueType === 'raw_emv') {
      return 'Dynamic QR is not available on raw static QR payloads here. Assign a real UPI ID based QR for amount-locked payments.';
    }
    return 'Dynamic QR needs an active QR with a valid UPI ID or UPI payment link.';
  }, [activeDynamicQr, myDirectQrs, activeQr]);

  const getUpiString = (amount = 0) => {
    if (!activeDynamicQr) return 'upi://pay?pa=unassigned@upi&pn=Unassigned&mc=0000&tid=&tr=&tn=Unassigned&am=0&cu=INR';
    let rawVal = (activeDynamicQr.upiId || '').trim();
    const pn = encodeURIComponent(activeDynamicQr.merchantName || user?.name || 'Merchant');
    const mc = '5499';
    const tid = activeDynamicQr.tid || '';
    const tr = (activeDynamicQr.id || '').replace(/-/g, '').substring(0, 32);
    const tn = encodeURIComponent(`Payment to ${activeDynamicQr.merchantName || user?.name || 'Merchant'}`);
    const reqAmount = amount > 0 ? Number(amount).toFixed(2) : '0.00';
    if (rawVal.startsWith('upi://') || rawVal.startsWith('UPI://')) {
      let uri = rawVal;
      if (amount > 0) {
        if (uri.match(/[?&]am=/i)) uri = uri.replace(/([?&])am=[0-9.]+/i, `$1am=${reqAmount}`);
        else uri += `&am=${reqAmount}`;
        if (!uri.match(/[?&]cu=/i)) uri += '&cu=INR';
      }
      return uri;
    }
    const pa = rawVal;
    let upi = `upi://pay?pa=${pa}&pn=${pn}&mc=${mc}&tr=${tr}&tn=${tn}&cu=INR`;
    if (amount > 0) upi += `&am=${reqAmount}&mam=${reqAmount}`;
    if (tid) upi += `&tid=${tid}`;
    return upi;
  };

  const upiString = getUpiString();
  const dynamicUpiString = getUpiString(Number(dynamicAmount) || 0);

  const getQrIntentString = (qr) => {
    if (!qr) return 'upi://pay?pa=unassigned@upi&pn=Unassigned&mc=0000&tid=&tr=&tn=Unassigned&am=0&cu=INR';
    let rawVal = (qr.upiId || '').trim();
    if (!rawVal) return 'upi://pay?pa=unassigned@upi&pn=Unassigned&mc=0000&tid=&tr=&tn=Unassigned&am=0&cu=INR';
    if (rawVal.startsWith('MANUAL-UPI')) return rawVal;
    if (rawVal.startsWith('000201')) return rawVal;
    const pn = encodeURIComponent(qr.merchantName || user?.name || qr.label || 'Merchant');
    const mc = '5499';
    const tid = qr.tid || '';
    const tr = (qr.id || '').replace(/-/g, '').substring(0, 32);
    const tn = encodeURIComponent(`Payment to ${qr.merchantName || user?.name || qr.label || 'Merchant'}`);
    if (rawVal.startsWith('upi://') || rawVal.startsWith('UPI://')) {
      const uri = rawVal;
      return uri.match(/[?&]cu=/i) ? uri : `${uri}${uri.includes('?') ? '&' : '?'}cu=INR`;
    }
    let upi = `upi://pay?pa=${rawVal}&pn=${pn}&mc=${mc}&tr=${tr}&tn=${tn}&cu=INR`;
    if (tid) upi += `&tid=${tid}`;
    return upi;
  };

  const fetchQrBlob = async (qr) => {
    if (!qr?.imagePath) return null;
    const response = await fetch(`${UPLOADS_BASE}${qr.imagePath}`);
    if (!response.ok) throw new Error('Unable to load QR image.');
    return response.blob();
  };

  const generateQrBlobFromIntent = async (qr) => {
    const intent = getQrIntentString(qr);
    const svgMarkup = renderToStaticMarkup(
      <div xmlns="http://www.w3.org/1999/xhtml" style={{ background: '#ffffff', padding: '20px', display: 'inline-flex' }}>
        <QRCodeSVG value={intent} size={320} bgColor="#ffffff" fgColor="#111827" includeMargin />
      </div>
    );
    return new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  };

  const buildQrBlob = async (qr) => {
    try {
      const uploadedBlob = await fetchQrBlob(qr);
      if (uploadedBlob) return uploadedBlob;
    } catch (fetchError) {
      console.warn('Falling back to generated QR image for share/download', fetchError);
    }
    return generateQrBlobFromIntent(qr);
  };

  const handleDownloadQr = async (qr) => {
    try {
      const blob = await buildQrBlob(qr);
      if (!blob) {
        error('No QR image is available to download for this record.');
        return;
      }

      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${(qr.label || qr.tid || 'qr-code').replace(/[^a-z0-9_-]+/gi, '_')}.${blob.type.includes('svg') ? 'svg' : 'png'}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(objectUrl);
      success('QR download started.');
    } catch (downloadError) {
      console.error(downloadError);
      error('Failed to download QR image.');
    }
  };

  const handleShareQr = async (qr) => {
    const intent = getQrIntentString(qr);
    const shareTitle = `${titleCase(qr.label || 'QR Code')} Payment QR`;
    const shareText = `${shareTitle}\nUPI Intent: ${intent}`;

    try {
      const blob = await buildQrBlob(qr);
      const shareFile = blob
        ? new File(
            [blob],
            `${(qr.label || qr.tid || 'qr-code').replace(/[^a-z0-9_-]+/gi, '_')}.${blob.type.includes('svg') ? 'svg' : 'png'}`,
            { type: blob.type || 'image/png' }
          )
        : null;

      if (navigator.share) {
        if (shareFile && navigator.canShare?.({ files: [shareFile] })) {
          await navigator.share({
            title: shareTitle,
            text: shareText,
            files: [shareFile]
          });
          return;
        }

        await navigator.share({
          title: shareTitle,
          text: shareText
        });
        return;
      }

      await navigator.clipboard.writeText(intent);
      success('UPI intent copied. You can now paste and share it.');
    } catch (shareError) {
      if (shareError?.name === 'AbortError') return;
      console.error(shareError);
      try {
        await navigator.clipboard.writeText(intent);
        success('Share is not supported here, so the UPI intent was copied.');
      } catch {
        error('Failed to share QR or copy the payment intent.');
      }
    }
  };

  const updateUpiId = async (id, upiId) => {
    setIsFixing(true);
    try {
      const result = await updateQrCode(id, { upiId });
      if (!result?.success) throw new Error(result?.error || 'Failed to update UPI ID');
      setFixingQr(null);
      setManualUpi('');
      success('UPI ID updated successfully.');
    } catch {
      error('Failed to update UPI ID. Please try again.');
    } finally {
      setIsFixing(false);
    }
  };

  const loadQrReport = async (qr, filters = reportFilters) => {
    setReportQr(qr);
    setIsLoadingReport(true);
    const result = await fetchQrReport(qr.id, filters);
    if (result.success) {
      setQrReport(result.data);
    } else {
      setQrReport(null);
      error(result.error || 'Failed to load QR report.');
    }
    setIsLoadingReport(false);
  };

  const handleApplyReportFilters = async () => {
    if (!reportQr) return;
    await loadQrReport(reportQr, reportFilters);
  };

  const closeReportModal = () => {
    setReportQr(null);
    setQrReport(null);
    setReportFilters({ startDate: '', endDate: '' });
  };

  const renderInventoryTable = (rows, { title, emptyMessage }) => (
    <div className="qr-inventory-block">
      <h4 className="qr-inventory-title">{title}</h4>
      {rows.length === 0 ? (
        <div className="qr-empty-state">{emptyMessage}</div>
      ) : (
        <div className="qr-table-wrap">
          <table className="qr-inventory-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Owner</th>
                <th>TID</th>
                <th>UPI ID</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => {
                return (
                  <tr key={q.id} onClick={() => loadQrReport(q)} className="qr-table-row">
                    <td>{q.label || 'QR Code'}</td>
                    <td>{q.merchantName || 'Unassigned'}</td>
                    <td>{q.tid || 'N/A'}</td>
                    <td>
                      <span className="qr-compact-upi" title={q.upiId || 'N/A'}>
                        {formatCompactUpi(q.upiId)}
                      </span>
                    </td>
                    <td>
                      <span className={`qr-status-badge ${q.status === 'active' ? 'active' : 'inactive'}`}>
                        {(q.status || 'unknown').toUpperCase()}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="qr-action-row">
                        <button
                          className="qr-action-button report"
                          onClick={() => loadQrReport(q)}
                        >
                          View Report
                        </button>
                        <button
                          className="qr-action-button report"
                          onClick={() => handleDownloadQr(q)}
                        >
                          Download QR
                        </button>
                        <button
                          className="qr-action-button report"
                          onClick={() => handleShareQr(q)}
                        >
                          Share QR
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="dashboard-layout">
      {showPreview && activeQr?.imagePath && (
        <div className="fullscreen-modal" onClick={() => setShowPreview(false)}>
          <div className="modal-content large-preview" onClick={(e) => e.stopPropagation()}>
            <button className="qr-close-modal" onClick={() => setShowPreview(false)}>x</button>
            <div className="preview-label">Original Uploaded QR Image</div>
            <img src={`${UPLOADS_BASE}${activeQr.imagePath}`} alt="Original QR" className="full-image" />
          </div>
        </div>
      )}

      {fixingQr && (
        <div className="fullscreen-modal" style={{ background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>Fix Invalid QR</h2>
            <input type="text" placeholder="example@paytm" value={manualUpi} onChange={(e) => setManualUpi(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '2px solid #e2e8f0', marginBottom: '20px' }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setFixingQr(null)} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#f1f5f9', border: 'none' }}>Cancel</button>
              <button onClick={() => updateUpiId(fixingQr.id, manualUpi)} disabled={isFixing} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#8b5cf6', color: 'white', border: 'none' }}>{isFixing ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {reportQr && (
        <div className="fullscreen-modal" onClick={closeReportModal}>
          <div className="qr-report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qr-report-header">
              <div>
                <div className="preview-label">QR Performance Report</div>
                <h2>{reportQr.label || 'QR Code'}</h2>
                <p>{reportQr.tid ? `TID: ${reportQr.tid}` : reportQr.upiId || 'No identifier available'}</p>
              </div>
              <button className="qr-close-modal qr-report-close" onClick={closeReportModal}>x</button>
            </div>

            <div className="qr-report-filter-bar">
              <input
                type="date"
                value={reportFilters.startDate}
                onChange={(e) => setReportFilters((prev) => ({ ...prev, startDate: e.target.value }))}
              />
              <input
                type="date"
                value={reportFilters.endDate}
                onChange={(e) => setReportFilters((prev) => ({ ...prev, endDate: e.target.value }))}
              />
              <button className="qr-action-button report" onClick={handleApplyReportFilters} disabled={isLoadingReport}>
                {isLoadingReport ? 'Loading...' : 'Apply Filter'}
              </button>
            </div>

            {isLoadingReport ? (
              <div className="qr-empty-state">Loading QR report...</div>
            ) : (
              <>
                <div className="qr-report-stats">
                  <div className="qr-report-stat-card">
                    <span>Total Transactions</span>
                    <strong>{qrReport?.summary?.totalTransactions || 0}</strong>
                  </div>
                  <div className="qr-report-stat-card">
                    <span>Total Amount</span>
                    <strong>{formatCurrency(qrReport?.summary?.totalAmount || 0)}</strong>
                  </div>
                  <div className="qr-report-stat-card">
                    <span>Successful Amount</span>
                    <strong>{formatCurrency(qrReport?.summary?.completedAmount || 0)}</strong>
                  </div>
                </div>

                <div className="qr-report-section">
                  <h3>Datewise Summary</h3>
                  {qrReport?.dailyTotals?.length ? (
                    <div className="qr-table-wrap">
                      <table className="qr-inventory-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Transactions</th>
                            <th>Total Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {qrReport.dailyTotals.map((item) => (
                            <tr key={item.date}>
                              <td>{item.date}</td>
                              <td>{item.count}</td>
                              <td>{formatCurrency(item.totalAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="qr-empty-state">No transactions found for this date range.</div>
                  )}
                </div>

                <div className="qr-report-section">
                  <h3>Transactions</h3>
                  {qrReport?.transactions?.length ? (
                    <div className="qr-table-wrap">
                      <table className="qr-inventory-table">
                        <thead>
                          <tr>
                            <th>Date & Time</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Reference</th>
                            <th>Sender</th>
                          </tr>
                        </thead>
                        <tbody>
                          {qrReport.transactions.map((txn) => (
                            <tr key={txn.id}>
                              <td>{formatDateTime(txn.createdAt)}</td>
                              <td>{formatCurrency(txn.amount)}</td>
                              <td>{txn.status || 'N/A'}</td>
                              <td>{txn.refId || txn.clientRefId || txn.id}</td>
                              <td>{txn.sender || txn.consumer || txn.description || 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="qr-empty-state">No matched transactions available for this QR yet.</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="dashboard-body centered-content">
          <div className="qr-tabs card">
            <button className={activeTab === 'My QR' ? 'active' : ''} onClick={() => setActiveTab('My QR')}>My QR Code</button>
            <button className={activeTab === 'Dynamic' ? 'active' : ''} onClick={() => setActiveTab('Dynamic')}>Dynamic QR</button>
            <button className={activeTab === 'Inventory' ? 'active' : ''} onClick={() => setActiveTab('Inventory')}>
              Inventory ({myInventoryQrs.length})
            </button>
          </div>

          {activeTab === 'My QR' && (
            <>
              <div className="qr-header-section">
                <h2>Your Payment QR Code</h2>
                <p className="subtitle">{activeQr ? `Showing ${activeQr.label}` : 'No QR codes assigned.'}</p>
              </div>
              <div className="qr-card-exact card">
                <div className="qr-frame">
                  {activeDynamicQr ? (
                    <QRCodeSVG value={upiString} size={256} />
                  ) : (
                    <div style={{ width: 256, height: 256, background: '#f5f5f5', borderRadius: '12px' }} />
                  )}
                </div>
                {!activeDynamicQr && (
                  <div className="qr-help-note">{dynamicQrIssue}</div>
                )}
              </div>
            </>
          )}

          {activeTab === 'Dynamic' && (
            <>
              <div className="qr-header-section">
                <h2>Dynamic QR Code</h2>
                <p className="subtitle">Generate a QR code with a fixed amount.</p>
              </div>
              <div className="qr-card-exact card">
                <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '8px' }}>Amount (Rs)</label>
                  <input
                    type="number"
                    placeholder="Enter amount"
                    value={dynamicAmount}
                    onChange={(e) => setDynamicAmount(e.target.value)}
                    disabled={!activeDynamicQr}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '18px' }}
                  />
                </div>
                <div className="qr-frame" style={{ margin: '1.5rem' }}>
                  {activeDynamicQr ? (
                    <QRCodeSVG value={dynamicUpiString} size={256} />
                  ) : (
                    <div style={{ width: 256, height: 256, background: '#f5f5f5', borderRadius: '12px' }} />
                  )}
                </div>
                <div className="qr-help-note" style={{ margin: '0 1.5rem 1.5rem' }}>
                  {activeDynamicQr ? 'Dynamic QR is ready. Enter an amount and share or scan it to pay.' : dynamicQrIssue}
                </div>
              </div>
            </>
          )}

          {activeTab === 'Inventory' && (
            <div className="assigned-qrs-section card qr-inventory-card">
              <div className="qr-header-section qr-inventory-header">
                <h2>My QR Inventory</h2>
                <p className="subtitle">Tap any QR row to open its report with totals, transaction count, and datewise filtering.</p>
              </div>

              {renderInventoryTable(myInventoryQrs, {
                title: `My Inventory (${myInventoryQrs.length})`,
                emptyMessage: 'No QRs in your inventory.'
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default QrCodesPage;
