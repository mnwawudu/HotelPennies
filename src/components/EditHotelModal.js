import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import './EditHotelModal.css';

const AMENITY_OPTIONS = [
  { key: 'pool',       label: 'Swimming Pool' },
  { key: 'gym',        label: 'Gym / Fitness' },
  { key: 'restaurant', label: 'On-site Restaurant' },
  { key: 'parking',    label: 'Parking' },
  { key: 'breakfast',  label: 'Breakfast Included' },
  { key: 'casino',     label: 'Casino' }, // ✅ NEW
];

const EditHotelModal = ({ hotel, onClose, onHotelUpdated }) => {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    city: '',
    state: '',
    description: '',
    minPrice: '',
    maxPrice: '',
    termsAndConditions: '',
    amenities: [], // ✅
  });

  useEffect(() => {
    if (hotel) {
      setFormData({
        name: hotel.name || '',
        location: hotel.location || '',
        city: hotel.city || '',
        state: hotel.state || '',
        description: hotel.description || '',
        minPrice: hotel.minPrice || '',
        maxPrice: hotel.maxPrice || '',
        termsAndConditions: hotel.termsAndConditions || '',
        amenities: Array.isArray(hotel.amenities) ? hotel.amenities : [],
      });
    }
  }, [hotel]);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAmenityToggle = (key) => {
    setFormData(prev => {
      const set = new Set(prev.amenities || []);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return { ...prev, amenities: Array.from(set) };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');
    try {
      const res = await axios.put(`/api/hotels/${hotel._id}`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      onHotelUpdated(res.data);
      onClose();
    } catch (err) {
      console.error('Error updating hotel:', err);
      alert(err?.response?.data?.message || 'Failed to update hotel');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="modal-close-btn" onClick={onClose}>×</button>
        <h2 className="text-lg font-bold mb-4">Edit Hotel</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Hotel Name" className="w-full border p-2 rounded" required />
          <input type="text" name="location" value={formData.location} onChange={handleChange} placeholder="Address" className="w-full border p-2 rounded" required />
          <input type="text" name="city" value={formData.city} onChange={handleChange} placeholder="City" className="w-full border p-2 rounded" required />
          <input type="text" name="state" value={formData.state} onChange={handleChange} placeholder="State" className="w-full border p-2 rounded" required />
          <input type="number" name="minPrice" value={formData.minPrice} onChange={handleChange} placeholder="Min Price (₦)" className="w-full border p-2 rounded" required />
          <input type="number" name="maxPrice" value={formData.maxPrice} onChange={handleChange} placeholder="Max Price (₦)" className="w-full border p-2 rounded" required />
          <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Description" className="w-full border p-2 rounded" rows="3" />

          {/* ✅ Amenities */}
          <div className="amenities-fieldset">
            <div className="amenities-label">Amenities</div>
            <div className="amenities-grid">
              {AMENITY_OPTIONS.map(opt => (
                <label key={opt.key} className="amenity-chip">
                  <input
                    type="checkbox"
                    checked={(formData.amenities || []).includes(opt.key)}
                    onChange={() => handleAmenityToggle(opt.key)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <textarea
            name="termsAndConditions"
            value={formData.termsAndConditions}
            onChange={handleChange}
            placeholder="Booking Terms & Conditions (optional)"
            className="w-full border p-2 rounded"
            rows="3"
          />

          <div className="modal-action-buttons flex justify-end gap-4 mt-4">
            <button type="button" onClick={onClose} className="bg-gray-400 text-white px-4 py-2 rounded">Cancel</button>
            <button type="submit" className="bg-blue-900 text-white px-4 py-2 rounded">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditHotelModal;
