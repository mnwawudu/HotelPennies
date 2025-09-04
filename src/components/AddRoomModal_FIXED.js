import React, { useState } from 'react';
import './AddRoomModal.css';
import axios from '../utils/axiosConfig';

const AddRoomModal = ({ hotelId, onClose, onRoomAdded }) => {
  const [roomData, setRoomData] = useState({
    name: '',
    price: '',
    guestCapacity: '',
    bedType: '',
    promoPrice: '',
    complimentary: '',
    description: '',
  });

  const [selectedFiles, setSelectedFiles] = useState([]);
  const token = localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken'); // ✅ FIXED TOKEN

  const handleChange = (e) => {
    setRoomData({ ...roomData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setSelectedFiles([...e.target.files]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      Object.entries(roomData).forEach(([key, value]) => {
        formData.append(key, value);
      });
      selectedFiles.forEach((file) => {
        formData.append('images', file);
      });

      await axios.post(`/api/rooms/create/${hotelId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`, // ✅ ADD TOKEN
        },
      });

      alert('✅ Room created successfully');
      onRoomAdded();
      onClose();
    } catch (err) {
      console.error('❌ Upload failed:', err);
      alert('❌ Upload failed: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Add New Room</h2>
        <form onSubmit={handleSubmit}>
          <input type="text" name="name" placeholder="Room Name" onChange={handleChange} required />
          <input type="number" name="price" placeholder="Price" onChange={handleChange} required />
          <input type="number" name="guestCapacity" placeholder="Guest Capacity" onChange={handleChange} required />
          <input type="text" name="bedType" placeholder="Bed Type" onChange={handleChange} required />
          <input type="number" name="promoPrice" placeholder="Promo Price" onChange={handleChange} />
          <input type="text" name="complimentary" placeholder="Complimentary" onChange={handleChange} />
          <textarea name="description" placeholder="Room Description" onChange={handleChange} required />
          <input type="file" multiple accept="image/*" onChange={handleFileChange} required />
          <div className="modal-buttons">
            <button type="submit">Save Room</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddRoomModal;
