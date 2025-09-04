import React, { useState } from 'react';
import axios from '../utils/axiosConfig';
import UploadCruiseImageModal from '../components/UploadCruiseImageModal';
import './AddCruiseModal.css';

const AddCruiseModal = ({ onClose, onCruiseAdded }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration: '',
    price: '',
    city: '',
    state: '',
    complimentary: ''
  });

  const [loading, setLoading] = useState(false);
  const [newCruiseId, setNewCruiseId] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post('/api/cruises', formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
        },
      });

      const createdCruise = res.data;
      setNewCruiseId(createdCruise._id);
      setShowUploadModal(true);
    } catch (err) {
      console.error('❌ Failed to add cruise:', err);
      alert('❌ Failed to add cruise');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDone = () => {
    setShowUploadModal(false);
    onCruiseAdded();
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h3>Add New Cruise</h3>
        <form onSubmit={handleSubmit}>
          <input name="title" value={formData.title} onChange={handleChange} placeholder="Title" required />
          <input name="city" value={formData.city} onChange={handleChange} placeholder="City" required />
          <input name="state" value={formData.state} onChange={handleChange} placeholder="State" required />
          <input name="duration" value={formData.duration} onChange={handleChange} placeholder="Duration (e.g. 3hrs)" required />
          <input name="price" type="number" value={formData.price} onChange={handleChange} placeholder="Price (₦)" required />
          <input name="complimentary" value={formData.complimentary} onChange={handleChange} placeholder="Complimentary (e.g. snacks, drinks)" />
          <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Description..." />

          <div className="modal-actions">
            <button type="submit" disabled={loading} className="save-btn">
              {loading ? 'Saving...' : 'Save & Upload Images'}
            </button>
            <button onClick={onClose} type="button" className="cancel-btn">Cancel</button>
          </div>
        </form>
      </div>

      {showUploadModal && newCruiseId && (
        <UploadCruiseImageModal
          cruiseId={newCruiseId}
          onClose={handleUploadDone}
        />
      )}
    </div>
  );
};

export default AddCruiseModal;
