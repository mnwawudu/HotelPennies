// 📁 src/pages/EditTourGuideModal.js
import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';

const EditTourGuideModal = ({ onClose, initialData = {}, onTourGuideUpdated }) => {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    location: '',
    city: '',
    state: '',
    language: '',
    experience: '',
    description: '',
    complimentary: '',
    capacity: '',
    promoPrice: '',
    usePromo: false,
    bio: '',
    termsAndConditions: '',
    mainImageIndex: 0,
    images: [],
  });

  const [images, setImages] = useState([]);
  const [hostImageFile, setHostImageFile] = useState(null);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [hostPreview, setHostPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');

  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      const {
        name = '', price = '', location = '', city = '', state = '',
        language = '', experience = '', description = '', complimentary = '',
        capacity = '', promoPrice = '', usePromo = false, bio = '',
        termsAndConditions = '', images: existingImages = [], hostImage = '',
      } = initialData;

      setFormData({
        name, price, location, city, state, language, experience,
        description, complimentary, capacity, promoPrice, usePromo,
        bio, termsAndConditions, mainImageIndex: 0, images: existingImages,
      });

      setPreviewUrls(existingImages);
      setHostPreview(hostImage);
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setImages(selectedFiles);
    setPreviewUrls(selectedFiles.map((file) => URL.createObjectURL(file)));
  };

  const handleHostImageChange = (e) => {
    const file = e.target.files[0];
    setHostImageFile(file);
    setHostPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = new FormData();
      Object.entries(formData).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          payload.append(key, val);
        }
      });

      images.forEach((img) => payload.append('images', img));
      if (hostImageFile) {
        payload.append('hostImage', hostImageFile);
      }

      const res = await axios.put(`/api/tour-guides/${initialData._id}`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      if (typeof onTourGuideUpdated === 'function') {
        onTourGuideUpdated(res.data);
      } else {
        alert('✅ Tour guide updated successfully.');
      }

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      console.error('❌ Failed to update tour guide:', err);
      setError('❌ Failed to update tour guide. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <button className="close-button" onClick={onClose}>×</button>
        <h2 className="modal-title">Edit Tour Guide</h2>
        <form onSubmit={handleSubmit} className="modal-form">
          <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Name" required />
          <input type="number" name="price" value={formData.price} onChange={handleChange} placeholder="Price" required />
          <input type="number" name="promoPrice" value={formData.promoPrice} onChange={handleChange} placeholder="Promo Price" />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <input type="checkbox" name="usePromo" checked={formData.usePromo} onChange={handleChange} id="usePromo" />
            <label htmlFor="usePromo" style={{ fontWeight: 500 }}>Use Promo Price</label>
          </div>

          <input type="text" name="location" value={formData.location} onChange={handleChange} placeholder="Full Address or Location" required />
          <input type="text" name="city" value={formData.city} onChange={handleChange} placeholder="City" required />
          <input type="text" name="state" value={formData.state} onChange={handleChange} placeholder="State" required />
          <input type="text" name="language" value={formData.language} onChange={handleChange} placeholder="Language e.g. English, Hausa" required />
          <input type="number" name="experience" value={formData.experience} onChange={handleChange} placeholder="Years of Experience" required />
          <input type="number" name="capacity" value={formData.capacity} onChange={handleChange} placeholder="Capacity" />
          <input type="text" name="complimentary" value={formData.complimentary} onChange={handleChange} placeholder="Complimentary e.g. Lunch, Tickets" />
          <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Description" rows={4} required />

          <textarea name="bio" value={formData.bio} onChange={handleChange} placeholder="Short bio about the tour guide" rows={3} />
          <textarea name="termsAndConditions" value={formData.termsAndConditions} onChange={handleChange} placeholder="Booking Terms & Conditions" rows={3} />

          <label style={{ marginTop: '10px' }}>Change Host Image (optional)</label>
          <input type="file" accept="image/*" onChange={handleHostImageChange} />
          {hostPreview && <img src={hostPreview} alt="host-preview" className="image-thumb" style={{ marginTop: 5 }} />}

          <label style={{ marginTop: '10px' }}>Replace Gallery Images (optional)</label>
          <input type="file" accept="image/*" multiple onChange={handleFileChange} />
          <div className="image-preview-grid">
            {previewUrls.map((url, index) => (
              <img key={index} src={url} alt={`preview-${index}`} className="image-thumb" />
            ))}
          </div>

          <div className="modal-buttons">
            <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="save-btn" disabled={saving}>
              {saving ? 'Updating...' : 'Update'}
            </button>
          </div>
          {error && <p className="error-message">{error}</p>}
        </form>
      </div>
    </div>
  );
};

export default EditTourGuideModal;
