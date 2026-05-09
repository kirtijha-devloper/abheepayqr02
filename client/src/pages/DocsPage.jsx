import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import './DocsPage.css';

const sections = [
  { id: 'overview',       label: 'Overview',             icon: '🏠' },
  { id: 'getting-started',label: 'Getting Started',      icon: '🚀' },
  { id: 'merchants',      label: 'Merchant Management',  icon: '🏪' },
  { id: 'qr-codes',       label: 'QR Code System',       icon: '📱' },
  { id: 'transactions',   label: 'Transactions',         icon: '💳' },
  { id: 'wallet',         label: 'Wallet & Settlements', icon: '💰' },
  { id: 'dynamic-qr',     label: 'Dynamic QR Payments',  icon: '⚡' },
  { id: 'callbacks',      label: 'Webhooks & Callbacks', icon: '🔗' },
  { id: 'reports',        label: 'Reports & Reconciliation', icon: '📊' },
  { id: 'support',        label: 'Support',              icon: '🎧' },
];

const DocsPage = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const filteredSections = sections.filter(s =>
    s.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="dashboard-body">
          <div className="docs-layout">

            {/* Left Nav */}
            <aside className="docs-sidebar">
              <div className="docs-search-wrap">
                <span className="docs-search-icon">🔍</span>
                <input
                  className="docs-search-input"
                  placeholder="Search docs..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <nav className="docs-nav">
                {filteredSections.map(s => (
                  <button
                    key={s.id}
                    className={`docs-nav-item ${activeSection === s.id ? 'active' : ''}`}
                    onClick={() => setActiveSection(s.id)}
                  >
                    <span className="docs-nav-icon">{s.icon}</span>
                    <span>{s.label}</span>
                    {activeSection === s.id && <span className="docs-nav-active-dot" />}
                  </button>
                ))}
              </nav>
              <div className="docs-version-badge">
                <span className="docs-version-tag">v1.0.0</span>
                <span>LIOPAY Platform</span>
              </div>
            </aside>

            {/* Main Content */}
            <article className="docs-content">

              {/* ── OVERVIEW ── */}
              {activeSection === 'overview' && (
                <div className="docs-section animated">
                  <div className="docs-hero">
                    <div className="docs-hero-tag">📖 Documentation</div>
                    <h1>LIOPAY Payment Platform</h1>
                    <p className="docs-hero-sub">
                      Comprehensive guide to managing merchants, QR codes, settlements, and payment workflows on the LIOPAY platform.
                    </p>
                    <div className="docs-hero-badges">
                      <span className="badge badge-green">✓ Production Ready</span>
                      <span className="badge badge-blue">UPI Compliant</span>
                      <span className="badge badge-purple">Admin + Merchant Roles</span>
                    </div>
                  </div>

                  <div className="docs-card-grid">
                    {[
                      { icon: '🏪', title: 'Merchants', desc: 'Onboard and manage merchant accounts with custom charge configs.', section: 'merchants' },
                      { icon: '📱', title: 'QR Codes', desc: 'Upload, assign, and track physical & digital UPI QR codes.', section: 'qr-codes' },
                      { icon: '⚡', title: 'Dynamic QR', desc: 'Generate real-time amount-locked QR for merchant payments.', section: 'dynamic-qr' },
                      { icon: '🔗', title: 'Webhooks', desc: 'Receive server-side callbacks for every settled transaction.', section: 'callbacks' },
                    ].map(card => (
                      <div key={card.section} className="docs-quick-card" onClick={() => setActiveSection(card.section)}>
                        <div className="docs-quick-icon">{card.icon}</div>
                        <h3>{card.title}</h3>
                        <p>{card.desc}</p>
                        <span className="docs-quick-link">Read more →</span>
                      </div>
                    ))}
                  </div>

                  <div className="docs-info-block">
                    <h2>What is LIOPAY?</h2>
                    <p>LIOPAY is a full-stack payment management platform that enables administrators to onboard merchants, assign UPI QR codes, process settlements, and track every transaction in real time. Merchants get a dedicated dashboard to view their QR codes, generate dynamic payment QRs, and request fund settlements.</p>
                  </div>
                </div>
              )}

              {/* ── GETTING STARTED ── */}
              {activeSection === 'getting-started' && (
                <div className="docs-section animated">
                  <h1>Getting Started</h1>
                  <p className="docs-lead">Follow these steps to get up and running with the LIOPAY platform.</p>

                  <div className="docs-steps">
                    {[
                      { step: '01', title: 'Admin Login', desc: 'Navigate to /admin/login and sign in with your Super Admin credentials. Admin accounts are seeded during initial deployment.' },
                      { step: '02', title: 'Create a Merchant', desc: 'Go to Merchants → Add Merchant. Fill in the merchant\'s name, email, Password, and Partner ID. Set custom charge rates if required.' },
                      { step: '03', title: 'Upload a QR Code', desc: 'Go to QR Codes → Bulk Upload. Upload a physical QR image, enter its UPI handle (e.g. 919955@paytm), MID, TID and Label.' },
                      { step: '04', title: 'Assign QR to Merchant', desc: 'In the QR Inventory tab, select one or more QRs and use the Quick Assign dropdown to link them to a merchant.' },
                      { step: '05', title: 'Merchant Logs In', desc: 'Merchant logs in at /login. They can now see their assigned QR, generate dynamic payment QRs, and view their wallet.' },
                    ].map(s => (
                      <div key={s.step} className="docs-step-item">
                        <div className="docs-step-num">{s.step}</div>
                        <div className="docs-step-body">
                          <h3>{s.title}</h3>
                          <p>{s.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── MERCHANTS ── */}
              {activeSection === 'merchants' && (
                <div className="docs-section animated">
                  <h1>Merchant Management</h1>
                  <p className="docs-lead">Admins have full control over merchant accounts — creation, editing, charge configuration, and status toggling.</p>

                  <div className="docs-info-block">
                    <h2>Creating a Merchant</h2>
                    <p>Navigate to <code className="inline-code">Admin → Merchants → + New Merchant</code>. The following fields are required:</p>
                    <table className="docs-table">
                      <thead><tr><th>Field</th><th>Description</th><th>Required</th></tr></thead>
                      <tbody>
                        <tr><td>Full Name</td><td>The merchant's legal or display name</td><td>✅ Yes</td></tr>
                        <tr><td>Email</td><td>Unique login email for merchant dashboard</td><td>✅ Yes</td></tr>
                        <tr><td>Password</td><td>Initial login password (merchant should change it)</td><td>✅ Yes</td></tr>
                        <tr><td>Partner ID</td><td>Unique merchant identifier shown on QR</td><td>✅ Yes</td></tr>
                        <tr><td>Charge Type</td><td>flat or percentage — how settlement fees are calculated</td><td>Optional</td></tr>
                        <tr><td>Charge Value</td><td>The numeric fee amount or % for this merchant</td><td>Optional</td></tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="docs-info-block">
                    <h2>Editing a Merchant</h2>
                    <p>Click the <strong>Edit</strong> button on any merchant row. All fields can be updated. Leaving password blank keeps the existing password unchanged.</p>
                  </div>

                  <div className="docs-info-block">
                    <h2>Deactivating a Merchant</h2>
                    <p>Click <strong>Deactivate</strong> to block a merchant's access without deleting their data. This preserves all transaction history. The merchant will be unable to log in until reactivated.</p>
                  </div>

                  <div className="docs-callout docs-callout-warning">
                    ⚠️ <strong>Note:</strong> Deactivating a merchant does not unassign their QR codes. QR codes will remain linked but payment processing will be affected until the merchant is reactivated.
                  </div>
                </div>
              )}

              {/* ── QR CODES ── */}
              {activeSection === 'qr-codes' && (
                <div className="docs-section animated">
                  <h1>QR Code System</h1>
                  <p className="docs-lead">The QR system supports both physical QR image uploads and fully digital (generated) UPI payment codes.</p>

                  <div className="docs-info-block">
                    <h2>Uploading QR Codes</h2>
                    <p>Go to <code className="inline-code">Admin → QR Codes → Bulk Upload</code>. For each QR you need:</p>
                    <table className="docs-table">
                      <thead><tr><th>Field</th><th>Description</th></tr></thead>
                      <tbody>
                        <tr><td>QR Image</td><td>A photo/scan of the physical QR code sticker</td></tr>
                        <tr><td>UPI Handle</td><td>The VPA linked to this QR (e.g. <code className="inline-code">919955@paytm</code>)</td></tr>
                        <tr><td>Label</td><td>Friendly name for identifying the QR in the system</td></tr>
                        <tr><td>MID</td><td>Merchant ID from the payment processor / bank</td></tr>
                        <tr><td>TID</td><td>Terminal ID from the payment processor / bank</td></tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="docs-info-block">
                    <h2>Assigning QR to a Merchant</h2>
                    <p>In the <strong>Inventory</strong> tab, use the checkboxes to select one or more QR codes. Then use the <strong>Quick Assign</strong> dropdown at the top to select a merchant and click <strong>Assign QRs</strong>.</p>
                    <p>You can also use the <strong>Edit</strong> button on any QR row to update its label, UPI ID, MID or TID individually.</p>
                  </div>

                  <div className="docs-info-block">
                    <h2>Digital vs Physical View</h2>
                    <p>On the merchant QR page, there are two view modes:</p>
                    <ul className="docs-list">
                      <li><strong>Digital</strong> — A live-generated QR code created from the assigned UPI handle. Safe to scan with any UPI app.</li>
                      <li><strong>Physical</strong> — Shows the actual uploaded QR image as-is. Useful for display at the point of sale.</li>
                    </ul>
                  </div>

                  <div className="docs-callout docs-callout-info">
                    ℹ️ <strong>Tip:</strong> For clean scans on mobile, the Digital QR uses Medium error correction level (level="M") for optimal readability on screen.
                  </div>
                </div>
              )}

              {/* ── TRANSACTIONS ── */}
              {activeSection === 'transactions' && (
                <div className="docs-section animated">
                  <h1>Transactions</h1>
                  <p className="docs-lead">Every payment processed through the platform is recorded as a transaction and visible to both admins and merchants.</p>

                  <div className="docs-info-block">
                    <h2>Transaction Lifecycle</h2>
                    <div className="docs-flow">
                      {['Customer Scans QR', 'Payment Sent via UPI', 'Bank Confirms Credit', 'Admin Uploads Settlement Report', 'Transaction Matches → Wallet Updated'].map((step, i, arr) => (
                        <React.Fragment key={step}>
                          <div className="docs-flow-step">{step}</div>
                          {i < arr.length - 1 && <div className="docs-flow-arrow">↓</div>}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  <div className="docs-info-block">
                    <h2>Transaction Status</h2>
                    <table className="docs-table">
                      <thead><tr><th>Status</th><th>Meaning</th></tr></thead>
                      <tbody>
                        <tr><td><span className="badge badge-green">Completed</span></td><td>Payment received and confirmed in settlement report</td></tr>
                        <tr><td><span className="badge badge-yellow">Pending</span></td><td>Payment initiated but not yet confirmed</td></tr>
                        <tr><td><span className="badge badge-red">Failed</span></td><td>Payment was declined or timed out</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── WALLET ── */}
              {activeSection === 'wallet' && (
                <div className="docs-section animated">
                  <h1>Wallet & Settlements</h1>
                  <p className="docs-lead">Each merchant has a wallet that is credited when settlement reports are processed. Merchants can request payouts from their wallet balance.</p>

                  <div className="docs-info-block">
                    <h2>How the Wallet Works</h2>
                    <ul className="docs-list">
                      <li>When an admin uploads a settlement report, the system matches transactions to merchants using TID/MID.</li>
                      <li>On a successful match, the merchant's wallet is credited with the transaction amount.</li>
                      <li>Merchants can view their full transaction history under Wallet → Funds Movement History.</li>
                    </ul>
                  </div>

                  <div className="docs-info-block">
                    <h2>Requesting a Settlement</h2>
                    <p>Merchants can request a bank withdrawal via <strong>Request Settlement</strong>. The system calculates deductions based on the admin-configured payout rules and shows a breakdown before confirmation.</p>
                  </div>

                  <div className="docs-info-block">
                    <h2>Payout Charges Configuration</h2>
                    <p>Admins configure payout charges under <code className="inline-code">Settings → Payout Charges</code>. Charges can be:</p>
                    <ul className="docs-list">
                      <li><strong>Flat Fee</strong>: A fixed ₹ amount deducted regardless of withdrawal size.</li>
                      <li><strong>Percentage</strong>: A % of the withdrawal amount.</li>
                      <li><strong>Range-based</strong>: Different rates for different withdrawal ranges (e.g. ₹0–1000: ₹10 flat, ₹1000+: 2%).</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* ── DYNAMIC QR ── */}
              {activeSection === 'dynamic-qr' && (
                <div className="docs-section animated">
                  <h1>Dynamic QR Payments</h1>
                  <p className="docs-lead">Merchants can generate a real-time QR code with a pre-set amount that is locked and cannot be modified by the payer.</p>

                  <div className="docs-info-block">
                    <h2>How Dynamic QR Works</h2>
                    <ol className="docs-list">
                      <li>Merchant goes to <strong>QR Codes → Dynamic</strong> tab.</li>
                      <li>Enters the amount they want to collect (e.g. ₹500).</li>
                      <li>A QR is instantly generated encoding a UPI deep link with <code className="inline-code">am=500.00&mam=500.00</code>.</li>
                      <li>The payer scans the QR on any UPI app. The amount is pre-filled and <strong>locked</strong> — the payer cannot change it.</li>
                    </ol>
                  </div>

                  <div className="docs-info-block">
                    <h2>UPI URI Format</h2>
                    <div className="docs-code-block">
                      <pre>{`upi://pay
  ?pa=merchant@paytm     ← UPI VPA (Virtual Payment Address)
  &pn=MerchantName       ← Payee Name
  &am=500.00             ← Amount (2 decimal places)
  &mam=500.00            ← Minimum Amount (locks the field)
  &mc=5499               ← Merchant Category Code (Retail)
  &tr=<transaction-ref>  ← Unique reference ID
  &cu=INR                ← Currency`}</pre>
                    </div>
                  </div>

                  <div className="docs-callout docs-callout-warning">
                    ⚠️ <strong>Important:</strong> Dynamic QR only works for merchants who have a verified UPI QR assigned by the admin. Placeholder (MANUAL-UPI) QR codes cannot be used for dynamic payments.
                  </div>

                  <div className="docs-callout docs-callout-info">
                    ℹ️ <strong>Why mam=?</strong> The <code className="inline-code">mam</code> (Minimum Amount) parameter signals UPI apps to lock the amount field. When <code className="inline-code">am</code> and <code className="inline-code">mam</code> are equal, apps like PhonePe and GPay disable the amount input for the payer.
                  </div>
                </div>
              )}

              {/* ── CALLBACKS ── */}
              {activeSection === 'callbacks' && (
                <div className="docs-section animated">
                  <h1>Webhooks & Callbacks</h1>
                  <p className="docs-lead">LIOPAY can automatically notify your backend system whenever a payment is confirmed, using HTTP POST webhooks.</p>

                  <div className="docs-info-block">
                    <h2>Configuring Your Webhook URL</h2>
                    <p>Go to <code className="inline-code">Callbacks</code> in the merchant sidebar. Enter your server endpoint URL (must start with <code className="inline-code">https://</code>) and click <strong>Save Configuration</strong>.</p>
                  </div>

                  <div className="docs-info-block">
                    <h2>Webhook Payload</h2>
                    <p>When a payment is confirmed, LIOPAY sends a POST request to your callback URL with this JSON body:</p>
                    <div className="docs-code-block">
                      <pre>{`{
  "event": "payment.success",
  "transactionId": "txn_abc123",
  "refId": "RRN_9238471",
  "amount": 500.00,
  "merchantId": "M001",
  "status": "completed",
  "timestamp": "2024-04-03T09:00:00Z",
  "upiId": "919955@paytm"
}`}</pre>
                    </div>
                  </div>

                  <div className="docs-info-block">
                    <h2>Retry Logic</h2>
                    <p>If your server returns a non-2xx response, the delivery is logged as <strong>failed</strong>. You can manually retry any failed callback from the <strong>Recent Delivery Logs</strong> table by clicking <strong>Resend ↪</strong>.</p>
                  </div>

                  <div className="docs-callout docs-callout-info">
                    ℹ️ <strong>Security Tip:</strong> Always verify callbacks server-side by checking the transaction ID against your own database before crediting user accounts.
                  </div>
                </div>
              )}

              {/* ── REPORTS ── */}
              {activeSection === 'reports' && (
                <div className="docs-section animated">
                  <h1>Reports & Reconciliation</h1>
                  <p className="docs-lead">Admins can upload bank settlement files to automatically reconcile transactions and credit merchant wallets.</p>

                  <div className="docs-info-block">
                    <h2>Uploading a Settlement Report</h2>
                    <ol className="docs-list">
                      <li>Go to <code className="inline-code">Admin → Reconciliation</code>.</li>
                      <li>Upload the CSV/XLSX settlement file received from the bank.</li>
                      <li>The system scans for TID/MID columns to match transactions.</li>
                      <li>Matched transactions are marked as completed and wallet balances are updated.</li>
                      <li>Unmatched rows are flagged for manual review.</li>
                    </ol>
                  </div>

                  <div className="docs-info-block">
                    <h2>Merchant Reports</h2>
                    <p>Merchants can view their settlement history at <code className="inline-code">Merchant → Reports</code>. This shows all reports uploaded by the admin that contain transactions belonging to that merchant.</p>
                  </div>

                  <div className="docs-callout docs-callout-warning">
                    ⚠️ <strong>Fuzzy Matching:</strong> The system uses TID and MID for matching. Ensure all QR codes have correct MID and TID values set during upload to avoid unmatched records.
                  </div>
                </div>
              )}

              {/* ── SUPPORT ── */}
              {activeSection === 'support' && (
                <div className="docs-section animated">
                  <h1>Support</h1>
                  <p className="docs-lead">Merchants can raise support tickets directly from the dashboard. Admins can view, manage, and resolve all tickets.</p>

                  <div className="docs-info-block">
                    <h2>Raising a Ticket (Merchant)</h2>
                    <ol className="docs-list">
                      <li>Go to <strong>Support</strong> in the sidebar.</li>
                      <li>Click <strong>New Ticket</strong>.</li>
                      <li>Fill in the subject, category, and a detailed description.</li>
                      <li>Submit — the ticket is immediately visible to the admin.</li>
                    </ol>
                  </div>

                  <div className="docs-info-block">
                    <h2>Managing Tickets (Admin)</h2>
                    <p>Admins see all merchant tickets under <code className="inline-code">Admin → Support</code>. Each ticket shows the merchant name, category, creation date, and current status. Admins can update the status to <strong>In Progress</strong> or <strong>Resolved</strong>.</p>
                  </div>

                  <div className="docs-info-block">
                    <h2>Ticket Statuses</h2>
                    <table className="docs-table">
                      <thead><tr><th>Status</th><th>Meaning</th></tr></thead>
                      <tbody>
                        <tr><td><span className="badge badge-yellow">Open</span></td><td>Newly created, awaiting admin review</td></tr>
                        <tr><td><span className="badge badge-blue">In Progress</span></td><td>Admin has acknowledged and is working on it</td></tr>
                        <tr><td><span className="badge badge-green">Resolved</span></td><td>Issue has been fixed and closed</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </article>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DocsPage;
