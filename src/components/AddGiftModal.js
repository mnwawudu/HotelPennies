import React, { useState } from 'react';
import axios from '../utils/axiosConfig';
import './AddRoomModal.css'; // Reuse same styling

const AddGiftModal = ({ onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    promo: false,
    promoPrice: '',
    complimentary: '',
    description: '',
    hasDelivery: true
  });

  const [files, setFiles] = useState([]);
  const token = localStorage.getItem('adminToken');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleFileChange = (e) => {
    setFiles([...e.target.files]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...formData,
      price: Number(formData.price),
      promoPrice: formData.promo ? Number(formData.promoPrice) : null,
    };

    try {
      // Create gift first
      const res = await axios.post('/api/gifts', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const giftId = res.data._id;

      // Then upload images if any
      if (files.length > 0) {
        const uploadData = new FormData();
        files.forEach(file => uploadData.append('images', file));

        await axios.post(`/api/gifts/upload/${giftId}`, uploadData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        });
      }

      alert('✅ Gift created successfully');
      onClose();
    } catch (err) {
      console.error('❌ Failed to create gift:', err);
      alert('Failed to create gift');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content small">
        <button className="close-btn" onClick={onClose}>×</button>
        <h3>Add Gift</h3>
        <form onSubmit={handleSubmit}>
          <label>Name</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} required />

          <label>Price</label>
          <input type="number" name="price" value={formData.price} onChange={handleChange} required />

          <label className="checkbox-row">
            <input type="checkbox" name="promo" checked={formData.promo} onChange={handleChange} />
            Enable Promo Price
          </label>

          {formData.promo && (
            <>
              <label>Promo Price</label>
              <input type="number" name="promoPrice" value={formData.promoPrice} onChange={handleChange} />
            </>
          )}

          <label className="checkbox-row">
            <input type="checkbox" name="hasDelivery" checked={formData.hasDelivery} onChange={handleChange} />
            Include Delivery
          </label>

          <label>Complimentary</label>
          <input type="text" name="complimentary" value={formData.complimentary} onChange={handleChange} />

          <label>Description</label>
          <textarea name="description" value={formData.description} onChange={handleChange} />

          <label>Upload Images</label>
          <input type="file" multiple onChange={handleFileChange} />

          <div className="btn-row">
            <button type="submit" className="save-btn">Save</button>
            <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddGiftModal;
