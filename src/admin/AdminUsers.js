// src/admin/AdminUsers.jsx
import React, { useEffect, useState } from 'react';
import api from '../utils/axiosConfig';

const ROLES = ['staff', 'manager', 'superadmin']; // least-privilege → staff by default

export default function AdminUsers() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [password, setPassword] = useState('');

  const load = async () => {
    try {
      setErr('');
      setLoading(true);
      const { data } = await api.get('/api/admin/admin-users'); // ✅ correct endpoint
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to load admin users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onCreate = async (e) => {
    e.preventDefault();
    try {
      setErr('');
      await api.post('/api/admin/admin-users', {
        name: name.trim(),
        email: email.trim(),     // must be unique per admin!
        role,
        password: password.trim(),
        sendInvite: true         // email invite if SMTP is configured
      });
      setName(''); setEmail(''); setRole('staff'); setPassword('');
      await load();
      alert('Admin created. If email is valid, an invite was sent.');
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to create admin');
    }
  };

  const onReset = async (id) => {
    if (!window.confirm('Send password reset to this admin?')) return;
    try {
      await api.post(`/api/admin/admin-users/${id}/reset-password`);
      alert('Reset email sent (if SMTP configured).');
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to reset password');
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm('Delete this admin? This cannot be undone.')) return;
    try {
      await api.delete(`/api/admin/admin-users/${id}`);
      await load();
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to delete admin');
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Admin Users & Roles</h2>

      <form onSubmit={onCreate} className="grid gap-3 max-w-xl">
        <input
          className="book-gift-input"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="book-gift-input"
          placeholder="email@domain.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
        />
        <select
          className="book-gift-input"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <input
          className="book-gift-input"
          placeholder="Temporary password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
        />
        <button className="book-gift-button submit" type="submit">Create Admin</button>
      </form>

      {err && <p className="text-red-600 mt-3">{err}</p>}

      <div className="card mt-6">
        <table className="nice-table">
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Role</th><th>Created</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan="5">No admin users yet.</td></tr>
            ) : (
              items.map(a => (
                <tr key={a._id}>
                  <td>{a.name || '—'}</td>
                  <td>{a.email}</td>
                  <td>{a.role}</td>
                  <td>{a.createdAt ? new Date(a.createdAt).toLocaleString() : '—'}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={() => onReset(a._id)}>Reset PW</button>
                    <button className="btn btn-danger" onClick={() => onDelete(a._id)}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
