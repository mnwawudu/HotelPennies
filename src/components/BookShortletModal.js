import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import { PaystackButton } from 'react-paystack';
import axios from '../utils/axiosConfig';
import 'react-datepicker/dist/react-datepicker.css';
import './BookShortletModal.css';

const BookShortletModal = ({ shortlet, onClose }) => {
  const [bookingInfo, setBookingInfo] = useState({
    fullName: '',
    email: '',
    phone: '',
    checkIn: null,
    checkOut: null,
    guests: 1,
    pickup: false,
    pickupLocation: '',
  });

  const [shortletState, setShortletState] = useState(shortlet?.state || null);
  const [pickupOptions, setPickupOptions] = useState([]);
  const [availablePickupPrices, setAvailablePickupPrices] = useState([]);
  const [pickupCost, setPickupCost] = useState(0);
  const [unavailableDates, setUnavailableDates] = useState([]);
  const [showGatewayOptions, setShowGatewayOptions] = useState(false);
  const [referralCode, setReferralCode] = useState(null);

  const pricePerNight = Number(shortlet.promoPrice || shortlet.price);
  const checkInDate = bookingInfo.checkIn;
  const checkOutDate = bookingInfo.checkOut;

  const nights =
    checkInDate && checkOutDate
      ? Math.max(1, Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)))
      : 0;

  const roomCost = pricePerNight * nights;
  const totalPrice = roomCost + (bookingInfo.pickup ? pickupCost : 0);

  useEffect(() => {
    // Get referralCode from localStorage
    const storedReferralCode = localStorage.getItem('referralCode');
    if (storedReferralCode) {
      setReferralCode(storedReferralCode);
    }

    const fetchAllData = async () => {
      try {
        const [shortletRes, pickupRes, unavailableRes] = await Promise.all([
          axios.get(`/api/shortlets/public/${shortlet._id}`),
          axios.get('/api/pickup-delivery/pickup/shortlet'),
          axios.get(`/api/shortlets/public/${shortlet._id}/unavailable-dates`)
        ]);
        setShortletState(shortletRes.data.state);
        setPickupOptions(pickupRes.data);
        const dates = unavailableRes.data.unavailableDates.map(date => {
          const d = new Date(date);
          d.setHours(0, 0, 0, 0);
          return d;
        });
        setUnavailableDates(dates);
      } catch (err) {
        console.error('❌ Failed to fetch shortlet data', err);
      }
    };

    fetchAllData();
  }, [shortlet._id]);

  useEffect(() => {
    if (bookingInfo.pickup && shortletState) {
      const cleanedState = shortletState?.toLowerCase().replace(/state|fct/gi, '').trim();
      const matches = pickupOptions.filter(
        (opt) =>
          opt.businessType === 'shortlet' &&
          opt.state?.toLowerCase().replace(/state|fct/gi, '').trim() === cleanedState
      );
      setAvailablePickupPrices(matches);
    } else {
      setAvailablePickupPrices([]);
      setPickupCost(0);
    }
  }, [bookingInfo.pickup, pickupOptions, shortletState]);

  useEffect(() => {
    const selected = availablePickupPrices.find(
      (opt) => opt._id === bookingInfo.pickupLocation
    );
    setPickupCost(Number(selected?.price || 0));
  }, [bookingInfo.pickupLocation, availablePickupPrices]);

  useEffect(() => {
    if (bookingInfo.pickup && availablePickupPrices.length === 1) {
      setBookingInfo((prev) => ({
        ...prev,
        pickupLocation: availablePickupPrices[0]._id,
      }));
    }
  }, [bookingInfo.pickup, availablePickupPrices]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setBookingInfo((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!bookingInfo.checkIn || !bookingInfo.checkOut) {
      alert('Please select check-in and check-out dates.');
      return;
    }

    setShowGatewayOptions(true);
  };

  const handlePaymentSuccess = async (reference) => {
    try {
      const token = localStorage.getItem('token');

      await axios.post(
        '/api/shortlet-bookings/verified',
        {
          ...bookingInfo,
          checkIn: bookingInfo.checkIn.toISOString(),
          checkOut: bookingInfo.checkOut.toISOString(),
          shortletId: shortlet._id,
          price: totalPrice,
          paymentReference: reference,
          paymentProvider: 'paystack',
          pickupCost,
          referredByUserId: referralCode || undefined,
        },
        token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      );

      alert('✅ Booking and payment successful!');
      onClose();
      setTimeout(() => {
        window.location.href = `/shortlets/${shortlet._id}`;
      }, 500);
    } catch (err) {
      console.error('❌ Booking error:', err);
      alert('❌ Booking succeeded but server failed to save booking.');
    }
  };

  const paystackConfig = {
    reference: new Date().getTime().toString(),
    email: bookingInfo.email,
    amount: totalPrice * 100,
    publicKey: (process.env.REACT_APP_PAYSTACK_PUBLIC_KEY || localStorage.getItem('PAYSTACK_PUBLIC_KEY') || '').trim(),

  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="modal-close-btn" onClick={onClose}>×</button>
        <h3 className="text-lg font-semibold mb-4">Book Shortlet - {shortlet.name}</h3>

        <p><strong>Shortlet State:</strong> {shortletState || 'Fetching...'}</p>
        <p><strong>Price per night:</strong> ₦{pricePerNight.toLocaleString()}</p>
        <p><strong>Nights:</strong> {nights}</p>
        {bookingInfo.pickup && <p><strong>Pickup Fee:</strong> ₦{pickupCost.toLocaleString()}</p>}
        <p><strong>Total:</strong> ₦{totalPrice.toLocaleString()}</p>

        <form onSubmit={handleSubmit} className="space-y-3 mt-3">
          <input type="text" name="fullName" placeholder="Your Full Name" value={bookingInfo.fullName} onChange={handleChange} required />
          <input type="email" name="email" placeholder="Email Address" value={bookingInfo.email} onChange={handleChange} required />
          <input type="tel" name="phone" placeholder="Phone Number" value={bookingInfo.phone} onChange={handleChange} required />

          <label>Check-In</label>
          <DatePicker
            selected={bookingInfo.checkIn}
            onChange={(date) => setBookingInfo(prev => ({ ...prev, checkIn: date }))}
            minDate={new Date()}
            excludeDates={unavailableDates}
            className="date-picker-input"
            placeholderText="Select Check-In Date"
            required
          />

          <label>Check-Out</label>
          <DatePicker
            selected={bookingInfo.checkOut}
            onChange={(date) => setBookingInfo(prev => ({ ...prev, checkOut: date }))}
            minDate={bookingInfo.checkIn || new Date()}
            excludeDates={unavailableDates}
            className="date-picker-input"
            placeholderText="Select Check-Out Date"
            required
          />

          <input type="number" name="guests" min="1" placeholder="Number of Guests" value={bookingInfo.guests} onChange={handleChange} required />

          <div className="flex items-center gap-4">
            <label className="pickup-toggle">
              <input
                type="checkbox"
                name="pickup"
                checked={bookingInfo.pickup}
                onChange={handleChange}
              />
              <span>Request Pickup</span>
            </label>

            {bookingInfo.pickup && (
              <select
                name="pickupLocation"
                value={bookingInfo.pickupLocation}
                onChange={handleChange}
                required
                className="flex-1"
              >
                <option value="">Select Pickup Option</option>
                {availablePickupPrices.map((opt) => (
                  <option key={opt._id} value={opt._id}>
                    {opt.title} - ₦{Number(opt.price).toLocaleString()}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="modal-action-buttons flex justify-end gap-4 mt-4">
            <button type="button" onClick={onClose} className="bg-gray-500 text-white px-4 py-2 rounded">Cancel</button>
            <button type="submit" className="bg-blue-900 text-white px-4 py-2 rounded">Proceed to Payment</button>
          </div>
        </form>

        {showGatewayOptions && (
          <div className="payment-method-modal-backdrop" onClick={() => setShowGatewayOptions(false)}>
            <div className="payment-method-modal" onClick={(e) => e.stopPropagation()}>
              <button className="payment-modal-close-btn" onClick={() => setShowGatewayOptions(false)}>×</button>
              <h4>Select Payment Method</h4>
              <div className="payment-buttons">
                <PaystackButton
                  {...paystackConfig}
                  text="Pay with Paystack"
                  className="paystack-button"
                  onSuccess={async (res) => {
                    try {
                      const verify = await axios.get(`/api/paystack/verify/${res.reference}`);
                      if (verify.data.verified) {
                        await handlePaymentSuccess(res.reference);
                      } else {
                        alert('❌ Payment not verified. Please try again.');
                      }
                    } catch (err) {
                      console.error('❌ Paystack verification failed:', err);
                      alert('❌ Could not verify Paystack payment.');
                    }
                  }}
                  onClose={() => console.log('Paystack modal closed')}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookShortletModal;
