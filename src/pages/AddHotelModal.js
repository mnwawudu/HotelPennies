import React, { useState } from 'react';
import axios from '../utils/axiosConfig';
import './AddHotelModal.css';

const AMENITY_OPTIONS = [
  { key: 'pool',       label: 'Swimming Pool' },
  { key: 'gym',        label: 'Gym / Fitness' },
  { key: 'restaurant', label: 'On-site Restaurant' },
  { key: 'parking',    label: 'Parking' },
  { key: 'breakfast',  label: 'Breakfast Included' }, // (maps to restaurant in NG setting)
  { key: 'casino',     label: 'Casino' },             // ✅ NEW
];

const AddHotelModal = ({ onClose, onHotelAdded }) => {
  const [hotelData, setHotelData] = useState({
    name: '',
    location: '',
    city: '',
    state: '',
    description: '',
    minPrice: '',
    maxPrice: '',
    images: [],
    termsAndConditions: '',
    amenities: [], // ✅
  });
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'images') {
      setHotelData(prev => ({ ...prev, images: files }));
    } else {
      setHotelData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAmenityToggle = (key) => {
    setHotelData(prev => {
      const set = new Set(prev.amenities || []);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return { ...prev, amenities: Array.from(set) };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData();

    // Scalars
    Object.entries(hotelData).forEach(([key, val]) => {
      if (key === 'images' || key === 'amenities') return;
      if (val !== undefined && val !== null && val !== '') formData.append(key, val);
    });

    // Files
    for (let file of hotelData.images || []) {
      formData.append('images', file);
    }

    // ✅ Amenities — send in two formats so the backend can parse either way:
    // 1) repeated fields: amenities[] = "pool"
    (hotelData.amenities || []).forEach(a => formData.append('amenities[]', a));
    // 2) JSON string: amenities = '["pool","gym"]'
    formData.append('amenities', JSON.stringify(hotelData.amenities || []));

    try {
      const res = await axios.post('/api/hotels/create', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      onHotelAdded(res.data);
    } catch (err) {
      console.error('❌ Failed to add hotel:', err);
      alert(err?.response?.data?.message || 'Failed to add hotel');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="add-hotel-form no-scroll-overlay">
      <button type="button" className="close-btn" onClick={onClose}>×</button>
      <h2 className="form-title">Add New Hotel</h2>

      <input type="text" name="name" placeholder="Hotel Name" value={hotelData.name} onChange={handleChange} required />
      <input type="text" name="location" placeholder="Location" value={hotelData.location} onChange={handleChange} required />
      <input type="text" name="city" placeholder="City" value={hotelData.city} onChange={handleChange} required />
      <input type="text" name="state" placeholder="State" value={hotelData.state} onChange={handleChange} required />
      <input type="number" name="minPrice" placeholder="Min Price (₦)" value={hotelData.minPrice} onChange={handleChange} required />
      <input type="number" name="maxPrice" placeholder="Max Price (₦)" value={hotelData.maxPrice} onChange={handleChange} required />
      <textarea name="description" placeholder="Description" value={hotelData.description} onChange={handleChange} required />

      {/* ✅ Amenities */}
      <div className="amenities-fieldset">
        <div className="amenities-label">Amenities</div>
        <div className="amenities-grid">
          {AMENITY_OPTIONS.map(opt => (
            <label key={opt.key} className="amenity-chip">
              <input
                type="checkbox"
                checked={(hotelData.amenities || []).includes(opt.key)}
                onChange={() => handleAmenityToggle(opt.key)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <textarea
        name="termsAndConditions"
        placeholder="Booking Terms & Conditions (optional)"
        value={hotelData.termsAndConditions}
        onChange={handleChange}
      />

      <input type="file" name="images" accept="image/*" multiple onChange={handleChange} />

      <button type="submit" className="btn navy">{saving ? 'Saving...' : 'Save Hotel'}</button>
    </form>
  );
};

export default AddHotelModal;
