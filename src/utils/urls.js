// src/utils/urls.js
export const API_BASE =
  /localhost|127\.0\.0\.1/.test(window.location.hostname)
    ? 'http://localhost:10000'
    : 'https://hotelpennies-4.onrender.com';

export function apiUrl(path = '') {
  return path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export function assetUrl(path = '') {
  // for /uploads/... and any image/file served by the backend
  return apiUrl(path);
}
