import React, { useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { QRCodeSVG } from 'qrcode.react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { UPLOADS_BASE } from '../config';
import { copyTextToClipboard } from '../utils/clipboard';
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

const getQrValueType = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return 'missing';
  if (normalized.startsWith('MANUAL-UPI')) return 'manual';
  if (normalized.startsWith('000201')) return 'raw_emv';
  if (normalized.startsWith('upi://') || normalized.startsWith('UPI://')) return 'upi_uri';
  return normalized.includes('@') ? 'upi_id' : 'unknown';
};

const getPublicPaymentPageUrl = (paymentLink) => {
  if (!paymentLink || typeof window === 'undefined') return '';
  const publicUrl = new URL('/pay', window.location.origin);
  publicUrl.searchParams.set('upi', paymentLink);
  return publicUrl.toString();
};

const parseEmvPayload = (payload) => {
  const data = String(payload || '').trim();
  const fields = [];
  let index = 0;

  while (index + 4 <= data.length) {
    const id = data.slice(index, index + 2);
    const length = Number(data.slice(index + 2, index + 4));
    if (Number.isNaN(length) || length < 0) break;

    const start = index + 4;
    const end = start + length;
    if (end > data.length) break;

    fields.push({
      id,
      value: data.slice(start, end)
    });

    index = end;
  }

  return fields;
};

