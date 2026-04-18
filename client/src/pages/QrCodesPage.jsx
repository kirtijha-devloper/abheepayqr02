import React, { useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { QRCodeSVG } from 'qrcode.react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { UPLOADS_BASE } from '../config';
import './QrCodesPage.css';

const QrCodesPage = () => {
  const { qrCodes, updateQrCode, unassignQrCode, merchants, assignQrByIds } = useAppContext();
  const { user } = useAuth();
  const { success, error } = useToast();
  const [activeTab, setActiveTab] = useState('My QR');
  const [viewMode, setViewMode] = useState('physical');
  const [dynamicAmount, setDynamicAmount] = useState('');
  const [fixingQr, setFixingQr] = useState(null);
  const [manualUpi, setManualUpi] = useState('');
  const [isFixing, setIsFixing] = useState(false);
  const [selectedQrId, setSelectedQrId] = useState(null);
  const [assigningQr, setAssigningQr] = useState(null);

  // Filter QRs: Merchant sees their own + their branches
  const myDirectQrs = useMemo(() => {
    return (qrCodes || []).filter(q => q.merchantId === user?.id && q.status === 'active');
  }, [qrCodes, user]);

  const branchQrs = useMemo(() => {
    return (qrCodes || []).filter(q => q.merchantId !== user?.id && q.status === 'active');
  }, [qrCodes, user]);

  const handleAssignToBranch = async (branchId) => {
    if (!assigningQr) return;
    const res = await assignQrByIds([assigningQr.id], branchId);
    if (res.success) {
      success(`QR assigned to branch successfully.`);
      setAssigningQr(null);
    } else {
      error(res.error || 'Failed to assign QR.');
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
    } catch (err) {
        console.error("Failed to update UPI ID:", err);
        error('Failed to update UPI ID. Please try again.');
    } finally {
        setIsFixing(false);
    }
  };

  const activeQr = useMemo(() => {
    if (myDirectQrs.length === 0) return null;
    if (selectedQrId) {
        const found = myDirectQrs.find(q => q.id === selectedQrId);
        if (found) return found;
    }
    const sortedQrs = [...myDirectQrs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const verifiedQrs = sortedQrs.filter(q => {
        const upi = (q.upiId || "").trim();
        return upi && !upi.startsWith('MANUAL-UPI');
    });
    return verifiedQrs.length > 0 ? verifiedQrs[0] : sortedQrs[0];
  }, [myDirectQrs, selectedQrId]);

  const getUpiString = (amount = 0) => {
    if (!activeQr) return "upi://pay?pa=unassigned@upi&pn=Unassigned&mc=0000&tid=&tr=&tn=Unassigned&am=0&cu=INR";
    let rawVal = (activeQr.upiId || "").trim();
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
            if (uri.match(/[?&]mam=/i)) uri = uri.replace(/([?&])mam=[0-9.]+/i, `$1mam=${reqAmount}`);
            else uri += `&mam=${reqAmount}`;
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

  const [showPreview, setShowPreview] = useState(false);
  const upiString = getUpiString();
  const dynamicUpiString = getUpiString(Number(dynamicAmount) || 0);

  return (
    <div className="dashboard-layout">
      {showPreview && activeQr?.imagePath && (
        <div className="fullscreen-modal" onClick={() => setShowPreview(false)}>
            <div className="modal-content large-preview" onClick={e => e.stopPropagation()}>
                <button className="qr-close-modal" onClick={() => setShowPreview(false)}>×</button>
                <div className="preview-label">Original Uploaded QR Image</div>
                <img src={`${UPLOADS_BASE}${activeQr.imagePath}`} alt="Original QR" className="full-image" />
            </div>
        </div>
      )}

      {fixingQr && (
        <div className="fullscreen-modal" style={{background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'}}>
            <div style={{background: 'white', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'}}>
                <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>Fix Invalid QR</h2>
                <input type="text" placeholder="example@paytm" value={manualUpi} onChange={(e) => setManualUpi(e.target.value)} style={{width: '100%', padding: '12px', borderRadius: '12px', border: '2px solid #e2e8f0', marginBottom: '20px'}} />
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setFixingQr(null)} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#f1f5f9', border: 'none' }}>Cancel</button>
                    <button onClick={() => updateUpiId(fixingQr.id, manualUpi)} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#8b5cf6', color: 'white', border: 'none' }}>Save</button>
                </div>
            </div>
        </div>
      )}

      {assigningQr && (
        <div className="fullscreen-modal" onClick={() => setAssigningQr(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '400px', padding: '2rem'}}>
                <h3 style={{color: 'white', marginBottom: '1.5rem'}}>Assign QR to Branch</h3>
                <div style={{maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                    {merchants.map(branch => (
                        <button key={branch.id} onClick={() => handleAssignToBranch(branch.userId)} style={{background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '1rem', borderRadius: '12px'}}>
                            {branch.fullName}
                        </button>
                    ))}
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
            <button className={activeTab === 'Assigned' ? 'active' : ''} onClick={() => setActiveTab('Assigned')}>Inventory ({qrCodes.length})</button>
          </div>

          {activeTab === 'My QR' && (
            <>
              <div className="qr-header-section">
                <h2>Your Payment QR Code</h2>
                <p className="subtitle">{activeQr ? `Showing ${activeQr.label}` : "No QR codes assigned."}</p>
              </div>
              <div className="qr-card-exact card">
                <div className="qr-frame" style={{background: 'white', padding: '24px', borderRadius: '24px'}}>
                  {activeQr ? (
                    <QRCodeSVG value={upiString} size={256} />
                  ) : (
                    <div style={{width: 256, height: 256, background: '#f5f5f5', borderRadius: '12px'}} />
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'Assigned' && (
            <div className="assigned-qrs-section card" style={{ maxWidth: '800px', width: '100%', padding: '2rem' }}>
              <div className="qr-header-section" style={{ marginBottom: '2rem' }}>
                <h2>Manage QR Codes</h2>
                <p className="subtitle">View and allocate QR codes to your branches.</p>
              </div>

              {qrCodes.length > 0 ? (
                <>
                  <h4 style={{color: 'white', marginBottom: '1rem'}}>Directly Assigned ({myDirectQrs.length})</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
                    {myDirectQrs.map(q => (
                      <div key={q.id} style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '16px', padding: '1.25rem' }}>
                        <div style={{fontWeight: '700', color: 'white'}}>{q.label}</div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                          {user?.role === 'merchant' && (
                             <button onClick={() => setAssigningQr(q)} style={{ flex: 1, padding: '8px', borderRadius: '8px', background: '#8b5cf6', color: 'white', border: 'none' }}>Assign</button>
                          )}
                          <button onClick={() => unassignQrCode(q.id)} style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none' }}>Unassign</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {branchQrs.length > 0 && (
                    <>
                      <h4 style={{color: 'white', marginBottom: '1rem'}}>Branch QRs ({branchQrs.length})</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                        {branchQrs.map(q => (
                          <div key={q.id} style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.1)', borderRadius: '16px', padding: '1.25rem' }}>
                            <div style={{fontWeight: '700', color: 'white'}}>{q.label}</div>
                            <div style={{fontSize: '0.8rem', color: '#10b981'}}>Assigned to: {q.merchantName}</div>
                            <button onClick={() => unassignQrCode(q.id)} style={{ width: '100%', padding: '8px', marginTop: '12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none' }}>Revoke</button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div style={{ padding: '4rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>No QRs found.</div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default QrCodesPage;
