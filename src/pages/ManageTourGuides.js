// 📁 src/pages/ManageTourGuides.js
import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import AddTourGuideModal from './AddTourGuideModal';
import EditTourGuideModal from '../components/EditTourGuideModal';
import UploadImageModal from '../components/UploadImageModal';
import CalendarModal from '../components/CalendarModal';
import FeatureTourGuideModal from '../components/FeatureTourGuideModal';
import DeleteModal from '../components/DeleteModal';
import TourGuideCard from '../components/TourGuideCard';
import './ManageTourGuides.css';

const ManageTourGuides = () => {
  const [tourGuides, setTourGuides] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTourGuide, setSelectedTourGuide] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const fetchTourGuides = async () => {
    const token = localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');
    try {
      const res = await axios.get('/api/tour-guides/my-listings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTourGuides(res.data);
    } catch (err) {
      console.error('❌ Failed to fetch tour guides:', err);
    }
  };

  useEffect(() => {
    fetchTourGuides();
  }, []);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button className="btn-dark" onClick={() => setShowAddModal(true)}>
          + Add Tour Guide
        </button>
      </div>

      <div className="tour-guide-list" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {tourGuides.map((guide) => (
          <TourGuideCard
            key={guide._id}
            guide={guide}
            onEdit={() => {
              setSelectedTourGuide(guide);
              setShowEditModal(true);
            }}
            onUpload={() => {
              setSelectedTourGuide(guide);
              setShowUploadModal(true);
            }}
            onCalendar={() => {
              setSelectedTourGuide(guide);
              setShowCalendarModal(true);
            }}
            onFeature={() => {
              setSelectedTourGuide(guide);
              setShowFeatureModal(true);
            }}
            onDelete={() => {
              setSelectedTourGuide(guide);
              setShowDeleteModal(true);
            }}
          />
        ))}
      </div>

      {showAddModal && (
        <AddTourGuideModal
          onClose={() => setShowAddModal(false)}
          onTourGuideAdded={fetchTourGuides}
        />
      )}

      {showEditModal && selectedTourGuide && (
        <EditTourGuideModal
          initialData={selectedTourGuide}
          onClose={() => {
            setShowEditModal(false);
            setSelectedTourGuide(null);
          }}
          onTourGuideUpdated={fetchTourGuides}
        />
      )}

      {showUploadModal && selectedTourGuide && (
        <UploadImageModal
          itemId={selectedTourGuide._id}
          resource="tour-guides"
          onClose={() => {
            setShowUploadModal(false);
            setSelectedTourGuide(null);
          }}
          onUploaded={fetchTourGuides}
        />
      )}

      {showCalendarModal && selectedTourGuide && (
        <CalendarModal
          itemId={selectedTourGuide._id}
          type="tourguides"
          onClose={() => {
            setShowCalendarModal(false);
            setSelectedTourGuide(null);
          }}
        />
      )}

      {showFeatureModal && selectedTourGuide && (
        <FeatureTourGuideModal
          itemId={selectedTourGuide._id}
          onClose={() => {
            setShowFeatureModal(false);
            setSelectedTourGuide(null);
          }}
          onUpdated={fetchTourGuides}
        />
      )}

      {showDeleteModal && selectedTourGuide && (
        <DeleteModal
          title="Delete Tour Guide"
          message={`Are you sure you want to delete "${selectedTourGuide.name}"?`}
          itemId={selectedTourGuide._id}
          itemType="tourguide"
          onCancel={() => {
            setShowDeleteModal(false);
            setSelectedTourGuide(null);
          }}
          onDeleted={fetchTourGuides}
        />
      )}
    </>
  );
};

export default ManageTourGuides;
