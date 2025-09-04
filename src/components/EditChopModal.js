import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import './AddChopModal.css';

const EditChopModal = ({ chop, onClose, onChopUpdated }) => {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    hasDelivery: false,
    deliveryFee: '',
    description: '',
    complimentary: '',
    promo: false,
    promoPrice: '',
    images: []
  });

  const [selectedFiles, setSelectedFiles] = useState([]);
  const token = localStorage.getItem('adminToken');

  useEffect(() => {
    if (chop) {
      setFormData({
        name: chop.name || '',
        price: chop.price || '',
        hasDelivery: chop.hasDelivery || false,
        deliveryFee: chop.deliveryFee || '',
        description: chop.description || '',
        complimentary: chop.complimentary || '',
        promo: chop.promo || false,
        promoPrice: chop.promoPrice || '',
        images: chop.images || []
      });
    }
  }, [chop]);

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
    try {
      const payload = {
        ...formData,
        price: Number(formData.price),
        promo: Boolean(formData.promo),
        promoPrice: formData.promo ? Number(formData.promoPrice) : null,
        hasDelivery: Boolean(formData.hasDelivery),
        deliveryFee: formData.hasDelivery ? Number(formData.deliveryFee) : 0
      };

      const res = await axios.put(`/api/chops/${chop._id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (selectedFiles.length > 0) {
        const uploadData = new FormData();
        selectedFiles.forEach(file => uploadData.append('images', file));

        await axios.post(`/api/chops/upload/${chop._id}`, uploadData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
      }

      onChopUpdated(res.data.chop);
      onClose();
    } catch (err) {
      console.error('❌ Failed to update chop:', err);
      alert('Failed to update chop');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="close-btn" onClick={onClose}>&times;</button>
        <h2 className="modal-title">Edit Chop</h2>
        <form onSubmit={handleSubmit} className="modal-form">
          <input type="text" name="name" placeholder="Name" value={formData.name} onChange={handleChange} required />
          <input type="number" name="price" placeholder="Price" value={formData.price} onChange={handleChange} required />

          <div className="inline-toggle">
            <input type="checkbox" name="promo" checked={formData.promo} onChange={handleChange} />
            <label htmlFor="promo">Enable Promo</label>
          </div>

          {formData.promo && (
            <input type="number" name="promoPrice" placeholder="Promo Price" value={formData.promoPrice} onChange={handleChange} />
          )}

          <div className="inline-toggle">
            <input type="checkbox" name="hasDelivery" checked={formData.hasDelivery} onChange={handleChange} />
            <label htmlFor="hasDelivery">Include Delivery Fee</label>
          </div>

          {formData.hasDelivery && (
            <input type="number" name="deliveryFee" placeholder="Delivery Fee (₦)" value={formData.deliveryFee} onChange={handleChange} />
          )}

          <input type="text" name="complimentary" placeholder="Complimentary (e.g. Free Drink)" value={formData.complimentary} onChange={handleChange} />
          <textarea name="description" placeholder="Description" value={formData.description} onChange={handleChange} />

          <label className="file-upload">
            Upload Images:
            <input type="file" multiple onChange={handleFileChange} />
          </label>

          <button type="submit" className="submit-btn">Update Chop</button>
        </form>
      </div>
    </div>
  );
};

export default EditChopModal;
