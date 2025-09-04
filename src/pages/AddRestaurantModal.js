import React, { useState } from 'react';
import axios from '../utils/axiosConfig';
import './AddRestaurantModal.css';

const AddRestaurantModal = ({ onClose, onAdded }) => {
  const [form, setForm] = useState({
    name: '',
    cuisineType: '',
    location: '',
    city: '',
    state: '',
    priceRange: '',
    description: '',
    images: [],
    mainImageIndex: 0,
    openingHours: { open: '', close: '' },
    termsAndConditions: ''
  });

  const [uploading, setUploading] = useState(false);
  const token = localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('openingHours.')) {
      const key = name.split('.')[1];
      setForm({ ...form, openingHours: { ...form.openingHours, [key]: value } });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleFileChange = (e) => {
    setForm({ ...form, images: Array.from(e.target.files) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);

    const data = new FormData();
    for (let key in form) {
      if (key === 'images') {
        form.images.forEach((img) => data.append('images', img));
      } else if (key === 'openingHours') {
        data.append('openingHours[open]', form.openingHours.open);
        data.append('openingHours[close]', form.openingHours.close);
      } else {
        data.append(key, form[key]);
      }
    }

    try {
      const res = await axios.post('/api/restaurants', data, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      onAdded(res.data);
      onClose();
    } catch (err) {
      console.error('❌ Failed to add restaurant:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="close-btn" onClick={onClose}>×</button>
        <h2>Add Restaurant</h2>
        <form onSubmit={handleSubmit}>
          <input name="name" placeholder="Name" onChange={handleChange} required />
          <input name="cuisineType" placeholder="Cuisine Type" onChange={handleChange} />
          <input name="location" placeholder="Location" onChange={handleChange} required />
          <input name="city" placeholder="City" onChange={handleChange} required />
          <input name="state" placeholder="State" onChange={handleChange} required />
          <input name="priceRange" placeholder="Price Range (₦500 - ₦5000)" onChange={handleChange} />
          <textarea name="description" placeholder="Description" onChange={handleChange} />

          <label>Opening Hours</label>
          <input name="openingHours.open" placeholder="Opening Time (e.g. 08:00 AM)" onChange={handleChange} />
          <input name="openingHours.close" placeholder="Closing Time (e.g. 10:00 PM)" onChange={handleChange} />

          <textarea name="termsAndConditions" placeholder="Booking Terms & Conditions" onChange={handleChange} />

          <input type="file" multiple accept="image/*" onChange={handleFileChange} />
          <input name="mainImageIndex" placeholder="Main Image Index (e.g. 0)" onChange={handleChange} />
          <button
            type="submit"
            className="submit-btn"
            style={{ backgroundColor: 'navy', color: 'white' }}
            disabled={uploading}
          >
            {uploading ? 'Adding...' : 'Add Restaurant'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddRestaurantModal;
