// 📄 src/components/BookEventCenterModal.js
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import axios from '../utils/axiosConfig';
import './BookEventCenterModal.css';
import 'react-datepicker/dist/react-datepicker.css';

const BookEventCenterModal = ({ eventCenter, onClose }) => {
  const navigate = useNavigate();

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

  const handleBookingSave = async (paymentRef, method) => {
    try {
      await axios.post(`/api/eventcenters/bookings`, {
        eventCenterId: eventCenter._id,
        fullName,
        email,
        phone,
        eventDate: toYMD(eventDate), // ← send local date-only (prevents off-by-one)
        guests,
        paymentRef,
        paymentMethod: method,
        amount,
      });

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

  const payWithPaystack = () => {
    setPaying(true);
    const handler = window.PaystackPop.setup({
      key: 'pk_test_f4e7df49f0ea642233e1f0a4ea62acb526f166e3',
      email,
      amount: amount * 100,
      currency: 'NGN',
      ref: reference,
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
              name="name"               // ✅ autofill
              autoComplete="name"       // ✅ autofill
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <input
              type="email"
              name="email"              // ✅ autofill
              autoComplete="email"      // ✅ autofill
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="tel"
              name="tel"                // ✅ autofill
              autoComplete="tel"        // ✅ autofill
              placeholder="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />

            <DatePicker
              selected={eventDate}
              onChange={(date) => setEventDate(date)}
              minDate={today}
              // Keep excludeDates to match your UI, but these are normalized at local noon
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
