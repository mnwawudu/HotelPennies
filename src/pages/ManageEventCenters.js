import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import AddEventCenterModal from './AddEventCenterModal';
import EditEventCenterModal from '../components/EditEventCenterModal';
import UploadImageModal from '../components/UploadImageModal';
import CalendarModal from '../components/CalendarModal';
import DeleteModal from '../components/DeleteModal';
import FeatureEventCenterModal from '../components/FeatureEventCenterModal';
import EventCenterCard from '../components/EventCenterCard';
import './ManageEventCenter.css';

const ManageEventCenters = () => {
  const [eventCenters, setEventCenters] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState(null);

  const token = localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');

  const fetchEventCenters = async () => {
    try {
      const res = await axios.get('/api/eventcenters/my-listings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEventCenters(res.data);
    } catch (err) {
      console.error('Failed to fetch:', err);
    }
  };

  useEffect(() => {
    fetchEventCenters();
  }, []);

  const handleAdd = (newItem) => setEventCenters(prev => [...prev, newItem]);

  const handleUpdate = (updatedItem) => {
    setEventCenters(prev =>
      prev.map(ec => ec._id === updatedItem._id ? updatedItem : ec)
    );
  };

  const handleDelete = (idToDelete) => {
    setEventCenters(prev => prev.filter(ec => ec._id !== idToDelete));
  };

  const normalizeState = (stateValue) => {
    const clean = (stateValue || '').trim().toLowerCase();
    if (clean === 'imo') return 'Imo State';
    if (clean === 'rivers') return 'Rivers State';
    if (clean === 'lagos') return 'Lagos State';
    if (clean === 'ogun') return 'Ogun State';
    return stateValue;
  };

  const eventCentersWithNormalizedState = eventCenters.map(center => {
    if (!center || typeof center !== 'object') return {};
    return {
      ...center,
      state: center.state ? normalizeState(center.state) : '',
    };
  });

  return (
    <>
      <div className="manage-event-center-container">
        <div className="header-container">
          <h2 className="text-xl font-bold">Manage Event Centers</h2>
          <button onClick={() => setShowAddModal(true)} className="add-button">
            + Add Event Center
          </button>
        </div>

        <div className="event-center-grid">
          {eventCentersWithNormalizedState.map(item => (
            <div key={item._id} className="event-card-wrapper">
              <EventCenterCard data={item} isVendorView={false} />
              <div className="vendor-controls">
                <button onClick={() => { setSelectedCenter(item); setShowEditModal(true); }}>Edit</button>
                <button onClick={() => { setSelectedCenter(item); setShowUploadModal(true); }}>Upload Image</button>
                <button onClick={() => { setSelectedCenter(item); setShowCalendarModal(true); }}>Calendar</button>
                <button onClick={() => { setSelectedCenter(item); setShowFeatureModal(true); }}>Feature</button>
                <button
                  style={{ backgroundColor: '#d32f2f', color: '#fff' }}
                  onClick={() => { setSelectedCenter(item); setShowDeleteModal(true); }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAddModal && (
        <AddEventCenterModal
          onClose={() => setShowAddModal(false)}
          onEventCenterAdded={fetchEventCenters}
        />
      )}

      {showEditModal && selectedCenter && (
        <EditEventCenterModal
          eventCenter={selectedCenter}
          onClose={() => {
            setShowEditModal(false);
            setSelectedCenter(null);
          }}
          onUpdated={handleUpdate}
        />
      )}

      {showUploadModal && selectedCenter && (
        <UploadImageModal
          resource="eventcenters"
          itemId={selectedCenter._id}
          onClose={() => {
            setShowUploadModal(false);
            setSelectedCenter(null);
          }}
          onUploaded={fetchEventCenters}
        />
      )}

      {showCalendarModal && selectedCenter && (
        <CalendarModal
          itemId={selectedCenter._id}
          type="eventcenter"
          onClose={() => {
            setShowCalendarModal(false);
            setSelectedCenter(null);
          }}
          onSaved={fetchEventCenters}
        />
      )}

      {showDeleteModal && selectedCenter && (
        <DeleteModal
          itemId={selectedCenter._id}
          itemType="eventcenter"
          title="Delete Event Center"
          message="Are you sure you want to delete this event center?"
          onCancel={() => {
            setShowDeleteModal(false);
            setSelectedCenter(null);
          }}
          onDeleted={(deletedId) => {
            handleDelete(deletedId);
            setShowDeleteModal(false);
            setSelectedCenter(null);
          }}
        />
      )}

      {showFeatureModal && selectedCenter && (
        <FeatureEventCenterModal
          eventCenter={selectedCenter}
          onClose={() => {
            setShowFeatureModal(false);
            setSelectedCenter(null);
          }}
          onUpdated={fetchEventCenters}
        />
      )}
    </>
  );
};

export default ManageEventCenters;
