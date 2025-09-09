// ✅ src/pages/UserDashboard.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from '../utils/axiosConfig';
import './UserDashboard.css';

const currency = (n) => `₦${Number(n || 0).toLocaleString()}`;
const getToken = () => localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
const normStatus = (s) => {
  const v = String(s || '').toLowerCase();
  if (v === 'paid') return 'paid';
  if (['failed', 'rejected', 'cancelled', 'canceled'].includes(v)) return 'failed';
  return 'pending';
};
const SHOW_PARTNER_BANKS = false;

/* -------------------------------------------
   Helpers
------------------------------------------- */
const normalizeAccountsResponse = (data) =>
  Array.isArray(data?.payoutAccounts) ? data.payoutAccounts :
  Array.isArray(data?.accounts) ? data.accounts : [];

// lock body scroll for bottom sheet
const useBodyScrollLock = (locked) => {
  useEffect(() => {
    if (!locked) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouch = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = prevOverflow || '';
      document.body.style.touchAction = prevTouch || '';
    };
  }, [locked]);
};

// detect mobile (≤640px) so we can switch to card lists
const useIsMobile = (breakpoint = 640) => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = (e) => setIsMobile(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    setIsMobile(mq.matches);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, [breakpoint]);
  return isMobile;
};

// Fixed full-screen bottom sheet rendered via portal
const BottomSheet = ({ open, title, onClose, children }) => {
  useBodyScrollLock(open);
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const node = (
    <div className="hp-sheet-overlay" role="dialog" aria-modal="true" aria-label={title || 'Dialog'}>
      <div className="hp-sheet" ref={sheetRef}>
        <div className="hp-sheet-header">
          <h3>{title}</h3>
          <button className="hp-sheet-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="hp-sheet-body">{children}</div>
      </div>
    </div>
  );
  return ReactDOM.createPortal(node, document.body);
};

// ---- Clean, non-clipping button styles (inline so they override old CSS) ----
const btnBase = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid transparent',
  lineHeight: 1.2,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  minHeight: 40,
};
const btnPrimary   = { ...btnBase, background: '#0a7f2e', color: '#fff' };
const btnSecondary = { ...btnBase, background: '#f3f4f6', color: '#111827', border: '1px solid #e5e7eb' };
const btnTiny      = { ...btnBase, padding: '8px 10px', minHeight: 34, fontWeight: 600 };
const tabStyle = (active) => ({
  ...btnBase,
  padding: '8px 12px',
  borderRadius: 8,
  background: active ? '#0a7f2e' : '#f3f4f6',
  color: active ? '#fff' : '#111827',
  border: active ? '1px solid #0a7f2e' : '1px solid #e5e7eb',
});

// mobile card styles
const listCard = {
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  background: '#fff',
  padding: 12,
  marginBottom: 10,
};
const listRow = { display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 4, fontSize: 13 };
const listLabel = { opacity: 0.7 };

