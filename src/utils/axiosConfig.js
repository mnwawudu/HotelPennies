// src/utils/axiosConfig.js
import axios from 'axios';

const isBrowser = typeof window !== 'undefined';
const proto = isBrowser ? window.location.protocol : '';
const host  = isBrowser ? window.location.hostname : '';

const isCapacitor = proto === 'capacitor:' || (isBrowser && !!window.Capacitor);
const isHttpLocal = /^(localhost|127\.0\.0\.1)$/.test(host) && /^https?:$/.test(proto);

// Allow either var; REACT_APP_API_URL preferred
const ENV_BASE = (process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE || '').trim();

const baseURL =
  ENV_BASE ||
  (isCapacitor
    ? 'https://hotelpennies-4.onrender.com'
    : isHttpLocal
    ? 'http://localhost:10000'
    : 'https://hotelpennies-4.onrender.com');

const instance = axios.create({ baseURL });

instance.interceptors.request.use(
  (config) => {
    const adminToken  = localStorage.getItem('adminToken')  || sessionStorage.getItem('adminToken');
    const userToken   = localStorage.getItem('userToken')   || sessionStorage.getItem('userToken');
    const vendorToken = localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');

    const token = adminToken || userToken || vendorToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

export default instance;
