import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import AddHotelModal from './AddHotelModal';
import EditHotelModal from '../components/EditHotelModal';
import DeleteModal from '../components/DeleteModal';
import UploadImageModal from '../components/UploadImageModal';
import AddRoomModal from '../pages/AddRoomModal';
import RoomList from '../pages/RoomList';
import HotelCard from '../components/HotelCard';
import './ManageHotels.css';

const ManageHotels = () => {
  const [hotels, setHotels] = useState([]);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [visibleRoomLists, setVisibleRoomLists] = useState({});

  const token = localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');

  const fetchHotels = async () => {
    try {
      const res = await axios.get('/api/hotels/my-hotels', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHotels(res.data);
    } catch (err) {
      console.error('❌ Failed to fetch hotels:', err);
    }
  };

  useEffect(() => {
    fetchHotels();
  }, []);

  const handleHotelAdded = (newHotel) => {
    setHotels([...hotels, newHotel]);
    setSelectedHotel(newHotel);
    setShowAddModal(false);
  };

  const handleHotelUpdated = (updatedHotel) => {
    setHotels(hotels.map(h => (h._id === updatedHotel._id ? updatedHotel : h)));
    setSelectedHotel(updatedHotel);
  };

  const handleHotelDeleted = (deletedId) => {
    setHotels(hotels.filter(h => h._id !== deletedId));
    setSelectedHotel(null);
  };

  const toggleRoomList = (hotelId) => {
    setVisibleRoomLists(prev => ({
      ...prev,
      [hotelId]: !prev[hotelId],
    }));
  };

  return (
    <div className="manage-hotels">
      <div className="header-row">
        <h2>Manage Hotels</h2>
        <button className="add-hotel-btn" onClick={() => setShowAddModal(true)}>+ Add Hotel</button>
      </div>

      <div className="hotel-stack">
        {hotels.map(hotel => (
          <div key={hotel._id} className="hotel-block">
            <div className="hotel-main">
              <HotelCard hotel={hotel} />
              <div className="hotel-actions">
                <button onClick={() => { setSelectedHotel(hotel); setShowEditModal(true); }} className="btn btn-navy btn-sm">Edit</button>
                <button onClick={() => { setSelectedHotel(hotel); setShowUploadModal(true); }} className="btn btn-navy btn-sm">Upload</button>
                <button onClick={() => { setSelectedHotel(hotel); setShowAddRoomModal(true); }} className="btn btn-navy btn-sm">Add Room</button>
                <button onClick={() => { setSelectedHotel(hotel); setShowDeleteModal(true); }} className="btn btn-danger btn-sm">Delete</button>
                <button onClick={() => toggleRoomList(hotel._id)} className="btn btn-gray btn-sm">
                  {visibleRoomLists[hotel._id] ? 'Hide Rooms' : 'View Rooms'}
                </button>
              </div>
            </div>

            {visibleRoomLists[hotel._id] && (
              <div className="room-list-wrapper">
                <RoomList hotelId={hotel._id} />
              </div>
            )}
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <AddHotelModal 
              onClose={() => setShowAddModal(false)} 
              onHotelAdded={handleHotelAdded} 
            />
          </div>
        </div>
      )}

      {showEditModal && selectedHotel && (
        <EditHotelModal hotel={selectedHotel} onClose={() => setShowEditModal(false)} onHotelUpdated={handleHotelUpdated} />
      )}

      {showUploadModal && selectedHotel && (
        <UploadImageModal
          resource="hotels"
          itemId={selectedHotel._id}
          onClose={() => setShowUploadModal(false)}
          onUploaded={fetchHotels}
        />
      )}

      {showAddRoomModal && selectedHotel && (
        <AddRoomModal
          hotelId={selectedHotel._id}
          onClose={() => setShowAddRoomModal(false)}
          onRoomAdded={fetchHotels}
        />
      )}

      {showDeleteModal && selectedHotel && (
        <DeleteModal
          itemId={selectedHotel._id}
          itemType="hotel"
          onClose={() => setShowDeleteModal(false)}
          onDeleted={handleHotelDeleted}
          title="Delete Hotel"
          message={`Are you sure you want to delete "${selectedHotel.name}"?`}
        />
      )}
    </div>
  );
};

export default ManageHotels;
