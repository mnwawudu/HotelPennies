import React, { useState } from 'react';
import axios from '../utils/axiosConfig';
import './AddShortletModal.css';

const AddShortletModal = ({ onClose, onShortletAdded }) => {
  const [form, setForm] = useState({
    title: '',
    location: '',
    state: '',
    city: '',
    price: '',
    description: '',
    promoPrice: '',
    complimentary: '',
    termsAndConditions: '',
    images: [],
    mainImage: ''
  });

  const [enablePromo, setEnablePromo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const token = localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    setUploading(true);
    try {
      const uploadedUrls = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append('files', file);
        const res = await axios.post('/api/cloudinary/upload', formData, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        uploadedUrls.push(...res.data.urls);
      }

      setForm((prev) => ({
        ...prev,
        images: [...prev.images, ...uploadedUrls],
        mainImage: prev.mainImage || uploadedUrls[0],
      }));
    } catch (err) {
      console.error('Image upload failed:', err);
      alert('Failed to upload image(s).');
    } finally {
      setUploading(false);
    }
  };

  const handleMainImageSelect = (url) => {
    setForm((prev) => ({ ...prev, mainImage: url }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.images.length === 0 || !form.mainImage) {
      alert('Please upload at least one image and select a main image.');
      return;
    }

    const finalForm = { ...form };
    if (!enablePromo) {
      delete finalForm.promoPrice;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/shortlets/create', finalForm, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert('Shortlet added successfully!');
      onShortletAdded(res.data.shortlet);
      onClose();
    } catch (err) {
      console.error('Error adding shortlet:', err);
      alert('Failed to add shortlet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-shortlet-modal">
      <div className="modal-content">
        <button onClick={onClose} className="close-button">×</button>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Add New Shortlet</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <input name="title" value={form.title} onChange={handleChange} required placeholder="Shortlet Title" className="w-full px-4 py-2 border rounded" />
          <input name="location" value={form.location} onChange={handleChange} required placeholder="Location" className="w-full px-4 py-2 border rounded" />
          <input name="city" value={form.city} onChange={handleChange} required placeholder="City" className="w-full px-4 py-2 border rounded" />
          <input name="state" value={form.state} onChange={handleChange} required placeholder="State" className="w-full px-4 py-2 border rounded" />
          <input name="price" type="number" value={form.price} onChange={handleChange} required placeholder="Price (₦)" className="w-full px-4 py-2 border rounded" />
          <textarea name="description" value={form.description} onChange={handleChange} placeholder="Description" rows="3" className="w-full px-4 py-2 border rounded" />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              name="promoPrice"
              type="number"
              value={form.promoPrice}
              onChange={handleChange}
              placeholder="Promo Price"
              className="flex-grow px-4 py-2 border rounded"
              disabled={!enablePromo}
            />
            <label style={{ fontSize: '14px' }}>
              <input
                type="checkbox"
                checked={enablePromo}
                onChange={() => setEnablePromo(!enablePromo)}
                style={{ marginRight: '6px' }}
              />
              Enable Promo
            </label>
          </div>

          <input name="complimentary" value={form.complimentary} onChange={handleChange} placeholder="Complimentary (Wi-Fi, etc)" className="w-full px-4 py-2 border rounded" />

          <textarea name="termsAndConditions" value={form.termsAndConditions} onChange={handleChange} placeholder="Booking Terms & Conditions" rows="3" className="w-full px-4 py-2 border rounded" />

          <div>
            <label className="block font-medium mb-1">Upload Images</label>
            <input type="file" multiple onChange={handleImageUpload} className="w-full px-4 py-2 border rounded" />
            {uploading && <p className="text-sm text-blue-600 mt-1">Uploading...</p>}
          </div>

          {form.images.length > 0 && (
            <div className="image-preview-grid">
              {form.images.map((url, index) => (
                <div key={index} className="relative group cursor-pointer">
                  <img
                    src={url}
                    alt={`Uploaded ${index}`}
                    className={form.mainImage === url ? 'selected' : ''}
                    onClick={() => handleMainImageSelect(url)}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="action-buttons">
            <button type="button" onClick={onClose} className="cancel-button">Cancel</button>
            <button type="submit" className="navy-button" disabled={loading || uploading}>
              {loading ? 'Saving...' : 'Save Shortlet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddShortletModal;
