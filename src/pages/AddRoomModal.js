import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import '../components/AddRoomModal.css';

const AddRoomModal = ({ hotelId, onClose, onRoomAdded }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [roomData, setRoomData] = useState({
    hotelId: '',
    name: '',
    price: '',
    guestCapacity: '',
    bedType: '',
    promoPrice: '',
    complimentary: '',
    description: ''
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (hotelId) {
      setRoomData(prev => ({ ...prev, hotelId }));
    }
  }, [hotelId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setRoomData({ ...roomData, [name]: value });
  };

  const handleFileChange = (e) => {
    setSelectedFiles([...e.target.files]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!roomData.hotelId) {
      setError('Please select a hotel.');
      return;
    }

    try {
      const formData = new FormData();
      Object.entries(roomData).forEach(([key, value]) => {
        formData.append(key, value);
      });
      selectedFiles.forEach(file => {
        formData.append('images', file);
      });

      const token = localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');

      const res = await axios.post(
        `/api/hotel-rooms/create/${roomData.hotelId}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`
          }
        }
      );

      onRoomAdded(res.data.room);
      alert('✅ Room added successfully');
      onClose();
    } catch (err) {
      console.error('❌ Room upload failed:', err);
      setError(err.response?.data?.message || 'Failed to add room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-room-overlay">
      <div className="add-room-modal">
        <button className="close-button" onClick={onClose}>×</button>
        <h3 className="modal-title">Add New Room</h3>
        <form onSubmit={handleSubmit} encType="multipart/form-data">
          <label>Room Name:</label>
          <input type="text" name="name" value={roomData.name} onChange={handleChange} required />

          <label>Price (₦):</label>
          <input type="number" name="price" value={roomData.price} onChange={handleChange} required />

          <label>Guest Capacity:</label>
          <input type="number" name="guestCapacity" value={roomData.guestCapacity} onChange={handleChange} required />

          <label>Bed Type:</label>
          <input type="text" name="bedType" value={roomData.bedType} onChange={handleChange} required />

          <label>Promo Price (Optional):</label>
          <input type="number" name="promoPrice" value={roomData.promoPrice} onChange={handleChange} />

          <label>Complimentary (e.g. Breakfast):</label>
          <input type="text" name="complimentary" value={roomData.complimentary} onChange={handleChange} />

          <label>Description:</label>
          <textarea name="description" value={roomData.description} onChange={handleChange} required />

          <label>Room Images:</label>
          <input type="file" multiple accept="image/*" onChange={handleFileChange} />

          {error && <p className="error-text">{error}</p>}

          <div className="button-row">
            <button type="submit" className="button-primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add Room'}
            </button>
            <button type="button" onClick={onClose} className="button-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddRoomModal;

// Additional modal imports for future use
export { default as DeleteModal } from '../components/DeleteModal';
export { default as CalendarModal } from '../components/CalendarModal';
export { default as FeatureRoomModal } from '../components/FeatureRoomModal';
