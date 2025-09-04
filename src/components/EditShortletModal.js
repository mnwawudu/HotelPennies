import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import './EditShortletModal.css';

const EditShortletModal = ({ shortlet, onClose, onUpdate }) => {
  const [form, setForm] = useState({
    title: shortlet.title || '',
    location: shortlet.location || '',
    city: shortlet.city || '',
    state: shortlet.state || '',
    price: shortlet.price || '',
    description: shortlet.description || '',
    promoPrice: shortlet.promoPrice || '',
    complimentary: shortlet.complimentary || '',
    termsAndConditions: shortlet.termsAndConditions || ''
  });

  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token =
      localStorage.getItem('vendorToken') ||
      sessionStorage.getItem('vendorToken') ||
      localStorage.getItem('token') ||
      sessionStorage.getItem('token');

    setLoading(true);
    try {
      const res = await axios.put(`/api/shortlets/${shortlet._id}`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Shortlet updated!');
      onUpdate(res.data.shortlet);
      setIsVisible(false);
      setTimeout(() => window.location.reload(), 300);
    } catch (err) {
      console.error('Error updating shortlet:', err);
      alert('Failed to update shortlet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isVisible) onClose();
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="shortlet-modal-overlay">
      <div className="edit-shortlet-modal">
        <button className="close-button" onClick={() => setIsVisible(false)}>×</button>
        <h2>Edit Shortlet</h2>
        <form onSubmit={handleSubmit}>
          <input name="title" value={form.title} onChange={handleChange} required placeholder="Shortlet Title" />
          <input name="location" value={form.location} onChange={handleChange} required placeholder="Location" />
          <input name="city" value={form.city} onChange={handleChange} required placeholder="City" />
          <input name="state" value={form.state} onChange={handleChange} required placeholder="State" />
          <input name="price" type="number" value={form.price} onChange={handleChange} required placeholder="Price (₦)" />
          <textarea name="description" value={form.description} onChange={handleChange} placeholder="Description" rows="3" />

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <input
              name="promoPrice"
              type="number"
              value={form.promoPrice}
              onChange={handleChange}
              placeholder="Promo Price"
              style={{ flex: '1' }}
            />
            <label style={{ fontSize: '14px' }}>
              <input
                type="checkbox"
                checked={!!form.promoPrice}
                onChange={(e) => {
                  setForm(prev => ({
                    ...prev,
                    promoPrice: e.target.checked ? prev.promoPrice || '' : ''
                  }));
                }}
              /> Enable Promo
            </label>
          </div>

          <input name="complimentary" value={form.complimentary} onChange={handleChange} placeholder="Complimentary (Wi-Fi, etc)" />

          <textarea name="termsAndConditions" value={form.termsAndConditions} onChange={handleChange} placeholder="Booking Terms & Conditions" rows="3" />

          <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" disabled={loading} style={{ backgroundColor: 'navy', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px' }}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditShortletModal;
