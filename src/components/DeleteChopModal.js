import React, { useState } from 'react';
import axios from '../utils/axiosConfig';

const DeleteChopModal = ({ chop, onClose, onDeleted }) => {
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem('adminToken');

  const handleDelete = async () => {
    if (!chop || !chop._id) {
      console.error('❌ Invalid chop data');
      alert('Chop information missing');
      return;
    }

    try {
      setLoading(true);
      const res = await axios.delete(`/api/chops/${chop._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Only remove from UI if backend confirms success (status 200 or 204)
      if (res.status === 200 || res.status === 204) {
        if (typeof onDeleted === 'function') onDeleted(chop._id);
        onClose();
      } else {
        console.error('❌ Unexpected delete status:', res.status);
        alert('Delete failed');
      }
    } catch (err) {
      console.error('❌ Failed to delete chop:', err);
      alert('Failed to delete chop');
    } finally {
      setLoading(false);
    }
  };

  const overlayStyle = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const modalStyle = {
    backgroundColor: '#fff',
    color: '#000',
    padding: '30px 20px',
    borderRadius: '8px',
    width: '320px',
    maxWidth: '90%',
    boxShadow: '0 0 15px rgba(0, 0, 0, 0.3)',
    textAlign: 'center',
  };

  const buttonRowStyle = {
    marginTop: '20px',
    display: 'flex',
    justifyContent: 'space-between',
  };

  const cancelBtnStyle = {
    backgroundColor: '#ccc',
    color: '#000',
    padding: '8px 16px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    flex: 1,
    marginRight: '10px',
  };

  const deleteBtnStyle = {
    backgroundColor: 'red',
    color: '#fff',
    padding: '8px 16px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    flex: 1,
    opacity: loading ? 0.6 : 1,
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h3>Delete Chop</h3>
        <p>Are you sure you want to delete <strong>{chop?.name || 'this chop'}</strong>?</p>
        <div style={buttonRowStyle}>
          <button style={cancelBtnStyle} onClick={onClose} disabled={loading}>Cancel</button>
          <button style={deleteBtnStyle} onClick={handleDelete} disabled={loading}>
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteChopModal;
