// 📁 src/components/EditMenuModal.js
import React, { useState } from 'react';
import axios from '../utils/axiosConfig';
import './EditMenuModal.css';

const EditMenuModal = ({ menuItem, onClose, onSave }) => {
  const [title, setTitle] = useState(menuItem.title || '');
  const [price, setPrice] = useState(menuItem.price || '');
  const [promoPrice, setPromoPrice] = useState(menuItem.promoPrice || '');
  const [usePromo, setUsePromo] = useState(!!menuItem.promoPrice);
  const [complimentary, setComplimentary] = useState(menuItem.complimentary || '');
  const [description, setDescription] = useState(menuItem.description || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');

  const handleSave = async () => {
    if (!title || !price) {
      setError('Title and price are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        title,
        price: Number(price),
        description,
        complimentary,
        available: true,
        promoPrice: usePromo && promoPrice ? Number(promoPrice) : null
      };

      await axios.put(`/api/restaurant-menus/${menuItem._id}/update`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (typeof onSave === 'function') {
        await onSave(); // Refresh list
      }

      onClose(); // Close modal
    } catch (err) {
      console.error('❌ Failed to update menu item:', err);
      setError('Failed to update menu item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content bg-white p-6 rounded relative">
        <button
          onClick={onClose}
          className="close-btn"
        >
          ×
        </button>

        <h2 className="text-lg font-semibold mb-4">Edit Menu</h2>

        <input
          type="text"
          placeholder="Dish Name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <input
          type="number"
          placeholder="Price (₦)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <input
            type="checkbox"
            checked={usePromo}
            onChange={(e) => setUsePromo(e.target.checked)}
          />
          <label>Use Promo Price</label>
        </div>

        {usePromo && (
          <input
            type="number"
            placeholder="Promo Price (₦)"
            value={promoPrice}
            onChange={(e) => setPromoPrice(e.target.value)}
          />
        )}

        <input
          type="text"
          placeholder="Complimentary"
          value={complimentary}
          onChange={(e) => setComplimentary(e.target.value)}
        />

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {error && <p className="error-text">{error}</p>}

        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-blue-900 text-white px-4 py-2 rounded mt-4"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default EditMenuModal;
