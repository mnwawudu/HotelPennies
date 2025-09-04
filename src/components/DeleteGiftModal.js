import React, { useState } from 'react';
import axios from '../utils/axiosConfig';

const DeleteGiftModal = ({ giftId, onDeleted, onCancel }) => {
  const [confirmed, setConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const token =
    localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');

  const handleDelete = async () => {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }

    try {
      setDeleting(true);
      const res = await axios.delete(`/api/gifts/${giftId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 200 || res.status === 204) {
        alert('✅ Gift deleted successfully');
        if (typeof onDeleted === 'function') onDeleted(giftId);
        if (typeof onCancel === 'function') onCancel();
      } else {
        throw new Error('Unexpected delete response');
      }
    } catch (error) {
      console.error('❌ Failed to delete gift:', error);
      alert('❌ Failed to delete gift');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: '#fff',
        padding: '25px',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '400px',
        textAlign: 'center',
        boxShadow: '0 8px 20px rgba(0,0,0,0.3)'
      }}>
        <h3 style={{ color: 'crimson' }}>Delete Gift</h3>
        <p>
          {confirmed
            ? '⚠️ This action is permanent. Proceed?'
            : 'Are you sure you want to delete this gift?'}
        </p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              flex: 1,
              backgroundColor: 'crimson',
              color: 'white',
              padding: '10px',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              opacity: deleting ? 0.7 : 1,
              cursor: 'pointer'
            }}
          >
            {confirmed ? (deleting ? 'Deleting...' : 'Yes, Delete') : 'Delete'}
          </button>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              backgroundColor: '#ccc',
              color: '#333',
              padding: '10px',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteGiftModal;
