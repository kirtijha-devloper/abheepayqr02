const isProd = import.meta.env.MODE === 'production';
const browserOrigin = isProd ? "https://abheepayqr02.vercel.app" : "http://localhost:4001";

export const API_BASE = `${browserOrigin}/api`;
export const UPLOADS_BASE = browserOrigin;
