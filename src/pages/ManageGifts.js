import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import './ManageGifts.css';
import UploadGiftImageModal from '../components/UploadGiftImageModal';
import EditGiftModal from '../components/EditGiftModal';
import AddGiftModal from '../components/AddGiftModal';
import AdminCalendarModal from '../components/AdminCalendarModal';
import FeatureGiftModal from '../components/FeatureGiftModal';
import DeleteGiftModal from '../components/DeleteGiftModal';
import GiftCard from '../components/GiftCard';

const ManageGifts = () => {
  const [gifts, setGifts] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedGift, setSelectedGift] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const token = localStorage.getItem('adminToken');

  const fetchGifts = async () => {
    try {
      const res = await axios.get('/api/gifts', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setGifts(res.data);
    } catch (error) {
      console.error('❌ Failed to fetch gifts:', error);
    }
  };

  useEffect(() => {
    fetchGifts();
  }, []);

  const handleDeleteGift = async (id) => {
    setGifts((prev) => prev.filter((gift) => gift._id !== id));
  };

  return (
    <div className="manage-gifts">
      <div className="header-row">
        <h2>Manage Gifts</h2>
        <button className="add-btn" onClick={() => setShowAddModal(true)}>+ Add Gift</button>
      </div>

      {/* ✅ Same working layout as Chops */}
      <div className="gift-grid">
        {gifts.map((gift) => (
          <div className="gift-card-wrapper" key={gift._id}>
            <GiftCard
              gift={gift}
              onEdit={() => { setSelectedGift(gift); setShowEditModal(true); }}
              onUpload={() => { setSelectedGift(gift); setShowUploadModal(true); }}
              onCalendar={() => { setSelectedGift(gift); setShowCalendarModal(true); }}
              onFeature={() => { setSelectedGift(gift); setShowFeatureModal(true); }}
              onDelete={() => { setSelectedGift(gift); setShowDeleteModal(true); }}
            />
          </div>
        ))}
      </div>

      {showAddModal && (
        <AddGiftModal onClose={() => { setShowAddModal(false); fetchGifts(); }} />
      )}

      {showEditModal && (
        <EditGiftModal
          gift={selectedGift}
          onClose={() => { setShowEditModal(false); fetchGifts(); }}
          onUpdate={fetchGifts}
        />
      )}

      {showUploadModal && (
        <UploadGiftImageModal
          giftId={selectedGift._id}
          onClose={() => setShowUploadModal(false)}
          onUploaded={fetchGifts}
        />
      )}

      {showCalendarModal && (
        <AdminCalendarModal
          item={selectedGift}
          itemType="gift"
          onClose={() => setShowCalendarModal(false)}
          onSaved={fetchGifts}
        />
      )}

      {showFeatureModal && (
        <FeatureGiftModal
          gift={selectedGift}
          onClose={() => { setShowFeatureModal(false); fetchGifts(); }}
        />
      )}

      {showDeleteModal && (
        <DeleteGiftModal
          giftId={selectedGift._id}
          onDeleted={handleDeleteGift}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
};

export default ManageGifts;
