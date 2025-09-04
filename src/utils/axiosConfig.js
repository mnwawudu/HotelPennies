// src/utils/axiosConfig.js
import axios from 'axios';

const baseURL = /localhost|127\.0\.0\.1/.test(window.location.hostname)
  ? 'http://localhost:10000'
  : 'https://hotelpennies-4.onrender.com';

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
