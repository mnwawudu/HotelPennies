// 📁 src/components/BookRoomModal.js
import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import './BookRoomModal.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

/**
 * 🔑 Resolve Paystack key at call-time.
 * Order of precedence:
 *   1) localStorage.PAYSTACK_PUBLIC_KEY (handy for dev testing)
 *   2) process.env.REACT_APP_PAYSTACK_PUBLIC_KEY (normal prod/dev config)
 *   3) DEV-ONLY fallback test key (never used on non-localhost)
 */
const resolvePaystackKey = () => {
  const fromStorage = (typeof window !== 'undefined' && localStorage.getItem('PAYSTACK_PUBLIC_KEY')) || '';
  if (fromStorage && fromStorage.trim()) return fromStorage.trim();

  const fromEnv = (process.env.REACT_APP_PAYSTACK_PUBLIC_KEY || '').trim();
  if (fromEnv) return fromEnv;

  const host = (typeof window !== 'undefined' && window.location && window.location.hostname) || '';
  const isLocalhost = /^localhost$|^127\.0\.0\.1$/i.test(host);
  // If truly local dev, allow a test key fallback; otherwise return empty to fail fast in prod
  return isLocalhost ? 'pk_test_f4e7df49f0ea642233e1f0a4ea62acb526f166e3' : '';
};

// ✅ normalize any picked date to local *noon* to avoid timezone rollbacks
const stripToNoon = (d) => {
  if (!d) return null;
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  return x;
};

// ✅ helper for YYYY-MM-DD string expected by backend
const toYMD = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ✅ lazy-load Paystack inline script once
const ensurePaystack = () =>
  new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve(true);
    const existing = document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => reject(new Error('Paystack script failed to load')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://js.paystack.co/v1/inline.js';
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => reject(new Error('Paystack script failed to load'));
    document.body.appendChild(s);
  });

