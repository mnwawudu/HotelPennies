// ✅ src/pages/ManageChops.js
import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import './ManageChops.css';
import AddChopModal from '../components/AddChopModal';
import EditChopModal from '../components/EditChopModal';
import ChopCard from '../components/ChopCard';
import UploadChopImageModal from '../components/UploadChopImageModal';
import AdminCalendarModal from '../components/AdminCalendarModal';

const ManageChops = () => {
  const [chops, setChops] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [selectedChop, setSelectedChop] = useState(null);

  const token = localStorage.getItem('adminToken');

  const fetchChops = async () => {
    try {
      const res = await axios.get('/api/chops', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setChops(res.data);
    } catch (err) {
      console.error('❌ Failed to fetch chops:', err);
    }
  };

  useEffect(() => {
    fetchChops();
  }, []);

  const handleDelete = (id) => {
  setChops(prev => prev.filter(c => c._id !== id));
};


  const handleEdit = (chop) => {
    setSelectedChop(chop);
    setShowEditModal(true);
  };

  const handleUpload = (chop) => {
    setSelectedChop(chop);
    setShowUploadModal(true);
  };

  const handleCalendar = (chop) => {
    setSelectedChop(chop);
    setShowCalendarModal(true);
  };

  return (
    <div className="manage-chops">
      <div className="header-row">
        <h2>Manage Chops</h2>
        <button onClick={() => setShowAddModal(true)} className="add-btn">+ Add Chop</button>
      </div>

      <div className="chop-list">
        {chops.map(chop => (
          <ChopCard
            key={chop._id}
            chop={chop}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onUpload={handleUpload}
            onCalendar={handleCalendar}
          />
        ))}
      </div>

      {showAddModal && (
        <AddChopModal
          onClose={() => setShowAddModal(false)}
          onChopAdded={(newChop) => setChops([newChop, ...chops])}
        />
      )}

      {showEditModal && selectedChop && (
        <EditChopModal
          chop={selectedChop}
          onClose={() => {
            setShowEditModal(false);
            setSelectedChop(null);
          }}
          onChopUpdated={(updated) => {
            if (!updated || !updated._id) {
              console.error("❌ Invalid update payload:", updated);
              return;
            }
            setChops(chops.map(c => (c._id === updated._id ? updated : c)));
          }}
        />
      )}

      {showUploadModal && selectedChop && (
        <UploadChopImageModal
          chopId={selectedChop._id}
          onClose={() => {
            setShowUploadModal(false);
            setSelectedChop(null);
          }}
          onUploaded={fetchChops}
        />
      )}

      {showCalendarModal && selectedChop && (
        <AdminCalendarModal
          key={selectedChop._id}
          item={selectedChop}
          itemType="chop"
          onClose={() => {
            setShowCalendarModal(false);
            setSelectedChop(null);
          }}
          onSaved={fetchChops}
        />
      )}
    </div>
  );
};

export default ManageChops;
