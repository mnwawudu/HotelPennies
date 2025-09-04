import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // payouts
  const [payouts, setPayouts] = useState([]);
  const [payoutsLoading, setPayoutsLoading] = useState(true);
  const [payoutsError, setPayoutsError] = useState('');

  // ✅ featured counts
  const [featuredCounts, setFeaturedCounts] = useState({
    hotels: 0,
    shortlets: 0,
    restaurants: 0,
    eventcenters: 0,
    total: 0,
  });

  // ✅ top user origins (from /api/admin/analytics/user-origins)
  const [origins, setOrigins] = useState({ total: 0, byState: [], byCity: [] });

  const formatNaira = (n) => `₦${Number(n || 0).toLocaleString()}`;

  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
  });

  const fetchSummary = async () => {
    try {
      const res = await axios.get('/api/admin/overview', authHeaders());
      setSummary(res.data);
    } catch (err) {
      console.error('Failed to fetch admin summary:', err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ new counts fetch
  const fetchFeaturedCounts = async () => {
    try {
      const res = await axios.get('/api/admin/explore-counts', authHeaders());
      setFeaturedCounts({
        hotels: res.data?.hotels || 0,
        shortlets: res.data?.shortlets || 0,
        restaurants: res.data?.restaurants || 0,
        eventcenters: res.data?.eventcenters || 0,
        total: res.data?.total || 0,
      });
    } catch (err) {
      console.error('Failed to fetch featured counts:', err);
    }
  };

  // payouts list
  const fetchPayouts = async () => {
    try {
      setPayoutsError('');
      setPayoutsLoading(true);
      const res = await axios.get('/api/admin/payouts?status=all&page=1&limit=50', authHeaders());
      const rows = res.data?.data || res.data || [];
      setPayouts(rows);
    } catch (err) {
      console.error('Failed to fetch payouts:', err);
      setPayoutsError('Failed to fetch payouts');
    } finally {
      setPayoutsLoading(false);
    }
  };

  // ✅ top user origins
  const fetchOrigins = async () => {
    try {
      const res = await axios.get('/api/admin/analytics/user-origins?limit=10', authHeaders());
      setOrigins(res.data || { total: 0, byState: [], byCity: [] });
    } catch (err) {
      console.error('Failed to fetch user origins:', err);
      setOrigins({ total: 0, byState: [], byCity: [] });
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchPayouts();
    fetchFeaturedCounts();
    fetchOrigins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !summary) return <p>Loading...</p>;

  // small helper for compacting long refs
  const shortRef = (r) => {
    if (!r) return '-';
    const s = String(r);
    return s.length <= 10 ? s : `${s.slice(0, 6)}…${s.slice(-4)}`;
  };

  return (
    <div className="admin-dashboard">
      <div className="dashboard-card">
        <h3>💰 Revenue and Sales Summary</h3>
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Total Sales</th>
              <th>Total Revenue (₦)</th>
            </tr>
          </thead>
          <tbody>
            {(summary.sales || []).map((item, i) => (
              <tr key={i}>
                <td>{item.category}</td>
                <td>{Number(item.totalSales || 0)}</td>
                <td>{formatNaira(item.totalRevenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="dashboard-card">
        <h3>🏆 Top Earners (Users & Vendors)</h3>
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Total Earned (₦)</th>
            </tr>
          </thead>
        <tbody>
            {(summary.topEarners || []).map((u, i) => (
              <tr key={i}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{formatNaira(u.totalEarned)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="dashboard-card">
        <h3>📍 Top User Origins</h3>
        {(!origins.byState.length && !origins.byCity.length) ? (
          <p>No data.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <strong>By State</strong>
              <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none' }}>
                {origins.byState.map((s) => (
                  <li key={s.state} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{s.state}</span><span>{s.count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <strong>By City</strong>
              <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none' }}>
                {origins.byCity.map((c) => (
                  <li key={`${c.city}-${c.state}`} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{c.label || (c.state ? `${c.city}, ${c.state}` : c.city)}</span>
                    <span>{c.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <div style={{ marginTop: 8, color: '#6c757d', fontSize: 12 }}>
          Total users: {origins.total || 0}
        </div>
      </div>

      <div className="dashboard-card">
        <h3>📢 Active Ads</h3>
        <p>{Number(summary.activeAds || 0)} ads running</p>
      </div>

      <div className="dashboard-card">
        <h3>⭐ Featured Listings</h3>
        <p>{Number(summary.featuredListings || 0)} total</p>
      </div>

      <div className="dashboard-card">
        <h3>🏢 Business Listings</h3>
        <p>{Number(summary.totalBusinesses || 0)} businesses listed</p>
      </div>

      {/* Payouts card (mirrors backend fields) */}
      <div className="dashboard-card">
        <h3>💳 Payouts (latest 50)</h3>
        {payoutsLoading && <p>Loading payouts...</p>}
        {payoutsError && <p className="error">{payoutsError}</p>}
        {!payoutsLoading && !payoutsError && payouts.length === 0 && <p>No payouts found.</p>}
        {!payoutsLoading && !payoutsError && payouts.length > 0 && (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Payee</th>
                <th>Email</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => {
                const displayStatus = (p.uiStatus || p.status || 'pending');
                return (
                  <tr key={p._id}>
                    <td>{p.payeeName || '-'}</td>
                    <td>{p.payeeEmail || '-'}</td>
                    <td>{formatNaira(p.amountNum ?? p.amount)}</td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {displayStatus}
                      {(p.provider || p.transferRef) && (
                        <div style={{ fontSize: 12, color: '#6c757d', marginTop: 2 }}>
                          {p.provider ? p.provider : 'gateway'}{p.transferRef ? ` • ${shortRef(p.transferRef)}` : ''}
                        </div>
                      )}
                    </td>
                    <td>{p.createdAt ? new Date(p.createdAt).toLocaleString() : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ✅ Explore Manager counts (no cards on dashboard) */}
      <div className="dashboard-card">
        <h3>🧽 Explore Manager</h3>
        <div className="feature-counts-grid">
          <div className="feature-count-box">
            <div className="label">Hotels</div>
            <div className="value">{featuredCounts.hotels}</div>
          </div>
          <div className="feature-count-box">
            <div className="label">Shortlets</div>
            <div className="value">{featuredCounts.shortlets}</div>
          </div>
          <div className="feature-count-box">
            <div className="label">Restaurants</div>
            <div className="value">{featuredCounts.restaurants}</div>
          </div>
          <div className="feature-count-box">
            <div className="label">Event Centers</div>
            <div className="value">{featuredCounts.eventcenters}</div>
          </div>
        </div>
        <p style={{ marginTop: 8 }}>
          Total featured: <strong>{featuredCounts.total}</strong>
        </p>
        <a className="btn-link" href="/admin/explore-manager" style={{ marginTop: 8, display: 'inline-block' }}>
          Open Explore Manager →
        </a>
      </div>
    </div>
  );
};

export default AdminDashboard;
