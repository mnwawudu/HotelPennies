import React, { useState } from 'react';
import axios from '../utils/axiosConfig';
import './AddEventCenterModal.css';

const AddEventCenterModal = ({ onClose, onEventCenterAdded }) => {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    city: '',
    state: '',
    price: '',
    promoPrice: '',
    usePromo: false,
    capacity: '',
    complimentary: '',
    description: '',
    openingHours: { open: '', close: '' },
    termsAndConditions: '',
    mainImageIndex: 0,
  });

  const [images, setImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith('openingHours.')) {
      const key = name.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        openingHours: { ...prev.openingHours, [key]: value },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }));
    }
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setImages(selectedFiles);
    setPreviewUrls(selectedFiles.map(file => URL.createObjectURL(file)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = new FormData();
      Object.entries(formData).forEach(([key, val]) => {
        if (key === 'openingHours') {
          payload.append('openingHours', JSON.stringify(val));
        } else {
          payload.append(key, val);
        }
      });
      images.forEach((img) => payload.append('images', img));

      const res = await axios.post('/api/eventcenters', payload, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });

      if (typeof onEventCenterAdded === 'function') {
        onEventCenterAdded();
      }

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      console.error('❌ Failed to create event center:', err);
      setError('❌ Failed to create event center. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <button className="close-button" onClick={onClose}>×</button>
        <h2 className="modal-title">Add Event Center</h2>
        <form onSubmit={handleSubmit} className="modal-form">
          <input type="text" name="name" placeholder="Name" onChange={handleChange} required />
          <input type="number" name="price" placeholder="Price" onChange={handleChange} required />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="number"
              name="promoPrice"
              value={formData.promoPrice}
              onChange={handleChange}
              placeholder="Promo Price"
              className="flex-grow px-4 py-2 border rounded"
              disabled={!formData.usePromo}
            />
            <label style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                name="usePromo"
                checked={formData.usePromo}
                onChange={handleChange}
                style={{ marginRight: '6px' }}
              />
              Use Promo Price
            </label>
          </div>

          <input type="text" name="location" placeholder="Full Address or Location" onChange={handleChange} required />
          <input type="text" name="city" placeholder="City" onChange={handleChange} required />
          <input type="text" name="state" placeholder="State" onChange={handleChange} required />
          <input type="number" name="capacity" placeholder="Capacity" onChange={handleChange} required />
          <input type="text" name="complimentary" placeholder="Complimentary e.g. Wifi | Breakfast" onChange={handleChange} />
          <textarea name="description" placeholder="Description" rows={4} onChange={handleChange} required />

          <label>Opening Hours</label>
          <input type="text" name="openingHours.open" placeholder="Opening Time (e.g. 08:00 AM)" onChange={handleChange} />
          <input type="text" name="openingHours.close" placeholder="Closing Time (e.g. 10:00 PM)" onChange={handleChange} />

          <textarea name="termsAndConditions" placeholder="Booking Terms & Conditions" onChange={handleChange} rows={3} />

          <input type="file" accept="image/*" multiple onChange={handleFileChange} />

          <div className="image-preview-grid">
            {previewUrls.map((url, index) => (
              <img
                key={index}
                src={url}
                alt={`preview-${index}`}
                className={`image-thumb ${formData.mainImageIndex === index ? 'selected' : ''}`}
                onClick={() => setFormData(prev => ({ ...prev, mainImageIndex: index }))}
              />
            ))}
          </div>

          <div className="modal-buttons">
            <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="save-btn" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
          {error && <p className="error-message">{error}</p>}
        </form>
      </div>
    </div>
  );
};

export default AddEventCenterModal;
