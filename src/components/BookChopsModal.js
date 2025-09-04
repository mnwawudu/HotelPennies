// 📄 src/components/BookChopsModal.js
import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import './BookChopsModal.css';

const BookChopsModal = ({ chop, quantity, total, onClose }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail]       = useState('');
  const [phone, setPhone]       = useState('');
  const [address, setAddress]   = useState('');
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [checkingDelivery, setCheckingDelivery]     = useState(false);

  const PAYSTACK_PUBLIC_KEY = 'pk_test_f4e7df49f0ea642233e1f0a4ea62acb526f166e3';

  // Compute price safely (supports either `promo` or `usePromo` flags)
  const unitPrice = Number(
    (chop?.promo === true || chop?.promo === 'true' || chop?.usePromo)
      ? chop?.promoPrice
      : chop?.price
  ) || 0;

  const computedQty    = Math.max(1, Number(quantity ?? 1));
  const computedTotal  = unitPrice * computedQty;            // authoritative total
  const displayTotal   = Number.isFinite(total) ? total : computedTotal; // UI label only

  // Load Paystack inline script once
  useEffect(() => {
    if (!document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]')) {
      const ps = document.createElement('script');
      ps.src = 'https://js.paystack.co/v1/inline.js';
      ps.async = true;
      document.body.appendChild(ps);
    }
  }, []);

  // ----- helpers -----
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

  // ----- form submit → pre-check delivery availability, then show payment button -----
  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!email || !email.includes('@')) return alert('Please enter a valid email address.');
    if (!fullName.trim()) return alert('Please enter your full name.');
    if (!phone.trim()) return alert('Please enter your phone number.');

    if (chop?.hasDelivery) {
      if (!address.trim()) return alert('Please enter your delivery address.');
      const stateRaw = extractStateFromAddress(address);
      if (!stateRaw) return alert('Could not detect state from address. Please include it.');

      const normalized = normalizeState(stateRaw);
      setCheckingDelivery(true);
      try {
        // Use lower-case in the path segment to match the backend route
        const res = await axios.get(`/api/pickup-delivery/check-availability/${normalized.toLowerCase()}/chops`);
        if (res.data?.available) {
          setShowPaymentOptions(true);
        } else {
          alert('Sorry, delivery is currently not available in your state.');
        }
      } catch (err) {
        console.error('❌ Failed to check delivery availability:', err);
        alert('Could not verify delivery availability. Try again later.');
      } finally {
        setCheckingDelivery(false);
      }
      return;
    }

    // For non-delivery chops (if that ever exists), proceed straight to payment
    setShowPaymentOptions(true);
  };

  // ----- save after payment (server verifies payment reference) -----
  const saveBooking = async (paymentReference) => {
    try {
      const payload = {
        chopId: chop?._id,
        fullName,
        email,
        phone,
        address: chop?.hasDelivery ? address : 'N/A',
        quantity: computedQty,
        total:    computedTotal,           // send authoritative total
        paymentReference,
        paymentProvider: 'paystack',
      };

      // Server route performs verification then saves booking
      await axios.post('/api/chops/bookings', payload);

      alert('Booking successful! Thank you for your purchase.');
      onClose?.();
    } catch (error) {
      console.error('❌ Booking saving failed:', error);
      alert(error?.response?.data?.error || 'Booking failed. Please contact support.');
    }
  };

  // ----- Paystack popup -----
  const handlePaystackPayment = () => {
    if (!window.PaystackPop) {
      alert('Paystack is still loading. Please wait.');
      return;
    }

    const handler = window.PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email,
      amount: computedTotal * 100, // charge exact computed total
      currency: 'NGN',
      ref: `HP-CHOP-${Date.now()}`,
      metadata: {
        custom_fields: [
          { display_name: 'Full Name',  variable_name: 'full_name',  value: fullName },
          { display_name: 'Phone',      variable_name: 'phone',      value: phone    },
        ],
      },
      callback: (response) => saveBooking(response.reference),
      onClose: () => alert('Payment was not completed.'),
    });

    handler.openIframe();
  };

  return (
    <div className="book-chops-modal-overlay">
      <div className="book-chops-modal-box">
        <button onClick={onClose} className="book-chops-modal-close">×</button>
        <h2 className="text-xl font-semibold mb-4">Book Chop</h2>

        {!showPaymentOptions ? (
          <form onSubmit={handleFormSubmit} className="space-y-4" autoComplete="on">
            <input
              type="text"
              name="name"                   // ✅ autofill
              autoComplete="name"           // ✅ autofill
              placeholder="Full Name"
              className="book-chops-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <input
              type="email"
              name="email"                  // ✅ autofill
              autoComplete="email"          // ✅ autofill
              placeholder="Email Address"
              className="book-chops-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="tel"
              name="tel"                    // ✅ autofill
              autoComplete="tel"            // ✅ autofill
              placeholder="Phone Number"
              className="book-chops-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            {chop?.hasDelivery && (
              <textarea
                name="street-address"       // ✅ autofill
                autoComplete="street-address" // ✅ autofill
                placeholder="Delivery Address (include State)"
                className="book-chops-input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            )}

            <div style={{ fontSize: 14, color: '#333' }}>
              <div><strong>Unit price:</strong> ₦{unitPrice.toLocaleString()}</div>
              <div><strong>Quantity:</strong> {computedQty}</div>
              <div><strong>Total:</strong> ₦{computedTotal.toLocaleString()}</div>
            </div>

            <button type="submit" className="book-chops-button submit" disabled={checkingDelivery}>
              {checkingDelivery ? 'Checking Delivery...' : `Proceed to Payment (₦${displayTotal.toLocaleString()})`}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-center text-sm text-gray-600">
              Pay with Paystack to complete your booking:
            </p>
            <button onClick={handlePaystackPayment} className="book-chops-button paystack">
              Pay ₦{computedTotal.toLocaleString()} with Paystack
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookChopsModal;
