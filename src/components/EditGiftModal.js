import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import './EditGiftModal.css'; // Separate modal CSS

const EditGiftModal = ({ gift, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    promo: false,
    promoPrice: '',
    complimentary: '',
    description: '',
    hasDelivery: true
  });

  const token = localStorage.getItem('adminToken');

  useEffect(() => {
    if (gift) {
      setFormData({
        name: gift.name || '',
        price: gift.price || '',
        promo: gift.promo || false,
        promoPrice: gift.promoPrice || '',
        complimentary: gift.complimentary || '',
        description: gift.description || '',
        hasDelivery: gift.hasDelivery ?? true,
      });
    }
  }, [gift]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...formData,
      price: Number(formData.price),
      promoPrice: formData.promo ? Number(formData.promoPrice) : null,
    };

    try {
      await axios.put(`/api/gifts/${gift._id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert('✅ Gift updated successfully');
      onUpdate(); // to refresh list
      onClose();
    } catch (err) {
      console.error('❌ Failed to update gift:', err);
      if (!err.response || err.response.status !== 200) {
        alert('Failed to update gift');
      }
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content small">
        <button className="close-btn" onClick={onClose}>×</button>
        <h3>Edit Gift</h3>
        <form onSubmit={handleSubmit}>
          <label style={{ textAlign: 'center' }}>Name</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} required />

          <label style={{ textAlign: 'center' }}>Price</label>
          <input type="number" name="price" value={formData.price} onChange={handleChange} required />

          <div className="checkbox-row">
            <input
              type="checkbox"
              name="promo"
              id="promo"
              checked={formData.promo}
              onChange={handleChange}
            />
            <label htmlFor="promo">Enable Promo Price</label>
          </div>

          {formData.promo && (
            <>
              <label style={{ textAlign: 'center' }}>Promo Price</label>
              <input type="number" name="promoPrice" value={formData.promoPrice} onChange={handleChange} />
            </>
          )}

          <label style={{ textAlign: 'center' }}>Complimentary</label>
          <input type="text" name="complimentary" value={formData.complimentary} onChange={handleChange} />

          <label style={{ textAlign: 'center' }}>Description</label>
          <textarea name="description" value={formData.description} onChange={handleChange} />

          <div className="checkbox-row">
            <input
              type="checkbox"
              name="hasDelivery"
              id="hasDelivery"
              checked={formData.hasDelivery}
              onChange={handleChange}
            />
            <label htmlFor="hasDelivery">Include Delivery</label>
          </div>

          <div className="btn-row">
            <button type="submit" className="save-btn">Save</button>
            <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditGiftModal;
