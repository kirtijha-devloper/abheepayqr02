import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);
const TOAST_EVENT = 'app:toast';

export const pushToast = (message, type = 'info') => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(TOAST_EVENT, {
      detail: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        message: String(message || ''),
        type,
      },
    })
  );
};

const inferToastType = (message) => {
  const text = String(message || '').toLowerCase();
  if (text.includes('fail') || text.includes('error') || text.includes('invalid') || text.includes('insufficient')) {
    return 'error';
  }
  if (text.includes('success') || text.includes('approved') || text.includes('saved') || text.includes('submitted')) {
    return 'success';
  }
  return 'info';
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  useEffect(() => {
    const handleToast = (event) => {
      const toast = event.detail;
      if (!toast?.message) return;

      setToasts((current) => [...current, toast]);

      const timer = window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
        timersRef.current.delete(toast.id);
      }, 3200);

      timersRef.current.set(toast.id, timer);
    };

    const originalAlert = window.alert;
    window.alert = (message) => {
      pushToast(message, inferToastType(message));
    };

    window.addEventListener(TOAST_EVENT, handleToast);

    return () => {
      window.alert = originalAlert;
      window.removeEventListener(TOAST_EVENT, handleToast);
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      toast: (message, type = 'info') => pushToast(message, type),
      success: (message) => pushToast(message, 'success'),
      error: (message) => pushToast(message, 'error'),
      info: (message) => pushToast(message, 'info'),
    }),
    []
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-item toast-${toast.type}`}>
            <span>{toast.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
