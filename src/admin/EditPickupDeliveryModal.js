// ✅ src/admin/EditPickupDeliveryModal.js
import React, { useState } from 'react';
import axios from 'axios';

const EditPickupDeliveryModal = ({ option, onClose }) => {
  const [form, setForm] = useState({
    businessType: option.businessType,
    title: option.title,
    price: option.price,
    description: option.description || '',
    isActive: option.isActive,
  });
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await axios.put(`/api/pickup-delivery/${option._id}`, form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      onClose();
    } catch (err) {
      alert('Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex justify-center items-center">
      <div className="bg-white p-6 rounded w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Edit Pickup/Delivery Option</h2>

        <label className="block mb-2 text-sm font-medium">Business Type</label>
        <select name="businessType" value={form.businessType} onChange={handleChange} className="w-full border p-2 mb-4">
          <option value="hotel">Hotel</option>
          <option value="shortlet">Shortlet</option>
          <option value="restaurant">Restaurant</option>
        </select>

        <label className="block mb-2 text-sm font-medium">Title</label>
        <input name="title" value={form.title} onChange={handleChange} className="w-full border p-2 mb-4" />

        <label className="block mb-2 text-sm font-medium">Price (₦)</label>
        <input name="price" type="number" value={form.price} onChange={handleChange} className="w-full border p-2 mb-4" />

        <label className="block mb-2 text-sm font-medium">Description</label>
        <textarea name="description" value={form.description} onChange={handleChange} className="w-full border p-2 mb-4" />

        <label className="block mb-2">
          <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} className="mr-2" />
          Active
        </label>

        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
          <button
            onClick={handleUpdate}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            {loading ? 'Updating...' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPickupDeliveryModal;
