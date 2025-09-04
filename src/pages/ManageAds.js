import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import CreateAdModal from '../components/CreateAdModal';
import EditAdModal from '../components/EditAdModal';
import UploadAdImageModal from '../components/UploadAdImageModal';
import AdCard from '../components/AdCard'; // ✅ New component
import './ManageAds.css';

const ManageAds = () => {
  const [ads, setAds] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editAd, setEditAd] = useState(null);
  const [uploadAd, setUploadAd] = useState(null);

  const fetchAds = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await axios.get('/api/adverts/featured', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAds(res.data);
    } catch (err) {
      console.error('❌ Failed to fetch ads:', err);
    }
  };

  useEffect(() => {
    fetchAds();
  }, []);

  const handleDisableAd = (ad) => {
    console.log('🛑 Disable logic not implemented yet for:', ad._id);
    // You can implement an actual disable endpoint later
  };

  return (
    <div className="admin-page">
      <div className="ads-header">
        <h2>Manage Ads</h2>
        <button onClick={() => setShowCreateModal(true)} className="new-ad-btn">
          + New Ad
        </button>
      </div>

      {ads.length === 0 ? (
        <p>No active ads available.</p>
      ) : (
        <div className="ads-grid">
          {ads.map((ad) => (
            <AdCard
              key={ad._id}
              ad={ad}
              onEdit={setEditAd}
              onUpload={setUploadAd}
              onDisable={handleDisableAd}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateAdModal
          onClose={() => setShowCreateModal(false)}
          onAdCreated={fetchAds}
        />
      )}

      {editAd && (
        <EditAdModal
          ad={editAd}
          onClose={() => setEditAd(null)}
          onAdUpdated={fetchAds}
        />
      )}

     {uploadAd && (
  <UploadAdImageModal
    adId={uploadAd._id} // ✅ This line fixes the undefined issue
    onClose={() => setUploadAd(null)}
    onImageUploaded={fetchAds}
  />
)}

    </div>
  );
};

export default ManageAds;
