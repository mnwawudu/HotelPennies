import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/axiosConfig';

const isStrong = (pwd = '') =>
  pwd.length >= 8 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /\d/.test(pwd);

export default function AdminSetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  // Token comes from the emailed link: /admin/set-password?token=XYZ
  const token = useMemo(() => params.get('token') || '', [params]);

  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');

    if (!token) {
      setErr('This link is missing a token or has expired.');
      return;
    }
    if (!isStrong(pw)) {
      setErr('Password must be at least 8 chars and include upper, lower, and a number.');
      return;
    }

    setBusy(true);
    try {
      // Use the existing backend endpoint you already have:
      // POST /api/admin/_setup/set-password with { token, password }
      const { data } = await api.post('/api/admin/_setup/set-password', {
        token,
        password: pw,
      });

      // If backend returns a token/admin, auto sign-in
      if (data?.token && data?.admin) {
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('admin', JSON.stringify(data.admin));
        navigate('/admin/dashboard', { replace: true });
        return;
      }

      // Otherwise show success and redirect to login
      setOk(true);
      setTimeout(() => navigate('/admin/login', { replace: true }), 800);
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to set password');
    } finally {
      setBusy(false);
    }
  };

  const disabled = !token || !isStrong(pw) || busy;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-6 shadow rounded w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Set Your Admin Password</h2>
        <p className="text-sm text-gray-600 mb-4">
          Enter a new password for your admin account.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            placeholder="New password (min 8, upper/lower/number)"
            className="w-full border p-2 rounded"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
          />

        {err && <p className="text-red-600 text-sm">{err}</p>}
        {ok && <p className="text-green-600 text-sm">Password updated. Redirecting…</p>}

          <button
            disabled={disabled}
            className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-60"
            type="submit"
          >
            {busy ? 'Saving…' : 'Set Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
