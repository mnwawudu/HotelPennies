// ✅ src/components/CancelBookingButton.js
import React, { useState } from 'react';
import axios from '../utils/axiosConfig';

const CancelBookingButton = ({
  bookingId,
  category,                 // 'hotel' | 'shortlet' | 'event' (optional; improves routing)
  userEmail,                // only used for true guests (not signed in)
  paymentReference,         // optional; sent for guests if provided
  onCancelSuccess,
  children,
}) => {
  const [loading, setLoading] = useState(false);
  const [justCancelled, setJustCancelled] = useState(false); // ✅ immediate UI feedback

  // Treat “signed in” purely by token presence; axios interceptor will attach it.
  const isSignedIn = () => {
    const userToken =
      localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
    const adminToken =
      localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
    return !!(userToken || adminToken);
  };

  const buildTargets = (id, cat) => {
    const map = {
      hotel: [
        `/api/bookings/hotel/${id}/cancel`,     // primary (your hotel router)
        `/api/hotel-bookings/${id}/cancel`,     // legacy/alt
      ],
      shortlet: [
        `/api/shortlet-bookings/${id}/cancel`,
      ],
      event: [
        `/api/event-center-bookings/${id}/cancel`,
        `/api/event-bookings/${id}/cancel`,
      ],
    };
    const fallbacks = [`/api/bookings/${id}/cancel`]; // aggregator if present
    if (cat && map[cat]) return [...map[cat], ...fallbacks];
    return [...map.hotel, ...map.shortlet, ...map.event, ...fallbacks];
  };

  const handleCancel = async () => {
    if (!bookingId) return;

    const confirmed = window.confirm('Are you sure you want to cancel this booking?');
    if (!confirmed) return;

    setLoading(true);
    try {
      const authed = isSignedIn();

      // Signed-in: NO email prompts, send empty body, server verifies via JWT.
      // Guest: if we don’t have an email, send them to the guest cancel page.
      let payload = {};
      if (!authed) {
        const email = String(userEmail || '').toLowerCase();
        if (!email) {
          // Pure guest flow → go to guest cancel page where they can request a magic link
          window.location.href = '/manage-booking';
          setLoading(false);
          return;
        }
        payload = { email };
        if (paymentReference) payload.paymentReference = paymentReference;
      }

      const targets = buildTargets(bookingId, (category || '').toLowerCase());

      let lastErr;
      for (const url of targets) {
        try {
          const res = await axios.patch(url, payload);
          if (res?.status >= 200 && res?.status < 300) {
            // ✅ immediate UI change (even before parent refresh)
            setJustCancelled(true);
            alert('✅ Booking cancelled successfully.');
            onCancelSuccess && onCancelSuccess();
            setLoading(false);
            return;
          }
        } catch (e) {
          const s = e?.response?.status;
          const msg = String(e?.response?.data?.message || '');
          if (s === 404) { lastErr = e; continue; }
          if (s === 400 && /already cancel+ed/i.test(msg)) {
            // ✅ reflect already-cancelled state in UI too
            setJustCancelled(true);
            alert('Booking was already canceled.');
            onCancelSuccess && onCancelSuccess();
            setLoading(false);
            return;
          }
          if (s === 400 && /Cannot cancel after check-in/i.test(msg)) {
            alert(msg); setLoading(false); return;
          }
          if (s === 401 || s === 403) {
            alert(msg || 'Authorization failed. Please sign in or use the guest cancel page.');
            setLoading(false); return;
          }
          lastErr = e; break;
        }
      }

      alert(lastErr?.response?.data?.message || '❌ Unable to cancel booking.');
    } catch (err) {
      console.error('Cancel booking error:', err);
      alert('❌ Failed to cancel booking.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCancel}
      disabled={loading || justCancelled}                     // ✅ disabled after success
      className="bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
      title={justCancelled ? 'Already cancelled' : 'Cancel booking'}
    >
      {loading
        ? 'Cancelling…'
        : justCancelled
        ? 'Cancelled'                                         // ✅ show “Cancelled”
        : (children || 'Cancel Booking')}
    </button>
  );
};

export default CancelBookingButton;
