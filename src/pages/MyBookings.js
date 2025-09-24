// 📄 src/pages/MyBookings.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import axios from '../utils/axiosConfig';
import { jsPDF } from 'jspdf';
import { PaystackButton } from 'react-paystack';
import CancelBookingButton from '../components/CancelBookingButton';
import './MyBookings.css';

const NG_TZ = 'Africa/Lagos';
const PAGE_SIZE = 20;
const OLD_ORDER_DAYS = 14;

// 🔧 single source of truth for the orders endpoint
const ORDERS_API = '/api/my/orders';

/* =========================
   Helpers (top-level, stable)
   ========================= */
const getAuthHeaders = () => {
  const tk =
    localStorage.getItem('userToken') ||
    localStorage.getItem('token') ||
    localStorage.getItem('authToken') ||
    sessionStorage.getItem('userToken') ||
    '';
  return tk ? { Authorization: `Bearer ${tk}` } : {};
};

const normalizeUICategory = (raw) => {
  const v = String(raw || '').toLowerCase().trim();
  if (v === 'eventcenter' || v === 'event_center' || v === 'event centre') return 'event';
  if (v === 'tourguide' || v === 'tour_guide' || v === 'tour guide') return 'tour';
  if (v === 'gift' || v === 'gifts') return 'gifts';
  return v || 'hotel';
};

const parseAmount = (val) => {
  if (val === undefined || val === null) return NaN;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/,/g, '').replace(/[^\d.-]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
};

const pickAmountFromRow = (r) => {
  const candidates = [
    r.amount,
    r.amountPaid,
    r.totalAmount,
    r.paidAmount,
    r.bookingAmount,
    r.total,
    r.totalPrice,
    r.price,
  ];
  for (const c of candidates) {
    const n = parseAmount(c);
    if (Number.isFinite(n)) return n;
  }
  return 0;
};

const normalizeRow = (r) => {
  const id = r._id || r.id || r.bookingId;

  const rawCat =
    r.category ||
    r.categoryLabel ||
    (r.meta && r.meta.category) ||
    '';
  const category = normalizeUICategory(rawCat);

  const title =
    r.title ||
    r.listingName ||
    r.hotelName ||
    r.roomName ||
    r.shortletName ||
    r.eventCenterName ||
    r.restaurantName ||
    r.guideName ||
    'Booking';

  const subTitle = r.subTitle || r.roomName || r.detail || '';

  const amount = pickAmountFromRow(r);

  const checkIn = r.checkIn || r.startDate || null;
  const checkOut = r.checkOut || r.endDate || null;
  const reservationTime = r.reservationTime || null;
  const eventDate = r.eventDate || null;
  const tourDate = r.tourDate || null;

  const paymentStatus =
    r.paymentStatus || (r.status === 'paid' ? 'paid' : r.paymentStatus) || 'paid';
  const canceled = Boolean(r.canceled || r.status === 'cancelled' || r.status === 'canceled');

  return {
    _id: id,
    category,
    title,
    subTitle,
    amount,
    checkIn,
    checkOut,
    reservationTime,
    eventDate,
    tourDate,
    paymentStatus,
    canceled,
    createdAt: r.createdAt || r.created_at || r.bookedAt || null,
    paymentReference: r.paymentReference || r.reference || null,
    paymentProvider: r.paymentProvider || null,
    email: r.email || null,
  };
};

const sameOrders = (a, b) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x._id !== y._id ||
      x.category !== y.category ||
      x.amount !== y.amount ||
      x.paymentStatus !== y.paymentStatus ||
      (x.createdAt || '') !== (y.createdAt || '')
    ) {
      return false;
    }
  }
  return true;
};

/* =========================
   Component
   ========================= */
