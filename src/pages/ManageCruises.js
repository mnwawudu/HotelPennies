import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import './ManageCruises.css';

import CruiseCard from '../components/CruiseCard';
import AddCruiseModal from './AddCruiseModal';
import EditCruiseModal from '../components/EditCruiseModal';
import UploadCruiseImageModal from '../components/UploadCruiseImageModal';
import AdminCalendarModal from '../components/AdminCalendarModal';

const ManageCruises = () => {
  const [cruises, setCruises] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [selectedCruise, setSelectedCruise] = useState(null);

  const token = localStorage.getItem('adminToken');

  const fetchCruises = async () => {
    try {
      const res = await axios.get('/api/cruises', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCruises(res.data);
    } catch (err) {
      console.error('❌ Failed to fetch cruises:', err);
    }
  };

  useEffect(() => {
    fetchCruises();
  }, []);

  const handleDelete = async (id) => {
    const confirm = window.confirm('Are you sure you want to delete this cruise?');
    if (!confirm) return;
    try {
      await axios.delete(`/api/cruises/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCruises(prev => prev.filter(c => c._id !== id));
    } catch (err) {
      console.error('❌ Failed to delete cruise:', err);
    }
  };

  const handleEdit = (cruise) => {
    setSelectedCruise(cruise);
    setShowEditModal(true);
  };

  const handleUpload = (cruise) => {
    setSelectedCruise(cruise);
    setShowUploadModal(true);
  };

  const handleCalendar = (cruise) => {
    setSelectedCruise(cruise);
    setShowCalendarModal(true);
  };

  const handleBookNow = (cruise) => {
    alert(`📅 Booking initiated for: ${cruise.title} (${cruise.city}, ${cruise.state})`);
    // You can open a booking modal/form here
  };

  return (
    <div className="manage-cruises">
      <div className="header-row">
        <h2>Manage City Cruises</h2>
        <button onClick={() => setShowAddModal(true)} className="add-btn">+ Add Cruise</button>
      </div>

      <div className="cruise-list">
        {cruises.map(cruise => (
          <CruiseCard
            key={cruise._id}
            cruise={cruise}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onUpload={handleUpload}
            onCalendar={handleCalendar}
            onBook={handleBookNow}
          />
        ))}
      </div>

      {showAddModal && (
        <AddCruiseModal
          onClose={() => setShowAddModal(false)}
          onCruiseAdded={fetchCruises}
        />
      )}

      {showEditModal && selectedCruise && (
        <EditCruiseModal
          cruise={selectedCruise}
          onClose={() => {
            setShowEditModal(false);
            setSelectedCruise(null);
          }}
          onCruiseUpdated={(updated) => {
            if (!updated || !updated._id) return;
            setCruises(cruises.map(c => (c._id === updated._id ? updated : c)));
          }}
        />
      )}

      {showUploadModal && selectedCruise && (
        <UploadCruiseImageModal
          cruiseId={selectedCruise._id}
          onClose={() => {
            setShowUploadModal(false);
            setSelectedCruise(null);
          }}
          onUploaded={fetchCruises}
        />
      )}

      {showCalendarModal && selectedCruise && (
        <AdminCalendarModal
          key={selectedCruise._id}
          item={selectedCruise}
          itemType="cruise"
          onClose={() => {
            setShowCalendarModal(false);
            setSelectedCruise(null);
          }}
          onSaved={() => {
            fetchCruises();
            setShowCalendarModal(false);
            setSelectedCruise(null);
          }}
        />
      )}
    </div>
  );
};

export default ManageCruises;