const extractUpiFromRawEmv = (payload) => {
  const rootFields = parseEmvPayload(payload);
  const merchantAccountFields = rootFields
    .filter((field) => Number(field.id) >= 26 && Number(field.id) <= 51)
    .flatMap((field) => parseEmvPayload(field.value));

  const findCandidate = (values) =>
    values.find((value) => {
      const normalized = String(value || '').trim();
      return normalized.includes('@') || normalized.toLowerCase().startsWith('upi://');
    }) || '';

  const accountCandidate = findCandidate(merchantAccountFields.map((field) => field.value));
  const rawCandidate = findCandidate(rootFields.map((field) => field.value));
  const merchantName = rootFields.find((field) => field.id === '59')?.value || 'Merchant';
  const transactionNote = rootFields.find((field) => field.id === '62')?.value || '';
  const merchantCode = rootFields.find((field) => field.id === '52')?.value || '5499';
  const amount = rootFields.find((field) => field.id === '54')?.value || '';
  const currencyCode = rootFields.find((field) => field.id === '53')?.value === '356' ? 'INR' : 'INR';

  let payee = accountCandidate || rawCandidate;
  if (!payee) return '';

  if (payee.toLowerCase().startsWith('upi://')) return payee;

  const params = new URLSearchParams({
    pa: payee,
    pn: merchantName,
    mc: merchantCode,
    cu: currencyCode
  });

  if (amount) params.set('am', amount);
  if (transactionNote) params.set('tn', transactionNote);

  return `upi://pay?${params.toString()}`;
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
  const [paymentLinkQr, setPaymentLinkQr] = useState(null);

  const [showPreview, setShowPreview] = useState(false);

  const stopEvent = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

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

  const myQrIssue = useMemo(() => {
    if (!activeQr) return 'No active QR is assigned to this user yet.';
    const valueType = getQrValueType(activeQr.upiId);
    if (valueType === 'manual') {
      return 'This assigned QR is still a placeholder MANUAL-UPI record. Assign a real UPI QR to display a scannable payment code here.';
    }
    return '';
  }, [activeQr]);

  const buildUpiString = (qr, amount = 0) => {
    if (!qr) return 'upi://pay?pa=unassigned@upi&pn=Unassigned&mc=0000&tid=&tr=&tn=Unassigned&am=0&cu=INR';
    let rawVal = (qr.upiId || '').trim();
    if (rawVal.startsWith('MANUAL-UPI')) return rawVal;
    if (rawVal.startsWith('000201')) return rawVal;
    const pn = encodeURIComponent(qr.merchantName || user?.name || 'Merchant');
    const mc = '5499';
    const tid = qr.tid || '';
    const tr = (qr.id || '').replace(/-/g, '').substring(0, 32);
    const tn = encodeURIComponent(`Payment to ${qr.merchantName || user?.name || 'Merchant'}`);
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

  const upiString = buildUpiString(activeQr);
  const dynamicUpiString = buildUpiString(activeDynamicQr, Number(dynamicAmount) || 0);

  const getPaymentLink = (qr, amount = 0) => {
    if (!qr) return '';
    const rawValue = String(qr.upiId || '').trim();
    const valueType = getQrValueType(rawValue);
    const amountValue = Number(amount) || 0;

    if (valueType === 'manual' || valueType === 'missing' || valueType === 'unknown') return '';
    if (valueType === 'raw_emv') return extractUpiFromRawEmv(rawValue);
    return buildUpiString(qr, amountValue);
  };

  const canUsePaymentLink = (qr) => {
    return Boolean(getPaymentLink(qr));
  };

  const getShareablePaymentLink = (qr, amount = 0) => {
    const paymentLink = getPaymentLink(qr, amount);
    if (!paymentLink) return '';
    return getPublicPaymentPageUrl(paymentLink);
  };

  const fetchQrBlob = async (qr) => {
    if (!qr?.imagePath) return null;
    const response = await fetch(`${UPLOADS_BASE}${qr.imagePath}`);
    if (!response.ok) throw new Error('Unable to load QR image.');
    return response.blob();
  };

  const getBlobExtension = (blob) => {
    if (!blob?.type) return 'png';
    if (blob.type.includes('png')) return 'png';
    if (blob.type.includes('jpeg') || blob.type.includes('jpg')) return 'jpg';
    if (blob.type.includes('svg')) return 'svg';
    return 'png';
  };

  const renderDisplayedQrSvgMarkup = (qr) => {
    const rawSvg = renderToStaticMarkup(
      <QRCodeSVG value={buildUpiString(qr)} size={320} bgColor="#ffffff" fgColor="#111827" includeMargin />
    );

    return rawSvg.includes('xmlns=')
      ? rawSvg
      : rawSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  };

  const svgMarkupToPngBlob = (svgMarkup) => new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const objectUrl = window.URL.createObjectURL(svgBlob);
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width || 360;
      canvas.height = image.height || 360;
      const context = canvas.getContext('2d');

      if (!context) {
        window.URL.revokeObjectURL(objectUrl);
        reject(new Error('Canvas is not supported.'));
        return;
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      canvas.toBlob((blob) => {
        window.URL.revokeObjectURL(objectUrl);
        if (!blob) {
          reject(new Error('Failed to convert QR image.'));
          return;
        }
        resolve(blob);
      }, 'image/png');
    };

    image.onerror = () => {
      window.URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load generated QR image.'));
    };

    image.src = objectUrl;
  });

  const generateDisplayedQrBlob = async (qr) => {
    const svgMarkup = renderDisplayedQrSvgMarkup(qr);
    return svgMarkupToPngBlob(svgMarkup);
  };

  const buildQrBlob = async (qr) => {
    try {
      const uploadedBlob = await fetchQrBlob(qr);
      if (uploadedBlob) return uploadedBlob;
    } catch (fetchError) {
      console.warn('Falling back to generated QR image for share/download', fetchError);
    }
    return generateDisplayedQrBlob(qr);
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
      anchor.download = `${(qr.label || qr.tid || 'qr-code').replace(/[^a-z0-9_-]+/gi, '_')}.${getBlobExtension(blob)}`;
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

  const handleCopyPaymentLink = async (event, qr, amount = 0) => {
    if (event) stopEvent(event);

    const paymentLink = getShareablePaymentLink(qr, amount);
    if (!paymentLink) {
      error('This QR does not have a valid payment link yet.');
      return;
    }

    const copied = await copyTextToClipboard(paymentLink);

    if (copied) {
      success('Payment link copied to clipboard.');
      return;
    }

    error('Failed to copy payment link.');
  };

  const handleSharePaymentLink = async (event, qr, amount = 0) => {
    if (event) stopEvent(event);

    const paymentLink = getShareablePaymentLink(qr, amount);
    if (!paymentLink) {
      error('This QR does not have a valid payment link yet.');
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${qr?.label || 'QR Code'} Payment Link`,
          text: paymentLink,
          url: paymentLink
        });
        success('Payment link shared.');
        return;
      }

      const copied = await copyTextToClipboard(paymentLink);
      if (copied) {
        success('Share is not available here, so the payment link was copied instead.');
        return;
      }
    } catch (shareError) {
      if (shareError?.name === 'AbortError') return;
      console.error(shareError);
    }

    error('Failed to share payment link.');
  };

  const handleOpenPaymentIntent = (event, qr, amount = 0) => {
    if (event) stopEvent(event);

    const paymentLink = getPaymentLink(qr, amount);
    if (!paymentLink) {
      error('This QR does not have a valid payment link yet.');
      return;
    }

    try {
      window.location.assign(paymentLink);
      setTimeout(() => {
        const fallbackAnchor = document.createElement('a');
        fallbackAnchor.href = paymentLink;
        fallbackAnchor.target = '_self';
        fallbackAnchor.rel = 'noopener noreferrer';
        fallbackAnchor.style.display = 'none';
        document.body.appendChild(fallbackAnchor);
        fallbackAnchor.click();
        document.body.removeChild(fallbackAnchor);
      }, 150);
      success('Trying to open the payment app...');
    } catch (intentError) {
      console.error(intentError);
      error('Failed to open the payment intent.');
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
                          type="button"
                          className="qr-action-button report"
                          onClick={() => loadQrReport(q)}
                        >
                          View Report
                        </button>
                        <button
                          type="button"
                          className="qr-action-button report"
                          onClick={() => handleDownloadQr(q)}
                        >
                          Download QR
                        </button>
                        <button
                          type="button"
                          className="qr-action-button report"
                          onClick={() => setPaymentLinkQr(q)}
                          disabled={!canUsePaymentLink(q)}
                        >
                          Payment Link
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

      {paymentLinkQr && (
        <div className="fullscreen-modal" onClick={() => setPaymentLinkQr(null)}>
          <div className="qr-payment-link-modal card" onClick={(e) => e.stopPropagation()}>
            <div className="qr-report-header">
              <div>
                <div className="preview-label">Payment Link</div>
                <h2>{paymentLinkQr.label || 'QR Code'}</h2>
                <p>Open, copy, or share this payment link.</p>
              </div>
              <button className="qr-close-modal qr-report-close" onClick={() => setPaymentLinkQr(null)}>x</button>
            </div>

            <div className="qr-payment-link-panel">
              <label className="qr-payment-link-label">Payment Link</label>
              <div className="qr-payment-link-row">
                <input
                  type="text"
                  className="qr-payment-link-input"
                  value={getShareablePaymentLink(paymentLinkQr)}
                  onClick={(event) => event.currentTarget.select()}
                  readOnly
                />
                <button
                  type="button"
                  className="qr-action-button report"
                  onClick={(event) => handleOpenPaymentIntent(event, paymentLinkQr)}
                >
                  Open
                </button>
                <button
                  type="button"
                  className="qr-action-button report"
                  onClick={(event) => handleCopyPaymentLink(event, paymentLinkQr)}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="qr-action-button report"
                  onClick={(event) => handleSharePaymentLink(event, paymentLinkQr)}
                >
                  Share
                </button>
              </div>
            </div>
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
                  {activeQr && !myQrIssue ? (
                    <QRCodeSVG value={upiString} size={256} />
                  ) : (
                    <div style={{ width: 256, height: 256, background: '#f5f5f5', borderRadius: '12px' }} />
                  )}
                </div>
                {myQrIssue && (
                  <div className="qr-help-note">{myQrIssue}</div>
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
                {activeDynamicQr && (
                  <div className="qr-payment-link-panel">
                    <label className="qr-payment-link-label">Payment Link</label>
                    <div className="qr-payment-link-row">
                      <input
                        type="text"
                        className="qr-payment-link-input"
                        value={getShareablePaymentLink(activeDynamicQr, Number(dynamicAmount) || 0)}
                        onClick={(event) => event.currentTarget.select()}
                        readOnly
                      />
                      <button
                        type="button"
                        className="qr-action-button report"
                        onClick={(event) => handleOpenPaymentIntent(event, activeDynamicQr, Number(dynamicAmount) || 0)}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        className="qr-action-button report"
                        onClick={(event) => handleCopyPaymentLink(event, activeDynamicQr, Number(dynamicAmount) || 0)}
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        className="qr-action-button report"
                        onClick={(event) => handleSharePaymentLink(event, activeDynamicQr, Number(dynamicAmount) || 0)}
                      >
                        Share
                      </button>
                    </div>
                  </div>
                )}
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
