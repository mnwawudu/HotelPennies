import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import axios from '../utils/axiosConfig';
import './AddRoomModal.css'; // Reuses modal layout styling

const CalendarModal = ({ itemId, type = 'room', onClose, onSaved }) => {
  const [unavailableDates, setUnavailableDates] = useState([]);
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');

 const getItemRoute = () => {
  switch (type) {
    case 'room':
      return 'hotel-rooms';
    case 'shortlet':
      return 'shortlets';
    case 'restaurant':
      return 'restaurants';
    case 'menu':
      return 'restaurant-menus';
    case 'eventcenter':
      return 'eventcenters';
    case 'tourguides':
      return 'tour-guides';
    case 'chop': // ✅ Add this
      return 'chops';
    default:
      return '';
  }
};


  useEffect(() => {
    const fetchDates = async () => {
      const route = getItemRoute();
      if (!itemId || !route) return;

      try {
        const res = await axios.get(`/api/${route}/${itemId}/unavailable-dates`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const dates = (res.data.unavailableDates || []).map(d => new Date(d));
        setUnavailableDates(dates);
      } catch (err) {
        console.error('❌ Error fetching unavailable dates:', err);
      }
    };

    fetchDates();
  }, [itemId]);

  const toggleDate = (selectedDate) => {
    const exists = unavailableDates.find(d => d.toDateString() === selectedDate.toDateString());
    if (exists) {
      setUnavailableDates(prev => prev.filter(d => d.toDateString() !== selectedDate.toDateString()));
    } else {
      setUnavailableDates(prev => [...prev, selectedDate]);
    }
  };

  const handleSave = async () => {
    const route = getItemRoute();
    if (!itemId || !route) {
      alert('❌ Invalid resource type or ID');
      return;
    }

    setLoading(true);
    try {
      await axios.put(
        `/api/${route}/${itemId}/unavailable-dates`,
        { unavailableDates },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('✅ Unavailable dates saved.');
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('❌ Failed to save unavailable dates:', err);
      alert('❌ Failed to save unavailable dates.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-room-overlay">
      <div className="add-room-modal">
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '20px',
            fontSize: '22px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#333'
          }}
        >
          ×
        </button>
        <h3 className="modal-title">Manage Unavailable Dates</h3>

        <DatePicker
          inline
          highlightDates={unavailableDates}
          onChange={toggleDate} // ✅ Corrected from onDayClick to onChange
        />

        <div className="button-row">
          <button className="button-primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </button>
          <button className="button-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default CalendarModal;
