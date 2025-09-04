import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import AddShortletModal from './AddShortletModal';
import EditShortletModal from '../components/EditShortletModal';
import UploadImageModal from '../components/UploadImageModal';
import CalendarModal from '../components/CalendarModal';
import FeatureShortletModal from '../components/FeatureShortletModal';
import DeleteModal from '../components/DeleteModal';
import ShortletCard from '../components/ShortletCard';
import './ManageShortlets.css';

const ManageShortlets = () => {
  const [shortlets, setShortlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [selectedShortlet, setSelectedShortlet] = useState(null);

  const fetchShortlets = async () => {
    try {
      const token = localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');
      const res = await axios.get('/api/shortlets/my-listings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShortlets(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching shortlets:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShortlets();
  }, []);

  const handleAddShortlet = () => setShowAddModal(true);
  const handleEdit = (shortlet) => {
    setSelectedShortlet(shortlet);
    setShowEditModal(true);
  };
  const handleUpload = (shortlet) => {
    setSelectedShortlet(shortlet);
    setShowUploadModal(true);
  };
  const handleCalendar = (shortlet) => {
    setSelectedShortlet(shortlet);
    setShowCalendarModal(true);
  };
  const handleFeature = (shortlet) => {
    setSelectedShortlet(shortlet);
    setShowFeatureModal(true);
  };
  const handleDelete = (shortlet) => {
    setSelectedShortlet(shortlet);
    setShowDeleteModal(true);
  };

  // ✅ Updated this part only
  const handleDeleted = () => {
    fetchShortlets();
    setShowDeleteModal(false);
  };

  return (
    <div className="manage-shortlets">
      <div className="shortlet-header">
        <h2>Your Shortlets</h2>
        <button onClick={handleAddShortlet}>+ Add Shortlet</button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="shortlet-grid">
          {shortlets.map((shortlet) => (
            <ShortletCard
              key={shortlet._id}
              shortlet={shortlet}
              onEdit={handleEdit}
              onUpload={handleUpload}
              onCalendar={handleCalendar}
              onFeature={handleFeature}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddShortletModal
          onClose={() => setShowAddModal(false)}
          onShortletAdded={fetchShortlets}
        />
      )}
      {showEditModal && selectedShortlet && (
        <EditShortletModal
          shortlet={selectedShortlet}
          onClose={() => setShowEditModal(false)}
          onUpdate={fetchShortlets}
        />
      )}
      {showUploadModal && selectedShortlet && (
        <UploadImageModal
          resource="shortlets"
          itemId={selectedShortlet._id}
          onClose={() => setShowUploadModal(false)}
          onUploaded={fetchShortlets}
        />
      )}
      {showCalendarModal && selectedShortlet && (
        <CalendarModal
          itemId={selectedShortlet._id}
          type="shortlet"
          onClose={() => setShowCalendarModal(false)}
          onSaved={fetchShortlets}
        />
      )}
      {showFeatureModal && selectedShortlet && (
        <FeatureShortletModal
          shortletId={selectedShortlet._id}
          onClose={() => setShowFeatureModal(false)}
          onFeatureUpdated={fetchShortlets}
        />
      )}
      {showDeleteModal && selectedShortlet && (
        <DeleteModal
          title="Delete Shortlet"
          message="Are you sure you want to delete this shortlet?"
          itemId={selectedShortlet._id}
          itemType="shortlet"
          onCancel={() => setShowDeleteModal(false)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
};

export default ManageShortlets;
