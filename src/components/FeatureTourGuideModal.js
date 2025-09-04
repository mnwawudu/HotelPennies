// ✅ components/FeatureTourGuideModal.js
import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import PayFeatureModal from './PayFeatureModal';
import './FeatureMenuModal.css'; // reuse same style

// Fallback pricing (used until admin pricing loads or if a duration is missing)
const FEATURE_PRICING_DEFAULT = {
  local: {
    '7d': 1500,
    '1m': 4000,
    '6m': 10000,
    '1y': 18000,
  },
  global: {
    '7d': 3500,
    '1m': 8000,
    '6m': 18000,
    '1y': 30000,
  },
};

const DURATION_LABELS = {
  '7d': '7 Days',
  '1m': '1 Month',
  '6m': '6 Months',
  '1y': '1 Year',
};

const ORDERED_DURATIONS = ['7d', '1m', '6m', '1y'];

const FeatureTourGuideModal = ({ tourguideId, onClose, onUpdated }) => {
  const [selectedType, setSelectedType] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('');
  const [vendor, setVendor] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Live pricing state (merged over defaults)
  const [pricing, setPricing] = useState(FEATURE_PRICING_DEFAULT);

  // ✅ Load vendor profile
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

  // ✅ Fetch admin feature pricing (public route)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axios.get('/api/feature-pricing');
        const rows = Array.isArray(res.data) ? res.data : [];

        // Build a { local: {dur:price}, global: {dur:price} } map
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
        // Silent fail -> keep defaults so vendors can proceed
        console.error('❌ Failed to fetch feature pricing (tourguide):', err);
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
        <h2 className="modal-title">Feature This Tour Guide</h2>

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
          roomId={tourguideId}          // keep compatibility with PayFeatureModal prop name
          featureType={selectedType}
          duration={selectedDuration}
          price={getPrice()}
          vendor={vendor}
          resourceType="tourguide"      // singular
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false);
            alert('✅ Tour guide successfully featured!');
            if (onUpdated) onUpdated();
            onClose();
          }}
        />
      )}
    </div>
  );
};

export default FeatureTourGuideModal;
