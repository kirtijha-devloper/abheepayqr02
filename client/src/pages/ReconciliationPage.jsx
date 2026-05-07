import React, { useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAppContext } from '../context/AppContext';
import './ReconciliationPage.css';

const RECON_PROVIDERS = [
  {
    key: 'pinelabs',
    title: 'Pinelabs Settlement',
    description: 'Use this lane to reconcile Pinelabs settlement exports against your internal transaction stream.',
    icon: 'PL',
  },
  {
    key: 'razorpay',
    title: 'Razorpay Settlement',
    description: 'Review Razorpay payout files and verify every credited line before closing the reconciliation cycle.',
    icon: 'RP',
  },
  {
    key: 'worldline',
    title: 'Worldline Settlement',
    description: 'Track Worldline settlement batches and compare the payout sheet with the assigned merchant transactions.',
    icon: 'WL',
  },
  {
    key: 'branchx',
    title: 'BranchX Settlement',
    description: 'Reconcile BranchX payout settlements and callbacks with the ledger before marking the cycle complete.',
    icon: 'BX',
  },
];

const ReconciliationPage = () => {
  const { mappingTrace, fetchMappingTrace, settlements, fetchSettlements } = useAppContext();
  const [traceLoading, setTraceLoading] = React.useState(false);
  const [settlementLoading, setSettlementLoading] = React.useState(false);

  React.useEffect(() => {
    setTraceLoading(true);
    setSettlementLoading(true);

    Promise.allSettled([
      fetchMappingTrace().finally(() => setTraceLoading(false)),
      fetchSettlements('all').finally(() => setSettlementLoading(false)),
    ]);
  }, [fetchMappingTrace, fetchSettlements]);

  const settlementSummary = useMemo(() => {
    const safeSettlements = Array.isArray(settlements) ? settlements : [];
    return {
      total: safeSettlements.length,
      branchx: safeSettlements.filter((item) => String(item?.serviceType || '').toLowerCase() === 'branchx_payout').length,
      pending: safeSettlements.filter((item) => String(item?.status || '').toLowerCase() === 'pending').length,
      success: safeSettlements.filter((item) => String(item?.status || '').toLowerCase() === 'success').length,
    };
  }, [settlements]);

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="dashboard-body animated">
          <div className="reconciliation-header-section">
            <div className="text-section">
              <h2>Data Reconciliation</h2>
              <p>Run settlement reconciliation only. Manual report upload has been moved to Reports.</p>
            </div>
          </div>

          <div className="recon-summary-strip card">
            <div className="recon-summary-item">
              <span>Total settlement records</span>
              <strong>{settlementLoading ? '...' : settlementSummary.total}</strong>
            </div>
            <div className="recon-summary-item">
              <span>BranchX settlements</span>
              <strong>{settlementLoading ? '...' : settlementSummary.branchx}</strong>
            </div>
            <div className="recon-summary-item">
              <span>Pending review</span>
              <strong>{settlementLoading ? '...' : settlementSummary.pending}</strong>
            </div>
            <div className="recon-summary-item">
              <span>Successful</span>
              <strong>{settlementLoading ? '...' : settlementSummary.success}</strong>
            </div>
          </div>

          <div className="recon-grid">
            {RECON_PROVIDERS.map((provider) => (
              <div key={provider.key} className="recon-card card">
                <div className="recon-icon-banner">
                  <div className="recon-banner-icon">{provider.icon}</div>
                </div>
                <div className="recon-content">
                  <h3>{provider.title}</h3>
                  <p>{provider.description}</p>
                  <div className="recon-status-box">
                    <span className="recon-status-label">Reconciliation lane</span>
                    <strong>{provider.key === 'branchx' ? 'BranchX callbacks + settlements' : 'Settlement matching only'}</strong>
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
              <span>Reco</span>
              <p>Use this page for settlement reconciliation flow only. Upload new manual statements from Reports.</p>
            </div>
          </div>

          <div className="mapping-trace-card card">
            <div className="card-header-v2">
              <h3 className="section-title">Latest QR assignments</h3>
            </div>
            <div className="mapping-trace-list">
              {traceLoading ? (
                <p className="mapping-trace-empty">Loading assignment trace...</p>
              ) : mappingTrace.length === 0 ? (
                <p className="mapping-trace-empty">No assignments logged yet.</p>
              ) : (
                <ul>
                  {mappingTrace.map((entry, idx) => (
                    <li key={`${entry.raw}-${idx}`} className={entry.matched ? 'mapped' : 'unmatched'}>
                      <span className="mapping-tid">{entry.tid || 'Unknown TID'}</span>
                      <span className="mapping-arrow">-&gt;</span>
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
