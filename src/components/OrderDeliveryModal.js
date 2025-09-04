// 📄 src/components/OrderDeliveryModal.js
import React, { useState } from 'react';
import './OrderDeliveryModal.css';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axiosConfig';

// ——— helpers for suggestions (non-invasive) ———
const getRecent = (key) => {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
};
const remember = (key, val) => {
  if (!val) return;
  const list = getRecent(key);
  const next = [String(val)].concat(list.filter((x) => x !== String(val))).slice(0, 5);
  localStorage.setItem(key, JSON.stringify(next));
};
const getProfileEmail = () => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return '';
    const u = JSON.parse(raw);
    return u?.email || '';
  } catch { return ''; }
};

const OrderDeliveryModal = ({ menu, restaurant, onClose }) => {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState(getProfileEmail() || ''); // ✅ ADDED
  const [phone, setPhone] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const price = Number(menu.promoPrice || menu.price);
  const deliveryFee = 2000;
  const total = quantity * price + deliveryFee;

  const handleInitialSubmit = (e) => {
    e.preventDefault();
    remember('recentDelNames', fullName);
    remember('recentDelEmails', email);
    remember('recentDelPhones', phone);
    remember('recentDelAddresses', address);
    setShowPaymentOptions(true);
  };

  const submitBooking = async (paymentProvider, paymentReference) => {
    setIsSubmitting(true);
    try {
      const payload = {
        fullName,
        email, // ✅ use real email
        phone,
        restaurantId: restaurant._id,
        bookingType: 'delivery',
        deliveryLocation: address,
        menuItems: [{ title: menu.title, price, quantity }],
        totalPrice: total,
        paymentStatus: 'paid',
        paymentProvider,
        paymentReference,
      };
      if (notes.trim()) payload.notes = notes.trim();

      // ✅ CHANGED: hit verified endpoint so backend verifies & emails confirmation
      const res = await axios.post('/api/restaurant-bookings/verified', payload);

      console.log('Booking successful response:', res.data);
      alert('Order placed successfully!');
      setIsSubmitting(false);
      onClose();
      navigate(`/restaurants/${restaurant._id}`);
    } catch (err) {
      setIsSubmitting(false);
      console.error('Booking save failed:', err.response || err.message || err);
      alert('Payment succeeded but order failed.');
    }
  };

  const handlePaystack = () => {
    const handler = window.PaystackPop?.setup({
      key: 'pk_test_f4e7df49f0ea642233e1f0a4ea62acb526f166e3',
      email, // ✅ use real email
      amount: total * 100,
      currency: 'NGN',
      ref: `HP-DEL-${Date.now()}`,
      metadata: {
        custom_fields: [
          { display_name: fullName, variable_name: 'phone', value: phone },
        ],
      },
      callback: function (response) {
        console.log('[✅ Paystack Delivery Success]', response);
        submitBooking('paystack', response.reference);
      },
      onClose: function () {
        alert('Payment cancelled.');
      },
    });

    handler?.openIframe();
  };

  // FW logic kept but not rendered (per request)
  const handleFlutterwave = () => {
    if (!window.FlutterwaveCheckout) return alert('Flutterwave not loaded');
    let callbackInvoked = false;
    window.FlutterwaveCheckout({
      public_key: 'FLWPUBK_TEST-cbc45a74444b9bdc51a7fa3387757f14-X',
      tx_ref: `HP-DEL-${Date.now()}`,
      amount: total,
      currency: 'NGN',
      payment_options: 'card,ussd,banktransfer',
      customer: { email, phonenumber: phone, name: fullName },
      customizations: {
        title: 'HotelPennies Restaurant Order',
        description: `${menu.title} - Quantity: ${quantity}`,
        logo: restaurant.mainImage || '/logo.png',
      },
      callback: async function (response) {
        if (callbackInvoked) return;
        callbackInvoked = true;
        try {
          await submitBooking('flutterwave', response.transaction_id || response.tx_ref);
          alert('Order placed successfully!');
          onClose();
          navigate(`/restaurants/${restaurant._id}`);
        } catch (error) {
          console.error('Error in submitBooking:', error);
          alert('Payment succeeded but order failed.');
        }
      },
      onclose: function () {
        if (!callbackInvoked) alert('Payment window closed.');
      },
    });
  };

  const recentNames = getRecent('recentDelNames');
  const recentEmails = getRecent('recentDelEmails');
  const recentPhones = getRecent('recentDelPhones');
  const recentAddresses = getRecent('recentDelAddresses');

  return (
    <div className="modal-backdrop">
      <div className="modal-container">
        <button className="modal-close-btn" onClick={onClose} disabled={isSubmitting}>
          &times;
        </button>
        <h2>Order for Delivery</h2>
        <p>
          <strong>{menu.title}</strong> from <strong>{restaurant.name}</strong>
        </p>

        {!showPaymentOptions ? (
          <form onSubmit={handleInitialSubmit} className="modal-form">
            <label>Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isSubmitting}
              autoComplete="name"
              list="del-names"
            />
            <datalist id="del-names">
              {recentNames.map((v, i) => <option key={i} value={v} />)}
            </datalist>

            {/* ✅ Email field */}
            <label>Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              autoComplete="email"
              list="del-emails"
            />
            <datalist id="del-emails">
              {[...new Set(recentEmails.concat(getProfileEmail() ? [getProfileEmail()] : []))]
                .filter(Boolean)
                .map((v, i) => <option key={i} value={v} />)}
            </datalist>

            <label>Delivery Address</label>
            <textarea
              rows={2}
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={isSubmitting}
              list="del-addresses"
            />
            <datalist id="del-addresses">
              {recentAddresses.map((v, i) => <option key={i} value={v} />)}
            </datalist>

            <label>Phone Number</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isSubmitting}
              autoComplete="tel"
              list="del-phones"
            />
            <datalist id="del-phones">
              {recentPhones.map((v, i) => <option key={i} value={v} />)}
            </datalist>

            <label>Quantity</label>
            <input
              type="number"
              min={1}
              required
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              disabled={isSubmitting}
            />

            <label>Notes (Optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. No onions, call on arrival"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
            />

            <p style={{ marginTop: '10px' }}>
              <strong>Total: ₦{total.toLocaleString()}</strong>
              <br />
              <span style={{ fontSize: '0.85rem', color: '#b00' }}>
                ⚠️ Delivery fee of ₦2,000 included in total.
              </span>
            </p>

            <div className="modal-actions">
              <button type="submit" className="submit-btn" disabled={isSubmitting}>
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
            <button
              className="submit-btn"
              style={{ backgroundColor: '#0a3d62' }}
              onClick={handlePaystack}
              disabled={isSubmitting}
            >
              Pay with Paystack
            </button>
            {/* ⛔ Flutterwave button intentionally hidden for delivery */}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderDeliveryModal;
