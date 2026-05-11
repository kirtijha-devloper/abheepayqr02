import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import ManualQrModal from '../components/ManualQrModal';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { UPLOADS_BASE, API_BASE } from '../config';
import { formatRoleLabel } from '../utils/roleLabels';
import jsQR from 'jsqr';
import JSZip from 'jszip';
import './QrCodesAdminPage.css';

const QrCodesAdminPage = () => {
  const formatCurrency = (value) => `Rs ${Number(value || 0).toFixed(2)}`;
  const formatDateTime = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
  };

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialTab = searchParams.get('tab') === 'inventory' ? 'manage' : 'upload';
  
  const [activeTab, setActiveTab] = useState(initialTab); // 'upload' or 'manage'
  const [uploadMode, setUploadMode] = useState('single');
  const [expandedSection, setExpandedSection] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [bulkFiles, setBulkFiles] = useState([]);
  
  const [statusFilter, setStatusFilter] = useState('All');
  const [assignFilter, setAssignFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [formData, setFormData] = useState({ label: '', mid: '', tid: '', upiId: '', merchantId: '' });
  const [scanError, setScanError] = useState('');
  
  const [assignTidInput, setAssignTidInput] = useState('');
  const [selectedTids, setSelectedTids] = useState([]);
  const [selectedQrIds, setSelectedQrIds] = useState([]); // for row checkboxes
  const [showTidSuggestions, setShowTidSuggestions] = useState(false);
  const [assignRoleFilter, setAssignRoleFilter] = useState('master');
  const [assignMerchantId, setAssignMerchantId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignTargets, setAssignTargets] = useState([]);

  // Edit State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editQrData, setEditQrData] = useState(null);
  const [reportQr, setReportQr] = useState(null);
  const [qrReport, setQrReport] = useState(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportFilters, setReportFilters] = useState({ startDate: '', endDate: '' });

  // UPI expand state
  const [expandedUpiIds, setExpandedUpiIds] = useState(new Set());
  const toggleUpiExpand = (id, e) => {
    e.stopPropagation();
    setExpandedUpiIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fileInputRef = useRef(null);
  const { success, error } = useToast();
  const { user } = useAuth();
  const {
    merchants,
    qrCodes, addQrCode, bulkAddQrCodes, assignQrByTid, assignQrByIds,
    unassignQrCode, deleteQrCode, updateQrCode, fetchData, fetchQrReport
  } = useAppContext();

  const isMerchantUser = user?.role === 'merchant';

  useEffect(() => {
    const fetchAssignTargets = async () => {
      const token = sessionStorage.getItem('authToken');
      try {
        const res = await fetch(`${API_BASE}/qrcodes/assign-targets`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) setAssignTargets(await res.json());
      } catch (error) {
        console.error('Failed to fetch assign targets', error);
      }
    };
    fetchAssignTargets();
  }, []);

  const adminAssignableRoles = ['master', 'merchant', 'branch'];
  const filteredAssignTargets = isMerchantUser
    ? assignTargets
    : assignTargets.filter((item) => String(item.role || '').toLowerCase() === assignRoleFilter);

  useEffect(() => {
    setAssignMerchantId('');
  }, [assignRoleFilter]);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processFiles(Array.from(files));
  };

  const scanQrCode = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          
          const tryScan = (filter = 'none') => {
            ctx.filter = filter;
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            return jsQR(imageData.data, imageData.width, imageData.height);
          };

          // Pass 1: Original
          let code = tryScan();
          
          // Pass 2: High Contrast
          if (!code) code = tryScan('contrast(200%) grayscale(100%)');
          
          // Pass 3: Brightness boost + Contrast
          if (!code) code = tryScan('brightness(120%) contrast(150%) grayscale(100%)');
          
          // Pass 4: Low Brightness (for overexposed)
          if (!code) code = tryScan('brightness(80%) contrast(200%) grayscale(100%)');

          resolve(code ? code.data : null);
        };
        img.onerror = () => resolve(null);
        img.src = event.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  const processFiles = async (files) => {
    if (uploadMode === 'single') {
        const file = files[0];
        setSelectedFile(file);
        setScanError('');
        setIsScanning(true);

        try {
            const upiId = await scanQrCode(file);
            if (upiId) {
                setFormData(prev => ({ ...prev, upiId: upiId }));
            } else {
                setScanError('Could not find a valid QR code in this image.');
            }
        } catch {
            setScanError('Error scanning QR code.');
        } finally {
            setIsScanning(false);
        }
    } else {
        // Bulk mode
        let allFiles = [];
        for (const file of files) {
            if (file.name.endsWith('.zip')) {
                const zip = await JSZip.loadAsync(file);
                const zipFiles = [];
                zip.forEach((relativePath, zipEntry) => {
                    if (!zipEntry.dir && (zipEntry.name.match(/\.(png|jpg|jpeg|gif)$/i))) {
                        zipFiles.push(zipEntry);
                    }
                });

                for (const entry of zipFiles) {
                    const blob = await entry.async("blob");
                    const newFile = new File([blob], entry.name, { type: blob.type });
                    allFiles.push(newFile);
                }
            } else {
                allFiles.push(file);
            }
        }

        setBulkFiles(allFiles);
        setSelectedFile(allFiles.length > 1 ? { name: `${allFiles.length} files extracted/selected` } : allFiles[0]);
        setScanError('');
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
        processFiles(Array.from(files));
    }
  };

  const handleUpload = async () => {
    if ((uploadMode === 'single' && !selectedFile) || (uploadMode === 'bulk' && bulkFiles.length === 0)) {
        error('Please select file(s) first.');
        return;
    }

    const formDataObj = new FormData();

    try {
        if (uploadMode === 'bulk') {
            const confirmBulk = window.confirm(`Are you sure you want to onboard ${bulkFiles.length} QR codes?`);
            if (!confirmBulk) return;

            setIsScanning(true);
            const qrcodesMetadata = [];
            let scannedCount = 0;

            const batchPrefix = Math.random().toString(36).substr(2, 3).toUpperCase();

            for (const file of bulkFiles) {
                const upiId = await scanQrCode(file);
                scannedCount++;
                
                let baseName = file.name.split('.')[0];
                let cleanTid = baseName.replace(/[^a-zA-Z0-9_-]/g, ''); 

                if (baseName.toLowerCase().includes('whatsapp') || baseName.toLowerCase().includes('image')) {
                    const seqNum = String(scannedCount).padStart(4, '0');
                    baseName = `QR-${batchPrefix}-${seqNum}`;
                    cleanTid = `TID-${batchPrefix}-${seqNum}`;
                }

                qrcodesMetadata.push({
                    label: baseName || "Bulk QR Code",
                    upiId: upiId || `MANUAL-UPI-${cleanTid ? cleanTid + '-' : ''}${Math.random().toString(36).substr(2, 6).toUpperCase()}`, 
                    mid: formData.mid || null,
                    tid: cleanTid || null,
                    merchantId: formData.merchantId || null,
                    merchantName: formData.merchantId ? (merchants.find(m => (m.userId || m.id) === formData.merchantId)?.fullName || "Assigned") : "Unassigned",
                    originalName: file.name // Used by backend to match image
                });

                formDataObj.append('qrImages', file);
            }

            formDataObj.append('qrcodes', JSON.stringify(qrcodesMetadata));

            if (qrcodesMetadata.length > 0) {
                const result = await bulkAddQrCodes(formDataObj);
                if (result.success) {
                    success(`Successfully onboarded all ${result.count} QR codes in the batch.`);
                } else {
                    error(result.error || 'Bulk upload failed');
                }
            } else {
                error('No valid files selected.');
            }
            setIsScanning(false);
        } else {
            formDataObj.append('qrImage', selectedFile);
            formDataObj.append('label', formData.label || "QR Code");
            formDataObj.append('upiId', formData.upiId);
            formDataObj.append('mid', formData.mid);
            formDataObj.append('tid', formData.tid);
            formDataObj.append('merchantId', formData.merchantId);
            formDataObj.append('merchantName', merchants.find(m => (m.userId || m.id) === formData.merchantId)?.fullName || "Unassigned");
            formDataObj.append('type', 'single');

            const result = await addQrCode(formDataObj);
            if (result?.success) {
              success('QR code onboarded successfully.');
            } else {
              throw new Error(result?.error || 'QR upload failed');
            }
        }

        // Reset
        setSelectedFile(null);
        setBulkFiles([]);
        setFormData({ label: '', mid: '', tid: '', upiId: '', merchantId: '' });
    } catch (err) {
        console.error("Critical error during upload:", err);
        error(`Critical error: ${err.message}`);
        setIsScanning(false);
    }
  };

  const handleAssignByTid = async () => {
    if (!assignMerchantId) {
      error(`Please select a ${isMerchantUser ? 'branch' : 'user'} first.`);
      return;
    }
    if (selectedTids.length === 0 && selectedQrIds.length === 0) {
      error('Please select at least one QR code.');
      return;
    }
    setIsAssigning(true);
    let successCount = 0;
    let errors = [];
    
    // Assign by direct ID for row-checkbox selections (works even when TID is null)
    if (selectedQrIds.length > 0) {
      const result = await assignQrByIds(selectedQrIds, assignMerchantId);
      if (result.success) {
        // use data.count if available, else fall back to number of selected IDs
        const cnt = (result.data?.count != null) ? result.data.count : selectedQrIds.length;
        successCount += cnt;
      } else {
        errors.push(`IDs: ${result.error}`);
      }
    }

    // Assign by TID for quick-search selections
    for (const tid of selectedTids) {
      const result = await assignQrByTid(tid, assignMerchantId);
      if (result.success) {
        successCount += (result.data?.count != null) ? result.data.count : 1;
      } else {
        errors.push(`TID ${tid}: ${result.error}`);
      }
    }
    
    if (errors.length > 0) {
      error(errors.join(' | '));
    }
    if (successCount > 0) {
      success(`Assigned ${successCount} QR code(s) successfully.`);
      setSelectedTids([]);
      setSelectedQrIds([]);
      setAssignTidInput('');
      setAssignMerchantId('');
    } else if (errors.length === 0) {
      error('0 QR codes were updated. They may already be assigned.');
    }
    setIsAssigning(false);
  };

  const handleEditQrClick = (e, qr) => {
    e.stopPropagation();
    setEditQrData({ ...qr });
    setShowEditModal(true);
  };

  const handleEditQrSubmit = async (e) => {
    e.preventDefault();
    try {
        const res = await updateQrCode(editQrData.id, {
            label: editQrData.label,
            upiId: editQrData.upiId,
            mid: editQrData.mid,
            tid: editQrData.tid
        });
        if (!res?.success) throw new Error(res?.error || 'Failed to update QR code');
        setShowEditModal(false);
        setEditQrData(null);
        success('QR code updated successfully.');
    } catch (err) {
        error(err.message || 'Failed to update QR code');
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

  return (
    <div className="dashboard-layout">
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
              <button className="action-btn" onClick={handleApplyReportFilters} disabled={isLoadingReport}>
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
        <main className="dashboard-body animated">
          <div className="qr-admin-header-flex">
            <div className="qr-title-group">
              <div className="qr-header-icon">⊞</div>
              <div className="qr-text-group">
                <h2>QR Management</h2>
                <p>Onboard physical QR codes and link them to distributor MIDs.</p>
              </div>
            </div>
            <button className="manual-create-top-btn" onClick={() => setIsModalOpen(true)}>
              + Manual Onboarding
            </button>
          </div>

          <div className="qr-nav-tabs">
            <button 
              className={`qr-nav-tab ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              <span className="tab-icon">📤</span> Bulk Upload
            </button>
            <button 
              className={`qr-nav-tab ${activeTab === 'manage' ? 'active' : ''}`}
              onClick={() => setActiveTab('manage')}
            >
              <span className="tab-icon">📋</span> Inventory
            </button>
          </div>

          {activeTab === 'upload' ? (
            <div className="qr-admin-grid">
              <div className="qr-upload-card card">
                <div className="card-header-v2">
                   <div className="header-info">
                      <span className="upload-icon-small">🖼️</span>
                      <div>
                        <h4>Upload QR Code Image</h4>
                        <p>Import single or bulk QR files</p>
                      </div>
                   </div>
                   <div className="toggle-group-v2">
                      <button className={`toggle-opt ${uploadMode === 'single' ? 'active' : ''}`} onClick={() => setUploadMode('single')}>Single</button>
                      <button className={`toggle-opt ${uploadMode === 'bulk' ? 'active' : ''}`} onClick={() => setUploadMode('bulk')}>Bulk</button>
                   </div>
                </div>

                <div 
                  className={`qr-dropzone-v2 ${isDragging ? 'dragging' : ''}`} 
                  onClick={handleFileClick}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept="image/*,.zip"
                    multiple={uploadMode === 'bulk'}
                    onChange={handleFileChange}
                  />
                  <div className="dropzone-content">
                    {selectedFile ? (
                      <>
                        <span className="drop-img-icon success">✅</span>
                        <p className="selected-filename">{selectedFile.name}</p>
                        <span className="drop-sub">{isScanning ? 'Scanning QR...' : formData.upiId ? `Decoded: ${formData.upiId}` : scanError || 'File ready'}</span>
                        <button className="clear-file-btn" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setFormData(p => ({...p, upiId: ''})); }}>✕ Remove</button>
                      </>
                    ) : (
                      <>
                        <span className="drop-img-icon">{uploadMode === 'single' ? '🖼️' : '📚'}</span>
                        <p>{uploadMode === 'single' ? 'Select QR image file (PNG/JPG)' : 'Select multiple QR image files or a ZIP'}</p>
                        <span className="drop-sub">{uploadMode === 'single' ? 'Maximum file size: 5MB' : 'Unlimited files in bulk mode'}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="qr-form-v2">
                  {uploadMode === 'single' ? (
                    <>
                      <div className="form-group-v2">
                        <label>Label / Name</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Counter 1" 
                          value={formData.label}
                          onChange={(e) => setFormData({...formData, label: e.target.value})}
                        />
                      </div>
                       <div className="form-group-v2">
                        <label>MID (Merchant ID)</label>
                        <input 
                          type="text" 
                          placeholder="Enter assigned MID" 
                          value={formData.mid}
                          onChange={(e) => setFormData({...formData, mid: e.target.value})}
                        />
                      </div>
                      <div className="form-group-v2">
                        <label>TID (Terminal ID)</label>
                        <input 
                          type="text" 
                          placeholder="Enter assigned TID" 
                          value={formData.tid}
                          onChange={(e) => setFormData({...formData, tid: e.target.value})}
                        />
                      </div>
                      <div className="form-group-v2">
                        <label>Assign Distributor</label>
                        <select 
                          className="inner-input"
                          value={formData.merchantId}
                          onChange={(e) => setFormData({...formData, merchantId: e.target.value})}
                          style={{width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-h)', padding: '12px', borderRadius: '8px'}}
                        >
                          <option value="">Select Merchant</option>
                          {assignTargets.map(m => (
                            <option key={m.id} value={m.userId || m.id}>{m.fullName || m.email}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group-v2">
                        <label>UPI ID (Auto-extracted)</label>
                        <input 
                          type="text" 
                          placeholder="Scan QR or enter manually" 
                          value={formData.upiId}
                          onChange={(e) => setFormData({...formData, upiId: e.target.value})}
                        />
                      </div>
                      
                      <div className={`collapsible-item ${expandedSection === 'advance' ? 'open' : ''}`}>
                        <div className="collapsible-header" onClick={() => toggleSection('advance')}>
                          <div className="header-left">
                            <span className="item-icon">🏦</span>
                            <span>Bank & Mapping Details</span>
                          </div>
                          <span className="chevron">▼</span>
                        </div>
                        <div className="collapsible-body">
                          <input type="text" placeholder="Bank Name" className="inner-input" />
                          <input type="text" placeholder="Account Number" className="inner-input" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="bulk-info-box card">
                       <strong>Bulk Mode Active:</strong> 
                       <p>System will automatically extract UPI data and MIDs from filenames or QR metadata.</p>
                       <ul>
                          <li>Ensure filenames are like: <code>terminal_id.png</code></li>
                          <li>Accepted formats: PNG, JPG, WEBP</li>
                       </ul>
                    </div>
                  )}

                  <button className="upload-submit-btn-v2" onClick={handleUpload}>
                     {uploadMode === 'single' ? 'Upload & Process QR' : 'Start Bulk Import'}
                  </button>
                </div>
              </div>

              <div className="qr-sidebar-v2">
                <div className="purple-card card">
                  <div className="manual-icon-v2">✨</div>
                  <h4>Manual Onboarding</h4>
                  <p>Input the UPI string manually to generate a secure code instantly.</p>
                  <button className="manual-generate-btn" onClick={() => setIsModalOpen(true)}>
                    Generate Now
                  </button>
                </div>
                
                <div className="how-it-works-card card">
                    <h4>How it works</h4>
                    <ul className="works-list">
                        <li>
                            <span className="step-num">1</span>
                            <p>Upload a QR image or enter UPI string manually.</p>
                        </li>
                        <li>
                            <span className="step-num">2</span>
                            <p>Map the QR to a specific Merchant or Terminal ID.</p>
                        </li>
                        <li>
                            <span className="step-num">3</span>
                            <p>QR code becomes immediately active for payments.</p>
                        </li>
                    </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="qr-manage-container card animated-fade-in">
              <div className="assign-by-tid-bar" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: 'var(--bg-card-2)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-h)' }}>Quick Assign:</span>
                  
                  <div style={{ position: 'relative', width: '220px' }}>
                    <input 
                      type="text" 
                      placeholder="Search unassigned by TID/Label" 
                      value={assignTidInput} 
                      onChange={e => {
                        setAssignTidInput(e.target.value);
                        setShowTidSuggestions(true);
                      }} 
                      onFocus={() => setShowTidSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowTidSuggestions(false), 200)}
                      className="inner-input" 
                      style={{ width: '100%' }}
                    />
                    {showTidSuggestions && assignTidInput && (() => {
                        const suggestions = qrCodes.filter(q => 
                          q.merchantName === 'Unassigned' && 
                          !selectedTids.includes(q.tid) &&
                          (q.tid?.toLowerCase()?.includes(assignTidInput.toLowerCase()) || q.label?.toLowerCase()?.includes(assignTidInput.toLowerCase()))
                        ).slice(0, 5);
                        
                        if (suggestions.length === 0) return null;
                        
                        return (
                          <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, 
                            background: '#1f2937', border: '1px solid #374151', 
                            borderRadius: '8px', zIndex: 10, marginTop: '8px', overflow: 'hidden',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                          }}>
                            {suggestions.map(q => (
                              <div 
                                key={q.id} 
                                style={{ padding: '10px 12px', cursor: 'pointer', color: '#e5e7eb', fontSize: '13px', borderBottom: '1px solid #374151', transition: 'background 0.2s' }}
                                onMouseDown={(e) => {
                                  e.preventDefault(); // Stop onBlur from firing first
                                  setSelectedTids(prev => [...new Set([...prev, q.tid])]);
                                  setAssignTidInput('');
                                  setShowTidSuggestions(false);
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#374151'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <div style={{ fontWeight: 600 }}>{q.label || 'Unnamed QR'}</div>
                                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>TID: {q.tid || 'No TID'}</div>
                              </div>
                            ))}
                          </div>
                        );
                    })()}
                  </div>

                  {!isMerchantUser && (
                    <select
                      value={assignRoleFilter}
                      onChange={e => setAssignRoleFilter(e.target.value)}
                      className="inner-input"
                      style={{ width: '160px', background: 'var(--bg-input)', color: 'var(--text-h)' }}
                    >
                      {adminAssignableRoles.map(role => (
                        <option key={role} value={role}>
                          {formatRoleLabel(role)}
                        </option>
                      ))}
                    </select>
                  )}

                  <select 
                    value={assignMerchantId} 
                    onChange={e => setAssignMerchantId(e.target.value)} 
                    className="inner-input" 
                    style={{ width: '250px', background: 'var(--bg-input)', color: 'var(--text-h)' }}
                  >
                  <option value="">
                    {isMerchantUser ? 'Select Branch' : `Select ${formatRoleLabel(assignRoleFilter)}`}
                  </option>
                  {filteredAssignTargets.map(m => (
                    <option key={m.id || m.userId} value={m.userId || m.id}>{m.fullName || m.email}</option>
                  ))}
                  </select>
                  <button 
                    className="action-btn" 
                    style={{ width: 'auto', padding: '10px 24px', margin: 0 }} 
                    onClick={handleAssignByTid}
                    disabled={isAssigning || (selectedTids.length === 0 && selectedQrIds.length === 0) || !assignMerchantId}
                  >
                    {isAssigning ? 'Assigning...' : `Assign ${selectedTids.length + selectedQrIds.length > 0 ? selectedTids.length + selectedQrIds.length : ''} QR${selectedTids.length + selectedQrIds.length !== 1 ? 's' : ''}`}
                  </button>
                </div>
                {(selectedTids.length > 0 || selectedQrIds.length > 0) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                    {selectedTids.map(tid => (
                      <span key={tid} style={{ background: 'var(--primary-dim)', border: '1px solid var(--primary-dim)', color: 'var(--primary)', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {tid}
                        <button onClick={() => setSelectedTids(prev => prev.filter(t => t !== tid))} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, fontSize: '16px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
                      </span>
                    ))}
                    {selectedQrIds.length > 0 && (
                      <span style={{ background: 'var(--primary-dim)', border: '1px solid var(--primary-dim)', color: 'var(--primary)', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        + {selectedQrIds.length} selected from table
                        <button onClick={() => setSelectedQrIds([])} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, fontSize: '16px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="manage-toolbar">
                <div className="manage-left">
                    <div className="manage-search">
                        <span className="search-icon">🔍</span>
                        <input type="text" placeholder="Search by MID or UPI handle..." />
                    </div>
                </div>
                <div className="manage-right">
                  <div className="filter-group-managed">
                     {['All', 'Active', 'Disabled'].map(opt => (
                        <button key={opt} className={`filter-btn-v2 ${statusFilter === opt ? 'active' : ''}`} onClick={() => setStatusFilter(opt)}>{opt}</button>
                     ))}
                  </div>
                  <div className="filter-group-managed">
                     {['All', 'Assigned', 'Unassigned'].map(opt => (
                        <button key={opt} className={`filter-btn-v2 ${assignFilter === opt ? 'active' : ''}`} onClick={() => setAssignFilter(opt)}>{opt}</button>
                     ))}
                  </div>
                  <button className="refresh-btn-v2" onClick={fetchData}>Refresh</button>
                </div>
              </div>

              <div className="table-responsive">
                <table className="manage-qrs-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>
                        <input 
                          type="checkbox" 
                          checked={(() => {
                            const filteredIds = qrCodes.filter(q => {
                                if (statusFilter !== 'All' && q.status?.toLowerCase() !== statusFilter.toLowerCase()) return false;
                                if (assignFilter === 'Assigned' && q.merchantName === 'Unassigned') return false;
                                if (assignFilter === 'Unassigned' && q.merchantName !== 'Unassigned') return false;
                                return true;
                            }).map(q => q.id);
                            return filteredIds.length > 0 && filteredIds.every(id => selectedQrIds.includes(id));
                          })()}
                          onChange={e => {
                            const filteredQrs = qrCodes.filter(q => {
                                if (statusFilter !== 'All' && q.status?.toLowerCase() !== statusFilter.toLowerCase()) return false;
                                if (assignFilter === 'Assigned' && q.merchantName === 'Unassigned') return false;
                                if (assignFilter === 'Unassigned' && q.merchantName !== 'Unassigned') return false;
                                return true;
                            });
                            if (e.target.checked) {
                              setSelectedQrIds(prev => [...new Set([...prev, ...filteredQrs.map(q => q.id)])]);
                            } else {
                              const filteredIds = filteredQrs.map(q => q.id);
                              setSelectedQrIds(prev => prev.filter(id => !filteredIds.includes(id)));
                            }
                          }}
                        />
                      </th>
                      <th>UPI Handle</th>
                      <th>Assigned Distributor</th>
                      <th>Label & TID/MID</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredQrs = qrCodes.filter(q => {
                        if (statusFilter !== 'All' && q.status?.toLowerCase() !== statusFilter.toLowerCase()) return false;
                        if (assignFilter === 'Assigned' && q.merchantName === 'Unassigned') return false;
                        if (assignFilter === 'Unassigned' && q.merchantName !== 'Unassigned') return false;
                        return true;
                      });
                      return (
                        <>
                          {filteredQrs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(item => (
                            <tr 
                              key={item.id} 
                              onClick={() => {
                                if (selectedQrIds.includes(item.id)) {
                                  setSelectedQrIds(prev => prev.filter(id => id !== item.id));
                                } else {
                                  setSelectedQrIds(prev => [...prev, item.id]);
                                }
                              }}
                              style={{ 
                                background: selectedQrIds.includes(item.id) ? 'var(--primary-dim)' : 'transparent',
                                cursor: 'pointer',
                                transition: 'background 0.2s'
                              }}
                            >
                              <td onClick={(e) => e.stopPropagation()}>
                                <input 
                                  type="checkbox" 
                                  checked={selectedQrIds.includes(item.id)}
                                  onChange={e => {
                                    if (e.target.checked) setSelectedQrIds(prev => [...new Set([...prev, item.id])]);
                                    else setSelectedQrIds(prev => prev.filter(id => id !== item.id));
                                  }}
                                />
                              </td>
                              <td>
                                <div className="qr-upi-cell">
                                  {item.imagePath ? (
                                      <div className="qr-thumb-small" style={{background: 'white', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                          <img src={`${UPLOADS_BASE}${item.imagePath}`} alt="QR" style={{width: '20px', height: '20px', objectFit: 'contain'}} />
                                      </div>
                                  ) : (
                                      <div className="qr-thumb-small">▦</div>
                                  )}
                                  <span
                                    className={`upi-text upi-expandable ${expandedUpiIds.has(item.id) ? 'expanded' : ''}`}
                                    onClick={(e) => toggleUpiExpand(item.id, e)}
                                    title="Click to expand/collapse"
                                  >
                                    {expandedUpiIds.has(item.id)
                                      ? item.upiId
                                      : `${(item.upiId || '').substring(0, 4)}••••`
                                    }
                                  </span>
                                </div>
                              </td>
                              <td>
                                {item.merchantName !== 'Unassigned' ? (
                                  <div className="assigned-merchant">
                                    <div className="m-name">{item.merchantName}</div>
                                    <div className="m-id">ID: {item.mid || '102293'}</div>
                                  </div>
                                ) : (
                                  <span className="unassigned-badge">In Inventory</span>
                                )}
                              </td>
                              <td>
                                <div className="mid-label-cell">
                                  <div className="label-text">{item.label}</div>
                                  <div className="mid-text">MID: {item.mid || 'N/A'}</div>
                                  <div className="mid-text" style={{color: 'var(--text-mute)'}}>TID: {item.tid || 'N/A'}</div>
                                </div>
                              </td>
                              <td>
                                <span
                                  className={`status-badge-v2 ${item.status.toLowerCase()}`}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const newStatus = item.status?.toLowerCase() === 'active' ? 'disabled' : 'active';
                                    const result = await updateQrCode(item.id, { status: newStatus });
                                    if (result?.success) {
                                      success(`QR marked as ${newStatus}.`);
                                    } else {
                                      error(result?.error || 'Failed to update QR status.');
                                    }
                                  }}
                                  style={{ cursor: 'pointer' }}
                                  title="Click to toggle status"
                                >
                                  {item.status.toUpperCase()}
                                </span>
                              </td>
                              <td>
                                <div className="merchant-actions" style={{display: 'flex', gap: '8px'}}>
                                    <button
                                      className="action-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        loadQrReport(item);
                                      }}
                                      style={{padding: '6px 12px', fontSize: '11px', fontWeight: '700', minWidth: '70px'}}
                                    >
                                      Report
                                    </button>
                                    
                                    <button 
                                      className="action-btn"
                                      onClick={(e) => handleEditQrClick(e, item)}
                                      style={{padding: '6px 12px', fontSize: '11px', fontWeight: '700', minWidth: '60px'}}
                                    >
                                      Edit
                                    </button>

                                    {item.merchantId && (
                                      <button 
                                        onClick={() => {
                                          if (window.confirm("Unassign this QR code and return to inventory?")) {
                                            unassignQrCode(item.id);
                                          }
                                        }} 
                                        className="action-btn" 
                                        style={{padding: '6px 10px', fontSize: '11px', background: 'var(--primary-dim)', color: 'var(--primary)', border: '1px solid var(--primary-dim)', fontWeight: '700'}}
                                      >
                                        Unassign
                                      </button>
                                    )}

                                    <button onClick={() => deleteQrCode(item.id)} className="action-btn danger-btn" style={{padding: '6px 10px', fontSize: '12px', background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-bg)'}}>Delete</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </>
                      );
                  })()}
                </tbody>
              </table>
            </div>
            
            <div className="table-footer-v2">
              <span className="showing-text">Inventory: {qrCodes.length} QR Codes registered</span>
              <div className="pagination-v2">
                 <button 
                    className="nav-btn-v2" 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                    disabled={currentPage === 1}
                 >
                   Previous
                 </button>
                 <button className="nav-num-v2 active">{currentPage}</button>
                 <button 
                    className="nav-btn-v2" 
                    onClick={() => {
                        const maxPage = Math.ceil(
                          qrCodes.filter(q => {
                            if (statusFilter !== 'All' && q.status?.toLowerCase() !== statusFilter.toLowerCase()) return false;
                            if (assignFilter === 'Assigned' && q.merchantName === 'Unassigned') return false;
                            if (assignFilter === 'Unassigned' && q.merchantName !== 'Unassigned') return false;
                            return true;
                          }).length / itemsPerPage
                        );
                        if (currentPage < maxPage) setCurrentPage(p => p + 1);
                    }} 
                    disabled={
                      currentPage >= Math.ceil(
                        qrCodes.filter(q => {
                          if (statusFilter !== 'All' && q.status?.toLowerCase() !== statusFilter.toLowerCase()) return false;
                          if (assignFilter === 'Assigned' && q.merchantName === 'Unassigned') return false;
                          if (assignFilter === 'Unassigned' && q.merchantName !== 'Unassigned') return false;
                          return true;
                        }).length / itemsPerPage
                      ) || qrCodes.length === 0
                    }
                 >
                   Next
                 </button>
              </div>
            </div>

              {/* Fixed Assign Bar — always visible at bottom when rows are selected */}
              {selectedQrIds.length > 0 && (
                <div style={{
                  position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
                  width: 'calc(100% - 280px)', maxWidth: '900px',
                  background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
                  border: '1px solid rgba(124,108,248,0.5)',
                  borderRadius: '16px', padding: '14px 24px',
                  display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
                  zIndex: 999, boxShadow: '0 8px 40px rgba(124,108,248,0.4)'
                }}>
                  <span style={{ fontWeight: 700, color: '#a5b4fc', fontSize: '15px', whiteSpace: 'nowrap' }}>
                    ✓ {selectedQrIds.length} QR{selectedQrIds.length > 1 ? 's' : ''} selected
                  </span>
                  {!isMerchantUser && (
                    <select
                      value={assignRoleFilter}
                      onChange={e => setAssignRoleFilter(e.target.value)}
                      style={{
                        minWidth: '150px', background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(124,108,248,0.4)', color: '#fff',
                        padding: '10px 14px', borderRadius: '10px', fontSize: '14px'
                      }}
                    >
                      {adminAssignableRoles.map(role => (
                        <option key={role} value={role}>
                          {formatRoleLabel(role)}
                        </option>
                      ))}
                    </select>
                  )}
                  <select 
                    value={assignMerchantId} 
                    onChange={e => setAssignMerchantId(e.target.value)} 
                    style={{ 
                      flex: 1, minWidth: '200px', background: 'rgba(0,0,0,0.4)', 
                      border: '1px solid rgba(124,108,248,0.4)', color: '#fff', 
                      padding: '10px 14px', borderRadius: '10px', fontSize: '14px' 
                    }}
                  >
                    <option value="">
                      {isMerchantUser ? '— Select Branch to Assign —' : `— Select ${formatRoleLabel(assignRoleFilter)} to Assign —`}
                    </option>
                    {filteredAssignTargets.map(m => (
                      <option key={m.id || m.userId} value={m.userId || m.id}>{m.fullName || m.email}</option>
                    ))}
                  </select>
                  <button 
                    onClick={handleAssignByTid}
                    disabled={isAssigning || !assignMerchantId}
                    style={{ 
                      padding: '10px 28px', background: '#7c6cf8', color: '#fff',
                      border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer',
                      opacity: (!assignMerchantId || isAssigning) ? 0.5 : 1, fontSize: '14px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isAssigning ? 'Assigning...' : `🔗 Assign to ${isMerchantUser ? 'Branch' : formatRoleLabel(assignRoleFilter)}`}
                  </button>
                  <button 
                    onClick={() => setSelectedQrIds([])}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#94a3b8', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    ✕ Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {showEditModal && editQrData && (
        <div className="modal-overlay">
          <div className="modal-container" style={{maxWidth: '500px'}}>
            <div className="modal-header-gradient">
              <h3>Edit QR Code</h3>
              <button className="close-modal" onClick={() => { setShowEditModal(false); setEditQrData(null); }}>&times;</button>
            </div>
            <form onSubmit={handleEditQrSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
                <div className="form-group-v2">
                  <label>Label</label>
                  <input 
                    type="text" 
                    value={editQrData.label || ''} 
                    onChange={e => setEditQrData({...editQrData, label: e.target.value})} 
                    className="inner-input"
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'white' }}
                  />
                </div>
                <div className="form-group-v2">
                  <label>UPI ID (Handle / String)</label>
                  <input 
                    type="text" 
                    value={editQrData.upiId || ''} 
                    onChange={e => setEditQrData({...editQrData, upiId: e.target.value})} 
                    className="inner-input"
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'white' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                    <div className="form-group-v2" style={{ flex: 1 }}>
                    <label>MID</label>
                    <input 
                        type="text" 
                        value={editQrData.mid || ''} 
                        onChange={e => setEditQrData({...editQrData, mid: e.target.value})} 
                        className="inner-input"
                        style={{ background: 'rgba(255,255,255,0.05)', color: 'white' }}
                    />
                    </div>
                    <div className="form-group-v2" style={{ flex: 1 }}>
                    <label>TID</label>
                    <input 
                        type="text" 
                        value={editQrData.tid || ''} 
                        onChange={e => setEditQrData({...editQrData, tid: e.target.value})} 
                        className="inner-input"
                        style={{ background: 'rgba(255,255,255,0.05)', color: 'white' }}
                    />
                    </div>
                </div>
              </div>
              <div className="modal-footer" style={{ padding: '16px 24px', background: 'rgba(0,0,0,0.2)' }}>
                <button type="button" className="btn-cancel" onClick={() => { setShowEditModal(false); setEditQrData(null); }}>Cancel</button>
                <button type="submit" className="btn-create" style={{ padding: '10px 24px' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ManualQrModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

export default QrCodesAdminPage;
