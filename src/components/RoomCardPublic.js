import React from 'react';
import { Link } from 'react-router-dom';
import './RoomCardPublic.css';

const RoomCardPublic = ({ room }) => {
  const {
    name,
    price = 0,
    promoPrice = 0,
    averageRating = 0,
    mainImage,
    hotelId,
    _id,
  } = room;

  console.log('RoomCardPublic - hotelId:', hotelId);

  const city =
    hotelId && typeof hotelId === 'object' && hotelId.city
      ? hotelId.city
      : 'City not set';

  const hotelIdValue = hotelId && typeof hotelId === 'object' ? hotelId._id : hotelId;

  const hasPromo = promoPrice > 0 && promoPrice < price;
  const discount = hasPromo ? Math.round(((price - promoPrice) / price) * 100) : 0;
  const finalPrice = hasPromo ? promoPrice : price;

  return (
    <div className="room-card-public">
     <Link to={`/hotels/${hotelId._id}`} className="room-card-link">
        <div className="room-image-container">
          {discount > 0 && <span className="room-discount-badge">-{discount}%</span>}
          <img src={mainImage} alt={name} className="room-image" />
        </div>
        <div className="room-details">
          <p className="room-name">{name}</p>
          <p className="room-city">{city}</p>
          <div className="room-price-rating">
            <p className="room-price">₦{finalPrice?.toLocaleString()}</p>
            {averageRating > 0 && (
              <p className="room-rating">⭐ {averageRating?.toFixed(1)}</p>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
};

export default RoomCardPublic;
