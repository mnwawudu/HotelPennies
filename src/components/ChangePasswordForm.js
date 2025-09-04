import React, { useState } from 'react';
import axios from '../utils/axiosConfig';

const getAuthToken = () =>
  localStorage.getItem('userToken') ||
  localStorage.getItem('vendorToken') ||
  localStorage.getItem('token') ||
  sessionStorage.getItem('userToken') ||
  sessionStorage.getItem('vendorToken') ||
  sessionStorage.getItem('token') ||
  '';

const strong = (s) =>
  s && s.length >= 8 && /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s);

const ChangePasswordForm = ({ onSuccess }) => {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setMsg('');

    if (!strong(newPassword)) {
      setMsg('Password must be 8+ chars with upper, lower, and a number.');
      return;
    }
    if (newPassword !== confirm) {
      setMsg('New password and confirmation do not match.');
      return;
    }

    try {
      setLoading(true);
      const token = getAuthToken();
      await axios.post(
        '/api/auth/change-password',
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMsg('Password updated. Please sign in again.');
      // Optional: clear tokens so user re-authenticates
      setTimeout(() => {
        localStorage.removeItem('userToken');
        localStorage.removeItem('vendorToken');
        localStorage.removeItem('token');
        sessionStorage.removeItem('userToken');
        sessionStorage.removeItem('vendorToken');
        sessionStorage.removeItem('token');
        onSuccess && onSuccess();
      }, 800);
    } catch (err) {
      const m =
        err?.response?.data?.message ||
        err?.message ||
        'Could not change password';
      setMsg(m);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ maxWidth: 420 }}>
      <h3 style={{ marginBottom: 12 }}>Change Password</h3>

      <label>Current Password</label>
      <input
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrent(e.target.value)}
        required
      />

      <label style={{ marginTop: 8 }}>New Password</label>
      <input
        type="password"
        value={newPassword}
        onChange={(e) => setNew(e.target.value)}
        required
        placeholder="Min 8 chars, upper/lower/number"
      />

      <label style={{ marginTop: 8 }}>Confirm New Password</label>
      <input
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
      />

      {msg && (
        <p style={{ marginTop: 8, color: /updated|again/i.test(msg) ? 'green' : '#b00' }}>
          {msg}
        </p>
      )}

      <button type="submit" disabled={loading} style={{ marginTop: 12 }}>
        {loading ? 'Updating…' : 'Update Password'}
      </button>
    </form>
  );
};

export default ChangePasswordForm;
