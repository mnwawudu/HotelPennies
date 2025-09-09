// src/utils/axiosConfig.js
import axios from 'axios';

const isCapacitor = typeof window !== 'undefined' && window.location?.protocol === 'capacitor:';
const isLocalhost =
  typeof window !== 'undefined' &&
  /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);

// In Capacitor, always use prod API. In browser localhost, use local API.
const baseURL = isCapacitor
  ? 'https://hotelpennies-4.onrender.com'
  : (isLocalhost
      ? 'http://localhost:10000'
      : 'https://hotelpennies-4.onrender.com');

const instance = axios.create({ baseURL });

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
