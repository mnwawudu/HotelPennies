import React, { useState } from 'react';
import axios from '../utils/axiosConfig';
import './DeleteModal.css';

const DeleteModal = ({
  title = 'Delete Item',
  message = 'Are you sure?',
  itemId,
  itemType,
  onCancel = () => {},   // ✅ Prevent crash if not passed
  onDeleted = () => {},  // ✅ Prevent crash if not passed
}) => {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    const token =
      localStorage.getItem('vendorToken') ||
      sessionStorage.getItem('vendorToken');

    let endpoint;
    switch (itemType) {
      case 'hotel':
        endpoint = `/api/hotels/${itemId}`;
        break;
      case 'room':
        endpoint = `/api/hotel-rooms/${itemId}`;
        break;
      case 'shortlet':
        endpoint = `/api/shortlets/${itemId}`;
        break;
      case 'restaurant':
        endpoint = `/api/restaurants/${itemId}`;
        break;
      case 'eventcenter':
        endpoint = `/api/eventcenters/${itemId}`;
        break;
      case 'tourguide':
        endpoint =`/api/tour-guides/${itemId}`;

        break;
      case 'menu': // ✅ this matches your restaurantMenuRoutes
        endpoint = `/api/restaurant-menus/${itemId}`;
        break;
      default:
        alert('❌ Unsupported delete type');
        console.error('❌ Delete failed: Unsupported delete type');
        return;
    }

    try {
      setLoading(true);
      await axios.delete(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      alert('✅ Item deleted successfully');
      onDeleted(itemId);
      onCancel(); // close modal
    } catch (err) {
      console.error('❌ Delete failed:', err);
      alert('❌ Failed to delete item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="delete-modal-overlay">
      <div className="delete-modal-box" style={{ position: 'relative' }}>
        {/* Close X */}
        <button
          onClick={onCancel}
          style={{
            position: 'absolute',
            top: '10px',
            right: '15px',
            fontSize: '20px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#555',
          }}
        >
          ×
        </button>

        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>{title}</h2>
        <p style={{ marginBottom: '20px' }}>{message}</p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              border: '1px solid gray',
              backgroundColor: '#f2f2f2',
              color: '#333',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            style={{
              padding: '8px 16px',
              backgroundColor: '#d32f2f',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;
