import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import './ManualQrModal.css';

const ManualQrModal = ({ isOpen, onClose }) => {
  const [expandedSection, setExpandedSection] = useState('bank'); // Default open as per screenshot
  const { addQrCode } = useAppContext();
  const { error, success } = useToast();
  const [formData, setFormData] = useState({ upiId: '', payeeName: '', label: '', mid: '' });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.upiId || !formData.payeeName) {
        error('Please fill in required fields.');
        return;
    }
    
    const fd = new FormData();
    fd.append('upiId', formData.upiId);
    fd.append('label', formData.label || 'Manual QR');
    fd.append('mid', formData.mid || 'N/A');
    fd.append('merchantName', 'Unassigned');
    fd.append('status', 'Active');
    fd.append('type', 'Single');
    // Note: No qrImage appended for manual creation

    addQrCode(fd);
    success('QR code created successfully.');
    onClose();
  };

  if (!isOpen) return null;

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="modal-overlay-v2">
      <div className="manual-qr-modal card animated-up">
        <div className="modal-header-v2">
          <div className="header-content">
            <span className="plus-icon-v2">+</span>
            <h3>Create QR Code Manually</h3>
          </div>
          <button className="close-btn-v2" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body-v2">
          <div className="form-grid-v2">
            <div className="form-group-modal">
              <label>UPI ID <span>*</span></label>
              <input type="text" name="upiId" value={formData.upiId} onChange={handleChange} placeholder="merchant@pinelabs" required />
            </div>
            <div className="form-group-modal">
              <label>PAYEE NAME <span>*</span></label>
              <input type="text" name="payeeName" value={formData.payeeName} onChange={handleChange} placeholder="Business Name" required />
            </div>
            <div className="form-group-modal">
              <label>LABEL</label>
              <input type="text" name="label" value={formData.label} onChange={handleChange} placeholder="Counter 1, Main Entrance..." />
            </div>
            <div className="form-group-modal">
              <label>MID / TERMINAL ID</label>
              <input type="text" name="mid" value={formData.mid} onChange={handleChange} placeholder="Terminal ID" />
            </div>
          </div>

          <div className={`modal-collapsible ${expandedSection === 'bank' ? 'open' : ''}`}>
            <div className="collapsible-trigger" onClick={() => toggleSection('bank')}>
              <div className="trigger-left">
                <span className="trigger-icon">🏦</span>
                <span className="trigger-title">Bank Details</span>
                <span className="trigger-sub">(Optional)</span>
              </div>
              <span className="trigger-chevron">▼</span>
            </div>
            <div className="collapsible-content">
              <div className="form-grid-v2">
                <div className="form-group-modal">
                  <label>BANK NAME</label>
                  <input type="text" placeholder="e.g. State Bank of India" />
                </div>
                <div className="form-group-modal">
                  <label>ACCOUNT HOLDER NAME</label>
                  <input type="text" placeholder="Name on account" />
                </div>
                <div className="form-group-modal">
                  <label>ACCOUNT NUMBER</label>
                  <input type="text" placeholder="e.g. 1234567890" />
                </div>
                <div className="form-group-modal">
                  <label>IFSC CODE</label>
                  <input type="text" placeholder="e.g. SBIN0001234" />
                </div>
                <div className="form-group-modal">
                  <label>BANK BRANCH</label>
                  <input type="text" placeholder="Branch name / city" />
                </div>
                <div className="form-group-modal">
                  <label>ACCOUNT TYPE</label>
                  <select className="modal-select-v2">
                    <option>— Select type —</option>
                    <option>Savings</option>
                    <option>Current</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className={`modal-collapsible ${expandedSection === 'limits' ? 'open' : ''}`}>
            <div className="collapsible-trigger" onClick={() => toggleSection('limits')}>
              <div className="trigger-left">
                <span className="trigger-icon">📈</span>
                <span className="trigger-title">Transaction Limits</span>
                <span className="trigger-sub">(Optional)</span>
              </div>
              <span className="trigger-chevron">▼</span>
            </div>
            <div className="collapsible-content">
              <div className="form-grid-v2 three-col">
                <div className="form-group-modal">
                  <label>MAX SINGLE AMOUNT (₹)</label>
                  <input type="text" placeholder="e.g. 50000" />
                </div>
                <div className="form-group-modal">
                  <label>DAILY LIMIT (₹)</label>
                  <input type="text" placeholder="e.g. 200000" />
                </div>
                <div className="form-group-modal">
                  <label>MONTHLY LIMIT (₹)</label>
                  <input type="text" placeholder="e.g. 5000000" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer-v2">
          <button className="cancel-btn-modal" onClick={onClose}>Cancel</button>
          <button className="submit-btn-modal" onClick={handleSubmit}>Create QR Code</button>
        </div>
      </div>
    </div>
  );
};

export default ManualQrModal;
