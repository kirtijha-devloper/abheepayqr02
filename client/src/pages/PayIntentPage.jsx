import React, { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

const decodeUpiLink = (value) => {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const PayIntentPage = () => {
  const [searchParams] = useSearchParams();

  const upiLink = useMemo(() => {
    const raw = searchParams.get('upi');
    return decodeUpiLink(raw);
  }, [searchParams]);

  useEffect(() => {
    if (!upiLink) return;

    const timer = window.setTimeout(() => {
      window.location.assign(upiLink);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [upiLink]);

  const handleOpen = () => {
    if (!upiLink) return;
    window.location.assign(upiLink);
  };

  return (
    <main className="pay-intent-page">
      <section className="pay-intent-card">
        <p className="pay-intent-eyebrow">Payment Link</p>
        <h1>Open Your UPI App</h1>
        <p className="pay-intent-copy">
          This link will open your payment app and continue the payment intent.
        </p>

        <input className="pay-intent-input" type="text" value={upiLink || 'Invalid payment link'} readOnly />

        <div className="pay-intent-actions">
          <button type="button" className="pay-intent-button" onClick={handleOpen} disabled={!upiLink}>
            Open Payment App
          </button>
        </div>
      </section>
    </main>
  );
};

export default PayIntentPage;
