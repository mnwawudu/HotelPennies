import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from '../utils/axiosConfig';

const strong = (s) =>
  s && s.length >= 8 && /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s);

const ResetPassword = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const qs = useMemo(() => new URLSearchParams(search), [search]);
  const email = qs.get('email') || '';
  const token = qs.get('token') || '';

  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg('');

    if (!strong(newPassword)) {
      setMsg('Password must be 8+ chars with upper, lower, and a number.');
      return;
    }
    if (newPassword !== confirm) {
      setMsg('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      await axios.post('/api/auth/reset-password', { email, token, newPassword });
      setOk(true);
      setMsg('Password reset successful. Please sign in.');
      setTimeout(() => navigate('/auth'), 1200); // adjust route if needed
    } catch (err) {
      const m =
        err?.response?.data?.message ||
        err?.message ||
        'Could not reset password';
      setMsg(m);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }}>
      <h2>Reset Password</h2>
      <p style={{ color: '#555' }}>Email: <strong>{email || '—'}</strong></p>
      <form onSubmit={submit}>
        <label>New Password</label>
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
          <p style={{ marginTop: 8, color: ok ? 'green' : '#b00' }}>{msg}</p>
        )}
        <button type="submit" disabled={loading} style={{ marginTop: 12 }}>
          {loading ? 'Resetting…' : 'Reset Password'}
        </button>
      </form>
    </div>
  );
};

export default ResetPassword;
