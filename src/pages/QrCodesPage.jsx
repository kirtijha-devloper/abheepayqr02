import React, { useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { QRCodeSVG } from 'qrcode.react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import jsQR from 'jsqr';
import { API_BASE, UPLOADS_BASE } from '../config';
import './QrCodesPage.css';

const QrCodesPage = () => {
  const { qrCodes, updateQrCode, unassignQrCode } = useAppContext();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('My QR');
  const [viewMode, setViewMode] = useState('physical'); // default: show original uploaded image
  const [dynamicAmount, setDynamicAmount] = useState('');
  const [fixingQr, setFixingQr] = useState(null); // Tracks the specific QR being fixed
  const [manualUpi, setManualUpi] = useState('');
  const [isFixing, setIsFixing] = useState(false);
  const [selectedQrId, setSelectedQrId] = useState(null); // Explicit selection state

  const updateUpiId = async (id, upiId) => {
    setIsFixing(true);
    try {
        await updateQrCode(id, { upiId });
        setFixingQr(null);
        setManualUpi('');
        alert("UPI ID updated successfully!");
    } catch (err) {
        console.error("Failed to update UPI ID:", err);
        alert("Failed to update UPI ID. Please try again.");
    } finally {
        setIsFixing(false);
    }
  };

  // Filter QRs assigned to this merchant
  const myQrs = useMemo(() => {
    return (qrCodes || []).filter(q => q.merchantId === user?.id && q.status === 'active');
  }, [qrCodes, user]);

  // Calculate Active QR based on selection or fallback
  const activeQr = useMemo(() => {
    if (myQrs.length === 0) return null;
    
    // 1. Check if we have an explicit selection
    if (selectedQrId) {
        const found = myQrs.find(q => q.id === selectedQrId);
        if (found) return found;
    }

    // 2. Fallback: Prioritize QRs that are NOT MANUAL placeholders
    const sortedQrs = [...myQrs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const verifiedQrs = sortedQrs.filter(q => {
        const upi = (q.upiId || "").trim();
        return upi && !upi.startsWith('MANUAL-UPI');
    });
    
    return verifiedQrs.length > 0 ? verifiedQrs[0] : sortedQrs[0];
  }, [myQrs, selectedQrId]);

  // Calculate UPI String based on tab
  const getUpiString = (amount = 0) => {
    if (!activeQr) return "upi://pay?pa=unassigned@upi&pn=Unassigned&mc=0000&tid=&tr=&tn=Unassigned&am=0&cu=INR";
    
    const rawVal = activeQr.upiId || "";

    // 1. If it's BHARAT-QR / EMV Co (common for bank merchant stands)
    // Starts with 000201...
    if (rawVal.startsWith('000201')) {
        return rawVal;
    }

    // 2. If it's already a full UPI URI
    if (rawVal.startsWith('upi://')) {
        // If we have an amount > 0, we could try to append &am=
        // but for "exact QR" request, better to respect original if possible
        if (amount > 0 && !rawVal.includes('&am=')) {
            return `${rawVal}&am=${amount}`;
        }
        return rawVal;
    }
    
    // 3. Otherwise, treat as simple VPA and build the URI
    const pa = rawVal;
    const pn = encodeURIComponent(user?.name || 'Merchant');
    const mc = '0000'; // Default merchant category
    const tid = activeQr.tid || '';
    const tr = activeQr.id;
    const tn = encodeURIComponent(`Payment to ${user?.name || 'Telering'}`);
    
    let upi = `upi://pay?pa=${pa}&pn=${pn}&mc=${mc}&tr=${tr}&tn=${tn}&cu=INR`;
    
    if (amount > 0) {
      upi += `&am=${amount}`;
    }
    
    if (tid) {
      upi += `&tid=${tid}`;
    }
    
    return upi;
  };

  const [showPreview, setShowPreview] = useState(false);
  const upiString = getUpiString();
  const dynamicUpiString = getUpiString(Number(dynamicAmount) || 0);

  return (
    <div className="dashboard-layout">
      {showPreview && activeQr?.imagePath && (
        <div className="fullscreen-modal" onClick={() => setShowPreview(false)}>
            <div className="modal-content large-preview" onClick={e => e.stopPropagation()}>
                <button className="close-modal" onClick={() => setShowPreview(false)}>×</button>
                <div className="preview-label">Original Uploaded QR Image</div>
                <img 
                    src={`http://localhost:4001${activeQr.imagePath}`} 
                    alt="Original QR" 
                    className="full-image"
                />
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
            <button className={activeTab === 'Assigned' ? 'active' : ''} onClick={() => setActiveTab('Assigned')}>Assigned QRs ({myQrs.length})</button>
          </div>

          {activeTab === 'My QR' && (
            <>
              <div className="qr-header-section">
                <div className="qr-icon-label">📱 Payment QR Code</div>
                <h2>Your Payment QR Code</h2>
                <p className="subtitle">
                    {activeQr 
                        ? `Showing ${activeQr.label}${myQrs.length > 1 ? ` (1 of ${myQrs.length} assigned)` : ''}` 
                        : "Wait for admin to assign QR codes to your account."}
                </p>
                {activeQr?.upiId?.startsWith('MANUAL-UPI') && (
                    <div className="manual-qr-warning" style={{ 
                        marginTop: '12px', 
                        padding: '12px', 
                        background: 'rgba(245, 158, 11, 0.1)', 
                        border: '1px solid rgba(245, 158, 11, 0.2)', 
                        borderRadius: '12px',
                        color: '#fbbf24',
                        fontSize: '12px',
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center'
                    }}>
                        <span>⚠️</span>
                        <span>This QR requires manual verification. Please use the "Physical" view for scanning.</span>
                    </div>
                )}
              </div>

              <div className="qr-card-exact card">
                <div className="qr-card-header">
                    <span className="pay-label">PAYUPI</span>
                    <h3 className="merchant-name">{user?.name || 'Merchant'}</h3>
                    <div className="merchant-id-badge">
                       <span>{activeQr?.mid || user?.partnerId || 'MERCHANT_ID'}</span>
                       <button className="copy-btn">📋</button>
                    </div>
                    {activeQr?.imagePath && (
                      <div className="view-mode-toggle">
                        <button 
                          className={viewMode === 'digital' ? 'active' : ''} 
                          onClick={() => setViewMode('digital')}
                        >Digital</button>
                        <button 
                          className={viewMode === 'physical' ? 'active' : ''} 
                          onClick={() => setViewMode('physical')}
                        >Physical</button>
                      </div>
                    )}
                </div>
                
                <div className="qr-code-body">
                  <div className="qr-frame" style={{ 
                      padding: '24px', 
                      background: 'white', 
                      borderRadius: '24px', 
                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                      border: '1px solid #f1f5f9',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center'
                  }}>
                    {activeQr ? (
                      <>
                        <div style={{ position: 'relative', width: '280px', height: '280px', overflow: 'hidden', borderRadius: '12px', background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {(viewMode === 'physical' && activeQr.imagePath) ? (
                                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                    <img 
                                        src={`${UPLOADS_BASE}${activeQr.imagePath}`} 
                                        alt="Merchant QR" 
                                        style={{ 
                                            width: '100%', 
                                            height: '100%', 
                                            objectFit: 'contain',
                                            filter: 'contrast(1.1) brightness(1.02)'
                                        }} 
                                    />
                                    <button 
                                        className="zoom-overlay-btn"
                                        onClick={() => setShowPreview(true)}
                                        title="View Full Photo"
                                    >🔍</button>
                                </div>
                            ) : (
                                 <QRCodeSVG 
                                    value={upiString} 
                                    size={256}
                                    level="H"
                                    includeMargin={true}
                                />
                            )}

                            {/* Overlay for Placeholder QR */}
                            {activeQr.upiId?.startsWith('MANUAL-UPI') && (
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'rgba(255,255,255,0.92)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '20px',
                                    textAlign: 'center',
                                    backdropFilter: 'blur(2px)'
                                }}>
                                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚠️</div>
                                    <p style={{ fontSize: '13px', color: '#1e293b', marginBottom: '12px', fontWeight: '700' }}>
                                        Invalid QR Code<br/><span style={{fontWeight: '400', color: '#64748b'}}>Quality issue detected</span>
                                    </p>
                                    <button 
                                        onClick={() => setFixingQr(activeQr)}
                                        style={{
                                            background: '#8b5cf6',
                                            color: 'white',
                                            border: 'none',
                                            padding: '8px 20px',
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.3)'
                                        }}
                                    >
                                        Fix & Activate
                                    </button>
                                </div>
                            )}

                            {/* Success Overlay for Verified QR */}
                            {!activeQr.upiId?.startsWith('MANUAL-UPI') && (
                                <div style={{
                                    position: 'absolute',
                                    top: '10px',
                                    right: '10px',
                                    background: '#10b981',
                                    color: 'white',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '10px',
                                    fontWeight: '900',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                    zIndex: 5
                                }}>
                                    {activeQr.imagePath ? 'VERIFIED ✓' : 'DIGITAL ✓'}
                                </div>
                            )}
                        </div>

                        <div style={{ 
                            marginTop: '20px', 
                            display: 'flex', 
                            flexDirection: 'column',
                            alignItems: 'center', 
                            gap: '12px',
                            width: '100%'
                        }}>
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px',
                                padding: '6px 16px',
                                background: '#f8fafc',
                                borderRadius: '30px',
                                border: '1px solid #e2e8f0'
                            }}>
                                <div style={{ width: '8px', height: '8px', background: activeQr.upiId?.startsWith('MANUAL-UPI') ? '#f59e0b' : '#10b981', borderRadius: '50%' }}></div>
                                <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569', letterSpacing: '0.05em' }}>
                                    {activeQr.upiId?.startsWith('000201') ? 'RAW BHARAT-QR DATA' : (activeQr.upiId?.startsWith('upi://') ? 'ORIGINAL UPI URI' : 'DIGITAL VERIFIED QR')}
                                </span>
                            </div>

                            <div className="raw-data-box" style={{ 
                                width: '100%',
                                padding: '12px',
                                background: '#f1f5f9',
                                borderRadius: '12px',
                                fontSize: '10px',
                                color: '#64748b',
                                fontFamily: 'monospace',
                                wordBreak: 'break-all',
                                textAlign: 'center',
                                border: '1px dashed #cbd5e1'
                            }}>
                                <div style={{ fontWeight: '700', marginBottom: '4px', color: '#475569' }}>ENC DATA:</div>
                                {activeQr.upiId}
                            </div>
                        </div>
                      </>
                    ) : (
                        <div className="qr-placeholder" style={{width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', color: '#666', borderRadius: '12px'}}>
                            No QR Assigned
                        </div>
                    )}
                  </div>
                </div>
                {activeQr?.tid && (
                    <div className="qr-footer-info" style={{marginTop: '1rem', textAlign: 'center', opacity: 0.6, fontSize: '0.8rem'}}>
                        Target TID: {activeQr.tid}
                    </div>
                )}
              </div>

            </>
          )}

          {/* Fix Modal - Moved OUT of conditional tab block so it works everywhere */}
          {fixingQr && (
            <div style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                backdropFilter: 'blur(4px)'
            }}>
                <div style={{
                    background: 'white',
                    padding: '30px',
                    borderRadius: '24px',
                    width: '90%',
                    maxWidth: '400px',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>Fix Invalid QR ({fixingQr.label})</h2>
                    <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>
                        Aapki photo thodi dhundli hai isliye system usey "read" nahi kar pa raha. Bas ek baar niche **UPI VPA** type karke save kar dijiye.
                    </p>
                    
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>Merchant UPI VPA</label>
                        <input 
                            type="text"
                            placeholder="example@paytm or 9123456789@upi"
                            value={manualUpi}
                            onChange={(e) => setManualUpi(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                border: '2px solid #e2e8f0',
                                fontSize: '16px',
                                outline: 'none',
                                transition: 'border-color 0.2s'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button 
                            onClick={() => {
                                setFixingQr(null);
                                setManualUpi('');
                            }}
                            style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#f1f5f9', color: '#475569', fontWeight: '600', cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => updateUpiId(fixingQr.id, manualUpi)}
                            disabled={isFixing || !manualUpi.includes('@')}
                            style={{ 
                                flex: 1, 
                                padding: '12px', 
                                borderRadius: '12px', 
                                border: 'none', 
                                background: '#8b5cf6', 
                                color: 'white', 
                                fontWeight: '600', 
                                cursor: 'pointer',
                                opacity: (isFixing || !manualUpi.includes('@')) ? 0.5 : 1
                            }}
                        >
                            {isFixing ? 'Saving...' : 'Verify & Upgrade'}
                        </button>
                    </div>
                </div>
            </div>
          )}

          {activeTab === 'Dynamic' && (
            <div className="dynamic-qr-section card" style={{ maxWidth: '480px', width: '100%', padding: '2rem' }}>
              <div className="qr-header-section" style={{ marginBottom: '2rem' }}>
                <div className="qr-icon-label">⚡ Real-time QR</div>
                <h2>Generate Dynamic QR</h2>
                <p className="subtitle">Enter amount to create a one-time payment QR.</p>
              </div>

              <div className="form-group" style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Amount (₹)</label>
                <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)', fontWeight: '700' }}>₹</span>
                    <input 
                        type="number" 
                        placeholder="0.00" 
                        value={dynamicAmount}
                        onChange={(e) => setDynamicAmount(e.target.value)}
                        style={{ width: '100%', padding: '1rem 1rem 1rem 2.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '1.25rem', fontWeight: '700' }}
                    />
                </div>
              </div>

              {Number(dynamicAmount) > 0 && activeQr ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className="qr-frame" style={{ background: 'white', padding: '1rem', borderRadius: '16px', marginBottom: '1.5rem' }}>
                    <QRCodeSVG 
                        value={dynamicUpiString} 
                        size={280}
                        level="H"
                        includeMargin={true}
                    />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: 'white', fontWeight: '700', fontSize: '1.125rem' }}>Pay ₹{dynamicAmount}</p>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem' }}>Scan and pay using any UPI app</p>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '3rem 1rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '2px dashed rgba(255,255,255,0.05)', borderRadius: '16px' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>💸</div>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem' }}>
                        {!activeQr ? "Wait for admin to assign QRs" : "Enter an amount to generate QR"}
                    </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Assigned' && (
            <div className="assigned-qrs-section card" style={{ maxWidth: '800px', width: '100%', padding: '2rem' }}>
              <div className="qr-header-section" style={{ marginBottom: '2rem' }}>
                <div className="qr-icon-label">📁 Inventory</div>
                <h2>Assigned QR Codes</h2>
                <p className="subtitle">List of all payment identifiers linked to your account.</p>
              </div>

              {myQrs.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                  {myQrs.map(q => (
                    <div 
                      key={q.id} 
                      onClick={() => {
                        setSelectedQrId(q.id);
                        setActiveTab('My QR');
                        // If it's a manual QR, switch to physical mode automatically
                        if (q.upiId?.startsWith('MANUAL-UPI')) setViewMode('physical');
                      }}
                      style={{ 
                        background: q.id === activeQr?.id ? 'rgba(124, 58, 237, 0.1)' : 'rgba(255, 255, 255, 0.03)', 
                        border: q.id === activeQr?.id ? '1px solid rgba(124, 58, 237, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)', 
                        borderRadius: '16px', 
                        padding: '1.25rem', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '12px',
                        cursor: 'pointer',
                        transform: q.id === activeQr?.id ? 'translateY(-2px)' : 'none',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        position: 'relative',
                        boxShadow: q.id === activeQr?.id ? '0 8px 16px rgba(124, 58, 237, 0.15)' : 'none'
                      }}>
                      {q.id === activeQr?.id && <div style={{ position: 'absolute', top: '-10px', right: '12px', background: '#7c3aed', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: '800' }}>ACTIVE</div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div style={{ width: '48px', height: '48px', background: '#fff', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)' }}>
                                <img 
                                    src={`${UPLOADS_BASE}${q.imagePath}`} 
                                    alt="QR" 
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', transform: q.upiId?.startsWith('MANUAL-UPI') ? 'scale(2.5)' : 'none' }} 
                                />
                            </div>
                            <div>
                                <div style={{ fontWeight: '700', color: 'white', fontSize: '14px' }}>{q.label}</div>
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>TID: {q.tid || 'N/A'}</div>
                            </div>
                        </div>
                        <span style={{ 
                            fontSize: '10px', 
                            padding: '4px 8px', 
                            borderRadius: '4px', 
                            background: q.upiId?.startsWith('MANUAL-UPI') ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                            color: q.upiId?.startsWith('MANUAL-UPI') ? '#f59e0b' : '#10b981', 
                            fontWeight: '800' 
                        }}>
                            {q.upiId?.startsWith('MANUAL-UPI') ? 'ACTION REQ' : 'VERIFIED'}
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', wordBreak: 'break-all', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        {q.upiId}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                         {q.upiId?.startsWith('MANUAL-UPI') && (
                            <button 
                                onClick={() => {
                                    setManualUpi('');
                                    setFixingQr(q);
                                }}
                                style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: '#8b5cf6', color: 'white', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                            >
                                Fix QR
                            </button>
                         )}
                         <button 
                            onClick={async () => {
                                if (window.confirm("Release this QR code back to Admin? It will be removed from your dashboard.")) {
                                    await unassignQrCode(q.id);
                                }
                            }}
                            style={{ 
                                flex: 1, 
                                padding: '8px', 
                                borderRadius: '8px', 
                                border: '1px solid rgba(239, 68, 68, 0.3)', 
                                background: 'rgba(239, 68, 68, 0.05)', 
                                color: '#ef4444', 
                                fontSize: '12px', 
                                fontWeight: '700', 
                                cursor: 'pointer' 
                            }}
                         >
                            Unassign
                         </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '4rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                    No assigned QR codes found.
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default QrCodesPage;
