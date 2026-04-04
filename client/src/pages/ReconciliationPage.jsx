import React from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import './ReconciliationPage.css';

const ReconciliationPage = () => {
  const { uploadReport, mappingTrace, fetchMappingTrace } = useAppContext();
  const { success, error } = useToast();
  const fileInputRef = React.useRef(null);
  const [uploadStatus, setUploadStatus] = React.useState('');
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [traceLoading, setTraceLoading] = React.useState(false);

  const handleManualClick = () => {
    fileInputRef.current?.click();
  };

  const processFile = async (file) => {
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('Uploading report...');

    const result = await uploadReport(file);
    setIsUploading(false);

    if (result.success) {
        const { processed, skipped, errors } = result.data || {};
        const details = [
            `Processed ${processed || 0}`,
            skipped ? `Skipped ${skipped}` : null,
            errors ? `Errors ${errors}` : null
        ].filter(Boolean).join(", ");
        setUploadStatus(`Success: ${details}`);
        success(`Upload complete. ${details}`);
        fetchMappingTrace();
    } else {
        setUploadStatus(`Error: ${result.error}`);
        error(`Upload failed: ${result.error}`);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    processFile(file);
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
        processFile(files[0]);
    }
  };

  const reconTypes = [
    { name: 'Pinelabs', bg: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' },
    { name: 'Razorpay', bg: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' },
    { name: 'Worldline', bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
    { name: 'Manual Upload', bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
  ];

  React.useEffect(() => {
    setTraceLoading(true);
    fetchMappingTrace().finally(() => setTraceLoading(false));
  }, [fetchMappingTrace]);

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="dashboard-body animated">
          <div className="reconciliation-header-section">
            <div className="text-section">
              <h2>Data Reconciliation</h2>
              <p>Match your digital records with bank settlement statements.</p>
              {uploadStatus && <div className={`status-banner ${uploadStatus.includes('Error') ? 'error' : 'success'}`} style={{marginTop: '1rem', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', fontSize: '0.875rem'}}>{uploadStatus}</div>}
            </div>
          </div>

          <input 
            type="file" 
            ref={fileInputRef} 
            style={{display: 'none'}} 
            accept=".csv, .xlsx, .xls"
            onChange={handleFileChange}
          />

          <div className="recon-grid">
            {reconTypes.map((type) => (
                <div 
                  key={type.name} 
                  className={`recon-card card ${isUploading ? 'disabled' : ''}`}
                >
                <div className="recon-icon-banner">
                    <div className="recon-banner-icon">{isUploading && type.name === 'Manual Upload' ? '...' : 'File'}</div>
                </div>
                <div className="recon-content">
                    <h3>{type.name} Settlement</h3>
                    <p>{type.name === 'Manual Upload' ? 'Upload comprehensive transaction CSV/Excel to distribute to merchants.' : `Process your weekly settlements for ${type.name} exports.`}</p>
                    <div 
                        className={`upload-zone ${isDragging && type.name === 'Manual Upload' ? 'dragging' : ''}`}
                        onClick={type.name === 'Manual Upload' ? handleManualClick : undefined}
                        onDragOver={type.name === 'Manual Upload' ? onDragOver : undefined}
                        onDragLeave={type.name === 'Manual Upload' ? onDragLeave : undefined}
                        onDrop={type.name === 'Manual Upload' ? onDrop : undefined}
                        style={{cursor: type.name === 'Manual Upload' ? 'pointer' : 'default'}}
                    >
                        <span className="upload-icon">Upload</span>
                        <p>{isUploading && type.name === 'Manual Upload' ? 'Processing...' : <>Drag file or <span>select export</span></>}</p>
                    </div>
                </div>
              </div>
            ))}
          </div>

          <div className="recon-history-card card">
            <div className="card-header-v2">
              <h3 className="section-title">Recent Recon Logs</h3>
            </div>
            <div className="empty-state-v2">
                <span>Logs</span>
                <p>No reconciliation runs found for this period.</p>
            </div>
          </div>
          <div className="mapping-trace-card card">
            <div className="card-header-v2">
              <h3 className="section-title">Latest QR assignments</h3>
            </div>
            <div className="mapping-trace-list">
              {traceLoading ? (
                <p className="mapping-trace-empty">Loading assignment trace…</p>
              ) : mappingTrace.length === 0 ? (
                <p className="mapping-trace-empty">No assignments logged yet.</p>
              ) : (
                <ul>
                  {mappingTrace.map((entry, idx) => (
                    <li key={`${entry.raw}-${idx}`} className={entry.matched ? 'mapped' : 'unmatched'}>
                      <span className="mapping-tid">{entry.tid || 'Unknown TID'}</span>
                      <span className="mapping-arrow">→</span>
                      <span className="mapping-merchant">{entry.merchantName ? `${entry.merchantName} (${entry.merchantId})` : 'Not matched'}</span>
                      <span className="mapping-timestamp">{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ReconciliationPage;
