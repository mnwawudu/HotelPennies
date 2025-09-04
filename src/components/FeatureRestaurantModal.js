// ✅ components/FeatureRestaurantModal.js
import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import PayFeatureModal from './PayFeatureModal';
import './FeatureMenuModal.css';

// Default pricing (used until admin pricing loads or as fallback)
const FEATURE_PRICING_DEFAULT = {
  local: { '7d': 1500, '1m': 4000, '6m': 10000, '1y': 18000 },
  global: { '7d': 3500, '1m': 8000, '6m': 18000, '1y': 30000 },
};

const DURATION_LABELS = {
  '7d': '7 Days',
  '1m': '1 Month',
  '6m': '6 Months',
  '1y': '1 Year',
};

const ORDERED_DURATIONS = ['7d', '1m', '6m', '1y'];

const FeatureRestaurantModal = ({ item, onClose, onSuccess }) => {
  const [selectedType, setSelectedType] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('');
  const [vendor, setVendor] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // ✅ live pricing (merged over defaults)
  const [pricing, setPricing] = useState(FEATURE_PRICING_DEFAULT);

  // Fetch admin pricing
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axios.get('/api/feature-pricing');
        const rows = Array.isArray(res.data) ? res.data : [];

        const map = { local: {}, global: {} };
        for (const r of rows) {
          const t = String(r?.type || '').toLowerCase();       // 'local' | 'global'
          const d = String(r?.duration || '').toLowerCase();   // '7d' | '1m' | '6m' | '1y'
          const p = Number(r?.price);
          if ((t === 'local' || t === 'global') && ORDERED_DURATIONS.includes(d) && Number.isFinite(p)) {
            map[t][d] = p;
          }
        }

        if (mounted) {
          setPricing(prev => ({
            local: { ...prev.local, ...map.local },
            global: { ...prev.global, ...map.global },
          }));
        }
      } catch (err) {
        // keep defaults; silent failure so vendor can still proceed
        console.error('❌ Failed to fetch feature pricing (restaurant):', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const getPrice = () => {
    if (!selectedType || !selectedDuration) return 0;
    const scope = pricing[selectedType] || {};
    const val = scope[selectedDuration];
    return Number.isFinite(Number(val)) ? Number(val) : 0;
  };

  useEffect(() => {
    const fetchVendor = async () => {
      try {
        const token =
          localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');

        const res = await axios.get('/api/vendor/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });

        setVendor(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch vendor profile:', err);
        alert('Failed to load vendor profile. Please refresh.');
      }
    };

    fetchVendor();
  }, []);

  const handleProceedToPay = () => {
    if (!selectedType || !selectedDuration) {
      alert('Please select both type and duration.');
      return;
    }

    if (!vendor) {
      alert('Vendor details not available. Cannot continue.');
      return;
    }

    setShowPaymentModal(true);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-btn" onClick={onClose}>×</button>
        <h2 className="modal-title">Feature This Restaurant</h2>

        <div className="modal-section">
          <p>Select Feature Type:</p>
          <div className="radio-group">
            {['local', 'global'].map((type) => (
              <label key={type} className="inline-label">
                <input
                  type="radio"
                  name="featureType"
                  value={type}
                  checked={selectedType === type}
                  onChange={() => {
                    setSelectedType(type);
                    setSelectedDuration('');
                  }}
                />
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </label>
            ))}
          </div>
        </div>

        {selectedType && (
          <div className="modal-section">
            <p>Select Duration:</p>
            <div className="radio-group">
              {ORDERED_DURATIONS.map((dur) => (
                <label key={dur} className="inline-label">
                  <input
                    type="radio"
                    name="duration"
                    value={dur}
                    checked={selectedDuration === dur}
                    onChange={() => setSelectedDuration(dur)}
                  />
                  {DURATION_LABELS[dur]} (₦{(pricing[selectedType]?.[dur] ?? 0).toLocaleString()})
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button
            onClick={handleProceedToPay}
            disabled={!selectedType || !selectedDuration || !vendor}
            className="confirm-btn"
          >
            Proceed to Pay ₦{getPrice().toLocaleString()}
          </button>
        </div>
      </div>

      {/* ✅ Payment Modal */}
      {showPaymentModal && vendor && (
        <PayFeatureModal
          roomId={item._id}            // keep for compatibility as you noted
          featureType={selectedType}
          duration={selectedDuration}
          price={getPrice()}
          vendor={vendor}
          resourceType="restaurant"
          onClose={() => setShowPaymentModal(false)}
          onSuccess={(data) => {
            setShowPaymentModal(false);
            alert('✅ Restaurant successfully featured!');
            if (onSuccess) onSuccess(data);
            onClose();
          }}
        />
      )}
    </div>
  );
};

export default FeatureRestaurantModal;
