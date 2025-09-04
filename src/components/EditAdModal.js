// ✅ src/components/EditAdModal.js
import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import './CreateAdModal.css';

const EditAdModal = ({ ad, onClose, onAdUpdated }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    link: '',
    state: '',
    city: '',
    scope: 'local',
    price: '',
    subscriptionPeriod: 'weekly',
    placement: []
  });

  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem('adminToken');

  useEffect(() => {
    if (ad) {
      setFormData({
        title: ad.title || '',
        description: ad.description || '',
        link: ad.link || '',
        state: ad.state || '',
        city: ad.city || '',
        scope: ad.scope || 'local',
        price: ad.price || '',
        subscriptionPeriod: ad.subscriptionPeriod || 'weekly',
        placement: ad.placement || []
      });
    }
  }, [ad]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'placement') {
      const updated = checked
        ? [...formData.placement, value]
        : formData.placement.filter(p => p !== value);
      setFormData({ ...formData, placement: updated });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.put(`/api/adverts/${ad._id}`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      onAdUpdated();
      onClose();
    } catch (err) {
      console.error('❌ Ad update failed:', err);
      alert('Failed to update ad.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="close-btn" onClick={onClose}>&times;</button>
        <h2 className="modal-title">Edit Ad</h2>
        <form onSubmit={handleSubmit} className="modal-form">
          <input name="title" placeholder="Ad Title" value={formData.title} onChange={handleChange} required />
          <textarea name="description" placeholder="Ad Description" value={formData.description} onChange={handleChange} required />
          <input name="link" type="url" placeholder="Redirection Link (optional)" value={formData.link} onChange={handleChange} />
          <div className="form-row">
            <input name="state" placeholder="State" value={formData.state} onChange={handleChange} required />
            <input name="city" placeholder="City" value={formData.city} onChange={handleChange} required />
          </div>
          <div className="form-row">
            <select name="scope" value={formData.scope} onChange={handleChange}>
              <option value="local">Local</option>
              <option value="global">Global</option>
            </select>
            <input name="price" type="number" placeholder="Price" value={formData.price} onChange={handleChange} required />
          </div>
          <select name="subscriptionPeriod" value={formData.subscriptionPeriod} onChange={handleChange}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>

          <div className="checkbox-group checkbox-aligned">
            <label><input type="checkbox" name="placement" value="home" checked={formData.placement.includes('home')} onChange={handleChange} /> Home</label>
            <label><input type="checkbox" name="placement" value="footer" checked={formData.placement.includes('footer')} onChange={handleChange} /> Footer</label>
            <label><input type="checkbox" name="placement" value="tours" checked={formData.placement.includes('tours')} onChange={handleChange} /> Tours</label>
            <label><input type="checkbox" name="placement" value="blogs" checked={formData.placement.includes('blogs')} onChange={handleChange} /> Blogs</label>
            <label><input type="checkbox" name="placement" value="hotel" checked={formData.placement.includes('hotel')} onChange={handleChange} /> Hotel Detail</label>
            <label><input type="checkbox" name="placement" value="restaurant" checked={formData.placement.includes('restaurant')} onChange={handleChange} /> Restaurant Detail</label>
            <label><input type="checkbox" name="placement" value="shortlet" checked={formData.placement.includes('shortlet')} onChange={handleChange} /> Shortlet Detail</label>
            <label><input type="checkbox" name="placement" value="event" checked={formData.placement.includes('event')} onChange={handleChange} /> Event Center Detail</label>
          </div>

          <button type="submit" className="submit-btn" style={{ backgroundColor: 'navy', color: 'white' }}>
            {loading ? 'Updating...' : 'Update Ad'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditAdModal;
