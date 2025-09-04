// 📁 src/components/AddMenuModal.js
import React, { useState } from 'react';
import axios from '../utils/axiosConfig';
import './AddRoomModal.css'; // Reuse modal styling

const AddMenuModal = ({ restaurantId, onClose, onMenuAdded }) => {
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    promoPrice: '',
    complimentary: '',
    description: '',
    available: false,
  });

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    setPreviews(files.map(file => URL.createObjectURL(file)));
  };

  const removeImage = (index) => {
    const updatedFiles = [...selectedFiles];
    const updatedPreviews = [...previews];
    updatedFiles.splice(index, 1);
    updatedPreviews.splice(index, 1);
    setSelectedFiles(updatedFiles);
    setPreviews(updatedPreviews);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!restaurantId) return setError('Missing restaurant ID');
    if (!formData.title || !formData.price) return setError('Please fill all required fields');
    if (selectedFiles.length === 0) return setError('Please upload at least one image');

    setLoading(true);
    setError('');

    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (value) data.append(key, value);
      });

      selectedFiles.forEach((file) => {
        data.append('images', file);
      });

      const token = localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');

      const res = await axios.post(`/api/restaurant-menus/upload/${restaurantId}`, data, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data.images?.length > 0) {
        await axios.put(`/api/restaurant-menus/${res.data._id}/main-image`, {
          mainImage: res.data.images[0]
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      onMenuAdded(res.data);
      alert('✅ Menu item added successfully');
      onClose();
    } catch (err) {
      console.error('❌ Menu upload failed:', err);
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-room-overlay">
      <div className="add-room-modal">
        <button
          className="close-button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            fontSize: '20px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          ×
        </button>
        <h3 className="modal-title">Add New Menu</h3>
        <form onSubmit={handleSubmit} encType="multipart/form-data">
          <label>Name:</label>
          <input type="text" name="title" value={formData.title} onChange={handleChange} required />

          <label>Price (₦):</label>
          <input type="number" name="price" value={formData.price} onChange={handleChange} required />

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="checkbox" name="available" checked={formData.available} onChange={handleChange} />
            Use Promo Price
          </label>

          {formData.available && (
            <>
              <label>Promo Price (₦):</label>
              <input type="number" name="promoPrice" value={formData.promoPrice} onChange={handleChange} />
            </>
          )}

          <label>Complimentary:</label>
          <input type="text" name="complimentary" value={formData.complimentary} onChange={handleChange} />

          <label>Description:</label>
          <textarea name="description" value={formData.description} onChange={handleChange} />

          <label>Upload Menu Images:</label>
          <input type="file" accept="image/*" multiple onChange={handleFileChange} />

          <div className="preview-grid" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {previews.map((src, index) => (
              <div key={index} style={{ position: 'relative', width: '100px', height: '100px' }}>
                <img
                  src={src}
                  alt={`preview-${index}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '5px'
                  }}
                />
                <button
                  type="button"
                  className="delete-btn"
                  onClick={() => removeImage(index)}
                  style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    background: 'red',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="button-row">
            <button type="submit" className="button-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button type="button" className="button-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMenuModal;
