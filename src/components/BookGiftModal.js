// 📄 src/components/BookGiftModal.js
import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import './BookGiftModal.css';

const BookGiftModal = ({ gift, qty, onClose }) => {
  // Gifts are delivery-only. Compute unit price and total.
  const unitPrice = Number(
    (gift?.promo === true || gift?.promo === 'true') ? gift?.promoPrice : gift?.price
  ) || 0;

  const computedQty = Math.max(1, Number(qty ?? 1));
  const computedTotal = unitPrice * computedQty;

  const [fullName, setFullName] = useState('');
  const [email, setEmail]       = useState('');
  const [phone, setPhone]       = useState('');
  const [address, setAddress]   = useState('');

  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [checkingDelivery, setCheckingDelivery]     = useState(false);

  const PAYSTACK_PUBLIC_KEY = 'pk_test_f4e7df49f0ea642233e1f0a4ea62acb526f166e3';

  // ✅ Keep Paystack script load
  useEffect(() => {
    if (!document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]')) {
      const ps = document.createElement('script');
      ps.src = 'https://js.paystack.co/v1/inline.js';
      ps.async = true;
      document.body.appendChild(ps);
    }
  }, []);

  // ---- helpers (frontend only) ----
  const extractStateFromAddress = (addr) => {
    const parts = String(addr || '').split(',').map(p => p.trim()).filter(Boolean);
    return parts[parts.length - 1] || '';
  };

  const normalizeState = (state) =>
    String(state || '')
      .toLowerCase()
      .replace(/\bstate\b/g, '')
      .trim()
      .replace(/\b\w/g, c => c.toUpperCase());

  const checkStateAvailability = async (state) => {
    try {
      const res = await axios.get(`/api/pickup-delivery/check-availability/${state}/gifts`);
      return !!res.data?.available;
    } catch (err) {
      console.error('❌ Error checking state availability:', err);
      return false;
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!fullName.trim()) return alert('Please enter your full name.');
    if (!email || !email.includes('@')) return alert('Please enter a valid email address.');
    if (!phone.trim()) return alert('Please enter your phone number.');
    if (!address.trim()) return alert('Please enter your delivery address (include State).');

    const rawState = extractStateFromAddress(address);
    if (!rawState) return alert('Could not detect state from address. Please include it.');
    const normalized = normalizeState(rawState);

    setCheckingDelivery(true);
    const available = await checkStateAvailability(normalized.toLowerCase());
    setCheckingDelivery(false);

    if (!available) {
      return alert('Sorry, delivery is currently not available in your state.');
    }

    setShowPaymentOptions(true);
  };

  const saveBooking = async (paymentReference) => {
    try {
      const payload = {
        giftId: gift._id,
        fullName,
        email,
        phone,
        address,                  // required (delivery-only)
        quantity: computedQty,    // number
        total: computedTotal,     // unitPrice × qty
        paymentReference,
        paymentProvider: 'paystack',
      };

      await axios.post('/api/gifts/bookings/verified', payload);
      alert('Booking successful! Thank you for your purchase.');
      onClose?.();
    } catch (error) {
      console.error('❌ Booking saving failed:', error);
      alert(error?.response?.data?.error || 'Booking failed. Please contact support.');
    }
  };

  const handlePaystackPayment = () => {
    if (!window.PaystackPop) {
      alert('Paystack is still loading. Please wait.');
      return;
    }

    const handler = window.PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email,
      amount: computedTotal * 100,
      currency: 'NGN',
      ref: `HP-GIFT-${Date.now()}`,
      metadata: {
        custom_fields: [
          { display_name: 'Full Name',   variable_name: 'full_name',   value: fullName },
          { display_name: 'Phone Number',variable_name: 'phone_number',value: phone    },
        ],
      },
      callback: (response) => saveBooking(response.reference),
      onClose: () => alert('Payment was not completed.'),
    });

    handler.openIframe();
  };

  return (
    <div className="book-gift-modal-overlay">
      <div className="book-gift-modal-box">
        <button onClick={onClose} className="book-gift-modal-close">×</button>
        <h2 className="text-xl font-semibold mb-4">Book Gift</h2>

        {!showPaymentOptions ? (
          <form onSubmit={handleFormSubmit} className="space-y-4" autoComplete="on">
            {/* ✅ Use browser autofill suggestions, not prefill */}
            <input
              type="text"
              name="name"                    // ✅ ADDED
              autoComplete="name"            // ✅ ADDED
              placeholder="Full Name"
              className="book-gift-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <input
              type="email"
              name="email"                   // ✅ ADDED
              autoComplete="email"           // ✅ ADDED
              placeholder="Email Address"
              className="book-gift-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="tel"
              name="tel"                     // ✅ ADDED
              autoComplete="tel"             // ✅ ADDED
              placeholder="Phone Number"
              className="book-gift-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            {/* Always required for Gifts (delivery-only) */}
            <textarea
              name="street-address"          // ✅ ADDED
              autoComplete="street-address"  // ✅ ADDED
              placeholder="Delivery Address (include State)"
              className="book-gift-input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />

            <div style={{ fontSize: 14, color: '#333' }}>
              <div><strong>Unit price:</strong> ₦{unitPrice.toLocaleString()}</div>
              <div><strong>Quantity:</strong> {computedQty}</div>
              <div><strong>Total:</strong> ₦{computedTotal.toLocaleString()}</div>
            </div>

            <button type="submit" className="book-gift-button submit" disabled={checkingDelivery}>
              {checkingDelivery ? 'Checking Delivery…' : 'Proceed to Payment'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-center text-sm text-gray-600">
              Pay with Paystack to complete your booking:
            </p>
            <button onClick={handlePaystackPayment} className="book-gift-button paystack">
              Pay ₦{computedTotal.toLocaleString()} with Paystack
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookGiftModal;
