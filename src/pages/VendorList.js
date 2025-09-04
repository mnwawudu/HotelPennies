// ✅ src/pages/VendorList.js
import React, { useEffect, useMemo, useState } from 'react';
import axios from '../utils/axiosConfig';
import './VendorList.css';

const formatNaira = (n) => `₦${Number(n || 0).toLocaleString()}`;

const VendorList = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  const token =
    localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const guessCityStateFromAddress = (addr = '') => {
    const parts = String(addr)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const state = parts.length >= 1 ? parts[parts.length - 1] : '—';
    const city = parts.length >= 2 ? parts[parts.length - 2] : '—';
    return { city, state };
  };

  // 🔧 TRUST SERVER FIRST: if API supplies kycStatus, use it.
  const computeKyc = (v) => {
    const server = String(v?.kycStatus || '').toUpperCase();
    if (['APPROVED', 'PROCESSING', 'REJECTED', 'PENDING'].includes(server)) {
      return server;
    }
    // Fallback (older endpoints): infer from docs/isFullyVerified
    const docs = v?.documents || {};
    const docsOk = !!(
      docs.meansOfId &&
      docs.cacCertificate &&
      docs.proofOfAddress
    );
    if (v?.isFullyVerified || docsOk) return 'APPROVED';
    return 'PENDING';
  };

  // Normalize one vendor row for UI + actions
  const normalizeVendor = (raw) => {
    const v = raw || {};
    const id = v?._id || v?.id || v?.vendorId || String(Math.random());
    const name = v?.businessName || v?.name || 'Unknown';
    const email = v?.email || '—';
    const phone = v?.phone || v?.contactPhone || '—';

    // Prefer explicit fields; otherwise fall back to address tail (display only)
    let state = v?.state || '—';
    let city = v?.city || '—';
    if ((state === '—' || city === '—') && v?.address) {
      const g = guessCityStateFromAddress(v.address);
      if (state === '—') state = g.state || '—';
      if (city === '—') city = g.city || '—';
    }

    // Services
    let services = [];
    if (Array.isArray(v?.businessTypes) && v.businessTypes.length) {
      services = v.businessTypes
        .map((bt) =>
          typeof bt === 'string' ? bt : bt?.serviceType || bt?.type || ''
        )
        .filter(Boolean);
    } else if (Array.isArray(v?.services) && v.services.length) {
      services = v.services
        .map((s) => (typeof s === 'string' ? s : s?.type || ''))
        .filter(Boolean);
    }

    // Total earned
    let totalEarned =
      Number(v?.totalEarned ?? v?.earnings ?? v?.walletBalance ?? 0) || 0;
    if (!totalEarned && Array.isArray(v?.payoutHistory)) {
      totalEarned = v.payoutHistory
        .filter((p) => String(p?.status).toLowerCase() === 'paid')
        .reduce((sum, p) => sum + Number(p?.amount || 0), 0);
    }

    // Status: API uses 'active' | 'closed' — we display 'suspended' for 'closed'
    const apiStatus = String(v?.status || 'active').toLowerCase();
    const displayStatus = apiStatus === 'closed' ? 'suspended' : apiStatus;

    const kyc = computeKyc(v);

    return {
      id,
      name,
      email,
      phone,
      state,
      city,
      services,
      totalEarned,
      kyc,
      status: displayStatus, // for pill
      apiStatus,             // for calling the right endpoint (suspend/restore)
      _raw: raw,
    };
  };

  const fetchVendorsPrimary = async () => {
    const res = await axios.get('/api/admin/vendors', { headers: authHeaders });
    const list = Array.isArray(res.data)
      ? res.data
      : res.data?.vendors || [];
    return list;
  };

  const fetchVendorsFallback = async () => {
    const [p, a, r] = await Promise.allSettled([
      axios.get('/api/admin/vendors/pending', { headers: authHeaders }),
      axios.get('/api/admin/vendors/approved', { headers: authHeaders }),
      axios.get('/api/admin/vendors/rejected', { headers: authHeaders }),
    ]);
    const collect = (s) =>
      s.status === 'fulfilled'
        ? Array.isArray(s.value.data)
          ? s.value.data
          : []
        : [];
    return [...collect(p), ...collect(a), ...collect(r)];
  };

  const fetchVendors = async () => {
    try {
      if (!token) {
        setError('Missing admin token');
        setLoading(false);
        return;
      }
      setError('');
      setLoading(true);

      let list = [];
      try {
        list = await fetchVendorsPrimary();
      } catch (e) {
        // 404 or not wired yet → fall back to pending/approved/rejected
        list = await fetchVendorsFallback();
      }
      setVendors(list);
    } catch (err) {
      console.error('❌ Error fetching vendors:', err);
      setError('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => vendors.map(normalizeVendor), [vendors]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const hay = [
        r.name,
        r.email,
        r.phone,
        r.state,
        r.city,
        ...(Array.isArray(r.services) ? r.services : []),
        r.status,
        r.kyc,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q]);

  const handleSuspendToggle = async (v) => {
    const id = v.id;
    const path =
      v.apiStatus === 'closed'
        ? `/api/admin/vendors/${id}/restore`   // UNSUSPEND
        : `/api/admin/vendors/${id}/suspend`; // SUSPEND

    try {
      await axios.post(path, {}, { headers: authHeaders });
    } catch (err) {
      console.error('❌ Suspend/Restore failed:', err);
      alert('Failed to update vendor status');
      return;
    }

    // update in place
    setVendors((prev) =>
      prev.map((raw) => {
        const n = normalizeVendor(raw);
        if (n.id !== id) return raw;
        // flip apiStatus and status
        const nextApi = n.apiStatus === 'closed' ? 'active' : 'closed';
        return { ...raw, status: nextApi, apiStatus: nextApi };
      })
    );
  };

  const handleDelete = async (v) => {
    if (!window.confirm(`Close/delete ${v.name}'s account? This cannot be undone.`)) return;
    try {
      await axios.delete(`/api/admin/vendors/${v.id}`, { headers: authHeaders });
    } catch (err) {
      console.error('❌ Delete failed:', err);
      alert('Failed to delete vendor');
      return;
    }
    setVendors((prev) => prev.filter((raw) => normalizeVendor(raw).id !== v.id));
  };

  const kycPill = (kyc) => (
    <span
      className={
        'pill ' +
        (kyc === 'APPROVED' ? 'pill-ok' : kyc === 'PROCESSING' ? 'pill-muted' : 'pill-warn')
      }
    >
      {kyc}
    </span>
  );

  const statusPill = (status) => (
    <span
      className={
        'pill ' +
        (status === 'active' ? 'pill-ok' : status === 'suspended' ? 'pill-warn' : 'pill-muted')
      }
      style={{ textTransform: 'lowercase' }}
    >
      {status}
    </span>
  );

  return (
    <div className="vendor-list-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2>All Vendors</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, phone, service…"
            className="vendor-search"
          />
          <button onClick={fetchVendors} className="refresh-btn">Refresh</button>
        </div>
      </div>

      {loading && <p className="loading">Loading vendors...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && filtered.length === 0 && <p>No vendors found.</p>}

      {!loading && !error && filtered.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>State</th>
              <th>City</th>
              <th>Services</th>
              <th>Total Earned</th>
              <th>KYC</th>
              <th>Status</th>
              <th style={{ minWidth: 160 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => (
              <tr key={v.id}>
                <td>{v.name}</td>
                <td>{v.email}</td>
                <td>{v.phone}</td>
                <td>{v.state}</td>
                <td>{v.city}</td>
                <td>{v.services.length ? v.services.join(', ') : 'None'}</td>
                <td>{formatNaira(v.totalEarned)}</td>
                <td>{kycPill(v.kyc)}</td>
                <td>{statusPill(v.status)}</td>
                <td style={{ display: 'flex', gap: 8 }}>
                  <button
                    className={v.apiStatus === 'closed' ? 'btn-green' : 'btn-warning'}
                    onClick={() => handleSuspendToggle(v)}
                  >
                    {v.apiStatus === 'closed' ? 'Restore' : 'Suspend'}
                  </button>
                  <button className="btn-danger" onClick={() => handleDelete(v)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default VendorList;
