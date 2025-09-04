// ✅ src/pages/ManagePayout.js
import React, { useEffect, useMemo, useState } from 'react';
import axios from '../utils/axiosConfig';
import './ManagePayout.css';

// UI filters we expose
const UI_STATUSES = ['submitted', 'pending', 'processing', 'paid', 'failed'];

export default function ManagePayout() {
  // views: vendor requests, user requests, records (all), balances
  const [view, setView] = useState('vendor'); // 'vendor' | 'user' | 'records' | 'balances'

  // shared
  const token = useMemo(() => localStorage.getItem('adminToken'), []);
  const authHeader = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  // -------- Requests tab state (vendor/user) --------
  const [reqStatus, setReqStatus] = useState('submitted'); // default "submitted"
  const [reqRows, setReqRows] = useState([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqErr, setReqErr] = useState('');

  // -------- Records tab --------
  const [recsType, setRecsType] = useState('all'); // all|vendor|user
  const [recsStatus, setRecsStatus] = useState('all'); // all|submitted|pending|processing|paid|failed
  const [recsRows, setRecsRows] = useState([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsErr, setRecsErr] = useState('');

  // -------- Balances tab --------
  const [balType, setBalType] = useState('vendor'); // vendor|user
  const [balRows, setBalRows] = useState([]);
  const [balLoading, setBalLoading] = useState(false);
  const [balErr, setBalErr] = useState('');
  const [sweepOpen, setSweepOpen] = useState(false);
  const [sweepMin, setSweepMin] = useState(5000);
  const [sweepLimit, setSweepLimit] = useState(200);
  const [sweepMsg, setSweepMsg] = useState('');

  // -------- Modals --------
  const [rowsModal, setRowsModal] = useState({ open: false, title: '', items: [] });
  const [confirmModal, setConfirmModal] = useState(null); // {payeeType, accountId, name, email, amount}

  const formatNaira = (n) => `₦${Number(n || 0).toLocaleString()}`;

  // shape requests/records payload to flat rows
  const shapeReqRows = (raw) => {
    const list = Array.isArray(raw?.data) ? raw.data : [];
    return list.map((p) => ({
      id: p._id,
      payeeType: p.payeeType,
      name: p.payeeName || '-',
      email: p.payeeEmail || '-',
      amount: typeof p.amountNum === 'number' ? p.amountNum : Number(p.amount || 0),
      status: p.uiStatus || p.status || 'pending',
      createdAt: p.createdAt || null,
    }));
  };

  // ---- data loaders
  const loadRequests = async () => {
    if (!(view === 'vendor' || view === 'user')) return;
    setReqLoading(true);
    setReqErr('');
    try {
      const res = await axios.get(
        `/api/admin/payouts?type=${view}&status=${reqStatus}`,
        { headers: authHeader }
      );
      setReqRows(shapeReqRows(res.data));
    } catch (e) {
      console.error('loadRequests error', e);
      setReqErr('Failed to load payout requests');
      setReqRows([]);
    } finally {
      setReqLoading(false);
    }
  };

  const loadRecords = async () => {
    if (view !== 'records') return;
    setRecsLoading(true);
    setRecsErr('');
    try {
      const qp = new URLSearchParams();
      qp.set('type', recsType);
      qp.set('status', recsStatus);
      const res = await axios.get(`/api/admin/payouts?${qp.toString()}`, {
        headers: authHeader,
      });
      setRecsRows(shapeReqRows(res.data));
    } catch (e) {
      console.error('loadRecords error', e);
      setRecsErr('Failed to load records');
      setRecsRows([]);
    } finally {
      setRecsLoading(false);
    }
  };

  const loadBalances = async () => {
    if (view !== 'balances') return;
    setBalLoading(true);
    setBalErr('');
    try {
      const res = await axios.get(
        `/api/admin/payouts/balances?payeeType=${balType}`,
        { headers: authHeader }
      );
      const rows = Array.isArray(res?.data?.rows) ? res.data.rows : [];
      setBalRows(rows.map((r) => ({
        accountId: r.accountId,
        name: r.name || '-',
        email: r.email || '-',
        amount: Number(r.amount || 0),
      })));
    } catch (e) {
      console.error('loadBalances error', e);
      setBalErr('Failed to load balances');
      setBalRows([]);
    } finally {
      setBalLoading(false);
    }
  };

  useEffect(() => { loadRequests(); /* eslint-disable-next-line */ }, [view, reqStatus]);
  useEffect(() => { loadRecords(); /* eslint-disable-next-line */ }, [view, recsType, recsStatus]);
  useEffect(() => { loadBalances(); /* eslint-disable-next-line */ }, [view, balType]);

  const refresh = () => {
    if (view === 'vendor' || view === 'user') loadRequests();
    else if (view === 'records') loadRecords();
    else loadBalances();
  };

  // ---- actions
  const changeStatus = async (id, next) => {
    try {
      await axios.patch(`/api/admin/payouts/${id}/status`, { status: next }, { headers: authHeader });
      refresh();
    } catch (e) {
      console.error('changeStatus error', e?.response?.data || e.message);
      alert(e?.response?.data?.message || 'Failed to update status');
    }
  };

  const openRows = async (payeeType, accountId, name) => {
    setRowsModal({ open: true, title: `Earning Rows — ${name}`, items: [{ loading: true }] });
    try {
      const res = await axios.get(`/api/admin/payouts/${payeeType}/${accountId}/rows`, { headers: authHeader });
      const items = Array.isArray(res?.data?.rows) ? res.data.rows : [];
      setRowsModal({ open: true, title: `Earning Rows — ${name}`, items });
    } catch (e) {
      console.error('openRows error', e);
      setRowsModal({ open: true, title: `Earning Rows — ${name}`, items: [] });
    }
  };

  const confirmCreate = (row) => {
    // balances row → create a payout request for full amount
    setConfirmModal({
      payeeType: balType,
      accountId: row.accountId,
      name: row.name,
      email: row.email,
      amount: row.amount,
    });
  };

  const createManual = async () => {
    if (!confirmModal) return;
    const payload = {
      payeeType: confirmModal.payeeType,
      payeeId: confirmModal.accountId,
      amount: Number(confirmModal.amount || 0),
    };
    setBusy(true);
    setToast('');
    try {
      await axios.post('/api/admin/payouts/manual', payload, { headers: authHeader });
      setToast('Payout request created.');
      setConfirmModal(null);
      // refresh requests list (so admin can process it)
      setView(confirmModal.payeeType === 'vendor' ? 'vendor' : 'user');
      setReqStatus('submitted');
    } catch (e) {
      console.error('createManual error', e?.response?.data || e.message);
      alert(e?.response?.data?.message || 'Failed to create payout request');
    } finally {
      setBusy(false);
    }
  };

  const runSweep = async () => {
    setBusy(true);
    setSweepMsg('');
    try {
      const body = {
        min: Number(sweepMin) || 5000,
        limit: Number(sweepLimit) || 200,
        type: 'all',
      };
      const res = await axios.post('/api/admin/payouts/sweep', body, { headers: authHeader });
      const moved = res?.data?.moved ?? 0;
      const skipped = res?.data?.skipped ?? 0;
      setSweepMsg(`Auto-sweep moved ${moved} request(s); skipped ${skipped}.`);
      refresh();
    } catch (e) {
      console.error('sweep error', e?.response?.data || e.message);
      alert(e?.response?.data?.message || 'Failed to run auto-sweep');
    } finally {
      setBusy(false);
    }
  };

  // ---- UI helpers
  const Empty = ({ okText }) => (
    <p style={{ marginTop: 12, color: '#666' }}>{okText || 'No items found.'}</p>
  );

  // row cell with change dropdown (+ optional extra buttons)
  const ActionCell = ({ id, status }) => {
    const options = ['submitted', 'pending', 'processing', 'paid', 'failed', 'cancelled', 'rejected'];
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select
          value={status}
          onChange={(e) => changeStatus(id, e.target.value)}
        >
          {options.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {status === 'failed' && (
          <button onClick={() => changeStatus(id, 'processing')}>Resend</button>
        )}
        {status === 'processing' && (
          <button onClick={() => changeStatus(id, 'cancelled')}>Cancel</button>
        )}
      </div>
    );
  };

  return (
    <div className="admin-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Manage Payouts</h2>
        <button onClick={refresh}>Refresh</button>
        <button onClick={() => setSweepOpen((s) => !s)}>
          {sweepOpen ? 'Hide Sweep Options' : 'Show Sweep Options'}
        </button>
        <button onClick={runSweep} disabled={busy}>{busy ? 'Running…' : 'Run Auto-Sweep'}</button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className={view === 'vendor' ? 'tab active' : 'tab'} onClick={() => setView('vendor')}>
            Vendor Requests
          </button>
          <button className={view === 'user' ? 'tab active' : 'tab'} onClick={() => setView('user')}>
            User Requests
          </button>
          <button className={view === 'records' ? 'tab active' : 'tab'} onClick={() => setView('records')}>
            Records
          </button>
          <button className={view === 'balances' ? 'tab active' : 'tab'} onClick={() => setView('balances')}>
            Balances
          </button>
        </div>
      </div>

      {sweepOpen && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <div>
            <label style={{ marginRight: 6 }}>Min (₦)</label>
            <input type="number" min={1000} value={sweepMin} onChange={(e) => setSweepMin(e.target.value)} style={{ width: 120 }} />
          </div>
          <div>
            <label style={{ marginRight: 6 }}>Limit</label>
            <input type="number" min={1} max={1000} value={sweepLimit} onChange={(e) => setSweepLimit(e.target.value)} style={{ width: 100 }} />
          </div>
          {sweepMsg && <span className="success">{sweepMsg}</span>}
        </div>
      )}

      {!!toast && <div className="success" style={{ marginBottom: 12 }}>{toast}</div>}

      {/* Vendor/User Requests */}
      {(view === 'vendor' || view === 'user') && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <label>Status</label>
            <select value={reqStatus} onChange={(e) => setReqStatus(e.target.value)}>
              {UI_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {reqLoading && <p>Loading requests…</p>}
          {reqErr && <p className="error">{reqErr}</p>}
          {!reqLoading && !reqErr && reqRows.length === 0 && <Empty okText="No payout requests yet." />}

          {!reqLoading && !reqErr && reqRows.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Payee</th>
                  <th>Email</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reqRows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.email}</td>
                    <td>{formatNaira(r.amount)}</td>
                    <td style={{ textTransform: 'capitalize' }}>{r.status}</td>
                    <td>{r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}</td>
                    <td><ActionCell id={r.id} status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* Records */}
      {view === 'records' && (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <label>Type</label>
            <select value={recsType} onChange={(e) => setRecsType(e.target.value)}>
              <option value="all">All</option>
              <option value="vendor">Vendor</option>
              <option value="user">User</option>
            </select>

            <label>Status</label>
            <select value={recsStatus} onChange={(e) => setRecsStatus(e.target.value)}>
              <option value="all">All</option>
              {UI_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {recsLoading && <p>Loading records…</p>}
          {recsErr && <p className="error">{recsErr}</p>}
          {!recsLoading && !recsErr && recsRows.length === 0 && <Empty okText="No records found." />}

          {!recsLoading && !recsErr && recsRows.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Payee</th>
                  <th>Email</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recsRows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.email}</td>
                    <td>{formatNaira(r.amount)}</td>
                    <td style={{ textTransform: 'capitalize' }}>{r.status}</td>
                    <td>{r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}</td>
                    <td><ActionCell id={r.id} status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* Balances */}
      {view === 'balances' && (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <label>Type</label>
            <select value={balType} onChange={(e) => setBalType(e.target.value)}>
              <option value="vendor">Vendor</option>
              <option value="user">User</option>
            </select>
          </div>

          {balLoading && <p>Loading balances…</p>}
          {balErr && <p className="error">{balErr}</p>}
          {!balLoading && !balErr && balRows.length === 0 && <Empty okText="No payable balances right now." />}

          {!balLoading && !balErr && balRows.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Payee</th>
                  <th>Email</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {balRows.map((r) => (
                  <tr key={`${r.accountId}`}>
                    <td>{r.name}</td>
                    <td>{r.email}</td>
                    <td>{formatNaira(r.amount)}</td>
                    <td>Available</td>
                    <td style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openRows(balType, r.accountId, r.name)}>View Rows</button>
                      <button onClick={() => confirmCreate(r)}>Create Payout</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* Rows Modal */}
      {rowsModal.open && (
        <div className="modal-overlay" onClick={() => setRowsModal({ open: false, title: '', items: [] })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <h3 style={{ marginTop: 0 }}>{rowsModal.title}</h3>
            <div style={{ maxHeight: 420, overflow: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Amount</th>
                    <th>Release On</th>
                    <th>Check-in</th>
                    <th>Check-out</th>
                    <th>Reason</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsModal.items.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 16 }}>No rows.</td></tr>
                  )}
                  {rowsModal.items.map((it, i) => (
                    <tr key={i}>
                      <td>{formatNaira(it.amount)}</td>
                      <td>{it.releaseOn ? new Date(it.releaseOn).toLocaleString() : '-'}</td>
                      <td>{it.checkInDate ? new Date(it.checkInDate).toLocaleDateString() : '-'}</td>
                      <td>{it.checkOutDate ? new Date(it.checkOutDate).toLocaleDateString() : '-'}</td>
                      <td>{it.reason || '-'}</td>
                      <td>{it.status || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => setRowsModal({ open: false, title: '', items: [] })}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Create Modal */}
      {confirmModal && (
        <div className="modal-overlay" onClick={() => !busy && setConfirmModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Create Payout</h3>
            <div style={{ lineHeight: 1.6 }}>
              <div><b>Payee:</b> {confirmModal.name} ({confirmModal.payeeType})</div>
              <div><b>Email:</b> {confirmModal.email}</div>
              <div><b>Amount:</b> {formatNaira(confirmModal.amount)}</div>
              <div style={{ marginTop: 8 }}>
                <b>Bank (snapshot)</b>
                <div style={{ color: '#666' }}>
                  Bank details will be snapshot from the payee profile (if available).
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              <button onClick={() => !busy && setConfirmModal(null)}>Close</button>
              <button onClick={createManual} disabled={busy}>
                {busy ? 'Creating…' : 'Confirm Payout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
