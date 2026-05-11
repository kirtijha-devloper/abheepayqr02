import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import './TpinModal.css';

const initialForm = {
  password: '',
  tpin: '',
  confirmTpin: '',
};

const TpinModal = ({ isOpen, onClose, title = 'Generate T-PIN', description, onSaved }) => {
  const { saveTransactionPin } = useAppContext();
  const { success, error } = useToast();
  const [form, setForm] = useState(initialForm);
  const [editable, setEditable] = useState({
    password: false,
    tpin: false,
    confirmTpin: false,
  });
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const resetAndClose = () => {
    if (saving) return;
    setForm(initialForm);
    setEditable({ password: false, tpin: false, confirmTpin: false });
    onClose();
  };

  const handleSubmit = async () => {
    const password = form.password.trim();
    const tpin = form.tpin.trim();
    const confirmTpin = form.confirmTpin.trim();

    if (!password) {
      error('Enter your account password.');
      return;
    }

    if (!/^\d{4}$/.test(tpin)) {
      error('Transaction PIN must be exactly 4 digits.');
      return;
    }

    if (tpin !== confirmTpin) {
      error('Transaction PIN values do not match.');
      return;
    }

    setSaving(true);
    const res = await saveTransactionPin(password, tpin);
    setSaving(false);

    if (res.success) {
      success('Transaction PIN updated successfully.');
      resetAndClose();
      if (typeof onSaved === 'function') onSaved();
      return;
    }

    error(res.error || 'Failed to update transaction PIN.');
  };

  return (
    <div className="tpin-modal-overlay" onClick={resetAndClose}>
      <div className="tpin-modal-card card" onClick={(event) => event.stopPropagation()}>
        <div className="tpin-modal-head">
          <h3>{title}</h3>
          <button type="button" className="tpin-modal-close" onClick={resetAndClose}>
            &times;
          </button>
        </div>

        <div className="tpin-modal-info">
          {description || 'Use your account password to create or update your 4-digit payout T-PIN.'}
        </div>

        <div className="tpin-modal-form">
          <label>
            <span>Account Password</span>
            <input
              type="password"
              placeholder="Enter account password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              onFocus={() => setEditable((prev) => ({ ...prev, password: true }))}
              autoComplete="current-password"
              readOnly={!editable.password}
              data-lpignore="true"
              data-1p-ignore="true"
            />
          </label>

          <label>
            <span>New 4-Digit T-PIN</span>
            <input
              type="password"
              inputMode="numeric"
              placeholder="Enter 4-digit T-PIN"
              value={form.tpin}
              onChange={(event) => setForm((prev) => ({ ...prev, tpin: event.target.value }))}
              onFocus={() => setEditable((prev) => ({ ...prev, tpin: true }))}
              autoComplete="new-password"
              readOnly={!editable.tpin}
              data-lpignore="true"
              data-1p-ignore="true"
            />
          </label>

          <label>
            <span>Confirm 4-Digit T-PIN</span>
            <input
              type="password"
              inputMode="numeric"
              placeholder="Confirm 4-digit T-PIN"
              value={form.confirmTpin}
              onChange={(event) => setForm((prev) => ({ ...prev, confirmTpin: event.target.value }))}
              onFocus={() => setEditable((prev) => ({ ...prev, confirmTpin: true }))}
              autoComplete="new-password"
              readOnly={!editable.confirmTpin}
              data-lpignore="true"
              data-1p-ignore="true"
            />
          </label>
        </div>

        <div className="tpin-modal-actions">
          <button type="button" className="tpin-secondary-btn" onClick={resetAndClose} disabled={saving}>
            Close
          </button>
          <button type="button" className="tpin-primary-btn" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Save T-PIN'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TpinModal;