const MyBookings = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // pagination
  const [page, setPage] = useState(1);

  // "Link missing booking" mini-form
  const [linking, setLinking] = useState(false);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkRef, setLinkRef] = useState('');

  // delete-from-history (undo support)
  const [undo, setUndo] = useState(null); // { category, id, title, timeoutId }

  const isLoggedIn = useMemo(
    () =>
      Boolean(
        localStorage.getItem('userToken') ||
          localStorage.getItem('token') ||
          localStorage.getItem('authToken') ||
          localStorage.getItem('user')
      ),
    []
  );

  // ---------- utils ----------
  const anchorNoonLocal = (d) => {
    const x = new Date(d);
    return new Date(x.getFullYear(), x.getMonth(), x.getDate(), 12, 0, 0, 0);
  };

  const hoursUntil = (date, isDateOnly = false) => {
    if (!date) return -Infinity;
    const now = new Date();
    const start = isDateOnly ? anchorNoonLocal(date) : new Date(date);
    return (start - now) / (1000 * 60 * 60);
  };

  const orderStatus = (item) => {
    if (item.canceled) return 'Cancelled';
    const cat = String(item.category || '').toLowerCase();
    const now = new Date();

    if (cat === 'hotel' || cat === 'shortlet') {
      if (item.checkOut && new Date(item.checkOut) < now) return 'Completed';
      return 'Active';
    }
    if (cat === 'restaurant') {
      if (item.reservationTime && new Date(item.reservationTime) < now) return 'Completed';
      return 'Active';
    }
    if (cat === 'event') {
      if (item.eventDate && new Date(item.eventDate) < now) return 'Completed';
      return 'Active';
    }
    if (cat === 'tour') {
      if (item.tourDate && new Date(item.tourDate) < now) return 'Completed';
      return 'Active';
    }
    if (cat === 'chops' || cat === 'gifts') {
      const created = item.createdAt ? new Date(item.createdAt) : null;
      if (created && (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24) > 5) return 'Completed';
      return 'Active';
    }
    return 'Active';
  };

  // ---- Refund policy (UI) ----
  const refundPercent = (item) => {
    const cat = String(item.category || '').toLowerCase();

    if (cat === 'hotel' || cat === 'shortlet') {
      const h = hoursUntil(item.checkIn, true);
      if (h >= 24 * 7) return 100;
      if (h >= 48) return 50;
      return 0;
    }

    if (cat === 'restaurant') {
      const h = hoursUntil(item.reservationTime, false);
      if (h >= 24) return 50;
      return 0;
    }

    if (cat === 'event') {
      const h = hoursUntil(item.eventDate, true);
      if (h >= 24 * 7) return 100;
      if (h >= 48) return 50;
      return 0;
    }

    if (cat === 'tour') {
      const h = hoursUntil(item.tourDate, true);
      if (h > 48) return 100;
      if (h >= 24) return 50;
      return 0;
    }

    if (cat === 'chops' || cat === 'gifts') return 0;
    return 0;
  };

  const refundHint = (item) => {
    const pct = refundPercent(item);
    if (pct === 100) return 'Free cancellation (per policy).';
    if (pct === 50) return '50% refund if you cancel now (per policy).';
    return 'Non-refundable (per policy).';
  };

  const formatDate = (d) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-NG', { timeZone: NG_TZ });
    } catch {
      return new Date(d).toLocaleDateString();
    }
  };

  const formatDateTime = (d) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleString('en-NG', { timeZone: NG_TZ });
    } catch {
      return new Date(d).toLocaleString();
    }
  };

  const getUserEmail = (fallback) => {
    if (fallback) return fallback;
    try {
      const userRaw = localStorage.getItem('user');
      if (userRaw) {
        const u = JSON.parse(userRaw);
        if (u?.email) return String(u.email).toLowerCase();
      }
    } catch {}
    return '';
  };

  // ---------- data fetch ----------
  const latestOrdersRef = useRef([]);

  const fetchOrders = useCallback(async (setInitialDone = false) => {
    try {
      const res = await axios.get(ORDERS_API, { headers: getAuthHeaders() });
      const list = Array.isArray(res.data) ? res.data : [];
      const normalized = list.map(normalizeRow);

      if (!sameOrders(normalized, latestOrdersRef.current)) {
        latestOrdersRef.current = normalized;
        setOrders(normalized);
        setPage(1);
      }
    } catch (err) {
      console.error('MyBookings fetch error:', err?.response?.data || err?.message || err);
      if (setInitialDone) setOrders([]);
    } finally {
      if (setInitialDone) setLoading(false);
    }
  }, []);

  // Initial load + gentle one-minute poll
  useEffect(() => {
    let stop = false;
    let intervalId = null;

    (async () => {
      await fetchOrders(true);
      if (stop) return;

      const start = Date.now();
      intervalId = setInterval(async () => {
        if (Date.now() - start > 60_000) {
          clearInterval(intervalId);
          intervalId = null;
          return;
        }
        await fetchOrders(false);
      }, 5000);
    })();

    return () => {
      stop = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [fetchOrders]);

  // keep page in range if list shrinks
  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [orders.length, totalPages, page]);

  const pageOrders = useMemo(
    () => orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [orders, page]
  );

  // ---------- actions ----------
  const generateReceipt = (item) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Order Receipt', 105, 15, null, null, 'center');
    doc.setFontSize(12);
    doc.text(`Order ID: ${item._id}`, 20, 30);
    doc.text(`Category: ${item.category}`, 20, 40);
    if (item.title) doc.text(`Title: ${item.title}`, 20, 50);
    if (item.subTitle) doc.text(`Detail: ${item.subTitle}`, 20, 60);
    if (item.createdAt) doc.text(`Booked on: ${formatDateTime(item.createdAt)}`, 20, 70);
    let y = 80;
    if (item.checkIn) {
      doc.text(`Check-in: ${formatDate(item.checkIn)}`, 20, y);
      y += 10;
    }
    if (item.checkOut) {
      doc.text(`Check-out: ${formatDate(item.checkOut)}`, 20, y);
      y += 10;
    }
    if (item.reservationTime) {
      doc.text(`Reservation: ${formatDateTime(item.reservationTime)}`, 20, y);
      y += 10;
    }
    if (item.eventDate) {
      doc.text(`Event: ${formatDateTime(item.eventDate)}`, 20, y);
      y += 10;
    }
    if (item.tourDate) {
      doc.text(`Tour: ${formatDate(item.tourDate)}`, 20, y);
      y += 10;
    }
    const amount = Number(item.amount || 0);
    doc.text(`Amount: ₦${amount.toLocaleString()}`, 20, y);
    y += 10;
    doc.text(`Payment: ${item.paymentStatus}`, 20, y);
    y += 10;
    doc.text(`Status: ${orderStatus(item)}`, 20, y);
    doc.setFontSize(10);
    doc.text('Thanks for using HotelPennies!', 105, 280, null, null, 'center');
    doc.save(`OrderReceipt_${item._id}.pdf`);
  };

  const linkBooking = async (e) => {
    e.preventDefault();
    if (!linkEmail || !linkRef) return alert('Enter email and payment reference.');
    try {
      setLinking(true);
      await axios.post(
        '/api/my/link-booking',
        { email: linkEmail, reference: linkRef },
        { headers: getAuthHeaders() }
      );
      setLinkEmail('');
      setLinkRef('');
      await fetchOrders(false);
      alert('Booking linked to your account.');
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || 'Failed to link booking.');
    } finally {
      setLinking(false);
    }
  };

  const isOlderThan = (d, days) => {
    if (!d) return false;
    const t = new Date(d).getTime();
    if (!Number.isFinite(t)) return false;
    return (Date.now() - t) / (1000 * 60 * 60 * 24) >= days;
  };

  const canRemoveFromHistory = (item) => {
    const s = orderStatus(item);
    return s === 'Completed' || s === 'Cancelled' || isOlderThan(item.createdAt, OLD_ORDER_DAYS);
  };

  const removeFromHistory = async (item) => {
    if (!window.confirm('Remove this booking from your history? This will not affect the booking itself.')) return;
    try {
      await axios.delete(`/api/my/orders/${item.category}/${item._id}`, { headers: getAuthHeaders() });
      const next = orders.filter(o => !(o._id === item._id && o.category === item.category));
      setOrders(next);

      if (undo?.timeoutId) clearTimeout(undo.timeoutId);
      const timeoutId = setTimeout(() => setUndo(null), 8000);
      setUndo({ category: item.category, id: item._id, title: item.title, timeoutId });
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || 'Failed to remove booking from history.');
    }
  };

  const undoRemove = async () => {
    if (!undo) return;
    try {
      await axios.post(`/api/my/orders/${undo.category}/${undo.id}/restore`, {}, { headers: getAuthHeaders() });
      if (undo.timeoutId) clearTimeout(undo.timeoutId);
      setUndo(null);
      await fetchOrders(false);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || 'Failed to restore booking.');
    }
  };

  // Paystack helper UI
  const PayNow = ({ item }) => {
    const publicKey = process.env.REACT_APP_PAYSTACK_PUBLIC_KEY;
    const amountNaira = Number(item.amount || 0);
    const amountKobo = Math.max(0, Math.round(amountNaira * 100));
    const email = getUserEmail(item.email);

    if (!publicKey) {
      return (
        <button className="pay-now-btn" title="Set REACT_APP_PAYSTACK_PUBLIC_KEY" disabled>
          Pay Now (Paystack key missing)
        </button>
      );
    }
    if (!amountKobo || !email) {
      return (
        <button className="pay-now-btn" disabled>
          Pay Now (incomplete details)
        </button>
      );
    }

    const ref = `HP-${String(item.category || 'GEN').slice(0, 3).toUpperCase()}-${item._id}-${Date.now()}`;

    const paystackProps = {
      publicKey,
      email,
      amount: amountKobo,
      currency: 'NGN',
      reference: ref,
      metadata: {
        orderId: item._id,
        category: item.category,
        title: item.title,
        platform: 'HotelPennies',
      },
      onSuccess: () => {
        alert('Payment successful! We are confirming your order.');
        fetchOrders(false);
      },
      onClose: () => {
        console.log('Paystack checkout closed.');
      },
    };

    return <PaystackButton {...paystackProps} text="Pay Now" className="pay-now-btn" />;
  };

  // ---------- render ----------
  return (
    <div className="my-bookings-container">
      <h2 className="my-bookings-title">My Orders</h2>

      {/* Undo banner */}
      {undo && (
        <div
          style={{
            background: '#fff3cd',
            border: '1px solid #ffeeba',
            color: '#856404',
            padding: '10px 12px',
            borderRadius: 6,
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>Removed “{undo.title || 'Booking'}” from your history.</span>
          <button
            onClick={undoRemove}
            style={{
              marginLeft: 'auto',
              background: '#856404',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            Undo
          </button>
        </div>
      )}

      {isLoggedIn && (
        <div className="link-missing-box">
          <h4>Missing a booking?</h4>
          <p className="link-missing-hint">
            Link it to your account using the email used at checkout and the payment reference.
          </p>
          <form onSubmit={linkBooking} className="link-missing-form">
            <input
              type="email"
              placeholder="Email used at checkout"
              value={linkEmail}
              onChange={(e) => setLinkEmail(e.target.value)}
            />
            <input
              type="text"
              placeholder="Payment reference (e.g. PSK_xxx or HP-RES-123...)"
              value={linkRef}
              onChange={(e) => setLinkRef(e.target.value)}
            />
            <button type="submit" disabled={linking}>
              {linking ? 'Linking…' : 'Link booking'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <p>Loading your orders...</p>
      ) : orders.length === 0 ? (
        <p className="no-bookings-msg">No orders found.</p>
      ) : (
        <>
          {pageOrders.map((item) => {
            const amount = Number(item.amount || 0);
            const cat = String(item.category || '').toLowerCase();

            const dateBlock =
              cat === 'hotel' || cat === 'shortlet' ? (
                <>
                  <p><strong>Booked on:</strong> {formatDateTime(item.createdAt)}</p>
                  <p><strong>Check-in:</strong> {formatDate(item.checkIn)}</p>
                  <p><strong>Check-out:</strong> {formatDate(item.checkOut)}</p>
                </>
              ) : cat === 'restaurant' ? (
                <>
                  <p><strong>Booked on:</strong> {formatDateTime(item.createdAt)}</p>
                  <p><strong>Reservation:</strong> {formatDateTime(item.reservationTime)}</p>
                </>
              ) : cat === 'event' ? (
                <>
                  <p><strong>Booked on:</strong> {formatDateTime(item.createdAt)}</p>
                  <p><strong>Event:</strong> {formatDateTime(item.eventDate)}</p>
                </>
              ) : cat === 'tour' ? (
                <>
                  <p><strong>Booked on:</strong> {formatDateTime(item.createdAt)}</p>
                  <p><strong>Tour Date:</strong> {formatDate(item.tourDate)}</p>
                </>
              ) : (
                <p><strong>Booked on:</strong> {formatDateTime(item.createdAt)}</p>
              );

            return (
              <div
                key={`${item._id}-${item.category}`}
                className={`booking-card ${item.paymentStatus === 'pending' ? 'pending-payment' : ''}`}
              >
                <div className="booking-info">
                  <p><strong>Category:</strong> {item.category}</p>
                  <p><strong>Title:</strong> {item.title}</p>
                  {item.subTitle ? <p><strong>Detail:</strong> {item.subTitle}</p> : null}
                  <p><strong>Amount:</strong> ₦{amount.toLocaleString()}</p>
                  {dateBlock}
                  <p>
                    <strong>Status:</strong>{' '}
                    <span
                      className={
                        orderStatus(item) === 'Cancelled'
                          ? 'cancelled-status'
                          : orderStatus(item) === 'Completed'
                          ? 'completed-status'
                          : ''
                      }
                    >
                      {orderStatus(item)}
                    </span>
                  </p>
                  <p>
                    <strong>Payment Status:</strong>{' '}
                    {item.paymentStatus === 'pending' ? (
                      <span className="pending-payment-status">⚠️ Pending Payment</span>
                    ) : (
                      'Paid'
                    )}
                  </p>
                </div>

                <div className="booking-actions">
                  {!item.canceled && (
                    <>
                      <CancelBookingButton
                        bookingId={item._id}
                        category={cat}
                        userEmail={getUserEmail(item.email)}
                        paymentReference={item.paymentReference}
                        onCancelSuccess={() => fetchOrders(false)}
                      />
                      <div className="refund-hint">{refundHint(item)}</div>
                    </>
                  )}

                  <button className="download-receipt-btn" onClick={() => generateReceipt(item)}>
                    Download Receipt
                  </button>

                  {item.paymentStatus === 'pending' && !item.canceled && <PayNow item={item} />}

                  {canRemoveFromHistory(item) && (
                    <button
                      onClick={() => removeFromHistory(item)}
                      className="download-receipt-btn"
                      style={{ background: '#dc3545', borderColor: '#dc3545', marginTop: 6 }}
                      title="Remove this booking from your history (does not affect the actual booking)"
                    >
                      Delete from history
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Pager */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              marginTop: 16,
            }}
          >
            <button
              className="download-receipt-btn"
              style={{ background: '#f0f0f0', color: '#333', borderColor: '#ccc' }}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              ‹ Prev
            </button>
            <span>
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>{' '}
              <span style={{ color: '#777' }}>
                ({orders.length} total)
              </span>
            </span>
            <button
              className="download-receipt-btn"
              style={{ background: '#f0f0f0', color: '#333', borderColor: '#ccc' }}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next ›
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default MyBookings;
