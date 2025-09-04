// ✅ src/components/EditCruiseModal.js
import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import UploadCruiseImageModal from './UploadCruiseImageModal';
import './EditCruiseModal.css';

const EditCruiseModal = ({ cruise, onClose, onCruiseUpdated }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration: '',
    price: '',
    city: '',
    state: '',
    complimentary: '',
  });
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    if (cruise) {
      setFormData({
        title: cruise.title || '',
        description: cruise.description || '',
        duration: cruise.duration || '',
        price: cruise.price || '',
        city: cruise.city || '',
        state: cruise.state || '',
        complimentary: cruise.complimentary || '',
      });
    }
  }, [cruise]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`/api/cruises/${cruise._id}`, formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
        },
      });
      if (onCruiseUpdated) onCruiseUpdated();
      onClose();
    } catch (err) {
      console.error('❌ Failed to update cruise', err);
      alert('❌ Failed to update cruise');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Edit Cruise</h2>
        <form onSubmit={handleSubmit}>
          <input name="title" value={formData.title} onChange={handleChange} placeholder="Title" required />
          <input name="duration" value={formData.duration} onChange={handleChange} placeholder="Duration" required />
          <input name="price" type="number" value={formData.price} onChange={handleChange} placeholder="Price" required />
          <input name="city" value={formData.city} onChange={handleChange} placeholder="City" required />
          <input name="state" value={formData.state} onChange={handleChange} placeholder="State" required />
          <input name="complimentary" value={formData.complimentary} onChange={handleChange} placeholder="Complimentary (optional)" />
          <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Description" />

          <button type="button" className="upload-btn" onClick={() => setShowUploadModal(true)}>
            Upload/Change Images
          </button>

          <div className="modal-actions">
            <button type="submit" className="save-btn">Save</button>
            <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
          </div>
        </form>

        {showUploadModal && (
          <UploadCruiseImageModal
            cruiseId={cruise._id}
            onClose={() => setShowUploadModal(false)}
          />
        )}
      </div>
    </div>
  );
};

export default EditCruiseModal;
