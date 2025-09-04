// ✅ components/FeatureEventCenterModal.js
import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import PayFeatureModal from './PayFeatureModal';
import './FeatureMenuModal.css'; // reuse this style

// Default (fallback) pricing — used only if the API doesn't provide a value
const FEATURE_PRICING = {
  local: { '7d': 3000, '1m': 8000, '6m': 20000, '1y': 35000 },
  global: { '7d': 7000, '1m': 15000, '6m': 35000, '1y': 60000 },
};

const DURATION_LABELS = {
  '7d': '7 Days',
  '1m': '1 Month',
  '6m': '6 Months',
  '1y': '1 Year',
};

const ORDERED_DURATIONS = ['7d', '1m', '6m', '1y'];

const FeatureEventCenterModal = ({ eventCenter, onClose, onUpdated }) => {
  const [selectedType, setSelectedType] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('');
  const [vendor, setVendor] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Live pricing pulled from the server (merged over defaults)
  const [pricing, setPricing] = useState(FEATURE_PRICING);
  const [loadingPrices, setLoadingPrices] = useState(true);

  // Get live pricing from /api/feature-pricing and merge over defaults
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await axios.get('/api/feature-pricing');
        const incoming = Array.isArray(res.data) ? res.data : [];

        const map = { local: {}, global: {} };
        for (const row of incoming) {
          const t = (row?.type || '').toLowerCase();
          const d = String(row?.duration || '').toLowerCase();
          const p = Number(row?.price);
          if ((t === 'local' || t === 'global') && ORDERED_DURATIONS.includes(d) && Number.isFinite(p)) {
            map[t][d] = p;
          }
        }

        // Merge onto defaults so any missing combo still shows a price
        setPricing(prev => ({
          local: { ...prev.local, ...map.local },
          global: { ...prev.global, ...map.global },
        }));
      } catch (err) {
        console.error('❌ Failed to fetch feature pricing:', err);
        // keep defaults
      } finally {
        setLoadingPrices(false);
      }
    };

    fetchPricing();
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
        <h2 className="modal-title">Feature This Event Center</h2>

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
            <p>
              Select Duration{loadingPrices ? ' (loading prices...)' : ''}:
            </p>
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
                  {DURATION_LABELS[dur]} (₦
                  {(pricing[selectedType]?.[dur] ?? 0).toLocaleString()})
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button
            onClick={handleProceedToPay}
            disabled={!selectedType || !selectedDuration || !vendor || loadingPrices}
            className="confirm-btn"
          >
            Proceed to Pay ₦{getPrice().toLocaleString()}
          </button>
        </div>
      </div>

      {/* ✅ Payment Modal */}
      {showPaymentModal && vendor && (
        <PayFeatureModal
          roomId={eventCenter._id} // ✅ Pass event center ID as roomId
          featureType={selectedType}
          duration={selectedDuration}
          price={getPrice()}
          vendor={vendor}
          resourceType="eventcenter" // ✅ Used by backend route logic
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false);
            alert('✅ Event Center successfully featured!');
            if (onUpdated) onUpdated();
            onClose();
          }}
        />
      )}
    </div>
  );
};

export default FeatureEventCenterModal;
