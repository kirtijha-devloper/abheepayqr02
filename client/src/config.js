const browserOrigin =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:4001`
    : 'http://localhost:4001';

export const API_BASE = import.meta.env.VITE_API_URL || `${browserOrigin}/api`;
export const UPLOADS_BASE = import.meta.env.VITE_UPLOADS_URL || browserOrigin;
