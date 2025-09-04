import React, { useEffect, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './AdminCalendarModal.css';
import axios from '../utils/axiosConfig';

const AdminCalendarModal = ({ item, itemType, onClose, onSaved }) => {
  const [selectedDates, setSelectedDates] = useState([]);
  const token = localStorage.getItem('adminToken');

  useEffect(() => {
    if (!item || !item._id || !itemType) return;
    fetchDates();
    // eslint-disable-next-line
  }, [item, itemType]);

  const fetchDates = async () => {
    try {
      const res = await axios.get(`/api/${itemType}s/${item._id}/unavailable-dates`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Normalize incoming dates to YYYY-MM-DD format
      const dates = res.data.unavailableDates || [];
      const normalized = dates.map(date => new Date(date).toISOString().split('T')[0]);
      setSelectedDates(normalized);
    } catch (err) {
      console.error('❌ Error fetching unavailable dates:', err);
    }
  };

  const toggleDate = (date) => {
    const iso = new Date(date).toISOString().split('T')[0];
    setSelectedDates((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso]
    );
  };

  const saveDates = async () => {
    try {
      await axios.put(
        `/api/${itemType}s/${item._id}/unavailable-dates`,
        { unavailableDates: selectedDates },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (typeof onSaved === 'function') onSaved();
      onClose();
    } catch (err) {
      console.error('❌ Failed to save unavailable dates:', err);
    }
  };

  const tileClassName = ({ date }) => {
    const iso = date.toISOString().split('T')[0];
    return selectedDates.includes(iso) ? 'unavailable' : null;
  };

  return (
    <div className="admin-calendar-modal-overlay">
      <div className="admin-calendar-modal-content">
        <button className="admin-calendar-close-btn" onClick={onClose}>×</button>
        <h3>Mark Unavailable Dates</h3>
        <Calendar
          onClickDay={toggleDate}
          tileClassName={tileClassName}
          selectRange={false}
        />
        <button className="admin-calendar-save-btn" onClick={saveDates}>
          Save
        </button>
      </div>
    </div>
  );
};

export default AdminCalendarModal;
