import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { QRCodeSVG } from 'qrcode.react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { UPLOADS_BASE, API_BASE } from '../config';
import './QrCodesPage.css';

const QrCodesPage = () => {
  const { qrCodes, updateQrCode, unassignQrCode, assignQrByIds, fetchData } = useAppContext();
  const { user } = useAuth();
  const { success, error } = useToast();
  const [activeTab, setActiveTab] = useState('My QR');
  const [dynamicAmount, setDynamicAmount] = useState('');
  const [fixingQr, setFixingQr] = useState(null);
  const [manualUpi, setManualUpi] = useState('');
  const [isFixing, setIsFixing] = useState(false);
  const [selectedQrId, setSelectedQrId] = useState(null);

  // Downline assign state
  const [downline, setDownline] = useState([]);
  const [selectedQrIds, setSelectedQrIds] = useState([]);
  const [assignTargetId, setAssignTargetId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Fetch downline members
  useEffect(() => {
    const fetchDownline = async () => {
      const token = sessionStorage.getItem('authToken');
      try {
        const res = await fetch(`${API_BASE}/qrcodes/my-downline`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) setDownline(await res.json());
      } catch (e) {
        console.error('Failed to fetch downline', e);
      }
    };
    fetchDownline();
  }, []);

  // My inventory QRs (assigned to me)
  const myInventoryQrs = useMemo(() => {
    return (qrCodes || []).filter(q => q.merchantId === user?.id);
  }, [qrCodes, user]);

  // QRs I've assigned to my downline (visible to me as branches)
  const assignedDownlineQrs = useMemo(() => {
    return (qrCodes || []).filter(q => q.merchantId !== user?.id && q.status === 'active');
  }, [qrCodes, user]);

  // Active QR for display
  const myDirectQrs = useMemo(() => myInventoryQrs.filter(q => q.status === 'active'), [myInventoryQrs]);

  const activeQr = useMemo(() => {
    if (myDirectQrs.length === 0) return null;
    if (selectedQrId) {
      const found = myDirectQrs.find(q => q.id === selectedQrId);
      if (found) return found;
    }
    const sorted = [...myDirectQrs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const verified = sorted.filter(q => {
      const upi = (q.upiId || '').trim();
      return upi && !upi.startsWith('MANUAL-UPI');
    });
    return verified.length > 0 ? verified[0] : sorted[0];
  }, [myDirectQrs, selectedQrId]);

  const getUpiString = (amount = 0) => {
    if (!activeQr) return 'upi://pay?pa=unassigned@upi&pn=Unassigned&mc=0000&tid=&tr=&tn=Unassigned&am=0&cu=INR';
    let rawVal = (activeQr.upiId || '').trim();
    if (rawVal.startsWith('MANUAL-UPI')) return rawVal;
    if (rawVal.startsWith('000201')) return rawVal;
    const pn = encodeURIComponent(activeQr.merchantName || user?.name || 'Merchant');
    const mc = '5499';
    const tid = activeQr.tid || '';
    const tr = (activeQr.id || '').replace(/-/g, '').substring(0, 32);
    const tn = encodeURIComponent(`Payment to ${activeQr.merchantName || user?.name || 'Merchant'}`);
    const reqAmount = amount > 0 ? Number(amount).toFixed(2) : '0.00';
    if (rawVal.startsWith('upi://') || rawVal.startsWith('UPI://')) {
      let uri = rawVal;
      if (amount > 0) {
        if (uri.match(/[?&]am=/i)) uri = uri.replace(/([?&])am=[0-9.]+/i, `$1am=${reqAmount}`);
        else uri += `&am=${reqAmount}`;
        if (!uri.match(/[?&]cu=/i)) uri += `&cu=INR`;
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

  const updateUpiId = async (id, upiId) => {
    setIsFixing(true);
    try {
      const result = await updateQrCode(id, { upiId });
      if (!result?.success) throw new Error(result?.error || 'Failed to update UPI ID');
      setFixingQr(null);
      setManualUpi('');
      success('UPI ID updated successfully.');
    } catch (err) {
      error('Failed to update UPI ID. Please try again.');
    } finally {
      setIsFixing(false);
    }
  };

  const toggleSelectQr = (id) => {
    setSelectedQrIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleAssignToDownline = async () => {
    if (selectedQrIds.length === 0) return error('Select at least one QR code.');
    if (!assignTargetId) return error('Select a downline member to assign to.');
    setIsAssigning(true);
    const res = await assignQrByIds(selectedQrIds, assignTargetId);
    setIsAssigning(false);
    if (res.success) {
      success(`${selectedQrIds.length} QR(s) assigned successfully.`);
      setSelectedQrIds([]);
      setAssignTargetId('');
      fetchData();
    } else {
      error(res.error || 'Failed to assign QRs.');
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Fullscreen preview modal */}
      {showPreview && activeQr?.imagePath && (
        <div className="fullscreen-modal" onClick={() => setShowPreview(false)}>
          <div className="modal-content large-preview" onClick={e => e.stopPropagation()}>
            <button className="qr-close-modal" onClick={() => setShowPreview(false)}>×</button>
            <div className="preview-label">Original Uploaded QR Image</div>
            <img src={`${UPLOADS_BASE}${activeQr.imagePath}`} alt="Original QR" className="full-image" />
          </div>
        </div>
      )}

      {/* Fix UPI modal */}
      {fixingQr && (
        <div className="fullscreen-modal" style={{ background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>Fix Invalid QR</h2>
            <input type="text" placeholder="example@paytm" value={manualUpi} onChange={e => setManualUpi(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '2px solid #e2e8f0', marginBottom: '20px' }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setFixingQr(null)} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#f1f5f9', border: 'none' }}>Cancel</button>
              <button onClick={() => updateUpiId(fixingQr.id, manualUpi)} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#8b5cf6', color: 'white', border: 'none' }}>Save</button>
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

          {/* My QR Tab */}
          {activeTab === 'My QR' && (
            <>
              <div className="qr-header-section">
                <h2>Your Payment QR Code</h2>
                <p className="subtitle">{activeQr ? `Showing ${activeQr.label}` : 'No QR codes assigned.'}</p>
              </div>
              <div className="qr-card-exact card">
                <div className="qr-frame" style={{ background: 'white', padding: '24px', borderRadius: '24px' }}>
                  {activeQr ? (
                    <QRCodeSVG value={upiString} size={256} />
                  ) : (
                    <div style={{ width: 256, height: 256, background: '#f5f5f5', borderRadius: '12px' }} />
                  )}
                </div>
              </div>
            </>
          )}

          {/* Dynamic QR Tab */}
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
                    onChange={e => setDynamicAmount(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '18px' }}
                  />
                </div>
                <div className="qr-frame" style={{ background: 'white', padding: '24px', borderRadius: '24px', margin: '1.5rem' }}>
                  {activeQr ? (
                    <QRCodeSVG value={dynamicUpiString} size={256} />
                  ) : (
                    <div style={{ width: 256, height: 256, background: '#f5f5f5', borderRadius: '12px' }} />
                  )}
                </div>
              </div>
            </>
          )}

          {/* Inventory Tab */}
          {activeTab === 'Inventory' && (
            <div className="assigned-qrs-section card" style={{ maxWidth: '900px', width: '100%', padding: '2rem' }}>
              <div className="qr-header-section" style={{ marginBottom: '1.5rem' }}>
                <h2>My QR Inventory</h2>
                <p className="subtitle">Select QRs and assign them to your downline members.</p>
              </div>

              {/* Assign bar */}
              {downline.length > 0 && (
                <div style={{
                  background: 'rgba(124,108,248,0.08)',
                  border: '1px solid rgba(124,108,248,0.2)',
                  borderRadius: '16px',
                  padding: '1rem 1.25rem',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                  flexWrap: 'wrap'
                }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#c4b5fd', whiteSpace: 'nowrap' }}>
                    {selectedQrIds.length > 0 ? `${selectedQrIds.length} QR(s) selected` : 'Select QRs below'}
                  </span>
                  <select
                    value={assignTargetId}
                    onChange={e => setAssignTargetId(e.target.value)}
                    style={{
                      flex: 1, minWidth: '200px',
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">— Select Downline Member —</option>
                    {downline.map(m => (
                      <option key={m.userId} value={m.userId}>{m.fullName}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAssignToDownline}
                    disabled={isAssigning || selectedQrIds.length === 0 || !assignTargetId}
                    style={{
                      padding: '10px 24px',
                      borderRadius: '10px',
                      border: 'none',
                      background: (isAssigning || selectedQrIds.length === 0 || !assignTargetId) ? 'rgba(124,108,248,0.3)' : '#7c6cf8',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: (isAssigning || selectedQrIds.length === 0 || !assignTargetId) ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isAssigning ? 'Assigning...' : `Assign ${selectedQrIds.length > 0 ? selectedQrIds.length : ''} QR(s)`}
                  </button>
                </div>
              )}

              {/* My inventory QRs */}
              {myInventoryQrs.length === 0 ? (
                <div style={{ padding: '4rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                  No QRs in your inventory.
                </div>
              ) : (
                <>
                  <h4 style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
                    My Inventory ({myInventoryQrs.length})
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    {myInventoryQrs.map(q => {
                      const isSelected = selectedQrIds.includes(q.id);
                      return (
                        <div
                          key={q.id}
                          onClick={() => toggleSelectQr(q.id)}
                          style={{
                            background: isSelected ? 'rgba(124,108,248,0.12)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${isSelected ? 'rgba(124,108,248,0.4)' : 'rgba(255,255,255,0.06)'}`,
                            borderRadius: '14px',
                            padding: '1rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            position: 'relative'
                          }}
                        >
                          {/* Checkbox indicator */}
                          <div style={{
                            position: 'absolute', top: '10px', right: '10px',
                            width: '20px', height: '20px',
                            borderRadius: '6px',
                            border: `2px solid ${isSelected ? '#7c6cf8' : 'rgba(255,255,255,0.2)'}`,
                            background: isSelected ? '#7c6cf8' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: '12px', fontWeight: 700
                          }}>
                            {isSelected && '✓'}
                          </div>

                          <div style={{ fontWeight: 700, color: '#fff', marginBottom: '4px', paddingRight: '28px' }}>{q.label || 'QR Code'}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '10px' }}>
                            {(q.upiId || '').substring(0, 16)}{q.upiId?.length > 16 ? '...' : ''}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: q.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: q.status === 'active' ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                              {q.status?.toUpperCase()}
                            </span>
                            {q.tid && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>TID: {q.tid}</span>}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }} onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => unassignQrCode(q.id)}
                              style={{ flex: 1, padding: '6px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Unassign
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Assigned to downline section */}
                  {assignedDownlineQrs.length > 0 && (
                    <>
                      <h4 style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem', marginTop: '0.5rem' }}>
                        Assigned to Downline ({assignedDownlineQrs.length})
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
                        {assignedDownlineQrs.map(q => (
                          <div key={q.id} style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.1)', borderRadius: '14px', padding: '1rem' }}>
                            <div style={{ fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{q.label || 'QR Code'}</div>
                            <div style={{ fontSize: '12px', color: '#10b981', marginBottom: '10px' }}>→ {q.merchantName}</div>
                            <button
                              onClick={() => unassignQrCode(q.id)}
                              style={{ width: '100%', padding: '6px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Revoke
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default QrCodesPage;
