import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import './RoomList.css';
import RoomCard from '../components/RoomCard';
import EditRoomModal from '../components/EditRoomModal';
import UploadImageModal from '../components/UploadImageModal';
import CalendarModal from '../components/CalendarModal';
import DeleteModal from '../components/DeleteModal';
import FeatureRoomModal from '../components/FeatureRoomModal';

const RoomList = ({ hotelId }) => {
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showFeatureModal, setShowFeatureModal] = useState(false);

  const fetchRooms = async () => {
    try {
      const res = await axios.get(`/api/hotel-rooms/${hotelId}/rooms`);
      setRooms(res.data);
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    }
  };

  useEffect(() => {
    if (hotelId) fetchRooms();
  }, [hotelId]);

  return (
    <div className="room-list-container">
      {rooms.length === 0 ? (
        <p>No rooms found.</p>
      ) : (
        <div className="room-cards-wrapper">
          {rooms.map((room) => (
           <div key={room._id}>
          <RoomCard room={room} />

              <div className="room-action-row">
                <button className="btn-action" onClick={() => { setSelectedRoom(room); setShowEditModal(true); }}>Edit</button>
                <button className="btn-action" onClick={() => { setSelectedRoom(room); setShowUploadModal(true); }}>Upload</button>
                <button className="btn-action" onClick={() => { setSelectedRoom(room); setShowCalendarModal(true); }}>Calendar</button>
                <button className="btn-action" onClick={() => { setSelectedRoom(room); setShowFeatureModal(true); }}>Feature</button>
                <button className="btn-action btn-delete" onClick={() => { setSelectedRoom(room); setShowDeleteModal(true); }}>Delete</button>

              </div>
            </div>
          ))}
        </div>
      )}

      {showEditModal && selectedRoom && (
        <EditRoomModal
          room={selectedRoom}
          onClose={() => {
            setShowEditModal(false);
            fetchRooms();
          }}
        />
      )}

      {showUploadModal && selectedRoom?._id && (
        <UploadImageModal
          resource="hotel-rooms"
          itemId={selectedRoom._id}
          onClose={() => {
            setShowUploadModal(false);
            fetchRooms();
          }}
          onUploaded={fetchRooms}
        />
      )}

    {showCalendarModal && selectedRoom?._id && (
  <CalendarModal
    itemId={selectedRoom._id} // ✅ correct
    type="room"
    onClose={() => {
      setShowCalendarModal(false);
      fetchRooms();
    }}
  />
      )}

      {showDeleteModal && selectedRoom?._id && (
  <DeleteModal
    itemId={selectedRoom._id}      // ✅ correct key name
    itemType="room"                // ✅ match expected type
    onDeleted={fetchRooms}         // ✅ refresh after delete
    onCancel={() => setShowDeleteModal(false)} // ✅ close modal
  />
      )}

      {showFeatureModal && selectedRoom?._id && (
        <FeatureRoomModal
          roomId={selectedRoom._id}
          onClose={() => {
            setShowFeatureModal(false);
            fetchRooms();
          }}
        />
      )}
    </div>
  );
};

export default RoomList;
