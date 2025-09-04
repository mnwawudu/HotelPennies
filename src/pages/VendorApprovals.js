import React, { useEffect, useMemo, useState } from 'react';
import axios from '../utils/axiosConfig';
import './VendorApprovals.css';

const VendorApprovals = () => {
  const [vendors, setVendors] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const token = localStorage.getItem('adminToken');

  const loadPending = async () => {
    if (!token) return setErr('Missing admin token');
    try {
      setLoading(true);
      setErr('');
      const res = await axios.get('/api/admin/vendors/pending', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = Array.isArray(res.data) ? res.data : [];
      setVendors(list);
    } catch (e) {
      console.error('❌ Failed to fetch pending vendors', e);
      setErr('Failed to load pending vendors.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return vendors;
    return vendors.filter((v) => {
      const fields = [
        v?.name, v?.email, v?.phone, v?.address,
        ...(Array.isArray(v?.businessTypes) ? v.businessTypes : []),
      ].filter(Boolean).map(String);
      return fields.some((f) => f.toLowerCase().includes(s));
    });
  }, [q, vendors]);

  const act = async (id, kind) => {
    if (!token) return;
    const url =
      kind === 'approve'
        ? `/api/admin/vendors/${id}/approve`
        : `/api/admin/vendors/${id}/reject`;
    try {
      await axios.post(url, {}, { headers: { Authorization: `Bearer ${token}` } });
      // optimistically remove from list
      setVendors((vs) => vs.filter((v) => v._id !== id));
    } catch (e) {
      console.error(`❌ ${kind} failed`, e);
      alert(`${kind === 'approve' ? 'Approve' : 'Reject'} failed.`);
    }
  };

  return (
    <div className="va-wrap">
      <div className="va-header">
        <h2>Vendor Approvals</h2>
        <div className="va-tools">
          <input
            className="va-search"
            placeholder="Search name, email, phone, service…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            type="button"
            className="va-refresh-btn"
            onClick={loadPending}
            title="Refresh pending list"
            disabled={loading}
          >
            ↻ {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {err && <p className="va-error">{err}</p>}

      {!loading && filtered.length === 0 && !err && (
        <p className="va-empty">No pending vendors.</p>
      )}

      {filtered.length > 0 && (
        <div className="va-table">
          <div className="va-thead">
            <div>Name</div>
            <div>Email</div>
            <div>Phone</div>
            <div>Docs</div>
            <div>Actions</div>
          </div>
          {filtered.map((v) => (
            <div className="va-row" key={v._id}>
              <div>{v.name || '-'}</div>
              <div>{v.email || '-'}</div>
              <div>{v.phone || '-'}</div>
              <div className="va-docs">
                <span className={v?.documents?.meansOfId ? 'ok' : 'miss'}>ID</span>
                <span className={v?.documents?.cacCertificate ? 'ok' : 'miss'}>CAC</span>
                <span className={v?.documents?.proofOfAddress ? 'ok' : 'miss'}>POA</span>
              </div>
              <div className="va-actions">
                <button className="va-btn approve" onClick={() => act(v._id, 'approve')}>
                  Approve
                </button>
                <button className="va-btn reject" onClick={() => act(v._id, 'reject')}>
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VendorApprovals;
