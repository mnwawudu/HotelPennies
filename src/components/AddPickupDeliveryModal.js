import React, { useState } from 'react';
import axios from '../utils/axiosConfig';
import './AddPickupDeliveryModal.css';

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa",
  "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo",
  "Ekiti", "Enugu", "Gombe", "Imo", "Jigawa", "Kaduna",
  "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo",
  "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
  "Abuja"
];

const AddPickupDeliveryModal = ({ onClose, onAdded }) => {
  const [form, setForm] = useState({
    type: 'pickup',
    businessType: 'hotel',
    state: 'Lagos',
    fromZone: 'mainland',
    toZone: 'mainland',
    title: '',
    description: '',
    estimatedTime: '',
    price: ''
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('adminToken');

      // 🧼 Clean zones before sending to backend
      const cleanedToZone = form.toZone?.replace(/state$/i, '').trim();
      const cleanedFromZone = form.fromZone?.replace(/state$/i, '').trim();

      const payload = {
        ...form,
        price: Number(form.price),
        ...(form.state === 'Lagos' && {
          fromZone: cleanedFromZone,
          toZone: cleanedToZone,
        })
      };

      // Remove zones if state is not Lagos
      if (form.state !== 'Lagos') {
        delete payload.fromZone;
        delete payload.toZone;
      }

      await axios.post('/api/pickup-delivery', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      onAdded();
      onClose();
    } catch (err) {
      if (err.response?.status === 409) {
        alert('Option already exists for this route and title.');
      } else if (err.response?.status === 401) {
        alert('Unauthorized. Please log in as admin.');
      } else {
        alert('Failed to add option.');
      }
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">×</button>
        <h3>Add Pickup/Delivery Option</h3>
        <form onSubmit={handleSubmit} className="pickup-form">
          <select name="type" value={form.type} onChange={handleChange} required>
            <option value="pickup">Pickup</option>
            <option value="delivery">Delivery</option>
          </select>

          <select name="businessType" value={form.businessType} onChange={handleChange} required>
            <option value="hotel">Hotel</option>
            <option value="shortlet">Shortlet</option>
            <option value="restaurant">Restaurant</option>
			<option value="chops">Chops</option>    
            <option value="gifts">Gifts</option> 
          </select>

          <select name="state" value={form.state} onChange={handleChange} required>
            {NIGERIAN_STATES.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>

          {form.state === 'Lagos' && (
            <>
              <select name="fromZone" value={form.fromZone} onChange={handleChange} required>
                <option value="mainland">Mainland</option>
                <option value="island">Island</option>
              </select>

              <select name="toZone" value={form.toZone} onChange={handleChange} required>
                <option value="mainland">Mainland</option>
                <option value="island">Island</option>
              </select>
            </>
          )}

          <input
            type="text"
            name="title"
            placeholder="Title"
            value={form.title}
            onChange={handleChange}
            required
          />

          <input
            type="text"
            name="description"
            placeholder="Description"
            value={form.description}
            onChange={handleChange}
          />

          <input
            type="text"
            name="estimatedTime"
            placeholder="Estimated Time (e.g., 30 mins)"
            value={form.estimatedTime}
            onChange={handleChange}
          />

          <input
            type="number"
            name="price"
            placeholder="Price (₦)"
            value={form.price}
            onChange={handleChange}
            required
          />

          <div className="modal-actions">
            <button type="submit" className="save-btn">Save</button>
            <button type="button" onClick={onClose} className="cancel-btn">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPickupDeliveryModal;
