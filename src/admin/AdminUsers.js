// src/admin/AdminUsers.js
import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/axiosConfig';

const ROLES = ['superadmin', 'manager', 'staff'];

function useAdminSession() {
  return useMemo(() => {
    try {
      const raw = localStorage.getItem('admin');
      const admin = raw ? JSON.parse(raw) : null;
      const token = localStorage.getItem('adminToken') || null;
      return { admin, token, role: admin?.role || null };
    } catch {
      return { admin: null, token: null, role: null };
    }
  }, []);
}

export default function AdminUsers() {
  const { token, role } = useAdminSession();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState('staff');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const canCreate = role === 'superadmin';
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  async function fetchAdmins() {
    setLoading(true);
    setErr('');
    try {
      const { data } = await api.get('/api/admin/users', { headers: authHeaders });
      setRows(Array.isArray(data) ? data : data?.items || []);
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to load admin users');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!canCreate) return;
    if (!name.trim() || !email.trim() || !password.trim()) {
      return alert('Name, email and password are required.');
    }
    setBusy(true);
    setErr('');
    try {
      await api.post(
        '/api/admin/users',
        { name: name.trim(), email: email.trim(), role: newRole, password },
        { headers: authHeaders }
      );
      setName('');
      setEmail('');
      setPassword('');
      setNewRole('staff');
      await fetchAdmins();
      alert('Admin user created.');
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to create admin');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!canCreate) return;
    if (!window.confirm('Delete this admin? This cannot be undone.')) return;
    try {
      await api.delete(`/api/admin/users/${id}`, { headers: authHeaders });
      await fetchAdmins();
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to delete admin');
    }
  }

  async function handleReset(id) {
    if (!canCreate) return;
    const ok = window.confirm('Reset password for this admin? A temporary password will be generated.');
    if (!ok) return;
    try {
      const { data } = await api.post(`/api/admin/users/${id}/reset-password`, {}, { headers: authHeaders });
      const temp = data?.tempPassword || data?.password || null;
      if (temp) {
        // In real prod you’d email this; for now show once.
        window.prompt('Temporary password (copy now):', temp);
      } else {
        alert('Password reset. The user should check their email (if configured).');
      }
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to reset password');
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 12 }}>Admin Users & Roles</h2>

      {err && <div style={{ color: '#b91c1c', marginBottom: 12 }}>{err}</div>}

      {/* Create form (superadmin only) */}
      {canCreate && (
        <form onSubmit={handleCreate} style={{ display: 'grid', gap: 8, maxWidth: 520, marginBottom: 24 }}>
          <div style={{ fontWeight: 600 }}>Create New Admin</div>
          <input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="book-gift-input"
          />
          <input
            type="email"
            placeholder="Email (login)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="book-gift-input"
          />
          <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="book-gift-input">
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <input
            type="password"
            placeholder="Initial password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="book-gift-input"
          />
          <button type="submit" className="book-gift-button submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create Admin'}
          </button>
        </form>
      )}

      {/* List */}
      <div className="table-wrapper" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <p>Loading…</p>
        ) : !rows.length ? (
          <p>No admin users found.</p>
        ) : (
          <table className="nice-table" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                {canCreate && <th style={{ width: 220 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u._id || u.id}>
                  <td>{u.name || '—'}</td>
                  <td style={{ wordBreak: 'break-all' }}>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.createdAt ? new Date(u.createdAt).toLocaleString() : '—'}</td>
                  {canCreate && (
                    <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="book-gift-button" type="button" onClick={() => handleReset(u._id || u.id)}>
                        Reset PW
                      </button>
                      <button
                        className="book-gift-button"
                        type="button"
                        onClick={() => handleDelete(u._id || u.id)}
                        style={{ background: '#fee2e2', color: '#991b1b' }}
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!canCreate && (
        <p style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
          You’re signed in with a non-superadmin role. You can view admins but cannot create/delete/reset.
        </p>
      )}
    </div>
  );
}
