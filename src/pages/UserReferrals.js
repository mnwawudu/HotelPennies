// 📄 src/pages/UserReferrals.js
import React, { useEffect, useState, useMemo } from 'react';
import axios from '../utils/axiosConfig';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';

const asCurrency = (n) => `₦${Number(n || 0).toLocaleString()}`;
const monthNum = (d) => new Date(d).getMonth();

export default function UserReferrals() {
  const [referrals, setReferrals] = useState([]);
  const [conversions, setConversions] = useState([]);
  const [error, setError] = useState('');
  const [filterMonth, setFilterMonth] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [r1, r2] = await Promise.all([
          axios.get('/api/user/referrals'),
          axios.get('/api/user/referral-conversions'),
        ]);
        if (cancelled) return;
        setReferrals(Array.isArray(r1.data?.referrals) ? r1.data.referrals : []);
        setConversions(Array.isArray(r2.data?.conversions) ? r2.data.conversions : []);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) setError('Please log in to view your referrals.');
        else setError('Failed to load referrals/conversions.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (filterMonth === 'all') return conversions;
    const m = parseInt(filterMonth, 10);
    return conversions.filter((c) => monthNum(c.date) === m);
  }, [conversions, filterMonth]);

  const totalCommission = useMemo(
    () => filtered.reduce((acc, curr) => acc + Number(curr.amountEarned || 0), 0),
    [filtered]
  );

  const exportCSV = () => {
    const csv = Papa.unparse(
      filtered.map((c) => ({
        referralId: c.referralId || '—',
        bookingId: c.bookingId || '—',
        amountEarned: c.amountEarned || 0,
        date: new Date(c.date).toISOString(),
      }))
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'referral_conversions.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [['Referral ID', 'Booking ID', 'Amount Earned', 'Date']],
      body: filtered.map((c) => [
        c.referralId || '—',
        c.bookingId || '—',
        asCurrency(c.amountEarned || 0),
        new Date(c.date).toLocaleDateString(),
      ]),
    });
    doc.save('referral_conversions.pdf');
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading…</div>;

  return (
    <div style={{ padding: '2rem' }}>
      <h2>My Referrals</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <h3>Referrals List</h3>
      {!referrals.length ? (
        <p>No referrals yet.</p>
      ) : (
        <ul>
          {referrals.map((ref, idx) => (
            <li key={ref._id || idx}>
              {ref.name || '—'} — {ref.email || '—'}{' '}
              (Joined: {ref.createdAt ? new Date(ref.createdAt).toLocaleDateString() : '—'})
            </li>
          ))}
        </ul>
      )}

      <hr />

      <h3>Referral Conversions</h3>
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="filter">Filter by Month: </label>{' '}
        <select id="filter" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
          <option value="all">All</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i}>
              {new Date(0, i).toLocaleString('default', { month: 'long' })}
            </option>
          ))}
        </select>
      </div>

      {!conversions.length ? (
        <p>No conversions yet.</p>
      ) : (
        <div>
          <p><strong>Total Commission (filtered):</strong> {asCurrency(totalCommission)}</p>
          <button onClick={exportCSV} style={{ marginRight: '1rem' }}>Export CSV</button>
          <button onClick={exportPDF}>Export PDF</button>

          <table style={{ marginTop: '1rem', width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={cellStyle}>Referral ID</th>
                <th style={cellStyle}>Booking ID</th>
                <th style={cellStyle}>Amount Earned</th>
                <th style={cellStyle}>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={i}>
                  <td style={cellStyle}>{c.referralId || '—'}</td>
                  <td style={cellStyle}>{c.bookingId || '—'}</td>
                  <td style={cellStyle}>{asCurrency(c.amountEarned || 0)}</td>
                  <td style={cellStyle}>{new Date(c.date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const cellStyle = { border: '1px solid #ccc', padding: '8px', textAlign: 'left' };
