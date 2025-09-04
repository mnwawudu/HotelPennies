// 📄 src/components/BookRestaurantModal.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import axios from '../utils/axiosConfig';
import 'react-datepicker/dist/react-datepicker.css';
import './BookRestaurantModal.css';

const BookRestaurantModal = ({ menu, restaurant, onClose }) => {
  const navigate = useNavigate();

  // Restore last values from localStorage
  const savedFullName = localStorage.getItem('restaurantBookingFullName') || '';
  const savedPhone = localStorage.getItem('restaurantBookingPhone') || '';
  const savedGuests = localStorage.getItem('restaurantBookingGuests') || '1';
  const savedQuantity = localStorage.getItem('restaurantBookingQty') || '1';
  const savedReservationDate = localStorage.getItem('restaurantBookingDate') || '';
  const savedReservationTime = localStorage.getItem('restaurantBookingTime') || '';

  // ✅ ADDED: email (prefill from user profile or last used)
  const getProfileEmail = () => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return '';
      const u = JSON.parse(raw);
      return u?.email || '';
    } catch {
      return '';
    }
  };
  const savedEmail =
    localStorage.getItem('restaurantBookingEmail') ||
    getProfileEmail() ||
    '';

  const [fullName, setFullName] = useState(savedFullName);
  const [email, setEmail] = useState(savedEmail); // ✅ ADDED
  const [phone, setPhone] = useState(savedPhone);
  const [guests, setGuests] = useState(Number(savedGuests));
  const [quantity, setQuantity] = useState(Number(savedQuantity));
  const [reservationDate, setReservationDate] = useState(
    savedReservationDate ? new Date(savedReservationDate) : null
  );
  const [reservationTime, setReservationTime] = useState(savedReservationTime);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unavailableDates, setUnavailableDates] = useState([]);

  // NEW: when Paystack opens, hide this modal entirely
  const [paystackOpen, setPaystackOpen] = useState(false);

  // ✅ ADDED: tiny “recent values” memory for suggestions
  const getRecent = (key) => {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  };
  const remember = (key, val) => {
    if (!val) return;
    const list = getRecent(key);
    const next = [String(val)].concat(list.filter((x) => x !== String(val))).slice(0, 5);
    localStorage.setItem(key, JSON.stringify(next));
  };

  const price = Number(menu.promoPrice || menu.price);
  const total = quantity * price;

  // Fetch dates the restaurant is unavailable
  useEffect(() => {
    const fetchUnavailableDates = async () => {
      try {
        const res = await axios.get(`/api/restaurants/${restaurant._id}/unavailable-dates`);
        const dates = res.data.unavailableDates || [];
        const formatted = dates.map((dateStr) => {
          const parsed = new Date(dateStr);
          parsed.setHours(0, 0, 0, 0);
          return parsed;
        });
        setUnavailableDates(formatted);
      } catch (err) {
        console.error('❌ Failed to fetch unavailable dates:', err);
      }
    };
    fetchUnavailableDates();
  }, [restaurant._id]);

  // Persist fields locally
  useEffect(() => localStorage.setItem('restaurantBookingFullName', fullName), [fullName]);
  useEffect(() => localStorage.setItem('restaurantBookingPhone', phone), [phone]);
  useEffect(() => localStorage.setItem('restaurantBookingGuests', guests.toString()), [guests]);
  useEffect(() => localStorage.setItem('restaurantBookingQty', quantity.toString()), [quantity]);
  useEffect(() => {
    if (reservationDate) {
      localStorage.setItem('restaurantBookingDate', reservationDate.toISOString().split('T')[0]);
    }
  }, [reservationDate]);
  useEffect(() => localStorage.setItem('restaurantBookingTime', reservationTime), [reservationTime]);
  useEffect(() => localStorage.setItem('restaurantBookingEmail', email), [email]); // ✅ ADDED

  const getReservationDateTimeISO = () => {
    if (!reservationDate || !reservationTime) return null;
    const combined = `${reservationDate.toISOString().split('T')[0]}T${reservationTime}:00`;
    return new Date(combined).toISOString();
  };

  const handleInitialSubmit = (e) => {
    e.preventDefault();
    if (!reservationDate || !reservationTime) {
      alert('Please select both reservation date and time.');
      return;
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      alert('Please enter a valid email address.');
      return;
    }
    if (guests < 1 || quantity < 1) {
      alert('Guests and quantity must be at least 1.');
      return;
    }
    const isoDate = reservationDate.toISOString().split('T')[0];
    const formattedUnavailable = unavailableDates.map((d) => d.toISOString().split('T')[0]);
    if (formattedUnavailable.includes(isoDate)) {
      alert('❌ This date is unavailable. Please choose another.');
      return;
    }

    // ✅ remember values for suggestions
    remember('recentRestaurantFullNames', fullName);
    remember('recentRestaurantEmails', email);
    remember('recentRestaurantPhones', phone);

    setShowPaymentOptions(true);
  };

  const submitBooking = async (paymentProvider, paymentReference) => {
    setIsSubmitting(true);
    try {
      const reservationTimeISO = getReservationDateTimeISO();
      if (!reservationTimeISO) {
        alert('Invalid reservation date or time.');
        setIsSubmitting(false);
        return;
      }

      await axios.post('/api/restaurant-bookings/verified', {
        fullName,
        email, // ✅ use entered email (was phone alias before)
        phone,
        restaurantId: restaurant._id,
        bookingType: 'reservation',
        guests,
        reservationTime: reservationTimeISO,
        totalPrice: total,
        paymentStatus: 'paid',
        paymentProvider,
        paymentReference,
        menuItems: [{ title: menu.title, price, quantity }],
      });

      alert('Reservation confirmed! Thank you for booking with HotelPennies.');
      setIsSubmitting(false);
      onClose();
      navigate(`/restaurants/${restaurant._id}`);
    } catch (err) {
      console.error('[Booking save failed]', err?.response?.data || err.message || err);
      alert('Payment succeeded but reservation failed.');
      setIsSubmitting(false);
    }
  };

  // Paystack popup (hides our modal while open)
  const handlePaystack = () => {
    const ref = `HP-RES-${Date.now()}`;
    setPaystackOpen(true);

    const handler = window.PaystackPop?.setup({
      key: 'pk_test_f4e7df49f0ea642233e1f0a4ea62acb526f166e3',
      email, // ✅ use real email for receipt
      amount: total * 100,
      currency: 'NGN',
      ref,
      metadata: {
        custom_fields: [{ display_name: fullName, variable_name: 'phone', value: phone }],
      },
      callback: (response) => {
        setPaystackOpen(false);
        submitBooking('paystack', response.reference);
      },
      onClose: () => {
        setPaystackOpen(false);
      },
    });

    handler?.openIframe();
  };

  // ✅ suggestions (from recent*)
  const recentNames = getRecent('recentRestaurantFullNames');
  const recentEmails = getRecent('recentRestaurantEmails');
  const recentPhones = getRecent('recentRestaurantPhones');

  return (
    <div className={`modal-backdrop ${paystackOpen ? 'hidden-during-paystack' : ''}`}>
      <div className="modal-container">
        <button className="modal-close-btn" onClick={onClose}>
          ×
        </button>
        <h2>Reserve a Table</h2>
        <p>
          <strong>{menu.title}</strong> at <strong>{restaurant.name}</strong>
        </p>

        {!showPaymentOptions ? (
          <form onSubmit={handleInitialSubmit} className="modal-form">
            <label>Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name" // ✅ hint browser
              list="recent-names"  // ✅ datalist suggestions
            />
            <datalist id="recent-names">
              {recentNames.map((n, i) => (
                <option key={i} value={n} />
              ))}
            </datalist>

            {/* ✅ ADDED: Email Address */}
            <label>Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              list="recent-emails"
            />
            <datalist id="recent-emails">
              {recentEmails.map((em, i) => (
                <option key={i} value={em} />
              ))}
            </datalist>

            <label>Phone Number</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              list="recent-phones"
            />
            <datalist id="recent-phones">
              {recentPhones.map((ph, i) => (
                <option key={i} value={ph} />
              ))}
            </datalist>

            <label>Number of Guests</label>
            <input
              type="number"
              min={1}
              required
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
            />

            <label>Quantity of Menu Item</label>
            <input
              type="number"
              min={1}
              required
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />

            <label>Reservation Date</label>
            <DatePicker
              selected={reservationDate}
              onChange={setReservationDate}
              minDate={new Date()}
              excludeDates={unavailableDates}
              className="date-picker-input"
              placeholderText="Select Date"
              required
            />

            <label>Reservation Time</label>
            <input
              type="time"
              required
              value={reservationTime}
              onChange={(e) => setReservationTime(e.target.value)}
            />

            <p style={{ marginTop: '10px' }}>
              <strong>Total: ₦{total.toLocaleString()}</strong>
            </p>

            <p style={{ fontSize: '0.9rem', color: '#555', marginBottom: '10px', lineHeight: '1.3' }}>
              We reserve seats till 15 minutes after reservation time.
              <br />
              Call 3 hours before reservation time for reschedule.
            </p>

            <div className="modal-actions">
              <button type="submit" disabled={isSubmitting} className="submit-btn">
                Continue to Payment
              </button>
            </div>
          </form>
        ) : (
          <div className="payment-options">
            <h4>Select Payment Method</h4>
            <p style={{ marginBottom: '12px' }}>
              Total to Pay: <strong>₦{total.toLocaleString()}</strong>
            </p>

            {/* Only Paystack button is shown here (no Flutterwave) */}
            <button
              className="submit-btn"
              style={{ backgroundColor: '#0a3d62' }}
              onClick={handlePaystack}
              disabled={isSubmitting}
              data-pay="paystack"
            >
              Pay with Paystack
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookRestaurantModal;
