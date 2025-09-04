// ✅ FeatureGiftModal.js
import React, { useState } from 'react';
import axios from '../utils/axiosConfig';
import './FeatureGiftModal.css'; 

const FeatureGiftModal = ({ gift, onClose }) => {
  const [featureType, setFeatureType] = useState('homepage');
  const [duration, setDuration] = useState('');
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!duration) return alert('Please enter number of days');

    try {
      setLoading(true);
      await axios.post(`/api/gifts/${gift._id}/feature`, {
        featureType,
        duration,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert('✅ Gift featured successfully');
      onClose();
    } catch (err) {
      console.error('❌ Feature error:', err);
      alert('❌ Failed to feature gift');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content small">
        <button className="close-btn" onClick={onClose}>×</button>
        <h3>Feature Gift</h3>
        <form onSubmit={handleSubmit}>
          <label>Feature Type</label>
          <select value={featureType} onChange={(e) => setFeatureType(e.target.value)}>
            <option value="homepage">Homepage</option>
            <option value="category">Category</option>
          </select>

          <label>Duration (in days)</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            required
          />

          <div className="btn-row">
            <button type="submit" className="save-btn" disabled={loading}>
              {loading ? 'Featuring...' : 'Feature'}
            </button>
            <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FeatureGiftModal;
