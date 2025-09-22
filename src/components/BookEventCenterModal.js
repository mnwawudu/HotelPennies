// 📄 src/components/BookEventCenterModal.js
import React, { useState, useEffect, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import axios from '../utils/axiosConfig';
import './BookEventCenterModal.css';
import 'react-datepicker/dist/react-datepicker.css';

const BookEventCenterModal = ({ eventCenter, onClose }) => {
 

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [eventDate, setEventDate] = useState(null);
  const [guests, setGuests] = useState('');
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [paying, setPaying] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [unavailableDates, setUnavailableDates] = useState([]);

  // ✅ NEW: capture referral code like shortlet modal
  const [referralCode, setReferralCode] = useState(null);

  // ---- helpers for stable date handling ----
  const toYMD = (d) => {
    if (!d) return '';
    const x = new Date(d);
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const day = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Build a local Date at *noon* to avoid timezone rollbacks (DST/UTC drift)
  const ymdToLocalNoonDate = (s) => {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
    const d = new Date(s);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
  };

  const amount =
    eventCenter.usePromo && eventCenter.promoPrice
      ? eventCenter.promoPrice
      : eventCenter.price;

  const reference = 'EVT-' + Math.floor(Math.random() * 1000000000);

  useEffect(() => {
    // ✅ mirror shortlet: read referral code (if any)
    const stored = localStorage.getItem('referralCode');
    if (stored) setReferralCode(stored);

    const fetchEventCenterDetails = async () => {
      try {
        const res = await axios.get(`/api/eventcenters/public/${eventCenter._id}?t=${Date.now()}`);
        const eventDetails = res.data;

        // Normalize unavailable dates to *local noon* Date objects (stable in picker)
        const formatted = (eventDetails.unavailableDates || []).map((dateStr) =>
          ymdToLocalNoonDate(dateStr)
        );

        setUnavailableDates(formatted);
      } catch (err) {
        console.error('❌ Failed to fetch event center details:', err);
      }
    };

    if (eventCenter?._id) {
      fetchEventCenterDetails();
    }
  }, [eventCenter?._id]);

  // Fast lookup set of YYYY-MM-DD for unavailable dates
  const unavailableSet = useMemo(
    () => new Set(unavailableDates.map((d) => toYMD(d))),
    [unavailableDates]
  );

  const handleBookingSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!eventDate) {
      setErrorMsg('❌ Please select a valid event date.');
      return;
    }

    // Compare using YYYY-MM-DD keys to avoid timezone mismatches
    const selectedKey = toYMD(eventDate);
    if (unavailableSet.has(selectedKey)) {
      setErrorMsg('❌ This date has already been booked. Please choose another date.');
      return;
    }

    setShowPaymentOptions(true);
  };

  // ✅ ONLY change: send JWT header + referredByUserId (from referralCode)
  const handleBookingSave = async (paymentRef, method) => {
    try {
      const token = localStorage.getItem('token');

      await axios.post(
        `/api/eventcenters/bookings`,
        {
          eventCenterId: eventCenter._id,
          fullName,
          email,
          phone,
          eventDate: toYMD(eventDate), // send local date-only
          guests,
          paymentRef,
          paymentMethod: method,
          amount,
          // mirror shortlet contract
          referredByUserId: referralCode || undefined,
        },
        token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      );

      setSuccessMsg('✅ Booking confirmed!');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('❌ Booking failed:', err);
      const error = err?.response?.data?.error || '❌ Failed to confirm booking. Please try again.';
      setErrorMsg(error);
    } finally {
      setPaying(false);
    }
  };

  // ✅ ONLY change: include referral in Paystack metadata (backend also resolves from verify->metadata)
  const payWithPaystack = () => {
    setPaying(true);
    const handler = window.PaystackPop.setup({
      key: 'pk_test_f4e7df49f0ea642233e1f0a4ea62acb526f166e3',
      email,
      amount: amount * 100,
      currency: 'NGN',
      ref: reference,
      metadata: {
        referralCode: referralCode || null,
        custom_fields: [
          { display_name: 'referralCode', variable_name: 'referral_code', value: referralCode || '' },
          { display_name: 'buyerEmail', variable_name: 'buyer_email', value: (email || '').toLowerCase() },
        ],
      },
      callback: function (response) {
        handleBookingSave(response.reference, 'Paystack');
      },
      onClose: function () {
        setPaying(false);
      },
    });
    handler.openIframe();
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-button" onClick={onClose}>×</button>
        <h2 className="modal-title">Book {eventCenter?.name}</h2>

        {!showPaymentOptions ? (
          <form className="booking-form" onSubmit={handleBookingSubmit} autoComplete="on">
            <input
              type="text"
              name="name"
              autoComplete="name"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="tel"
              name="tel"
              autoComplete="tel"
              placeholder="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />

            <DatePicker
              selected={eventDate}
              onChange={(date) => setEventDate(date)}
              minDate={today}
              excludeDates={unavailableDates}
              placeholderText="Select Event Date"
              className="date-picker-input"
              required
            />

            <input
              type="number"
              placeholder="Expected Guests"
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
              required
            />

            <button type="submit" className="submit-btn">
              Submit Booking
            </button>
          </form>
        ) : (
          <div className="payment-options">
            <button
              type="button"
              onClick={payWithPaystack}
              disabled={paying}
              className="pay-btn"
            >
              {paying ? 'Processing...' : 'Pay with Paystack'}
            </button>
          </div>
        )}

        {successMsg && <p className="success-msg">{successMsg}</p>}
        {errorMsg && <p className="error-msg">{errorMsg}</p>}
      </div>
    </div>
  );
};

export default BookEventCenterModal;
