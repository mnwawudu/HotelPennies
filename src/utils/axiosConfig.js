// src/utils/axiosConfig.js
import axios from 'axios';

const isBrowser = typeof window !== 'undefined';
const proto = isBrowser ? window.location.protocol : '';
const host  = isBrowser ? window.location.hostname : '';

const isCapacitor = proto === 'capacitor:' || (isBrowser && !!window.Capacitor);
const isHttpLocal = /^(localhost|127\.0\.0\.1)$/.test(host) && /^https?:$/.test(proto);

// Optional override via env (useful for previews)
const ENV_BASE = process.env.REACT_APP_API_BASE?.trim();

// If running inside Capacitor, always use production API.
// If running in real browser at http(s)://localhost, use local API.
// Otherwise default to production API.
const baseURL =
  ENV_BASE ||
  (isCapacitor
    ? 'https://hotelpennies-4.onrender.com'
    : isHttpLocal
    ? 'http://localhost:10000'
    : 'https://hotelpennies-4.onrender.com');

const instance = axios.create({ baseURL });

// Attach whichever auth token exists
instance.interceptors.request.use(
  (config) => {
    const userToken =
      localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
    const vendorToken =
      localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');

    if (userToken) config.headers.Authorization = `Bearer ${userToken}`;
    else if (vendorToken) config.headers.Authorization = `Bearer ${vendorToken}`;

    return config;
  },
  (error) => Promise.reject(error)
);

export default instance;