const BookRoomModal = ({ room, onClose }) => {
  const [bookingInfo, setBookingInfo] = useState({
    fullName: '',
    email: '',
    phone: '',
    checkIn: null,
    checkOut: null,
    guests: 1,
    rooms: 1,
    pickup: false,
    pickupLocation: '',
  });

  const [pickupOptions, setPickupOptions] = useState([]);
  const [pickupCost, setPickupCost] = useState(0);
  const [showGatewayModal, setShowGatewayModal] = useState(false);
  const [unavailableDates, setUnavailableDates] = useState([]);
  const [referredByUserId, setReferredByUserId] = useState(null);
  const [buyerUserId, setBuyerUserId] = useState(null);

  // 🔗 Absorb ?ref, ?referral, or ?code into localStorage on first render
  useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      const refParam = qs.get('ref') || qs.get('referral') || qs.get('code');
      if (refParam) localStorage.setItem('referralCode', refParam);
    } catch {}
  }, []);

  // ⚙️ Main bootstrap (pickup options, room unavailable dates, referral lookups, logged-in user)
  useEffect(() => {
    const fetchPickup = async () => {
      try {
        const res = await axios.get('/api/pickup-delivery/pickup/hotel');
        setPickupOptions(res.data || []);
      } catch {
        /* silent */
      }
    };

    const fetchUnavailableDates = async () => {
      try {
        const res = await axios.get(`/api/hotel-rooms/${room._id}/unavailable-dates`);
        const formatted = (res.data.unavailableDates || []).map((dateStr) => {
          const d = new Date(dateStr);
          d.setHours(12, 0, 0, 0); // ✅ noon to match picker normalization
          return d;
        });
        setUnavailableDates(formatted);
      } catch (err) {
        console.error('Failed to fetch room unavailable dates', err);
      }
    };

    const fetchReferralUser = async () => {
      // 1) Direct dev override: localStorage.hp_ref_user_id
      const directRefId = localStorage.getItem('hp_ref_user_id');
      if (directRefId) {
        setReferredByUserId(directRefId);
        return;
      }
      // 2) Referral code flow
      const referralCode = localStorage.getItem('referralCode');
      if (!referralCode) return;
      try {
        const res = await axios.get(`/api/user/code/${referralCode}`);
        setReferredByUserId(res.data.userId || null);
      } catch {
        setReferredByUserId(null);
      }
    };

    // Prefill buyer if logged in
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        if (parsed?._id) setBuyerUserId(parsed._id);
        if (parsed?.email) {
          setBookingInfo((prev) => ({
            ...prev,
            email: parsed.email,
            fullName: parsed.name || '',
          }));
        }
      } catch {
        // ignore
      }
    }

    fetchPickup();
    fetchUnavailableDates();
    fetchReferralUser();
  }, [room]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    setBookingInfo((prev) => ({ ...prev, [name]: newValue }));

    if (name === 'pickup' && checked) {
      const match = pickupOptions.find((opt) => opt.state === room.state);
      if (match) {
        setPickupCost(Number(match.price || 0));
        setBookingInfo((prev) => ({ ...prev, pickupLocation: match.title || '' }));
      } else {
        setPickupCost(0);
        setBookingInfo((prev) => ({ ...prev, pickupLocation: '' }));
      }
    } else if (name === 'pickup' && !checked) {
      setPickupCost(0);
      setBookingInfo((prev) => ({ ...prev, pickupLocation: '' }));
    }
  };

  const totalPrice = () => {
    const ci = bookingInfo.checkIn;
    const co = bookingInfo.checkOut;
    const nights = ci && co ? Math.max(1, Math.round((co - ci) / 86400000)) : 1;
    const roomsCount = Math.max(1, Number(bookingInfo.rooms || 1));
    const basePerRoom = Number(room.promoPrice || room.price);
    const base = nights * basePerRoom * roomsCount;
    return base + (bookingInfo.pickup ? pickupCost : 0);
  };

  const validateForm = () => {
    const { fullName, email, phone, checkIn, checkOut, guests, rooms } = bookingInfo;
    if (!fullName || !email || !phone) return 'Please fill in full name, email and phone.';
    if (!checkIn || !checkOut) return 'Please select both check-in and check-out dates.';
    if (new Date(checkOut) <= new Date(checkIn)) return 'Check-out must be after check-in.';
    if (Number(guests) < 1 || Number(rooms) < 1) return 'Guests and rooms must be at least 1.';
    if (!/^\S+@\S+\.\S+$/.test(email)) return 'Please enter a valid email.';

    // 🔑 check key at call-time (dev/prod safe)
    const pk = resolvePaystackKey();
    if (!pk) return 'Paystack key is not configured.';

    return '';
  };

  const handlePayment = async () => {
    const err = validateForm();
    if (err) {
      alert(err);
      return;
    }

    // Build YYYY-MM-DD list for selected range (inclusive) and check overlap
    const dateRange = [];
    let current = new Date(bookingInfo.checkIn);
    const end = new Date(bookingInfo.checkOut);
    while (current <= end) {
      const clone = new Date(current);
      clone.setHours(12, 0, 0, 0);
      dateRange.push(toYMD(clone));
      current.setDate(current.getDate() + 1);
    }
    const formattedUnavailable = unavailableDates.map((d) => toYMD(d));
    const overlap = dateRange.some((d) => formattedUnavailable.includes(d));
    if (overlap) {
      alert('❌ Selected dates include unavailable room dates. Please choose different dates.');
      return;
    }

    const reference = `HP-HOT-${room._id}-${Date.now()}`;
    const priceNaira = totalPrice();
    const amountKobo = Math.max(0, Math.round(priceNaira * 100));

    const hotelId = room.hotel?._id || room.hotel || room.hotelId;
    if (!hotelId) {
      alert('Missing hotel ID for booking.');
      return;
    }

    const roomsCount = Math.max(1, Number(bookingInfo.rooms || 1));
    const roomsPayload = [{ roomId: room._id, qty: roomsCount }];

    const verifyAndSaveBooking = async () => {
      try {
        // 🚫 prevent self-referral
        const refIdToSend =
          referredByUserId && buyerUserId && String(referredByUserId) === String(buyerUserId)
            ? undefined
            : referredByUserId || undefined;

        await axios.post('/api/bookings/hotel/verified', {
          ...bookingInfo,
          fullName: String(bookingInfo.fullName || '').trim(),
          email: String(bookingInfo.email || '').trim().toLowerCase(),
          phone: String(bookingInfo.phone || '').trim(),
          checkIn: toYMD(bookingInfo.checkIn),
          checkOut: toYMD(bookingInfo.checkOut),
          hotelId,
          roomId: room._id,          // legacy compatibility
          rooms: roomsPayload,       // used by backend to resolve vendorId
          price: priceNaira,
          paymentReference: reference,
          paymentProvider: 'paystack',
          buyerUserId: buyerUserId || undefined,
          referredByUserId: refIdToSend,

          // ✅ harmless hints so backend can trigger our branded email
          sendEmail: true,
          category: 'Hotel',
          titleHint: room?.hotel?.name || room?.name || 'Hotel booking',
        });

        alert('✅ Booking successful. A confirmation email has been sent to you.');
        setShowGatewayModal(false);
        onClose();
      } catch (err) {
        console.error('❌ Booking save failed:', err);
        alert(err?.response?.data?.error || '❌ Booking could not be saved. Please try again.');
      }
    };

    try {
      await ensurePaystack(); // ✅ lazy-load Paystack if needed
    } catch (e) {
      alert(e.message || 'Paystack could not be initialized.');
      return;
    }

    // 🔑 use resolved key at the moment of opening Paystack
    const pk = resolvePaystackKey();
    if (!pk) {
      alert('Paystack key is not configured.');
      return;
    }

    const handler = window.PaystackPop.setup({
      key: pk,
      email: bookingInfo.email,
      amount: amountKobo,
      currency: 'NGN',
      ref: reference,
      metadata: {
        custom_fields: [
          { display_name: 'Full Name', variable_name: 'full_name', value: bookingInfo.fullName },
          { display_name: 'Phone', variable_name: 'phone', value: bookingInfo.phone },
          { display_name: 'Rooms', variable_name: 'rooms', value: String(roomsCount) },
          { display_name: 'Hotel ID', variable_name: 'hotel_id', value: String(hotelId) },
          { display_name: 'Room ID', variable_name: 'room_id', value: String(room._id) },
        ],
      },
      callback: function () {
        // rely on server-side verification/webhook logic; then persist booking
        verifyAndSaveBooking();
      },
      onClose: function () {
        alert('Payment window closed.');
      },
    });

    handler.openIframe();
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Book Room</h2>

        <input
          name="fullName"
          placeholder="Full Name"
          value={bookingInfo.fullName}
          onChange={handleChange}
        />
        <input
          name="email"
          placeholder="Email"
          value={bookingInfo.email}
          onChange={handleChange}
        />
        <input
          name="phone"
          placeholder="Phone"
          value={bookingInfo.phone}
          onChange={handleChange}
        />

        {/* Check-In */}
        <DatePicker
          selected={bookingInfo.checkIn}
          onChange={(date) =>
            setBookingInfo((prev) => ({ ...prev, checkIn: stripToNoon(date) })) // ✅ noon-anchor
          }
          minDate={today}
          excludeDates={unavailableDates}
          placeholderText="Check-in Date"
          className="date-picker-input"
          required
        />

        {/* Check-Out */}
        <DatePicker
          selected={bookingInfo.checkOut}
          onChange={(date) =>
            setBookingInfo((prev) => ({ ...prev, checkOut: stripToNoon(date) })) // ✅ noon-anchor
          }
          minDate={today}
          excludeDates={unavailableDates}
          placeholderText="Check-out Date"
          className="date-picker-input"
          required
        />

        {/* Guests & Rooms inline */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Guests</label>
            <input
              type="number"
              min={1}
              name="guests"
              value={bookingInfo.guests}
              onChange={handleChange}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Rooms</label>
            <input
              type="number"
              min={1}
              name="rooms"
              value={bookingInfo.rooms}
              onChange={handleChange}
            />
          </div>
        </div>

        <label className="pickup-label" style={{ marginTop: 8 }}>
          <input
            type="checkbox"
            name="pickup"
            checked={bookingInfo.pickup}
            onChange={handleChange}
          />
          Request Pickup
        </label>

        {bookingInfo.pickup && (
          <p className="pickup-info">Pickup Cost: ₦{pickupCost.toLocaleString()}</p>
        )}

        <button
          className="pay-btn"
          onClick={() => setShowGatewayModal(true)}
          disabled={!bookingInfo.checkIn || !bookingInfo.checkOut}
          title={!bookingInfo.checkIn || !bookingInfo.checkOut ? 'Select dates to continue' : ''}
        >
          Proceed to Payment (₦{totalPrice().toLocaleString()})
        </button>

        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      {showGatewayModal && (
        <div className="gateway-popup">
          <div className="gateway-content">
            <h3>Confirm Payment</h3>
            <button className="paystack-popup-btn" onClick={handlePayment}>
              Pay with Paystack
            </button>
            <button className="popup-close" onClick={() => setShowGatewayModal(false)}>×</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookRoomModal;
