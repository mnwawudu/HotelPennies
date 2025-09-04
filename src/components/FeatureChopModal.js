// ✅ src/components/FeatureChopModal.js
import React, { useState } from 'react';
import axios from '../utils/axiosConfig';
import './AddChopModal.css';

const FeatureChopModal = ({ chop, onClose }) => {
  const [featureType, setFeatureType] = useState('Homepage');
  const [duration, setDuration] = useState(7);
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem('adminToken');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.put(`/api/chops/${chop._id}/feature`, {
        featureType,
        duration
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert('✅ Chop featured successfully');
      onClose();
    } catch (err) {
      console.error('❌ Feature failed:', err);
      alert('❌ Failed to feature chop');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="close-btn" onClick={onClose}>&times;</button>
        <h2 className="modal-title">Feature Chop</h2>

        <form onSubmit={handleSubmit} className="modal-form">
          <label>Feature Type:</label>
          <select value={featureType} onChange={(e) => setFeatureType(e.target.value)}>
            <option value="Homepage">Homepage</option>
            <option value="Spotlight">Spotlight</option>
            <option value="Top Rated">Top Rated</option>
          </select>

          <label>Duration (Days):</label>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            <option value={7}>7 Days</option>
            <option value={14}>14 Days</option>
            <option value={30}>30 Days</option>
          </select>

          <button type="submit" className="submit-btn" style={{ backgroundColor: 'navy', color: 'white' }}>
            {loading ? 'Featuring...' : 'Feature Chop'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default FeatureChopModal;
