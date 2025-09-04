import React from 'react';
import { Link } from 'react-router-dom';
import { FaStar } from 'react-icons/fa';
import './MenuCardPublic.css'; // reusing same styles

const EventCenterCardFeatured = ({ center }) => {
  if (!center) return null;

  const {
    name,
    price = 0,
    promoPrice = 0,
    rating = 0,
    mainImage,
    location = '',
    _id,
  } = center;

  const finalPrice = promoPrice && promoPrice < price ? promoPrice : price;
  const discount =
    promoPrice && promoPrice < price
      ? Math.round(((price - promoPrice) / price) * 100)
      : 0;

  return (
    <Link to={`/event-centers/${_id}`} className="menu-card-public">
      <div className="menu-image-container">
        <img
          src={mainImage || '/placeholder.jpg'}
          alt={name}
          className="menu-image"
        />
        {discount > 0 && (
          <span className="menu-discount-badge">{discount}% OFF</span>
        )}
      </div>

      <div className="menu-info">
        <p className="menu-title">{name}</p>
        <p className="menu-city">{location}</p>
        <div className="flex justify-between items-center">
          <p className="menu-price">₦{Number(finalPrice).toLocaleString()}</p>
          {rating > 0 && (
            <p className="menu-rating">
              <FaStar size={12} color="gold" /> {rating.toFixed(1)}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
};

export default EventCenterCardFeatured;
