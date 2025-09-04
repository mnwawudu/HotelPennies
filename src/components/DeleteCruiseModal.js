import React from 'react';
import axios from '../utils/axiosConfig';
import './DeleteCruiseModal.css';

const DeleteCruiseModal = ({ cruiseId, onClose, fetchCruises }) => {
  const handleDelete = async () => {
    try {
      await axios.delete(`/api/cruises/${cruiseId}`);
      fetchCruises();
      onClose();
    } catch (error) {
      console.error('❌ Failed to delete cruise:', error);
      alert('Failed to delete cruise. Please try again.');
    }
  };

  return (
    <div className="delete-modal-overlay">
      <div className="delete-modal-content">
        <h3>Confirm Deletion</h3>
        <p>Are you sure you want to delete this city cruise?</p>
        <div className="delete-modal-buttons">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="delete-btn" onClick={handleDelete}>Delete</button>
        </div>
      </div>
    </div>
  );
};

export default DeleteCruiseModal;
