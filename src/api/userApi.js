// ✅ src/api/userApi.js
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE_URL + '/api/user';
const getToken = () => localStorage.getItem('token');
const headers = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fetchUserDashboard = async () => {
  try {
    const res = await axios.get(`${API_BASE}/dashboard`, { headers: headers() });
    return res.data;
  } catch (err) {
    console.error('Error fetching dashboard:', err);
    throw new Error('Failed to load user dashboard');
  }
};

export const requestPayout = async () => {
  try {
    const res = await axios.post(`${API_BASE}/request-payout`, {}, { headers: headers() });
    return res.data;
  } catch (err) {
    console.error('Error requesting payout:', err);
    throw new Error('Failed to request payout');
  }
};

export const fetchEarnings = async () => {
  try {
    const res = await axios.get(`${API_BASE}/earnings`, { headers: headers() });
    return res.data.earnings;
  } catch (err) {
    console.error('Error fetching earnings:', err);
    throw new Error('Failed to fetch earnings');
  }
};

export const fetchReferrals = async () => {
  try {
    const res = await axios.get(`${API_BASE}/referrals`, { headers: headers() });
    return res.data.referrals;
  } catch (err) {
    console.error('Error fetching referrals:', err);
    throw new Error('Failed to fetch referrals');
  }
};

export const fetchPayoutHistory = async () => {
  try {
    const res = await axios.get(`${API_BASE}/payout-history`, { headers: headers() });
    return res.data.payouts;
  } catch (err) {
    console.error('Error fetching payout history:', err);
    throw new Error('Failed to fetch payout history');
  }
};

export const verifyEmail = async (token) => {
  try {
    const res = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/user/verify-email/${token}`);
    return res.data;
  } catch (err) {
    console.error('Error verifying email:', err);
    throw new Error('Email verification failed');
  }
};

export const resendVerificationEmail = async (email) => {
  try {
    const res = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/user/resend-verification`, { email });
    return res.data;
  } catch (err) {
    console.error('Error resending verification email:', err);
    throw new Error('Resending verification email failed');
  }
};
