// 📄 src/components/BookTourGuideModal.js
import React, { useEffect, useMemo, useState } from 'react';
import './BookTourGuideModal.css';
import axios from '../utils/axiosConfig';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const BookTourGuideModal = ({ guide, onClose }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [tourDate, setTourDate] = useState(null);
  const [numberOfGuests, setNumberOfGuests] = useState(1);
  const [notes, setNotes] = useState('');
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [unavailableDates, setUnavailableDates] = useState([]);

  const price = Number(guide?.promoPrice && guide.usePromo ? guide.promoPrice : guide?.price || 0);
  const totalPrice = isNaN(price * numberOfGuests) ? 0 : price * numberOfGuests;

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // ---- helpers for stable date handling ----
  const toYMD = (d) => {
    if (!d) return '';
    const x = new Date(d);
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const day = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const ymdToLocalNoonDate = (s) => {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
    const d = new Date(s);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
  };

  // ✅ Inject Paystack Script once
  useEffect(() => {
    if (!document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]')) {
      const ps = document.createElement('script');
      ps.src = 'https://js.paystack.co/v1/inline.js';
      ps.async = true;
      document.body.appendChild(ps);
    }
  }, []);

  // ✅ Fetch unavailable dates (normalize to local noon to avoid timezone drift)
  useEffect(() => {
    const fetchUnavailableDates = async () => {
      const id = guide?._id || guide?.id;
      if (!id) return;

      try {
        const res = await axios.get(`/api/tour-guides/${id}/unavailable-dates`);
        const fetched = (res.data.unavailableDates || []).map((s) => ymdToLocalNoonDate(s));
        setUnavailableDates(fetched);
      } catch (err) {
        console.error('❌ Failed to fetch unavailable dates:', err);
      }
    };

    fetchUnavailableDates();
  }, [guide]);

  // Compare by YYYY-MM-DD keys (date-only)
  const unavailableSet = useMemo(
    () => new Set(unavailableDates.map((d) => toYMD(d))),
    [unavailableDates]
  );

  const isUnavailable = (date) => unavailableSet.has(toYMD(date));
  const isSelectable = (date) => !isUnavailable(date);

  // Optional: red tint on unavailable dates (you can style the class in CSS)
  const highlightDates = useMemo(
    () => [{ 'react-datepicker__day--hp-unavailable': unavailableDates }],
    [unavailableDates]
  );

  // ✅ Basic email check before showing payment options
  const handleInitialSubmit = (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      alert('Enter a valid email address.');
      return;
    }
    if (!tourDate) {
      alert('Please select a tour date.');
      return;
    }
    // Extra guard: prevent selecting an unavailable day via manual input
    if (isUnavailable(tourDate)) {
      alert('Selected date is unavailable. Please choose another date.');
      return;
    }
    setShowPaymentOptions(true);
  };

  // ✅ Handle Paystack payment
  const handlePaystack = () => {
    if (!window.PaystackPop) {
      alert('Paystack is still loading. Please wait.');
      return;
    }

    const ref = `HP-TG-${Date.now()}`;
    const paystackHandler = window.PaystackPop.setup({
      key: 'pk_test_f4e7df49f0ea642233e1f0a4ea62acb526f166e3',
      email,
      amount: totalPrice * 100,
      currency: 'NGN',
      ref,
      metadata: {
        custom_fields: [
          {
            display_name: fullName,
            variable_name: 'phone',
            value: phone,
          },
        ],
      },
      callback: function (response) {
        const payload = {
          guideId: guide._id || guide.id,
          fullName,
          phone,
          email,
          tourDate: toYMD(tourDate), // ← send local date-only (prevents off-by-one)
          numberOfGuests,
          notes,
          paymentReference: response.reference,
          paymentProvider: 'paystack',
          totalPrice,
        };

        axios
          .post('/api/tour-guides/tour-guide-bookings/verified', payload)
          .then(() => {
            alert('Booking confirmed!');
            onClose?.();
            setTimeout(() => window.location.reload(), 300);
          })
          .catch((err) => {
            console.error('❌ Booking failed after payment:', err);
            alert('Payment succeeded but booking failed. Please contact support.');
          });
      },
      onClose: function () {
        alert('Payment cancelled.');
      },
    });

    paystackHandler.openIframe();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container">
        <button className="modal-close-btn" onClick={onClose}>
          &times;
        </button>

        <h2>Book Tour Guide</h2>
        <p>
          <strong>{guide?.name}</strong>
        </p>

        {!showPaymentOptions ? (
          <form onSubmit={handleInitialSubmit} className="modal-form" autoComplete="on">
            <label>Full Name</label>
            <input
              type="text"
              name="name"               // ✅ autofill
              autoComplete="name"       // ✅ autofill
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />

            <label>Email Address</label>
            <input
              type="email"
              name="email"              // ✅ autofill
              autoComplete="email"      // ✅ autofill
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label>Phone Number</label>
            <input
              type="tel"
              name="tel"                // ✅ autofill
              autoComplete="tel"        // ✅ autofill
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <label>Tour Date</label>
            <DatePicker
              selected={tourDate}
              onChange={(date) => setTourDate(date)}
              minDate={today}
              filterDate={isSelectable}
              highlightDates={highlightDates}
              placeholderText="Select a tour date"
              className="date-picker-input"
              required
            />

            <label>Number of Guests</label>
            <input
              type="number"
              min={1}
              required
              value={numberOfGuests}
              onChange={(e) => setNumberOfGuests(Number(e.target.value))}
            />

            <label>Additional Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes or requests"
            />

            <p style={{ marginTop: '10px' }}>
              <strong>Total: ₦{totalPrice.toLocaleString()}</strong>
              <br />
              <span style={{ fontSize: '0.85rem', color: '#b00' }}>
                ⚠️ Payment confirms booking. Please choose a valid date.
              </span>
            </p>

            <div className="modal-actions">
              <button type="submit" className="submit-btn">
                Confirm Booking
              </button>
            </div>
          </form>
        ) : (
          <div className="payment-options">
            <h4>Select Payment Method</h4>
            <p>
              Total to Pay: <strong>₦{totalPrice.toLocaleString()}</strong>
            </p>
            <button
              className="submit-btn"
              style={{ backgroundColor: '#0a3d62' }}
              onClick={handlePaystack}
            >
              Pay with Paystack
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookTourGuideModal;

/*
OPTIONAL CSS to visually mark the unavailable days (add to BookTourGuideModal.css):

.react-datepicker__day--hp-unavailable {
  background-color: #fee !important;
  color: #b91c1c !important;
  border-radius: 50%;
}
*/
