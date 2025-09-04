// 📄 src/pages/UserPayout.js
import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';

const currency = (n) => `₦${Number(n || 0).toLocaleString()}`;
const badge = (s) => `badge ${String(s || '').toLowerCase()}`;

export default function UserPayout() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('all');     // all | pending | paid | failed
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);    // default 20
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = async (p = page, ps = pageSize, st = status) => {
    setLoading(true);
    setErr('');
    try {
      const res = await axios.get('/api/user/payout-history', {
        params: { page: p, pageSize: ps, status: st },
      });
      const list = Array.isArray(res.data?.payouts) ? res.data.payouts : [];
      setRows(list);
      setTotal(Number(res.data?.total || list.length || 0));
      setTotalPages(Number(res.data?.totalPages || 1));
      setPage(p);
      setPageSize(ps);
      setStatus(st);
    } catch (e) {
      console.error('load payout-history error:', e);
      setErr('Failed to load payout history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1, pageSize, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChangeStatus = (e) => load(1, pageSize, e.target.value);
  const onChangePageSize = (e) => load(1, parseInt(e.target.value, 10) || 20, status);
  const prev = () => page > 1 && load(page - 1, pageSize, status);
  const next = () => page < totalPages && load(page + 1, pageSize, status);

  const showPager = total > pageSize; // 👈 only show pagination when we have 21+

  if (loading) return <div style={{ padding: '2rem' }}>Loading…</div>;
  if (err) return <div style={{ padding: '2rem', color: 'red' }}>{err}</div>;

  return (
    <div style={{ padding: '2rem' }}>
      <h3>Payout History</h3>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '0 0 12px' }}>
        <label>
          Filter:{' '}
          <select value={status} onChange={onChangeStatus}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
          </select>
        </label>

        {showPager && (
          <label>
            Page size:{' '}
            <select value={pageSize} onChange={onChangePageSize}>
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}

        <button className="secondary" onClick={() => load(page, pageSize, status)}>
          Refresh
        </button>

        {showPager && (
          <div style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.7 }}>
            {total} total • page {page} / {totalPages}
          </div>
        )}
      </div>

      <div className="table-wrapper">
        <table className="nice-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={i}>
                <td>{new Date(p.createdAt || Date.now()).toLocaleString()}</td>
                <td>{currency(p.amount)}</td>
                <td>
                  <span className={badge(p.uiStatus || p.status)}>
                    {String(p.uiStatus || p.status).toLowerCase()}
                  </span>
                </td>
                <td>{p.transferRef || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPager && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
          <button className="secondary" onClick={prev} disabled={page <= 1}>
            ← Prev
          </button>
          <span>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>
          </span>
          <button className="secondary" onClick={next} disabled={page >= totalPages}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
