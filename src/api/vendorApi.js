// ✅ src/api/vendorApi.js
import axios from 'axios';

const API_BASE = 'http://localhost:10000/api/vendor';

export const fetchVendorProfile = async () => {
  const token = localStorage.getItem('token');
  try {
    const res = await axios.get(`${API_BASE}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  } catch (err) {
    console.error('Error fetching vendor profile:', err);
    throw err;
  }
};

