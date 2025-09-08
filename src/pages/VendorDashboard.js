import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import VendorSidebar from '../components/VendorSidebar';
// ⛔️ removed ContinueRegistrationModal
import './VendorDashboard.css';

const currency = (n) => `₦${Number(n || 0).toLocaleString()}`;
const monthStart = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);

// payout history status normalizer (keep existing visual mapping)
const normStatus = (s) => {
  const v = String(s || '').toLowerCase();
  if (v === 'paid') return 'paid';
  if (['failed', 'rejected', 'cancelled', 'canceled'].includes(v)) return 'failed';
  return 'pending';
};

// booking-table badge class (keep label “cancelled”, style like “failed”)
const badgeClassForBookingStatus = (s) => {
  const v = String(s || '').toLowerCase();
  if (v === 'paid') return 'paid';
  if (v === 'cancelled' || v === 'canceled' || v === 'failed' || v === 'rejected') return 'failed';
  return 'pending';
};

const InlineKycBanner = ({ vendor, onGoProfile }) => {
  if (!vendor || vendor.isFullyVerified) return null;
  const status = vendor.kycStatus || 'PENDING';

  const tone = status === 'APPROVED' ? '#0a7f3a'
            : status === 'REJECTED' ? '#a30d0d'
            : status === 'PROCESSING' ? '#a67c00'
            : '#6b5d33';

  return (
    <div
      style={{
        background: '#fff8e1',
        border: '1px solid #ffe8a1',
        padding: '10px 12px',
        borderRadius: 8,
        margin: '0 0 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }}
      role="region"
      aria-label="Verification status"
    >
      <div style={{ fontWeight: 600, color: '#5a4b1a' }}>
        Finish verification to unlock listings & payouts.
      </div>
      <span
        style={{
          marginLeft: 'auto',
          fontSize: 12,
          padding: '2px 8px',
          borderRadius: 999,
          background: tone,
          color: 'white'
        }}
      >
        {status}
      </span>
      <button
        onClick={onGoProfile}
        className="secondary"
        style={{ marginLeft: 6 }}
      >
        Continue setup
      </button>
    </div>
  );
};

/* 🔷 Non-blocking Vendor Agreement banner (no dates).
   Clause: "By publishing a listing on HotelPennies, you agree to the Vendor Agreement."
   Dismissible; can be re-shown from Support tab; auto-stays hidden after signing. */
const InlineVendorAgreementBanner = ({
  accepted,
  hidden,
  onHide,
  onOpenAgreement,
  onAgree,
}) => {
  if (accepted || hidden) return null;

  return (
    <div
      style={{
        background: '#EEF6FF',
        border: '1px solid #BBD7FF',
        padding: '10px 12px',
        borderRadius: 8,
        margin: '0 0 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }}
      role="region"
      aria-label="Vendor agreement notice"
    >
      <div style={{ color: '#0a2540', lineHeight: 1.4 }}>
        By <b>publishing a listing</b> on HotelPennies, you agree to the{' '}
        <button
          onClick={onOpenAgreement}
          className="linklike"
          style={{ border: 'none', background: 'transparent', textDecoration: 'underline', color: '#0a3d62', cursor: 'pointer', padding: 0 }}
          aria-label="Open Vendor Agreement"
          type="button"
        >
          Vendor Agreement
        </button>.
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <button
          onClick={onAgree}
          type="button"
        >
          I Agree
        </button>
        <button
          onClick={onHide}
          className="secondary"
          aria-label="Hide agreement notice"
          type="button"
        >
          Hide
        </button>
      </div>
    </div>
  );
};

// 🔐 Banner persistence (TTL hide for 7 days; permanent hide after accept)
const AGREE_HIDE_KEY = 'hp-vendor-agree-banner-hide-until';
const AGREE_HIDE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const VendorDashboard = () => {
  const [vendor, setVendor] = useState(null);
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('analytics');

  // Live payouts/balances + min payout from /api/payouts/me
  const [payouts, setPayouts] = useState([]);
  const [balances, setBalances] = useState({ payableBalance: 0, available: 0, onHold: 0 });
  const [minPayout, setMinPayout] = useState(null);

  // Vendor-share breakdown/events
  const [vendorShare, setVendorShare] = useState(null);
  const [vendorShareEvents, setVendorShareEvents] = useState([]);
  const [showVendorShareDetails, setShowVendorShareDetails] = useState(false);

  // Layout
  const initialDesktop = typeof window !== 'undefined' ? window.innerWidth >= 992 : true;
  const [isDesktop, setIsDesktop] = useState(initialDesktop);
  const [isSidebarOpen, setIsSidebarOpen] = useState(initialDesktop);

  // Inputs & messages
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [newAccount, setNewAccount] = useState({ bankName: '', accountNumber: '', accountName: '' });
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [editedProfile, setEditedProfile] = useState({});
  const [loading, setLoading] = useState(true);
  const [lockMessage, setLockMessage] = useState('');

  // Booking table UX: filters + pagination
  const [statusFilter, setStatusFilter] = useState('all');     // all | paid | cancelled | pending
  const [typeFilter, setTypeFilter] = useState('all');         // all | hotel | shortlet | eventcenter | restaurant | tourguide
  const [search, setSearch] = useState('');
  const [bookPage, setBookPage] = useState(1);
  const [bookPageSize, setBookPageSize] = useState(25);        // 10 | 25 | 50 | 100

  // Vendor Agreement: meta + UI control
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [agreementHash, setAgreementHash] = useState(null);
  const [agreeBannerHidden, setAgreeBannerHidden] = useState(false);
  const [agreementLoading, setAgreementLoading] = useState(true);

  const location = useLocation();

  const token = useMemo(
    () => localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken'),
    []
  );
  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  useEffect(() => {
    const onResize = () => {
      const nowDesktop = window.innerWidth >= 992;
      setIsDesktop(nowDesktop);
      if (nowDesktop) setIsSidebarOpen(true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  useEffect(() => { if (!isDesktop) setIsSidebarOpen(false); }, [location.pathname, isDesktop]);
  const handleSidebarNavigate = () => { if (!isDesktop) setIsSidebarOpen(false); };

  // Agreement: load hidden flag (TTL-based) & meta (accepted/hash)
  useEffect(() => {
    try {
      const until = Number(localStorage.getItem(AGREE_HIDE_KEY) || 0);
      if (until > Date.now()) {
        setAgreeBannerHidden(true);
      } else {
        localStorage.removeItem(AGREE_HIDE_KEY);
        setAgreeBannerHidden(false);
      }
    } catch {}
  }, []);
  useEffect(() => {
    (async () => {
      if (!token) { setAgreementLoading(false); return; }
      try {
        const { data } = await axios.get('/api/vendor-agreement/meta', { headers: authHeaders });
        setAgreementAccepted(!!data?.accepted);
        setAgreementHash(data?.hash || null);
      } catch {
        // meta endpoint missing or failed — keep defaults (banner becomes manual)
      } finally {
        setAgreementLoading(false);
      }
    })();
  }, [token, authHeaders]);

  // Once accepted, keep banner hidden permanently
  useEffect(() => {
    if (agreementAccepted) {
      try { localStorage.removeItem(AGREE_HIDE_KEY); } catch {}
      setAgreeBannerHidden(true);
    }
  }, [agreementAccepted]);

  const openVendorAgreement = useCallback(async () => {
    try {
      const res = await axios.get('/api/vendor-agreement/file', {
        headers: authHeaders,
        responseType: 'blob',
      });
      const blobUrl = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      // Optionally revoke later: setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (e) {
      alert(e?.response?.data?.message || 'Could not open Vendor Agreement.');
    }
  }, [authHeaders]);

  const hideAgreementBanner = useCallback(() => {
    try {
      const hideUntil = Date.now() + AGREE_HIDE_TTL_MS;
      localStorage.setItem(AGREE_HIDE_KEY, String(hideUntil));
    } catch {}
    setAgreeBannerHidden(true);
  }, []);

  const unhideAgreementBanner = useCallback(() => {
    try { localStorage.removeItem(AGREE_HIDE_KEY); } catch {}
    setAgreeBannerHidden(false);
  }, []);

  const agreeVendorAgreement = useCallback(async () => {
    try {
      // explicit acceptance, no dates — only contentHash
      await axios.post('/api/vendor-agreement/accept', { contentHash: agreementHash }, { headers: authHeaders });
      setAgreementAccepted(true);
      setAgreeBannerHidden(true); // keep it hidden after signing
    } catch (e) {
      alert(e?.response?.data?.message || 'Could not record agreement. Please try again.');
    }
  }, [agreementHash, authHeaders]);

  // Single source of truth for payouts/balances + min payout
  const fetchPayoutsAndBalances = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get('/api/payouts/me', { headers: authHeaders });
      const list = Array.isArray(res.data?.payouts) ? res.data.payouts : [];
      const b = res.data?.balances || {};
      setPayouts(list);
      setBalances({
        payableBalance: Number(b.payableBalance ?? b.available ?? 0),
        available: Number(b.available ?? 0),
        onHold: Number(b.onHold ?? 0),
      });
      const serverMin = Number(res.data?.minPayout);
      if (Number.isFinite(serverMin)) setMinPayout(serverMin);
    } catch {
      // keep prior values
    }
  }, [authHeaders, token]);

  // Dashboard + bookings + balances
  useEffect(() => {
    if (!token) {
      setError('Vendor not logged in');
      setLoading(false);
      return;
    }

    const fetchDashboard = async () => {
      try {
        const res = await axios.get('/api/vendor/dashboard', { headers: authHeaders });
        setStats(res.data?.stats || { totalBookings: 0, totalRevenue: 0, cancelledBookings: 0 });
        setVendor({
          ...res.data.vendor,
          kycStatus: res.data.vendor?.kycStatus || res.data?.kycStatus || 'PENDING',
          payoutAccounts: res.data.vendor?.payoutAccounts || [],
          lockedPayoutAccountIndex:
            typeof res.data.vendor?.lockedPayoutAccountIndex === 'number'
              ? res.data.vendor.lockedPayoutAccountIndex
              : null,
        });

        // Vendor share + recent events
        setVendorShare(res.data?.vendorShare || null);
        setVendorShareEvents(Array.isArray(res.data?.vendorShareEventsRecent) ? res.data.vendorShareEventsRecent : []);

        // Optional fallback: vendorStats.payableBalance
        const fallbackPayable =
          res.data?.stats?.vendorStats?.payableBalance ??
          res.data?.vendorStats?.payableBalance ??
          null;
        if (fallbackPayable != null) {
          setBalances((prev) => ({ ...prev, payableBalance: Number(fallbackPayable) }));
        }
      } catch {
        setError('Failed to fetch dashboard');
      } finally {
        setLoading(false);
      }
    };

    const fetchBookings = async () => {
      try {
        const res = await axios.get('/api/vendor/bookings', { headers: authHeaders });
        setBookings(Array.isArray(res.data) ? res.data : []);
      } catch { /* ignore */ }
    };

    fetchDashboard();
    fetchBookings();
    fetchPayoutsAndBalances();
  }, [token, authHeaders, fetchPayoutsAndBalances]);

  // Derived metrics
  const pendingTotal = useMemo(
    () => payouts.filter(p => normStatus(p.uiStatus ?? p.status) === 'pending')
                 .reduce((s, p) => s + Number(p.amount || 0), 0),
    [payouts]
  );
  const paidTotal = useMemo(
    () => payouts.filter(p => normStatus(p.uiStatus ?? p.status) === 'paid')
                 .reduce((s, p) => s + Number(p.amount || 0), 0),
    [payouts]
  );
  const pendingCount = useMemo(
    () => payouts.filter(p => normStatus(p.uiStatus ?? p.status) === 'pending').length,
    [payouts]
  );
  const thisMonthPayouts = useMemo(() => {
    const start = monthStart();
    return payouts
      .filter(p => new Date(p.createdAt || p.requestedAt || p.date || 0) >= start)
      .reduce((s, p) => s + Number(p.amount || 0), 0);
  }, [payouts]);

  // Withdraw validation
  const payable = Number(balances.payableBalance || stats?.vendorStats?.payableBalance || 0);
  useEffect(() => {
    if (!amount) {
      setAmountError('');
      return;
    }
    const val = Number(amount);
    if (!Number.isFinite(val) || val <= 0) {
      setAmountError('Enter a valid amount');
      return;
    }
    if (Number.isFinite(minPayout) && val < minPayout) {
      setAmountError(`Minimum payout is ${currency(minPayout)}.`);
      return;
    }
    if (val > payable) {
      setAmountError(`You have exceeded your payable balance (${currency(payable)}).`);
      return;
    }
    setAmountError('');
  }, [amount, payable, minPayout]);

  // Locked account helpers
  const lockedIndex =
    typeof vendor?.lockedPayoutAccountIndex === 'number' ? vendor.lockedPayoutAccountIndex : null;
  const lockedAccount =
    lockedIndex !== null && vendor?.payoutAccounts?.[lockedIndex]
      ? vendor.payoutAccounts[lockedIndex]
      : null;

  // Actions
  const handleAddAccount = async () => {
    if (!token) return;
    try {
      const updatedAccounts = [...(vendor?.payoutAccounts || []), newAccount];
      const res = await axios.put('/api/vendor/payout-accounts', { accounts: updatedAccounts }, { headers: authHeaders });
      setVendor((prev) => ({
        ...prev,
        payoutAccounts: res.data.accounts || [],
        lockedPayoutAccountIndex:
          typeof res.data.lockedPayoutAccountIndex === 'number'
            ? res.data.lockedPayoutAccountIndex
            : prev.lockedPayoutAccountIndex ?? null,
      }));
      setNewAccount({ bankName: '', accountNumber: '', accountName: '' });
      setShowAccountForm(false);
      setLockMessage('');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to add account';
      alert(msg);
    }
  };

  const handleLockAccount = async (index) => {
    setLockMessage('');
    try {
      const res = await axios.post('/api/vendor/lock-payout-account', { index }, { headers: authHeaders });
      setVendor((prev) => ({
        ...prev,
        payoutAccounts: res.data.payoutAccounts || prev.payoutAccounts,
        lockedPayoutAccountIndex: res.data.lockedPayoutAccountIndex,
      }));
      setLockMessage('Account locked for automatic withdrawals.');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to lock payout account';
      setLockMessage(msg);
    }
  };

  const handleWithdraw = async () => {
    if (!token) return;
    if (!lockedAccount) return alert('Please lock a payout account first.');
    if (amountError || !amount) return;
    try {
      const res = await axios.post('/api/vendor/withdraw', { amount: Number(amount) }, { headers: authHeaders });
      setPayoutMessage(res.data.message || 'Withdrawal initiated');
      setAmount('');
      await fetchPayoutsAndBalances();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Withdrawal failed';
      setPayoutMessage(msg);
    }
  };

  const handleSubmitManualPayout = async () => {
    if (amountError || !amount) {
      setPayoutMessage(amountError || 'Enter a valid amount');
      return;
    }
    try {
      const parts = selectedAccount.split('—');
      const account =
        parts.length === 3
          ? { bankName: parts[0], accountNumber: parts[1], accountName: parts[2] }
          : selectedAccount;

      const res = await axios.post('/api/vendor/request-payout', { amount: Number(amount), account }, { headers: authHeaders });
      setPayoutMessage(res.data.message || 'Payout request submitted');
      setAmount('');
      setSelectedAccount('');
      await fetchPayoutsAndBalances();
    } catch (err) {
      setPayoutMessage(err?.response?.data?.message || 'Failed to submit payout request');
    }
  };

  const handleSaveProfile = async () => {
    if (!token) return;
    try {
      const res = await axios.put('/api/vendor/update-profile', editedProfile, { headers: authHeaders });
      setVendor({ ...vendor, ...(res.data.updatedVendor || {}) });
      setEditingProfile(false);
    } catch { /* ignore */ }
  };

  const exportPayoutHistoryCSV = () => {
    const rows = [['Date', 'Amount (NGN)', 'Status', 'Bank Name', 'Account Number', 'Account Name']];
    (payouts || [])
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .forEach((p) => {
        const bank = p.bank || {};
        rows.push([
          new Date(p.createdAt || p.requestedAt || Date.now()).toISOString(),
          String(p.amount || 0),
          normStatus(p.uiStatus ?? p.status),
          bank.bankName || '',
          bank.accountNumber || '',
          bank.accountName || '',
        ]);
      });

    const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payout_history_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ------- Booking list: filtering + pagination (client-side) -------
  const normalizedBookings = useMemo(
    () =>
      (bookings || [])
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [bookings]
  );

  const filteredBookings = useMemo(() => {
    let rows = normalizedBookings;

    if (statusFilter !== 'all') {
      rows = rows.filter((b) => {
        const s = String(b.status || '').toLowerCase();
        if (statusFilter === 'paid') return s === 'paid';
        if (statusFilter === 'cancelled') return s === 'cancelled' || s === 'canceled';
        if (statusFilter === 'pending') return s !== 'paid' && s !== 'cancelled' && s !== 'canceled';
        return true;
      });
    }

    if (typeFilter !== 'all') {
      rows = rows.filter((b) => String(b.category || '').toLowerCase() === typeFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((b) => {
        const hay = [
          b.listingName, b.buyerName, b.buyerEmail, b.buyerPhone,
          b.category, b.status
        ].map(x => String(x || '').toLowerCase()).join(' ');
        return hay.includes(q);
      });
    }

    return rows;
  }, [normalizedBookings, statusFilter, typeFilter, search]);

  const totalBookPages = Math.max(1, Math.ceil(filteredBookings.length / bookPageSize));
  const safePage = Math.min(bookPage, totalBookPages);
  const pageBookings = useMemo(
    () => filteredBookings.slice((safePage - 1) * bookPageSize, safePage * bookPageSize),
    [filteredBookings, safePage, bookPageSize]
  );

  const goToBookingsWithCancelled = () => {
    setActiveTab('booking');
    setStatusFilter('cancelled');
    setBookPage(1);
  };

  // --------- UI blocks ----------
  const renderVendorShareCard = () => {
    const p = vendorShare?.pending;
    const a = vendorShare?.available;
    if (!p && !a) return null;

    const gross = Number(p?.gross || 0);
    const revs  = Number(p?.reversals || 0);
    const net   = Number(p?.net || (gross - revs));

    return (
      <div className="metric-card" style={{ gridColumn: '1 / span 2' }}>
        <div className="metric-label">Vendor Share (Pending)</div>
        <div style={{ fontSize: 13, lineHeight: 1.4, marginTop: 6 }}>
          <div>Gross: <strong>{currency(gross)}</strong></div>
          <div>Less cancellations/reversals: <strong>-{currency(revs)}</strong></div>
          <div style={{ borderTop: '1px dashed #ddd', marginTop: 4, paddingTop: 4 }}>
            Net: <strong>{currency(net)}</strong>
          </div>
        </div>
        <button
          className="tiny"
          style={{ marginTop: 8 }}
          onClick={() => setShowVendorShareDetails(v => !v)}
        >
          {showVendorShareDetails ? 'Hide details' : 'View details'}
        </button>

        {showVendorShareDetails && (
          <div className="table-wrapper" style={{ marginTop: 8 }}>
            <table className="nice-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Booking</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(vendorShareEvents || []).map((ev, i) => (
                  <tr key={i}>
                    <td>{new Date(ev.createdAt).toLocaleString()}</td>
                    <td><span className={`badge ${ev.type === 'reversal' ? 'failed' : 'paid'}`}>{ev.type}</span></td>
                    <td>{ev.bookingId ? String(ev.bookingId).slice(-6) : '—'}</td>
                    <td>{currency(ev.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="hint" style={{ marginTop: 6 }}>
              Reversal lines appear when a booking is cancelled or reversed; they reduce pending revenue immediately.
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPayoutHistoryTable = () => {
    if (!payouts.length) return <p>No payout history yet.</p>;
    return (
      <div className="table-wrapper">
        <table className="nice-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Account</th>
            </tr>
          </thead>
          <tbody>
            {payouts
              .slice()
              .sort((a, b) => new Date(b.createdAt || b.requestedAt || 0) - new Date(a.createdAt || a.requestedAt || 0))
              .map((r, idx) => {
                const ui = normStatus(r.uiStatus ?? r.status);
                const bank = r.bank || {};
                return (
                  <tr key={idx}>
                    <td>{new Date(r.createdAt || r.requestedAt || Date.now()).toLocaleString()}</td>
                    <td>{currency(r.amount)}</td>
                    <td><span className={`badge ${ui}`}>{ui}</span></td>
                    <td>
                      {bank.bankName || bank.accountNumber || bank.accountName
                        ? `${bank.bankName || ''} ${bank.accountNumber || ''} ${bank.accountName || ''}`.trim()
                        : '—'}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderContent = () => {
    if (loading) return <div className="dashboard-section"><p>Loading…</p></div>;
    if (error) return <div className="dashboard-section"><p>{error}</p></div>;
    if (!vendor || !stats) return null;

    const belowMinBlocking = Number.isFinite(minPayout) && payable < minPayout;

    return (
      <>
        {/* 🔶 Inline banner replaces the old modal */}
        <InlineKycBanner
          vendor={vendor}
          onGoProfile={() => setActiveTab('profile')}
        />

        {/* 🔷 Non-blocking legal clause (no dates) */}
        {!agreementLoading && (
          <InlineVendorAgreementBanner
            accepted={agreementAccepted}
            hidden={agreeBannerHidden}
            onHide={hideAgreementBanner}
            onOpenAgreement={openVendorAgreement}
            onAgree={agreeVendorAgreement}
          />
        )}

        {activeTab === 'analytics' && (
          <div className="dashboard-section">
            <h3>Analytics</h3>
            <div className="metrics">
              <div className="metric-card">
                <div className="metric-label">Payable Balance</div>
                <div className="metric-value">{currency(payable)}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Total Bookings</div>
                <div className="metric-value">{Number(stats.totalBookings || 0)}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Cancelled Bookings</div>
                <div className="metric-value">
                  {Number(stats.cancelledBookings || 0)}
                </div>
                <button
                  className="tiny"
                  style={{ marginTop: 6 }}
                  onClick={goToBookingsWithCancelled}
                >
                  View cancelled
                </button>
              </div>
              <div className="metric-card">
                <div className="metric-label">Total Revenue</div>
                <div className="metric-value">{currency(stats.totalRevenue || 0)}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">This Month (Payouts)</div>
                <div className="metric-value">{currency(thisMonthPayouts)}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Pending/Processing</div>
                <div className="metric-value">{currency(pendingTotal)}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Paid Out</div>
                <div className="metric-value">{currency(paidTotal)}</div>
              </div>

              {renderVendorShareCard()}
            </div>
          </div>
        )}

        {activeTab === 'payouts' && (
          <div className="dashboard-section">
            <h3>Payout</h3>

            <div className="metrics">
              <div className="metric-card">
                <div className="metric-label">Payable Balance</div>
                <div className="metric-value">{currency(payable)}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Pending/Processing</div>
                <div className="metric-value">{currency(pendingTotal)}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Paid</div>
                <div className="metric-value">{currency(paidTotal)}</div>
              </div>
            </div>

            <div className="hint" style={{ margin: '8px 0 0' }}>
              {Number.isFinite(minPayout) && (
                <>Minimum payout: <strong>{currency(minPayout)}</strong>{' '}</>
              )}
              {typeof balances.onHold === 'number' && (
                <>• On hold: <strong>{currency(balances.onHold)}</strong></>
              )}
            </div>

            <div className="flex-row" style={{ gap: 12, margin: '8px 0 16px' }}>
              <button className="secondary" onClick={() => setShowAccountForm(true)}>Add Account</button>
              <button className="secondary" onClick={exportPayoutHistoryCSV}>Export Payout History (CSV)</button>
            </div>

            <h4>Payout Accounts</h4>
            <ul>
              {(vendor?.payoutAccounts || []).map((acc, i) => (
                <li key={i}>
                  {acc.bankName} — {acc.accountNumber} ({acc.accountName})
                  {lockedIndex === i ? (
                    <span className="badge paid" style={{ marginLeft: 8 }}>Locked</span>
                  ) : (
                    <button className="tiny" style={{ marginLeft: 8 }} onClick={() => handleLockAccount(i)}>
                      Lock
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {lockMessage && <p className="hint" style={{ marginTop: 6 }}>{lockMessage}</p>}

            {showAccountForm && (
              <div className="account-form">
                <input placeholder="Bank Name" value={newAccount.bankName} onChange={(e) => setNewAccount({ ...newAccount, bankName: e.target.value })} />
                <input placeholder="Account Number" value={newAccount.accountNumber} onChange={(e) => setNewAccount({ ...newAccount, accountNumber: e.target.value })} />
                <input placeholder="Account Name" value={newAccount.accountName} onChange={(e) => setNewAccount({ ...newAccount, accountName: e.target.value })} />
                <div className="btns">
                  <button onClick={handleAddAccount}>Save</button>
                  <button className="secondary" onClick={() => setShowAccountForm(false)}>Cancel</button>
                </div>
              </div>
            )}

            <div className="payout-request mt">
              <h4>{lockedAccount ? 'Withdraw' : 'Request Payout'}</h4>

              <p className="hint" style={{ marginBottom: 6 }}>
                Available to withdraw: <strong>{currency(payable)}</strong>
                {Number.isFinite(minPayout) && <> &nbsp; • &nbsp; Minimum payout: <strong>{currency(minPayout)}</strong></>}
              </p>

              <input
                placeholder="Amount (₦)"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {amountError && (
                <p className="error-note" style={{ color: '#c00', marginTop: 4 }}>{amountError}</p>
              )}

              {!lockedAccount ? (
                <>
                  <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}>
                    <option value="">Select Account</option>
                    {(vendor?.payoutAccounts || []).map((acc, i) => (
                      <option key={i} value={`${acc.bankName}—${acc.accountNumber}—${acc.accountName}`}>
                        {acc.bankName} - {acc.accountNumber} ({acc.accountName})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleSubmitManualPayout}
                    disabled={!!amountError || !amount || (Number.isFinite(minPayout) && belowMinBlocking)}
                  >
                    Submit
                  </button>
                </>
              ) : (
                <button
                  onClick={handleWithdraw}
                  disabled={!!amountError || !amount || (Number.isFinite(minPayout) && belowMinBlocking)}
                >
                  Withdraw
                </button>
              )}

              {payoutMessage && <p className="hint">{payoutMessage}</p>}
              <p className="hint">
                {lockedAccount
                  ? 'Locked account is used for automatic withdrawals.'
                  : 'Note: manual payouts remain Pending until processed by admin.'}
              </p>
            </div>

            <h4 className="mt">Payout History</h4>
            {renderPayoutHistoryTable()}
          </div>
        )}

        {activeTab === 'booking' && (
          <div className="dashboard-section">
            <h3>Booking History</h3>

            {/* Filters + page-size */}
            <div className="flex-row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <input
                style={{ minWidth: 200 }}
                placeholder="Search name, email, phone, listing…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setBookPage(1); }}
              />
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setBookPage(1); }}>
                <option value="all">All statuses</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setBookPage(1); }}>
                <option value="all">All types</option>
                <option value="hotel">Hotel</option>
                <option value="shortlet">Shortlet</option>
                <option value="eventcenter">Event Center</option>
                <option value="restaurant">Restaurant</option>
                <option value="tourguide">Tour Guide</option>
              </select>
              <select value={bookPageSize} onChange={(e) => { setBookPageSize(Number(e.target.value)); setBookPage(1); }}>
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
              <button
                className="secondary"
                onClick={() => { setStatusFilter('all'); setTypeFilter('all'); setSearch(''); setBookPage(1); }}
              >
                Reset
              </button>
              <div className="hint" style={{ marginLeft: 'auto' }}>
                Showing <strong>{pageBookings.length}</strong> of <strong>{filteredBookings.length}</strong> (
                total {bookings.length})
              </div>
            </div>

            {filteredBookings.length === 0 ? (
              <p>No matching bookings.</p>
            ) : (
              <>
                <div className="table-wrapper">
                  <table className="nice-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Listing</th>
                        <th>Buyer</th>
                        <th>Phone</th>
                        <th>Guests</th>
                        <th>Check-In</th>
                        <th>Check-Out</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageBookings.map((b, i) => (
                        <tr key={`${b.category}-${b.createdAt}-${i}`}>
                          <td>{b.category}</td>
                          <td>{b.listingName}</td>
                          <td>{b.buyerName || '—'}</td>
                          <td>{b.buyerPhone || '—'}</td>
                          <td>{b.guests ?? '—'}</td>
                          <td>{b.checkIn ? new Date(b.checkIn).toLocaleDateString() : '—'}</td>
                          <td>{b.checkOut ? new Date(b.checkOut).toLocaleDateString() : '—'}</td>
                          <td>{currency(b.price)}</td>
                          <td>
                            <span className={`badge ${badgeClassForBookingStatus(b.status)}`}>
                              {String(b.status || 'paid').toLowerCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination controls */}
                <div className="pager" style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    className="secondary"
                    onClick={() => setBookPage(p => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                  >
                    ‹ Prev
                  </button>
                  <span className="hint">
                    Page <strong>{safePage}</strong> / <strong>{totalBookPages}</strong>
                  </span>
                  <button
                    className="secondary"
                    onClick={() => setBookPage(p => Math.min(totalBookPages, p + 1))}
                    disabled={safePage >= totalBookPages}
                  >
                    Next ›
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="dashboard-section">
            <h3>Vendor Profile</h3>
            {editingProfile ? (
              <div className="profile-form">
                <input value={editedProfile.name} onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })} placeholder="Full name" />
                <input value={editedProfile.email} onChange={(e) => setEditedProfile({ ...editedProfile, email: e.target.value })} placeholder="Email" />
                <input value={editedProfile.phone} onChange={(e) => setEditedProfile({ ...editedProfile, phone: e.target.value })} placeholder="Phone" />
                <input value={editedProfile.address} onChange={(e) => setEditedProfile({ ...editedProfile, address: e.target.value })} placeholder="Address" />
                <div className="btns">
                  <button onClick={handleSaveProfile}>Save</button>
                  <button className="secondary" onClick={() => setEditingProfile(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <p>Name: {vendor?.name}</p>
                <p>Email: {vendor?.email}</p>
                <p>Phone: {vendor?.phone}</p>
                <p>Address: {vendor?.address}</p>
                <p>Verified: {vendor?.isFullyVerified ? '✅' : '❌'}</p>
                <div className="btns">
                  <button onClick={() => {
                    setEditedProfile({
                      name: vendor?.name || '',
                      email: vendor?.email || '',
                      phone: vendor?.phone || '',
                      address: vendor?.address || '',
                    });
                    setEditingProfile(true);
                  }}>Edit Profile</button>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'revenue' && (
          <div className="dashboard-section">
            <h3>Revenue</h3>
            <p>Total Revenue: {currency(stats?.totalRevenue || 0)}</p>
            <p>This Month (Payouts): {currency(thisMonthPayouts)}</p>
          </div>
        )}

        {activeTab === 'support' && (
          <div className="dashboard-section">
            <h3>Support</h3>
            <p>Contact support@yourdomain.com or call +234-XXX-XXX-XXXX.</p>

            {/* Legal quick actions */}
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="secondary" onClick={openVendorAgreement}>
                Open Vendor Agreement
              </button>
              {!agreementAccepted && (
                <>
                  <button onClick={agreeVendorAgreement}>I Agree</button>
                  <button className="tiny" onClick={unhideAgreementBanner}>
                    Show Agreement Notice Again
                  </button>
                </>
              )}
              {agreementAccepted && (
                <span className="hint">Agreement signed ✔</span>
              )}
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <div className="dashboard-mobile-header">
        <button className="hamburger-icon" onClick={() => setIsSidebarOpen(true)}>☰</button>
      </div>

      {!isDesktop && isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />}

      <div className="vendor-dashboard">
        <div className={`vendor-sidebar-container ${isSidebarOpen ? 'open' : ''}`}>
          <button className="close-btn-mobile" onClick={() => setIsSidebarOpen(false)}>×</button>
          <VendorSidebar onNavigate={handleSidebarNavigate} />
        </div>

        <div className="vendor-dashboard-content">
          {/* ⛔️ removed the blocking modal here */}

          <div className="dashboard-tabs-container">
            <div className="dashboard-tabs-scroll">
              <button onClick={() => setActiveTab('analytics')}>Analytics</button>
              <button onClick={() => setActiveTab('booking')}>Booking</button>
              <button onClick={() => setActiveTab('payouts')}>
                Payout {pendingCount > 0 ? <span className="tab-badge">{pendingCount}</span> : null}
              </button>
              <button onClick={() => setActiveTab('revenue')}>Revenue</button>
              <button onClick={() => setActiveTab('support')}>Support</button>
              <button onClick={() => setActiveTab('profile')}>👤</button>
            </div>
          </div>

          {renderContent()}
        </div>
      </div>
    </>
  );
};

export default VendorDashboard;
