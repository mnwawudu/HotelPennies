import React, { useState } from 'react';
import axios from '../utils/axiosConfig';
import './EditRestaurantModal.css';

const EditRestaurantModal = ({ restaurant, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: restaurant.name || '',
    cuisineType: restaurant.cuisineType || '',
    location: restaurant.location || '',
    city: restaurant.city || '',
    state: restaurant.state || '',
    description: restaurant.description || '',
    priceRange: restaurant.priceRange || '',
    openingHours: {
      open: restaurant.openingHours?.open || '',
      close: restaurant.openingHours?.close || ''
    },
    termsAndConditions: restaurant.termsAndConditions || ''
  });

  const token = localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('openingHours.')) {
      const key = name.split('.')[1];
      setFormData({
        ...formData,
        openingHours: { ...formData.openingHours, [key]: value }
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async () => {
    try {
      const res = await axios.put(`/api/restaurants/${restaurant._id}`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      onUpdate(res.data);
      onClose();
    } catch (err) {
      console.error('❌ Failed to update restaurant:', err);
      alert('Failed to update restaurant');
    }
  };

  return (
    <div className="edit-restaurant-overlay">
      <div className="edit-restaurant-modal">
        <button className="close-btn" onClick={onClose}>×</button>
        <h2>Edit Restaurant</h2>

        <div className="form-group">
          <input type="text" name="name" placeholder="Name" value={formData.name} onChange={handleChange} />
          <input type="text" name="cuisineType" placeholder="Cuisine Type" value={formData.cuisineType} onChange={handleChange} />
          <input type="text" name="location" placeholder="Location" value={formData.location} onChange={handleChange} />
          <input type="text" name="city" placeholder="City" value={formData.city} onChange={handleChange} />
          <input type="text" name="state" placeholder="State" value={formData.state} onChange={handleChange} />
          <input type="text" name="priceRange" placeholder="Price Range" value={formData.priceRange} onChange={handleChange} />
          <textarea name="description" placeholder="Description" value={formData.description} onChange={handleChange}></textarea>

          <label>Opening Hours</label>
          <input type="text" name="openingHours.open" placeholder="Opening Time (e.g. 08:00 AM)" value={formData.openingHours.open} onChange={handleChange} />
          <input type="text" name="openingHours.close" placeholder="Closing Time (e.g. 10:00 PM)" value={formData.openingHours.close} onChange={handleChange} />

          <textarea name="termsAndConditions" placeholder="Booking Terms & Conditions" value={formData.termsAndConditions} onChange={handleChange}></textarea>
        </div>

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="save-btn" onClick={handleSubmit}>Save</button>
        </div>
      </div>
    </div>
  );
};

export default EditRestaurantModal;
