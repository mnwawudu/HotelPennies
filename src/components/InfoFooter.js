import React from 'react';

const InfoFooter = () => {
  return (
    <div style={infoFooterStyle}>
      <div style={sectionStyle}>
        <h4>Amenities</h4>
        <p>Free Wi-Fi, Breakfast, Parking, Pool, AC, Lounge, etc.</p>
      </div>
      <div style={sectionStyle}>
        <h4>FAQ</h4>
        <p>How to book? When to check-in? Payment methods?</p>
      </div>
      <div style={sectionStyle}>
        <h4>Booking Rules</h4>
        <p>Check-in: 2PM • Check-out: 12PM</p>
      </div>
    </div>
  );
};

const infoFooterStyle = {
  backgroundColor: '#eaeaea',
  display: 'flex',
  justifyContent: 'space-around',
  padding: '1.5rem 0',
  flexWrap: 'wrap',
  color: '#333',
};

const sectionStyle = {
  flex: '1 1 200px',
  margin: '0.5rem',
};

export default InfoFooter;
