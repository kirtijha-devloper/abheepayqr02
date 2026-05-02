const browserOrigin =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : null;

const defaultApiOrigin =
  import.meta.env.MODE === 'production'
    ? (browserOrigin || 'https://abheepayqr02.vercel.app')
    : 'http://localhost:4001';

const apiBase = import.meta.env.VITE_API_URL || `${defaultApiOrigin}/api`;
const uploadsBase = import.meta.env.VITE_UPLOADS_URL || defaultApiOrigin;

export const API_BASE = apiBase.replace(/\/$/, '');
export const UPLOADS_BASE = uploadsBase.replace(/\/$/, '');
