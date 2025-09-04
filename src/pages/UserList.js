// src/pages/UserList.js
import React, { useEffect, useMemo, useState } from 'react';
import axios from '../utils/axiosConfig';
import './UserList.css';

const UserList = () => {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const token =
    localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');

  const load = async () => {
    try {
      setLoading(true);
      setErr('');
      const res = await axios.get('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('❌ Error fetching users:', e);
      setErr('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => {
      const fields = [
        u.name,
        u.email,
        u.phone,
        u.state,
        u.city,
        String(u.referrals ?? ''),
        String(u.totalEarned ?? ''),
      ]
        .filter(Boolean)
        .map(String);
      return fields.some((f) => f.toLowerCase().includes(s));
    });
  }, [q, users]);

  const fmtNaira = (n) => `₦${Number(n || 0).toLocaleString()}`;

  return (
    <div className="user-list-page">
      <div className="ul-header">
        <h2>All Users</h2>
        <div className="ul-tools">
          <input
            className="ul-search"
            placeholder="Search name, email, phone, city, state…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="ul-refresh" onClick={load} disabled={loading}>
            ↻ {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading && <p className="loading">Loading users…</p>}
      {err && <p className="error">{err}</p>}

      {!loading && !err && filtered.length === 0 && (
        <p className="empty">No users found.</p>
      )}

      {!loading && !err && filtered.length > 0 && (
        <table className="ul-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>State</th>
              <th>City</th>
              <th>Referrals</th>
              <th>Total Earned</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u._id}>
                <td>{u.name || '—'}</td>
                <td>{u.email || '—'}</td>
                <td>{u.phone || '—'}</td>
                <td>{u.state || '—'}</td>
                <td>{u.city || '—'}</td>
                <td>{u.referrals ?? 0}</td>
                <td>{fmtNaira(u.totalEarned)}</td>
                <td>
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default UserList;
