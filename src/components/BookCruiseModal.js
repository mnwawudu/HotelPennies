// src/components/BookCruiseModal.js
import React, { useState } from 'react';
import axios from '../utils/axiosConfig';
import './BookCruiseModal.css';

const BookCruiseModal = ({ cruise, onClose }) => {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    pickupLocation: '',
    destinations: '',
    numberOfGuests: '',
    durationHours: '',
    preferredDate: '',
    expectations: '',
    preferredContact: 'whatsapp',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/cruise-inquiries', { ...form });
      alert('✅ Inquiry submitted successfully!');
      onClose();
    } catch (err) {
      console.error('❌ Failed to submit inquiry:', err);
      alert('Failed to submit inquiry.');
    }
  };

  return (
    <div
      className="book-cruise-modal-overlay"
      role="dialog"
      aria-modal="true"
    >
      <div className="book-cruise-modal">
        <button className="close-btn" onClick={onClose}>×</button>
        <h3>📩 Book City Cruise</h3>

        {/* ✅ Cruise Info */}
        {cruise?.description && (
          <p className="cruise-desc"><strong>Description:</strong> {cruise.description}</p>
        )}
        {cruise?.complimentary && (
          <p className="cruise-complimentary">🎁 <strong>Complimentary:</strong> {cruise.complimentary}</p>
        )}

        <form onSubmit={handleSubmit} className="cruise-form">
          <input name="fullName" placeholder="Full Name" value={form.fullName} onChange={handleChange} required />
          <input name="email" placeholder="Email" value={form.email} onChange={handleChange} required />
          <input name="phone" placeholder="Phone Number" value={form.phone} onChange={handleChange} required />
          <input name="pickupLocation" placeholder="Pickup Location" value={form.pickupLocation} onChange={handleChange} required />
          <input name="destinations" placeholder="Destination(s)" value={form.destinations} onChange={handleChange} required />
          <input type="number" name="numberOfGuests" placeholder="Number of Guests" value={form.numberOfGuests} onChange={handleChange} required />
          <input type="number" name="durationHours" placeholder="Duration (hours)" value={form.durationHours} onChange={handleChange} required />
          <input type="date" name="preferredDate" value={form.preferredDate} onChange={handleChange} required />
          <textarea name="expectations" placeholder="Any expectations?" value={form.expectations} onChange={handleChange} />
          <label>Preferred Contact Method</label>
          <select name="preferredContact" value={form.preferredContact} onChange={handleChange}>
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Phone Call</option>
            <option value="email">Email</option>
          </select>
          <button type="submit" className="submit-btn">Submit Inquiry</button>
        </form>
      </div>
    </div>
  );
};

export default BookCruiseModal;
