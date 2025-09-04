import React from 'react';
import PaystackPop from '@paystack/inline-js';
import { FlutterWaveButton, closePaymentModal } from 'flutterwave-react-v3';
import './PayFeatureModal.css';

const PayFeatureModal = ({
  resourceId,
  roomId, // fallback
  featureType,
  duration,
  price,
  vendor,
  resourceType = 'room',
  onClose,
  onSuccess,
}) => {
  // ✅ Fallback handling
  const actualResourceId = resourceId || roomId;

  // ❌ Defensive check for resource ID
  if (!actualResourceId) {
    console.error('❌ Missing both resourceId and roomId', {
      resourceId,
      roomId,
      featureType,
      duration,
      price,
      resourceType,
      vendor,
    });
    alert('❌ Missing resource ID. Please refresh and try again.');
    return null;
  }

  const reference = `FPAY-${Date.now()}`;
  const paystackKey = process.env.REACT_APP_PAYSTACK_PUBLIC_KEY;
  const flutterwaveKey = process.env.REACT_APP_FLUTTERWAVE_PUBLIC_KEY;

  const getApiPath = (gateway, referenceOrTxId) => {
    return `/api/featurelisting/${gateway}/${resourceType}s/verify/${referenceOrTxId}`;
  };

  const handleJsonResponse = async (res) => {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await res.json();
    } else {
      const text = await res.text();
      console.error('❌ Non-JSON response:', text.slice(0, 300));
      throw new Error('❌ Expected JSON response but received HTML or unexpected format.');
    }
  };

  const payWithPaystack = () => {
    if (!paystackKey) return alert('❌ Paystack key not configured.');
    if (!vendor?.email || !vendor?.name) return alert('❌ Vendor details missing.');
    const vendorToken = localStorage.getItem('vendorToken');
    if (!vendorToken) return alert('❌ Vendor not authenticated.');

    const paystack = new PaystackPop();

    paystack.newTransaction({
      key: paystackKey,
      email: vendor.email,
      amount: price * 100,
      metadata: {
        resourceId: actualResourceId,
        featureType,
        duration,
        vendorName: vendor.name,
        resourceType,
      },
      onSuccess: async (transaction) => {
        try {
          const res = await fetch(getApiPath('paystack', transaction.reference), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${vendorToken}`,
            },
            body: JSON.stringify({
              resourceId: actualResourceId,
              featureType,
              duration,
              resourceType,
            }),
          });

          const data = await handleJsonResponse(res);

          if (res.ok) {
            alert('✅ Payment successful and feature activated!');
            if (onSuccess) onSuccess(data);
            onClose();
          } else {
            alert('❌ Payment verified but feature activation failed.');
          }
        } catch (err) {
          console.error('❌ Paystack verification error:', err);
          alert(`❌ Error verifying Paystack payment: ${err.message}`);
        }
      },
      onCancel: () => alert('❌ Payment cancelled.'),
      onError: (e) => {
        console.error('❌ Paystack error:', e);
        alert(`❌ ${e.message || 'Transaction failed.'}`);
      },
    });
  };

  const flutterwaveConfig = {
    public_key: flutterwaveKey,
    tx_ref: reference,
    amount: price,
    currency: 'NGN',
    payment_options: 'card,mobilemoney,ussd',
    customer: {
      email: vendor?.email || '',
      name: vendor?.name || '',
    },
    customizations: {
      title: 'Feature Listing Payment',
      description: `${featureType.toUpperCase()} feature for ${duration}`,
      logo: '/logo192.png',
    },
    callback: async (response) => {
      const vendorToken = localStorage.getItem('vendorToken');
      if (!vendorToken) return alert('❌ Vendor not authenticated.');

      try {
        const res = await fetch(getApiPath('flutterwave', response.transaction_id), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${vendorToken}`,
          },
          body: JSON.stringify({
            resourceId: actualResourceId,
            resourceType,
            featureType,
            duration,
          }),
        });

        const data = await handleJsonResponse(res);

        if (res.ok) {
          alert('✅ Payment successful and feature activated!');
          if (onSuccess) onSuccess(data);
          onClose();
        } else {
          alert('❌ Payment verified but feature activation failed.');
        }
      } catch (err) {
        console.error('❌ Flutterwave verification error:', err);
        alert(`❌ Error verifying Flutterwave payment: ${err.message}`);
      }

      closePaymentModal();
    },
    onClose: () => {
      console.warn('❌ Flutterwave modal closed.');
    },
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content payment-modal">
        <button className="close-btn" onClick={onClose}>×</button>
        <h3>Complete Payment</h3>
        <p>Amount: <strong>₦{price.toLocaleString()}</strong></p>

        <button className="pay-btn paystack-btn" onClick={payWithPaystack}>
          Pay with Paystack
        </button>

        {flutterwaveKey && vendor?.email ? (
          <FlutterWaveButton
            {...flutterwaveConfig}
            className="pay-btn flutterwave-btn"
            text="Pay with Flutterwave"
          />
        ) : (
          <p style={{ color: 'red', marginTop: '1rem' }}>
            ❌ Flutterwave setup incomplete.
          </p>
        )}
      </div>
    </div>
  );
};

export default PayFeatureModal;
