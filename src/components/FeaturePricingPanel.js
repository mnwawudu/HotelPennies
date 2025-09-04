// src/components/FeaturePricingPanel.js
import React, { useEffect, useMemo, useState } from 'react';
import axios from '../utils/axiosConfig';
import '../pages/AdminFeaturedListings.css';

const DURATIONS = ['7d', '1m', '6m', '1y'];
const SCOPES = ['local', 'global'];

const formatNaira = (n) => {
  if (n === null || n === undefined || n === '') return '—';
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return `₦${num.toLocaleString()}`;
};

export default function FeaturePricingPanel() {
  const token = useMemo(() => localStorage.getItem('adminToken'), []);
  const headers = { Authorization: `Bearer ${token}` };

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState({});
  const [editingKey, setEditingKey] = useState(null);
  const [draft, setDraft] = useState('');

  const keyOf = (type, duration) => `${type}:${duration}`;

  const loadPricing = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/feature-pricing', { headers });
      const map = {};
      (res.data || []).forEach((row) => {
        if (!row?.type || !row?.duration) return;
        map[keyOf(row.type, row.duration)] = Number(row.price || 0);
      });
      setPricing(map);
    } catch (err) {
      console.error('Failed to load pricing', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPricing(); }, []);

  const beginEdit = (type, duration) => {
    const k = keyOf(type, duration);
    setEditingKey(k);
    setDraft(pricing[k] ?? '');
  };

  const cancelEdit = () => { setEditingKey(null); setDraft(''); };

  const onSave = async (type, duration) => {
    const priceNum = Number(draft);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      return alert('Enter a valid non-negative number.');
    }
    try {
      await axios.post('/api/feature-pricing', { type, duration, price: priceNum }, { headers });
      setPricing((p) => ({ ...p, [keyOf(type, duration)]: priceNum }));
      cancelEdit();
    } catch (err) {
      console.error('Save pricing failed', err);
      alert(err?.response?.data?.message || 'Failed to save pricing');
    }
  };

  return (
    <div className="pricing-panel">
      {/* NAVY HEADER */}
      <button
        type="button"
        className="collapse-toggle"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem 1rem',
          borderRadius: 10,
          border: '1px solid transparent',
          background: '#0f1e4b',      // navy blue
          color: '#fff',               // white text
          boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
          fontWeight: 600,
        }}
      >
        <span>Feature Pricing</span>
        <span
          style={{
            marginLeft: 'auto',
            transition: 'transform 0.2s ease',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            opacity: 0.9,
          }}
        >
          ▶
        </span>
      </button>

      {open && (
        <div className="feature-table-wrap" style={{ marginTop: '0.75rem' }}>
          {loading ? (
            <p>Loading…</p>
          ) : (
            <table className="feature-table">
              <thead>
                <tr>
                  <th>Scope</th>
                  <th>Duration</th>
                  <th>Price (₦)</th>
                  <th style={{ width: 120 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {SCOPES.map((scope) =>
                  DURATIONS.map((dur) => {
                    const k = keyOf(scope, dur);
                    const isEditing = editingKey === k;
                    const price = pricing[k];
                    return (
                      <tr key={k}>
                        <td style={{ textTransform: 'capitalize' }}>{scope}</td>
                        <td>{dur}</td>
                        <td>
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              style={{ width: 160 }}
                            />
                          ) : (
                            <strong>{formatNaira(price)}</strong>
                          )}
                        </td>
                        <td className="actions">
                          {isEditing ? (
                            <>
                              <button className="primary" onClick={() => onSave(scope, dur)}>Update</button>
                              <button className="muted" onClick={cancelEdit}>Cancel</button>
                            </>
                          ) : (
                            <button onClick={() => beginEdit(scope, dur)}>
                              {price === undefined ? 'Add' : 'Edit'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
