import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import AddPickupDeliveryModal from '../components/AddPickupDeliveryModal';
import EditPickupDeliveryModal from '../components/EditPickupDeliveryModal';
import DeletePickupDeliveryModal from '../components/DeletePickupDeliveryModal';
import './ManagePickupDelivery.css';

const ManagePickupDelivery = () => {
  const [options, setOptions] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);

  const fetchOptions = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await axios.get('/api/pickup-delivery/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOptions(res.data);
    } catch (err) {
      console.error('Failed to fetch options:', err);
    }
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  const openEditModal = (option) => {
    setSelectedOption(option);
    setShowEditModal(true);
  };

  const openDeleteModal = (option) => {
    setSelectedOption(option);
    setShowDeleteModal(true);
  };

  return (
    <div className="pickup-delivery-admin-container">
      <div className="flex justify-between items-center mb-4 w-full">
        <h2 className="text-xl font-semibold">Manage Pickup & Delivery Options</h2>
        <button className="add-option-btn" onClick={() => setShowAddModal(true)}>
          + Add New Option
        </button>
      </div>

      <div className="pickup-options-list">
        <table className="options-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Business</th>
              <th>Title</th>
              <th>Description</th>
              <th>From</th>
              <th>To</th>
              <th>Price (₦)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {options.map((opt) => (
              <tr key={opt._id}>
                <td>{opt.type}</td>
                <td>{opt.businessType}</td>
                <td>{opt.title}</td>
                <td className="truncate-text">{opt.description}</td>
                <td>{opt.fromZone}</td>
                <td>{opt.toZone}</td>
                <td>{Number(opt.price).toLocaleString()}</td>
                <td>
                  <div className="button-group">
                    <button className="edit-btn" onClick={() => openEditModal(opt)}>Edit</button>
                    <button className="delete-btn" onClick={() => openDeleteModal(opt)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <AddPickupDeliveryModal
          onClose={() => setShowAddModal(false)}
          onAdded={fetchOptions}
        />
      )}

      {showEditModal && selectedOption && (
        <EditPickupDeliveryModal
          option={selectedOption}
          onClose={() => setShowEditModal(false)}
          onUpdated={fetchOptions}
        />
      )}

      {showDeleteModal && selectedOption && (
        <DeletePickupDeliveryModal
          option={selectedOption}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={fetchOptions}
        />
      )}
    </div>
  );
};

export default ManagePickupDelivery;
