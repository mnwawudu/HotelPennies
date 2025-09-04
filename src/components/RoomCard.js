// src/components/RoomCard.js
import React from 'react';
import './RoomCard.css';

const RoomCard = ({ room }) => {
  const getImage = () => {
    if (room.mainImage && room.mainImage.startsWith('http')) {
      return room.mainImage;
    }

    if (room.images?.length) {
      const first = room.images[0];
      return first.startsWith('http')
        ? first
        : `http://localhost:10000/${first.replace(/\\/g, '/')}`;
    }

    return '/default-room.jpg';
  };

  return (
    <div className="room-card">
      <img
        src={getImage()}
        alt={room.name}
        className="room-image"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = '/default-room.jpg';
        }}
      />
      <div className="room-details">
        <h3 className="room-title">{room.name}</h3>

        {/* ✅ Promo + Normal Price Logic */}
        <div className="room-price">
          {room.promoPrice ? (
            <>
              <span className="old-price">₦{room.price?.toLocaleString()}</span>
              <span className="promo-price">₦{room.promoPrice?.toLocaleString()}</span>
            </>
          ) : (
            <span className="promo-price">₦{room.price?.toLocaleString()}</span>
          )}
        </div>

        <p className="room-specs">{room.bedType} | {room.guestCapacity} Guests</p>
        <p className="room-tags">✓ {room.complimentary || 'No extras listed'}</p>
        <p className="room-desc">{room.description}</p>

        <div className="room-buttons">
          <button className="btn-view">View More</button>
          <button className="btn-book">Book Now</button>
        </div>
      </div>
    </div>
  );
};

export default RoomCard;
