// ✅ src/pages/AdminFeaturedListings.jsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from '../utils/axiosConfig';
import FeaturePricingPanel from '../components/FeaturePricingPanel';
import './AdminFeaturedListings.css';

const STATUSES = ['active', 'scheduled', 'expired', 'all'];
const TYPES = ['all','room','menu','shortlet','restaurant','eventcenter','tourguide','chop','gift'];

const fmt = (d) => d ? new Date(d).toLocaleString() : '—';
const left = (to) => {
  if (!to) return '—';
  const diff = (new Date(to) - new Date()) / 86400000;
  if (diff < 0) return `${Math.abs(Math.ceil(diff))}d ago`;
  return `${Math.ceil(diff)}d`;
};

export default function AdminFeaturedListings() {
  const token = useMemo(() => localStorage.getItem('adminToken'), []);
  const headers = { Authorization: `Bearer ${token}` };

  const [overview, setOverview] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState('active');
  const [type, setType] = useState('all');
  const [q, setQ] = useState('');

  // create form
  const [formOpen, setFormOpen] = useState(false);
  const [fType, setFType] = useState('shortlet'); // resourceType
  const [fScope, setFScope] = useState('local');  // featureType
  const [fVendor, setFVendor] = useState('');
  const [fResource, setFResource] = useState('');
  const [fDays, setFDays] = useState(7);
  const [fState, setFState] = useState('');

  const loadOverview = async () => {
    const res = await axios.get('/api/admin/features/overview', { headers });
    setOverview(res.data);
  };

  const loadRows = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/features/list', {
        headers,
        params: { status, resourceType: type, q, page: 1, limit: 50 },
      });
      setRows(res.data?.rows || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOverview(); }, []);
  useEffect(() => { loadRows(); }, [status, type]);

  const onSearch = (e) => { e.preventDefault(); loadRows(); };

  const unfeature = async (id) => {
    if (!window.confirm('Unfeature this item now?')) return;
    await axios.post(`/api/admin/features/${id}/unfeature`, {}, { headers });
    await Promise.all([loadOverview(), loadRows()]);
  };

  const extend = async (id, days = 7) => {
    await axios.patch(`/api/admin/features/${id}/extend`, { days }, { headers });
    await Promise.all([loadOverview(), loadRows()]);
  };

  const removeRow = async (id) => {
    if (!window.confirm('Delete feature record?')) return;
    await axios.delete(`/api/admin/features/${id}`, { headers });
    await Promise.all([loadOverview(), loadRows()]);
  };

  const createFeature = async (e) => {
    e.preventDefault();
    if (!fVendor || !fResource) return alert('Enter vendorId and resourceId');

    await axios.post('/api/admin/features', {
      resourceType: fType,
      resourceId: fResource,
      vendorId: fVendor,
      featureType: fScope,
      durationDays: Number(fDays) || 7,
      state: fScope === 'local' ? (fState || undefined) : undefined,
    }, { headers });

    setFormOpen(false);
    setFVendor(''); setFResource(''); setFDays(7); setFState('');
    await Promise.all([loadOverview(), loadRows()]);
  };

  return (
    <div className="admin-featured">
      <h2>Manage Featured Listings</h2>

      <div className="feature-cards">
        {overview ? (
          <>
            <div className="stat"><span className="label">Total Active</span><span className="value">{overview.total}</span></div>
            {Object.entries(overview.breakdown || {}).map(([k, v]) => (
              <div key={k} className="stat"><span className="label">{k}</span><span className="value">{v}</span></div>
            ))}
          </>
        ) : <div className="stat"><span className="label">Loading…</span></div>}
      </div>

      <div className="feature-toolbar">
        <form onSubmit={onSearch} className="feature-filters">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input placeholder="Search (name/email/id)" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="submit">Search</button>
        </form>

        <button className="primary" onClick={() => setFormOpen(v => !v)}>
          {formOpen ? 'Close' : 'New Feature'}
        </button>
      </div>

      {formOpen && (
        <form className="feature-create" onSubmit={createFeature}>
          <select value={fType} onChange={(e) => setFType(e.target.value)}>
            {TYPES.filter(t => t !== 'all').map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={fScope} onChange={(e) => setFScope(e.target.value)}>
            <option value="local">local</option>
            <option value="global">global</option>
          </select>
          {fScope === 'local' && (
            <input placeholder="Target State (optional)" value={fState} onChange={(e) => setFState(e.target.value)} />
          )}
          <input placeholder="Vendor ID" value={fVendor} onChange={(e) => setFVendor(e.target.value)} />
          <input placeholder="Resource ID" value={fResource} onChange={(e) => setFResource(e.target.value)} />
          <input type="number" min="1" placeholder="Days" value={fDays} onChange={(e) => setFDays(e.target.value)} />
          <button type="submit" className="primary">Create</button>
        </form>
      )}

      <div className="feature-table-wrap">
        {loading ? (
          <p>Loading…</p>
        ) : rows.length === 0 ? (
          <p>No records found.</p>
        ) : (
          <table className="feature-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Type</th>
                <th>Scope</th>
                <th>From</th>
                <th>To</th>
                <th>Left</th>
                <th>Vendor</th>
                <th>Status</th>
                <th style={{width:180}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r._id}>
                  <td className="item-cell">
                    <img src={r.thumb || '/default.jpg'} alt="" />
                    <div>
                      <div className="name">{r.itemName || r.resourceId}</div>
                      <div className="sub">{r.itemLocation || '—'}</div>
                    </div>
                  </td>
                  <td>{r.resourceType}</td>
                  <td>{r.featureType}{r.scopeState ? ` (${r.scopeState})` : ''}</td>
                  <td>{fmt(r.featuredFrom)}</td>
                  <td>{fmt(r.featuredTo)}</td>
                  <td>{left(r.featuredTo)}</td>
                  <td>{r.vendorEmail || r.vendorName || '—'}</td>
                  <td style={{textTransform:'capitalize'}}>{r.status}</td>
                  <td className="actions">
                    <button className="danger" onClick={() => unfeature(r._id)}>Unfeature</button>
                    <button onClick={() => extend(r._id, 7)}>+7d</button>
                    <button className="muted" onClick={() => removeRow(r._id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Inline pricing manager */}
      <FeaturePricingPanel />
    </div>
  );
}
