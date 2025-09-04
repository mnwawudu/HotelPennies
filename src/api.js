import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:10000/api',
});

// Automatically attach token to all requests
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('vendorToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;
