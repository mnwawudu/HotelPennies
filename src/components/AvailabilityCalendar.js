import React from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './AvailabilityCalendar.css';

const AvailabilityCalendar = ({ unavailableDates = [] }) => {
  const tileDisabled = ({ date }) =>
    unavailableDates.some(
      (unavailableDate) =>
        new Date(unavailableDate).toDateString() === date.toDateString()
    );

  return (
    <div className="calendar-container">
      <h3 className="calendar-title">Availability</h3>
      <Calendar
        tileDisabled={tileDisabled}
        selectRange={false}
        showNeighboringMonth={false}
      />
    </div>
  );
};

export default AvailabilityCalendar;
