import React, { useEffect, useState } from 'react';
import api from '../utils/axiosConfig';

export default function AdminUsers() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/admin/users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken') || ''}` }
      });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to load admins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    setErr('');
    setBusy(true);
    try {
      await api.post('/api/admin/users/invite',
        { name, email, role },
        { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken') || ''}` } }
      );
      setName(''); setEmail(''); setRole('staff');
      await load();
      alert('Invite sent (or link logged on server).');
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to invite');
    } finally {
      setBusy(false);
    }
  };

  const resend = async (id) => {
    try {
      await api.post(`/api/admin/users/${id}/invite`, {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken') || ''}` } }
      );
      alert('Invite re-sent (or link logged on server).');
      await load();
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to resend');
    }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this admin?')) return;
    try {
      await api.delete(`/api/admin/users/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken') || ''}` }
      });
      await load();
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Admin Users & Roles</h2>

      <div className="bg-white rounded shadow p-4 mb-6 space-y-3 max-w-xl">
        <input className="w-full border p-2 rounded" placeholder="Full name"
          value={name} onChange={e => setName(e.target.value)} />
        <input className="w-full border p-2 rounded" placeholder="Email"
          value={email} onChange={e => setEmail(e.target.value)} />
        <select className="w-full border p-2 rounded" value={role} onChange={e => setRole(e.target.value)}>
          <option value="staff">staff (content)</option>
          <option value="manager">manager</option>
          <option value="superadmin">superadmin</option>
        </select>
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <button disabled={busy} onClick={create}
          className="bg-blue-900 text-white px-4 py-2 rounded disabled:opacity-60">
          {busy ? 'Sending…' : 'Send Invite'}
        </button>
      </div>

      <div className="bg-white rounded shadow p-4">
        <h3 className="font-medium mb-3">Admins</h3>
        {loading ? <p>Loading…</p> : !rows.length ? <p>No admins yet.</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-2">Name</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Created</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b">
                    <td className="p-2">{r.name || '—'}</td>
                    <td className="p-2">{r.email}</td>
                    <td className="p-2 capitalize">{r.role}</td>
                    <td className="p-2">{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</td>
                    <td className="p-2 space-x-2">
                      <button onClick={() => resend(r.id)} className="px-3 py-1 rounded bg-blue-700 text-white">Resend</button>
                      <button onClick={() => del(r.id)} className="px-3 py-1 rounded bg-red-100 text-red-700">Delete</button>
                      {r.invitePending && <span className="ml-2 text-xs text-orange-600">invite pending</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