/* -------------------------------------------
   Component
------------------------------------------- */
const UserDashboard = () => {
  const isMobile = useIsMobile();

  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');

  // Tabs
  const [activeTab, setActiveTab] = useState('earnings');

  // Modal + payout
  const [showModal, setShowModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutError, setPayoutError] = useState('');
  const [payoutSuccess, setPayoutSuccess] = useState('');

  // Accounts
  const [accounts, setAccounts] = useState([]);
  const [lockedIndex, setLockedIndex] = useState(null);
  const [partnerBanks, setPartnerBanks] = useState([]);

  // Add account (bottom sheet)
  const [sheetOpen, setSheetOpen] = useState(false);

  // Bank dropdown + verification
  const [banks, setBanks] = useState([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [selectedBankCode, setSelectedBankCode] = useState('');
  const [selectedBankName, setSelectedBankName] = useState('');

  const [newAccNumber, setNewAccNumber] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [addAccError, setAddAccError] = useState('');
  const [addAccSuccess, setAddAccSuccess] = useState('');
  const [nameCheckStatus, setNameCheckStatus] = useState(null); // null | 'ok' | 'mismatch' | 'checking'
  const [bankVerifyStatus, setBankVerifyStatus] = useState(null); // null | 'checking' | 'ok' | 'fail'
  const [savingAcc, setSavingAcc] = useState(false);

  // In-dashboard data
  const [referrals, setReferrals] = useState(null);
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [referralsFetched, setReferralsFetched] = useState(false);

  const [payoutHistory, setPayoutHistory] = useState(null);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutsFetched, setPayoutsFetched] = useState(false);

  const token = useMemo(getToken, []);
  const auth = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  // -------- Load dashboard + accounts (authoritative) --------
  useEffect(() => {
    if (!token) {
      setError('No token found');
      return;
    }
    const load = async () => {
      try {
        const [dashRes, accRes] = await Promise.all([
          axios.get('/api/user/dashboard', { headers: auth }),
          axios.get('/api/user/payout-accounts', { headers: auth }),
        ]);

        setDashboard(dashRes.data || null);

        const accs = normalizeAccountsResponse(accRes.data);
        setAccounts(accs);

        const li =
          typeof accRes.data?.lockedPayoutAccountIndex === 'number'
            ? accRes.data.lockedPayoutAccountIndex
            : typeof dashRes.data?.lockedPayoutAccountIndex === 'number'
            ? dashRes.data.lockedPayoutAccountIndex
            : null;
        setLockedIndex(li);

        setPartnerBanks(dashRes.data?.partnerBanks || []);
      } catch {
        setError('❌ Failed to load dashboard');
      }
    };
    load();
  }, [token, auth]);

  // Load banks when sheet opens the first time
  useEffect(() => {
    const fetchBanks = async () => {
      if (!sheetOpen || banks.length) return;
      setBanksLoading(true);
      try {
        const res = await axios.get('/api/user/banks', { headers: auth });
        const list = Array.isArray(res?.data?.banks) ? res.data.banks : [];
        list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
        setBanks(list);
      } catch {
        setAddAccError('Failed to load banks');
      } finally {
        setBanksLoading(false);
      }
    };
    fetchBanks();
  }, [sheetOpen, banks.length, auth]);

  // ---- Lazy loaders (mirror your working pages), always fetch on first open ----
  const fetchReferrals = async () => {
    setReferralsLoading(true);
    try {
      const res = await axios.get('/api/user/referrals', { headers: auth });
      const rows = Array.isArray(res?.data?.referrals) ? res.data.referrals : [];
      setReferrals(rows);
    } catch {
      setReferrals([]);
    } finally {
      setReferralsLoading(false);
      setReferralsFetched(true);
    }
  };

  const fetchPayoutHistory = async () => {
    setPayoutsLoading(true);
    try {
      const res = await axios.get('/api/user/payout-history', {
        headers: auth,
        params: { page: 1, pageSize: 20, status: 'all' },
      });
      const rows = Array.isArray(res?.data?.payouts) ? res.data.payouts : [];
      setPayoutHistory(rows);
    } catch {
      setPayoutHistory([]);
    } finally {
      setPayoutsLoading(false);
      setPayoutsFetched(true);
    }
  };

  // Trigger fetch when tab first opens (even if dashboard seed was empty)
  useEffect(() => {
    if (activeTab === 'referrals' && !referralsFetched) fetchReferrals();
    if (activeTab === 'history' && !payoutsFetched) fetchPayoutHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // -------- Derived helpers --------
  const payable   = Number(dashboard?.payableBalance || 0);
  const pending   = Number(dashboard?.currentBalance || 0);
  const minPayout = Number(dashboard?.minPayout || 5000);

  const firstHoldActive = !!dashboard?.firstPayoutHoldActive;
  const firstHoldUntil = dashboard?.firstPayoutHoldUntil
    ? new Date(dashboard.firstPayoutHoldUntil)
    : null;

  const lockedAccount =
    lockedIndex !== null && accounts?.[lockedIndex] ? accounts[lockedIndex] : null;

  const commissionNet   = Number(dashboard?.commissionEarned || 0);
  const cashbackNet     = Number(dashboard?.cashbackEarned || 0);
  const totalEarnedNet  = commissionNet + cashbackNet;

  const breakdowns = dashboard?.breakdowns || {};

  // -------- Payout modal handlers --------
  const openPayoutModal = () => {
    setShowModal(true);
    setPayoutAmount(payable);
    setPayoutError('');
    setPayoutSuccess('');
  };

  const validateAmount = (val) => {
    const n = Number(val);
    if (!Number.isFinite(n) || n <= 0) return 'Enter a valid amount';
    if (n < minPayout) return `Minimum payout is ${currency(minPayout)}.`;
    if (n > payable) return `You have exceeded your payable balance (${currency(payable)}).`;
    return '';
  };

  const handlePayoutSubmit = async () => {
    const n = Number(payoutAmount);
    const errMsg = validateAmount(n);
    if (errMsg) {
      setPayoutError(errMsg);
      setPayoutSuccess('');
      return;
    }
    if (firstHoldActive) {
      setPayoutError(
        `Your first payout unlocks on ${firstHoldUntil?.toLocaleString?.() || ''}`
      );
      setPayoutSuccess('');
      return;
    }
    if (!lockedAccount) {
      setPayoutError('Please add and lock a payout account first');
      setPayoutSuccess('');
      return;
    }

    try {
      const res = await axios.post(
        '/api/user/request-payout',
        { amount: n },
        { headers: auth }
      );
      setPayoutSuccess(res.data?.message || 'Payout requested successfully');
      setPayoutError('');
      const fresh = await axios.get('/api/user/dashboard', { headers: auth });
      setDashboard(fresh.data || null);
      setShowModal(false);
      if (activeTab === 'history') fetchPayoutHistory();
    } catch (err) {
      setPayoutError(err?.response?.data?.message || 'Failed to request payout');
      setPayoutSuccess('');
    }
  };

  // -------- Accounts helpers --------
  const refreshAccounts = async () => {
    try {
      const res = await axios.get('/api/user/payout-accounts', { headers: auth });
      const accs = normalizeAccountsResponse(res.data);
      setAccounts(accs);
      setLockedIndex(
        typeof res.data?.lockedPayoutAccountIndex === 'number'
          ? res.data.lockedPayoutAccountIndex
          : null
      );
      if (Array.isArray(res.data?.partnerBanks)) setPartnerBanks(res.data.partnerBanks);
    } catch {
      /* ignore */
    }
  };

  const runNameMatchCheck = async (name) => {
    setNameCheckStatus('checking');
    setAddAccError('');
    try {
      const res = await axios.post(
        '/api/user/validate-account-name',
        { accountName: name },
        { headers: auth }
      );
      setNameCheckStatus(res.data?.ok ? 'ok' : 'mismatch');
      if (!res.data?.ok) {
        setAddAccError('Name mismatch: account name must match your HotelPennies profile name.');
      }
    } catch {
      setNameCheckStatus(null);
      setAddAccError('Name validation failed');
    }
  };

  const verifyWithBank = async () => {
    setAddAccSuccess('');
    setAddAccError('');
    setBankVerifyStatus('checking');

    if (!selectedBankCode) {
      setAddAccError('Select your bank.');
      setBankVerifyStatus(null);
      return;
    }
    if (!/^\d{10}$/.test(String(newAccNumber))) {
      setAddAccError('Account number must be 10 digits.');
      setBankVerifyStatus(null);
      return;
    }

    try {
      const res = await axios.post(
        '/api/user/banks/resolve',
        { accountNumber: newAccNumber, bankCode: selectedBankCode },
        { headers: auth }
      );
      const resolvedName = res?.data?.accountName || '';
      if (!resolvedName) {
        setBankVerifyStatus('fail');
        setAddAccError('Could not resolve account name. Please check details.');
        return;
      }
      setNewAccName(resolvedName);
      setBankVerifyStatus('ok');
      await runNameMatchCheck(resolvedName);
    } catch (e) {
      setBankVerifyStatus('fail');
      setAddAccError(e?.response?.data?.message || 'Failed to verify with bank');
    }
  };

  const handleAddAccount = async () => {
    setAddAccSuccess('');
    setAddAccError('');

    if (!selectedBankCode || !selectedBankName || !newAccNumber || !newAccName) {
      setAddAccError('Please fill all fields (bank, account number, account name).');
      return;
    }
    if (!/^\d{10}$/.test(String(newAccNumber))) {
      setAddAccError('Account number must be 10 digits.');
      return;
    }
    if (bankVerifyStatus !== 'ok') {
      setAddAccError('Please verify account with bank first.');
      return;
    }
    if (nameCheckStatus !== 'ok') {
      setAddAccError('Please ensure the account name matches your profile.');
      return;
    }

    setSavingAcc(true);
    try {
      const updated = [
        ...(accounts || []),
        {
          bankName: selectedBankName,
          bankCode: selectedBankCode,
          accountNumber: newAccNumber,
          accountName: newAccName,
        },
      ];

      const res = await axios.put(
        '/api/user/payout-accounts',
        { accounts: updated },
        { headers: auth }
      );

      const saved = normalizeAccountsResponse(res.data);
      if (saved.length) {
        setAccounts(saved);
        setLockedIndex(
          typeof res.data?.lockedPayoutAccountIndex === 'number'
            ? res.data.lockedPayoutAccountIndex
            : lockedIndex
        );
      } else {
        await refreshAccounts();
      }

      setAddAccSuccess('Account added.');
      // reset form
      setSelectedBankCode('');
      setSelectedBankName('');
      setNewAccNumber('');
      setNewAccName('');
      setNameCheckStatus(null);
      setBankVerifyStatus(null);

      setSheetOpen(false);
    } catch (err) {
      setAddAccError(err?.response?.data?.message || 'Failed to add account');
    } finally {
      setSavingAcc(false);
    }
  };

  const handleLockAccount = async (index) => {
    try {
      await axios.post(
        '/api/user/lock-payout-account',
        { index },
        { headers: auth }
      );
      await refreshAccounts();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to lock payout account');
    }
  };

  // ---- Sections (tabs) ----
  const EarningsSection = () => (
    <>
      <div className="card">
        <h2>Welcome back, {dashboard.name}</h2>
        <p><strong>Referral Code:</strong> {dashboard.userCode}</p>
        <p>
          <strong>Affiliate Link:</strong>{' '}
          <a href={dashboard.affiliateLink} target="_blank" rel="noopener noreferrer">
            {dashboard.affiliateLink}
          </a>
        </p>
        <p><strong>Email Verified:</strong> {dashboard.isEmailVerified ? '✅ Yes' : '❌ No'}</p>
        {firstHoldActive && (
          <div className="info-banner" style={{ marginTop: 8 }}>
            First payout unlocks on <strong>{firstHoldUntil?.toLocaleString?.()}</strong>.
          </div>
        )}
      </div>

      <div className="card">
        <h3>Earnings & Balances</h3>
        <div className="dashboard-grid">
          <div className="sub-card">
            <p><strong>Total Earned (Net)</strong></p>
            <p>{currency(totalEarnedNet)}</p>
          </div>

          <div className="sub-card">
            <p><strong>Current Balance (Pending)</strong></p>
            <p>{currency(pending)}</p>
            <div className="hint" style={{ fontSize: 11, marginTop: 4 }}>
              Matches your ledger pending balance.
            </div>
          </div>

          <div className="sub-card">
            <p><strong>Payable Balance</strong></p>
            <p>{currency(payable)}</p>
            <div className="hint" style={{ fontSize: 11, marginTop: 4 }}>
              Ready to withdraw.
            </div>
          </div>

          <div className="sub-card">
            <p><strong>Monthly Earnings (Net)</strong></p>
            <p>{currency(dashboard?.monthlyEarnings || 0)}</p>
          </div>

          <div className="sub-card">
            <p><strong>Referrals</strong></p>
            <p>{dashboard?.referralCount || 0}</p>
          </div>

          <div className="sub-card">
            <p><strong>Cashback Earned</strong></p>
            <p>{currency(cashbackNet)}</p>
            {breakdowns?.cashback && (
              <div className="hint" style={{ fontSize: 11, marginTop: 4 }}>
                Net = gross ({currency(breakdowns.cashback.gross)}) − reversals ({currency(breakdowns.cashback.reversed)})
              </div>
            )}
          </div>

          <div className="sub-card">
            <p><strong>Commission Earned</strong></p>
            <p>{currency(commissionNet)}</p>
            {breakdowns?.commission && (
              <div className="hint" style={{ fontSize: 11, marginTop: 4 }}>
                Net = gross ({currency(breakdowns.commission.gross)}) − reversals ({currency(breakdowns.commission.reversed)})
              </div>
            )}
          </div>

          <div className="sub-card">
            <p><strong>Payout Eligible</strong></p>
            <p>{payable >= minPayout ? '✅ Yes' : `❌ No (${currency(minPayout)} min.)`}</p>
          </div>

          <div className="sub-card">
            <p><strong>Action</strong></p>
            <button
              style={btnPrimary}
              onClick={openPayoutModal}
              disabled={payable < minPayout || firstHoldActive || !lockedAccount}
              title={
                !lockedAccount
                  ? 'Add and lock a payout account first'
                  : payable < minPayout
                  ? `Minimum payout is ${currency(minPayout)}`
                  : firstHoldActive
                  ? `First payout unlocks on ${firstHoldUntil?.toLocaleString?.()}`
                  : 'Request Payout'
              }
            >
              Request Payout
            </button>
            <div className="hint" style={{ marginTop: 6, fontSize: 12 }}>
              Available to withdraw: <strong>{currency(payable)}</strong>
              {'  •  '}Minimum payout: <strong>{currency(minPayout)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Payout accounts + "Add account" as bottom sheet trigger */}
      <div className="card">
        <h3>Payout Accounts</h3>

        {SHOW_PARTNER_BANKS && !!partnerBanks?.length && (
          <div style={{ marginBottom: 12 }}>
            {/* intentionally hidden — marketing cards removed */}
          </div>
        )}

        {/* Desktop table */}
        {!isMobile && (
          <div
            className="table-wrapper"
            style={{ marginTop: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}
          >
            {(!accounts || accounts.length === 0) ? (
              <p>No payout accounts yet.</p>
            ) : (
              <table className="nice-table" style={{ minWidth: 720 }}>
                <thead>
                  <tr>
                    <th>Bank</th>
                    <th>Account Number</th>
                    <th>Account Name</th>
                    <th>Locked</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((acc, i) => (
                    <tr key={i}>
                      <td>{acc.bankName || '—'}</td>
                      <td>{acc.accountNumber}</td>
                      <td>{acc.accountName}</td>
                      <td>{lockedIndex === i ? '✅' : '—'}</td>
                      <td>
                        {lockedIndex === i ? (
                          <span className="badge paid">Active</span>
                        ) : (
                          <button style={btnTiny} onClick={() => handleLockAccount(i)}>Lock</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Mobile card list */}
        {isMobile && (
          <div style={{ marginTop: 12 }}>
            {(!accounts || accounts.length === 0) ? (
              <p>No payout accounts yet.</p>
            ) : (
              accounts.map((acc, i) => (
                <div key={i} style={listCard}>
                  <div style={listRow}><span style={listLabel}>Bank</span><span>{acc.bankName || '—'}</span></div>
                  <div style={listRow}><span style={listLabel}>Account No.</span><span>{acc.accountNumber}</span></div>
                  <div style={listRow}><span style={listLabel}>Account Name</span><span>{acc.accountName}</span></div>
                  <div style={listRow}><span style={listLabel}>Locked</span><span>{lockedIndex === i ? '✅' : '—'}</span></div>
                  <div style={{ marginTop: 8 }}>
                    {lockedIndex === i ? (
                      <span className="badge paid">Active</span>
                    ) : (
                      <button style={{ ...btnTiny, width: '100%' }} onClick={() => handleLockAccount(i)}>Lock</button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <div className="btns" style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button
            style={btnPrimary}
            onClick={() => { 
              setAddAccError(''); 
              setAddAccSuccess(''); 
              setSelectedBankCode(''); 
              setSelectedBankName(''); 
              setNewAccNumber(''); 
              setNewAccName(''); 
              setNameCheckStatus(null);
              setBankVerifyStatus(null);
              setSheetOpen(true); 
            }}
          >
            Add Account
          </button>
          <button style={btnSecondary} onClick={refreshAccounts}>Refresh</button>
        </div>
      </div>
    </>
  );

  const ReferralsSection = () => {
    const rows = Array.isArray(referrals) ? referrals : [];
    return (
      <div className="card">
        <h3>My Referrals</h3>
        {referralsLoading && !rows.length ? (
          <p>Loading referrals…</p>
        ) : !rows.length ? (
          <p>No referrals yet.</p>
        ) : (
          <>
            {/* Desktop table */}
            {!isMobile && (
              <div
                className="table-wrapper"
                style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}
              >
                <table className="nice-table" style={{ minWidth: 680 }}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Email Verified</th>
                      <th>Total Spent</th>
                      <th>Referred At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td>{r.name || '—'}</td>
                        <td style={{ wordBreak: 'break-all' }}>{r.email || '—'}</td>
                        <td>{r.isEmailVerified ? '✅' : '❌'}</td>
                        <td>{currency(r.totalSpent || 0)}</td>
                        <td>{r.referredAt ? new Date(r.referredAt).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Mobile card list */}
            {isMobile && (
              <div>
                {rows.map((r, i) => (
                  <div key={i} style={listCard}>
                    <div style={{ fontWeight: 600 }}>{r.name || '—'}</div>
                    <div style={listRow}><span style={listLabel}>Email</span><span style={{ wordBreak: 'break-all' }}>{r.email || '—'}</span></div>
                    <div style={listRow}><span style={listLabel}>Verified</span><span>{r.isEmailVerified ? '✅' : '❌'}</span></div>
                    <div style={listRow}><span style={listLabel}>Total Spent</span><span>{currency(r.totalSpent || 0)}</span></div>
                    <div style={listRow}><span style={listLabel}>Referred At</span><span>{r.referredAt ? new Date(r.referredAt).toLocaleString() : '—'}</span></div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const HistorySection = () => {
    const payouts = Array.isArray(payoutHistory) ? payoutHistory : [];
    return (
      <div className="card">
        <h3>Payout History</h3>
        {payoutsLoading && !payouts.length ? (
          <p>Loading payout history…</p>
        ) : !payouts.length ? (
          <p>No payout history yet.</p>
        ) : (
          <>
            {/* Desktop table */}
            {!isMobile && (
              <div
                className="table-wrapper"
                style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}
              >
                <table className="nice-table" style={{ minWidth: 640 }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts
                      .slice()
                      .sort(
                        (a, b) =>
                          new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0)
                      )
                      .map((p, i) => (
                        <tr key={i}>
                          <td>{new Date(p.createdAt || p.date || Date.now()).toLocaleString()}</td>
                          <td>{currency(p.amount)}</td>
                          <td>
                            <span className={`badge ${normStatus(p.uiStatus ?? p.status)}`}>
                              {normStatus(p.uiStatus ?? p.status)}
                            </span>
                          </td>
                          <td style={{ wordBreak: 'break-all' }}>{p.transferRef || '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Mobile card list */}
            {isMobile && (
              <div>
                {payouts
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0)
                  )
                  .map((p, i) => (
                    <div key={i} style={listCard}>
                      <div style={{ fontWeight: 600 }}>{currency(p.amount)}</div>
                      <div style={listRow}><span style={listLabel}>Date</span><span>{new Date(p.createdAt || p.date || Date.now()).toLocaleString()}</span></div>
                      <div style={listRow}><span style={listLabel}>Status</span><span className={`badge ${normStatus(p.uiStatus ?? p.status)}`}>{normStatus(p.uiStatus ?? p.status)}</span></div>
                      <div style={listRow}><span style={listLabel}>Reference</span><span style={{ wordBreak: 'break-all' }}>{p.transferRef || '—'}</span></div>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const ProfileSection = () => (
    <div className="card">
      <h3>Profile</h3>
      <div className="profile-grid">
        <div><strong>Name:</strong> {dashboard.name || '—'}</div>
        <div><strong>Email:</strong> {dashboard.email || '—'}</div>
        <div><strong>Phone:</strong> {dashboard.phone || '—'}</div>
        <div><strong>Address:</strong> {dashboard.address || '—'}</div>
        <div><strong>Email Verified:</strong> {dashboard.isEmailVerified ? '✅ Yes' : '❌ No'}</div>
      </div>
      <p className="hint" style={{ marginTop: 8 }}>
        To edit your details, use the Edit Profile page if enabled in your routes.
      </p>
    </div>
  );

  if (error) return <div className="dashboard-error">{error}</div>;
  if (!dashboard) return <p className="dashboard-loading">Loading dashboard...</p>;

  return (
    <>
      <div className="tab-bar" style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={tabStyle(activeTab === 'earnings')} onClick={() => setActiveTab('earnings')}>My Earnings</button>
        <button style={tabStyle(activeTab === 'referrals')} onClick={() => setActiveTab('referrals')}>My Referrals</button>
        <button style={tabStyle(activeTab === 'history')} onClick={() => setActiveTab('history')}>Payout History</button>
        <button style={tabStyle(activeTab === 'profile')} onClick={() => setActiveTab('profile')}>Profile</button>
      </div>

      {activeTab === 'earnings' && <EarningsSection />}
      {activeTab === 'referrals' && <ReferralsSection />}
      {activeTab === 'history' && <HistorySection />}
      {activeTab === 'profile' && <ProfileSection />}

      {/* Payout Modal */}
      {showModal && (
        <div className="payout-modal-overlay">
          <div className="payout-modal">
            <button className="modal-close" onClick={() => setShowModal(false)}>✖</button>
            <h3>Request Payout</h3>
            <p className="hint" style={{ marginBottom: 6 }}>
              Available to withdraw: <strong>{currency(payable)}</strong>
              {'  •  '}Minimum payout: <strong>{currency(minPayout)}</strong>
            </p>
            <input
              type="number"
              value={payoutAmount}
              onChange={(e) => {
                setPayoutAmount(e.target.value);
                setPayoutError(validateAmount(e.target.value));
                setPayoutSuccess('');
              }}
              className="payout-input"
              placeholder="Amount (₦)"
            />
            {payoutError && <p className="error-text">{payoutError}</p>}
            {payoutSuccess && <p className="success-text">{payoutSuccess}</p>}
            <div className="modal-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={handlePayoutSubmit}
                style={btnPrimary}
                disabled={
                  !!validateAmount(payoutAmount) ||
                  firstHoldActive ||
                  !lockedAccount
                }
                title={
                  !lockedAccount
                    ? 'Add and lock a payout account first'
                    : firstHoldActive
                    ? `First payout unlocks on ${firstHoldUntil?.toLocaleString?.()}`
                    : validateAmount(payoutAmount) || 'Submit'
                }
              >
                Submit
              </button>
              <button onClick={() => setShowModal(false)} style={btnSecondary}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔒 Bottom sheet for “Add Account” */}
      <BottomSheet
        open={sheetOpen}
        title="Add Payout Account"
        onClose={() => setSheetOpen(false)}
      >
        <div className="account-form" style={{ marginTop: 4 }}>
          <div className="account-grid">
            {/* Bank dropdown */}
            <div>
              <label className="small-label">Bank</label>
              <select
                value={selectedBankCode}
                onChange={(e) => {
                  const code = e.target.value;
                  const b = banks.find((x) => x.code === code);
                  setSelectedBankCode(code);
                  setSelectedBankName(b ? b.name : '');
                  setBankVerifyStatus(null);
                }}
                disabled={banksLoading}
                style={{ ...btnSecondary, padding: '10px 12px', width: '100%' }}
              >
                <option value="">{banksLoading ? 'Loading banks…' : 'Select bank'}</option>
                {banks.map((b) => (
                  <option key={b.code} value={b.code}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Account number */}
            <div>
              <label className="small-label">Account Number</label>
              <input
                placeholder="10-digit account number"
                value={newAccNumber}
                onChange={(e) => {
                  setNewAccNumber(e.target.value.replace(/\D/g, '').slice(0, 10));
                  setBankVerifyStatus(null);
                }}
                inputMode="numeric"
                pattern="\d*"
                style={{ ...btnSecondary, padding: '10px 12px', width: '100%' }}
              />
            </div>

            {/* Resolved account name */}
            <div>
              <label className="small-label">Account Name</label>
              <input
                placeholder="Account Name (from bank)"
                value={newAccName}
                onChange={(e) => {
                  setNewAccName(e.target.value);
                  setNameCheckStatus(null);
                }}
                style={{ ...btnSecondary, padding: '10px 12px', width: '100%' }}
              />
            </div>

            {/* Verify with bank + profile match */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button style={btnSecondary} onClick={verifyWithBank} disabled={banksLoading}>
                {bankVerifyStatus === 'checking' ? 'Verifying…' : 'Verify with Bank'}
              </button>
              {bankVerifyStatus === 'checking' && <span className="hint namecheck-slot">Checking…</span>}
              {bankVerifyStatus === 'ok' && <span className="badge paid namecheck-slot">Verified ✓</span>}
              {bankVerifyStatus === 'fail' && <span className="badge failed namecheck-slot">Not found</span>}

              <button
                style={btnSecondary}
                onClick={() => runNameMatchCheck(newAccName)}
                disabled={!newAccName}
              >
                Validate Name Match
              </button>
              {nameCheckStatus === 'checking' && <span className="hint namecheck-slot">Matching…</span>}
              {nameCheckStatus === 'ok' && <span className="badge paid namecheck-slot">Match ✓</span>}
              {nameCheckStatus === 'mismatch' && <span className="badge failed namecheck-slot">Mismatch</span>}
            </div>
          </div>

          {addAccError && <p className="error-text" style={{ marginTop: 6 }}>{addAccError}</p>}
          {addAccSuccess && <p className="success-text" style={{ marginTop: 6 }}>{addAccSuccess}</p>}

          <div className="btns" style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button
              onClick={handleAddAccount}
              style={btnPrimary}
              disabled={savingAcc || bankVerifyStatus !== 'ok' || nameCheckStatus !== 'ok'}
              title={
                bankVerifyStatus !== 'ok'
                  ? 'Verify with bank first'
                  : nameCheckStatus !== 'ok'
                  ? 'Validate name match first'
                  : 'Save Account'
              }
            >
              {savingAcc ? 'Saving…' : 'Save Account'}
            </button>
            <button style={btnSecondary} onClick={() => setSheetOpen(false)} disabled={savingAcc}>
              Cancel
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
};

export default UserDashboard;
