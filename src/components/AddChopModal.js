// ✅ src/components/AddChopModal.js
import React, { useState } from 'react';
import axios from '../utils/axiosConfig';
import './AddChopModal.css';

const AddChopModal = ({ onClose, onChopAdded }) => {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    hasDelivery: false,
    deliveryFee: '',
    description: '',
    complimentary: '',
    promo: false,
    promoPrice: ''
  });

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem('adminToken');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleFileChange = (e) => {
    setSelectedFiles([...e.target.files]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      ...formData,
      price: Number(formData.price),
      promoPrice: formData.promo ? Number(formData.promoPrice) : null,
      promo: Boolean(formData.promo),
      hasDelivery: Boolean(formData.hasDelivery),
      deliveryFee: formData.hasDelivery ? Number(formData.deliveryFee) : 0
    };

    try {
      const res = await axios.post('/api/chops', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const chopId = res.data._id;

      if (selectedFiles.length > 0) {
        const uploadData = new FormData();
        selectedFiles.forEach(file => uploadData.append('images', file));

        await axios.post(`/api/chops/upload/${chopId}`, uploadData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
      }

      // 🔁 Refetch updated chop with images
      const updated = await axios.get(`/api/chops/${chopId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      onChopAdded(updated.data);
      onClose();
    } catch (err) {
      console.error('❌ Failed to add chop:', err);
      alert('❌ Failed to add chop');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="close-btn" onClick={onClose}>&times;</button>
        <h2 className="modal-title">Add Chop</h2>
        <form onSubmit={handleSubmit} className="modal-form">
          <input
            type="text"
            name="name"
            placeholder="Name"
            value={formData.name}
            onChange={handleChange}
            required
          />
          <input
            type="number"
            name="price"
            placeholder="Price"
            value={formData.price}
            onChange={handleChange}
            required
          />

          <label className="inline-toggle">
            <input
              type="checkbox"
              name="promo"
              checked={formData.promo}
              onChange={handleChange}
            /> Enable Promo
          </label>
          {formData.promo && (
            <input
              type="number"
              name="promoPrice"
              placeholder="Promo Price (₦)"
              value={formData.promoPrice}
              onChange={handleChange}
              style={{ color: 'navy', fontWeight: 'bold' }}
            />
          )}

          <label className="inline-toggle">
            <input
              type="checkbox"
              name="hasDelivery"
              checked={formData.hasDelivery}
              onChange={handleChange}
            /> Include Delivery Fee
          </label>
          {formData.hasDelivery && (
            <input
              type="number"
              name="deliveryFee"
              placeholder="Delivery Fee (₦)"
              value={formData.deliveryFee}
              onChange={handleChange}
            />
          )}

          <input
            type="text"
            name="complimentary"
            placeholder="Complimentary (e.g. Free Drink)"
            value={formData.complimentary}
            onChange={handleChange}
          />
          <textarea
            name="description"
            placeholder="Description"
            value={formData.description}
            onChange={handleChange}
          />

          <label className="file-upload">
            Upload Images:
            <input type="file" multiple onChange={handleFileChange} />
          </label>

          <button
            type="submit"
            className="submit-btn"
            style={{ backgroundColor: 'navy', color: 'white' }}
          >
            {loading ? 'Adding...' : 'Add Chop'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddChopModal;
