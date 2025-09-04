// src/components/HotelCard.js
import React from 'react';
import './HotelCard.css';

const HotelCard = ({ hotel }) => {
  return (
    <div className="hotel-content">
      <img
        src={hotel.images?.[0] || '/default-hotel.jpg'}
        alt={hotel.name}
        className="hotel-image"
        onError={(e) => {
          e.target.src = '/default-hotel.jpg';
        }}
      />
      <div className="hotel-details">
        <h3 className="hotel-name">{hotel.name}</h3>
        <p><strong>Location:</strong> {hotel.location}</p>
        <p><strong>City:</strong> {hotel.city}</p>
        <p><strong>State:</strong> {hotel.state}</p>
        <p><strong>Description:</strong> {hotel.description}</p>
		<p><strong>Price Range:</strong> ₦{hotel.minPrice?.toLocaleString()} – ₦{hotel.maxPrice?.toLocaleString()}</p>

      </div>
    </div>
  );
};

export default HotelCard;
