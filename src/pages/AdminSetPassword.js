import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/axiosConfig';

export default function AdminSetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const email = useMemo(() => params.get('email') || '', [params]);
  const token = useMemo(() => params.get('token') || '', [params]);

  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const { data } = await api.post('/api/admin/set-password', {
        email, token, newPassword: pw,
      });
      localStorage.setItem('adminToken', data.token);
      localStorage.setItem('admin', JSON.stringify(data.admin));
      navigate('/admin/dashboard');
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to set password');
    } finally {
      setBusy(false);
    }
  };

  const disabled = !email || !token || pw.length < 8;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-6 shadow rounded w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Set Your Admin Password</h2>
        <p className="text-sm text-gray-600 mb-4">{email}</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            placeholder="New password"
            className="w-full border p-2 rounded"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
          />
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <button
            disabled={disabled || busy}
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
