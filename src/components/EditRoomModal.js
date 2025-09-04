import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import '../components/EditRoomModal.css';

const EditRoomModal = ({ room, onClose, onRoomUpdated = () => {} }) => {
  const [roomData, setRoomData] = useState({
    name: '',
    price: '',
    guestCapacity: '',
    bedType: '',
    promoPrice: '',
    complimentary: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');

  useEffect(() => {
    if (room) {
      setRoomData({
        name: room.name || '',
        price: room.price || '',
        guestCapacity: room.guestCapacity || '',
        bedType: room.bedType || '',
        promoPrice: room.promoPrice || '',
        complimentary: room.complimentary || '',
        description: room.description || ''
      });
    }
  }, [room]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setRoomData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.put(
        `/api/hotel-rooms/${room._id}`,
        roomData,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      onRoomUpdated(res.data.updatedRoom || res.data);
      alert('✅ Room updated successfully');
      onClose();
    } catch (err) {
      console.error('❌ Update error:', err);
      setError(err.response?.data?.message || 'Failed to update room');
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
            top: '-10px',
            right: '-10px',
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '50%',
            width: '30px',
            height: '30px',
            fontSize: '20px',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            zIndex: 10
          }}
        >
          ×
        </button>

        <h3 className="modal-title">Edit Room</h3>
        <form onSubmit={handleSubmit}>
          <label>Room Name:</label>
          <input type="text" name="name" value={roomData.name} onChange={handleChange} required />

          <label>Price (₦):</label>
          <input type="number" name="price" value={roomData.price} onChange={handleChange} required />

          <label>Guest Capacity:</label>
          <input type="number" name="guestCapacity" value={roomData.guestCapacity} onChange={handleChange} required />

          <label>Bed Type:</label>
          <input type="text" name="bedType" value={roomData.bedType} onChange={handleChange} required />

          <label>Promo Price:</label>
          <input type="number" name="promoPrice" value={roomData.promoPrice} onChange={handleChange} />

          <label>Complimentary:</label>
          <input type="text" name="complimentary" value={roomData.complimentary} onChange={handleChange} />

          <label>Description:</label>
          <textarea name="description" value={roomData.description} onChange={handleChange} required />

          {error && <p className="error-text">{error}</p>}

          <div className="button-row">
            <button type="submit" className="button-primary" disabled={loading}>
              {loading ? 'Updating...' : 'Save Changes'}
            </button>
            <button type="button" onClick={onClose} className="button-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditRoomModal;
