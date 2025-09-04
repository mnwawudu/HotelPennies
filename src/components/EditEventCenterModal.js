import React, { useState } from 'react';
import './EditEventCenterModal.css';
import axios from '../utils/axiosConfig';

const EditEventCenterModal = ({ eventCenter, onClose, onUpdated }) => {
  const [form, setForm] = useState({
    name: eventCenter.name || '',
    price: eventCenter.price || '',
    location: eventCenter.location || '',
    city: eventCenter.city || '',
    state: eventCenter.state || '',
    capacity: eventCenter.capacity || '',
    description: eventCenter.description || '',
    usePromo: eventCenter.usePromo || false,
    promoPrice: eventCenter.promoPrice || '',
    complimentary: eventCenter.complimentary || '',
    openingHours: {
      open: eventCenter.openingHours?.open || '',
      close: eventCenter.openingHours?.close || ''
    },
    termsAndConditions: eventCenter.termsAndConditions || ''
  });

  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name.includes('openingHours.')) {
      const key = name.split('.')[1];
      setForm((prev) => ({
        ...prev,
        openingHours: { ...prev.openingHours, [key]: value }
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.put(`/api/eventcenters/${eventCenter._id}`, form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      onUpdated(res.data);
      onClose();
    } catch (err) {
      console.error('❌ Update failed:', err);
      alert('Failed to update event center');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <button className="modal-close" onClick={onClose}>×</button>
        <h2 className="modal-title">Edit Event Center</h2>
        <form className="modal-form" onSubmit={handleSubmit}>
          <input className="modal-input" type="text" name="name" value={form.name} onChange={handleChange} placeholder="Name" required />
          <input className="modal-input" type="number" name="price" value={form.price} onChange={handleChange} placeholder="Price" required />
          <input className="modal-input" type="text" name="location" value={form.location} onChange={handleChange} placeholder="Location" required />
          <input className="modal-input" type="text" name="city" value={form.city} onChange={handleChange} placeholder="City" required />
          <input className="modal-input" type="text" name="state" value={form.state} onChange={handleChange} placeholder="State" required />
          <input className="modal-input" type="number" name="capacity" value={form.capacity} onChange={handleChange} placeholder="Capacity" required />
          <input className="modal-input" type="text" name="description" value={form.description} onChange={handleChange} placeholder="Description" />

          <label className="modal-checkbox">
            <input type="checkbox" name="usePromo" checked={form.usePromo} onChange={handleChange} />
            Enable Promo Price
          </label>
          <input className="modal-input" type="number" name="promoPrice" value={form.promoPrice} onChange={handleChange} placeholder="Promo Price" />

          <input className="modal-input" type="text" name="complimentary" value={form.complimentary} onChange={handleChange} placeholder="Complimentary" />

          <label>Opening Hours</label>
          <input className="modal-input" type="text" name="openingHours.open" value={form.openingHours.open} onChange={handleChange} placeholder="Opening Time (e.g. 08:00 AM)" />
          <input className="modal-input" type="text" name="openingHours.close" value={form.openingHours.close} onChange={handleChange} placeholder="Closing Time (e.g. 10:00 PM)" />

          <textarea className="modal-input" name="termsAndConditions" value={form.termsAndConditions} onChange={handleChange} placeholder="Booking Terms & Conditions" rows={3} />

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-save" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditEventCenterModal;
