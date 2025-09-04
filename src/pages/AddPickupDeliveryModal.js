import React, { useState } from 'react';
import axios from 'axios';

const AddPickupDeliveryModal = ({ onClose, onAdded }) => {
  const [type, setType] = useState('pickup');
  const [businessType, setBusinessType] = useState('hotel');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('token') || sessionStorage.getItem('token');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('/api/pickup-delivery', {
        type,
        businessType,
        description,
        price,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onAdded();
      onClose();
    } catch (err) {
      console.error('Failed to add option:', err);
      alert('Error adding pickup/delivery option.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded w-full max-w-md space-y-4 shadow-lg">
        <h2 className="text-xl font-bold mb-2">Add Pickup/Delivery Option</h2>

        <div>
          <label className="block font-medium">Type:</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border rounded p-2">
            <option value="pickup">Pickup</option>
            <option value="delivery">Delivery</option>
          </select>
        </div>

        <div>
          <label className="block font-medium">Applies To:</label>
          <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="w-full border rounded p-2">
            <option value="hotel">Hotel</option>
            <option value="shortlet">Shortlet</option>
            <option value="restaurant">Restaurant</option>
            <option value="chops">Chops</option>
            <option value="gifts">Gifts</option>
          </select>
        </div>

        <div>
          <label className="block font-medium">Description:</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border rounded p-2"
            rows={2}
            required
          />
        </div>

        <div>
          <label className="block font-medium">Price (₦):</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full border rounded p-2"
            required
          />
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} type="button" className="border px-4 py-2 rounded">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded">
            {loading ? 'Saving...' : 'Add Option'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddPickupDeliveryModal;
