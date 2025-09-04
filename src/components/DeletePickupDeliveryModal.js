import React from 'react';

const DeletePickupDeliveryModal = ({ onClose, onConfirm }) => {
  return (
    <div className="add-pickup-modal-backdrop" onClick={onClose}>
      <div className="add-pickup-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Confirm Deletion</h3>
        <p>Are you sure you want to delete this pickup/delivery option?</p>
        <div className="modal-buttons">
          <button onClick={onClose}>Cancel</button>
          <button onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
};

export default DeletePickupDeliveryModal;
