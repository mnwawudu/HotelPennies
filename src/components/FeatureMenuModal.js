// ✅ components/FeatureMenuModal.js
import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import PayFeatureModal from './PayFeatureModal';
import './FeatureMenuModal.css';

// Default (fallback) pricing — used only if the API doesn't provide a value
const FEATURE_PRICING = {
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

const FeatureMenuModal = ({ menuId, onClose, onSuccess }) => {
  const [selectedType, setSelectedType] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('');
  const [vendor, setVendor] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Live pricing pulled from the server (merged over defaults)
  const [pricing, setPricing] = useState(FEATURE_PRICING);
  const [loadingPrices, setLoadingPrices] = useState(true);

  // Fetch live pricing and merge onto defaults
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await axios.get('/api/feature-pricing');
        const incoming = Array.isArray(res.data) ? res.data : [];

        const map = { local: {}, global: {} };
        for (const row of incoming) {
          const t = (row?.type || '').toLowerCase();       // 'local' | 'global'
          const d = String(row?.duration || '').toLowerCase(); // '7d' | '1m' | ...
          const p = Number(row?.price);
          if ((t === 'local' || t === 'global') && ORDERED_DURATIONS.includes(d) && Number.isFinite(p)) {
            map[t][d] = p;
          }
        }

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
        <h2 className="modal-title">Feature This Menu</h2>

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
          resourceId={menuId}           // Use resourceId for new unified route
          featureType={selectedType}
          duration={selectedDuration}
          price={getPrice()}
          vendor={vendor}
          resourceType="menu"           // ✅ correct resource type
          onClose={() => setShowPaymentModal(false)}
          onSuccess={(data) => {
            setShowPaymentModal(false);
            alert('✅ Menu successfully featured!');
            if (onSuccess) onSuccess(data);
            onClose();
          }}
        />
      )}
    </div>
  );
};

export default FeatureMenuModal;
