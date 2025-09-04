import React from 'react';
import { Link } from 'react-router-dom';
import './MenuCardPublic.css';
import { FaStar } from 'react-icons/fa';

const MenuCardPublic = ({ menu }) => {
  if (!menu) return null;

  const {
    title,
    price = 0,
    promoPrice = 0,
    averageRating = 0,
    mainImage,
    restaurantId,
  } = menu;

  const finalPrice = promoPrice && promoPrice < price ? promoPrice : price;
  const discount =
    promoPrice && promoPrice < price
      ? Math.round(((price - promoPrice) / price) * 100)
      : 0;

  const city =
    typeof restaurantId === 'object' && restaurantId?.city
      ? restaurantId.city
      : 'City not set';

  const restaurantLink = `/restaurants/${restaurantId?._id || restaurantId}`;


  return (
    <Link to={restaurantLink} className="menu-card-public">
      <div className="menu-image-container">
        <img
          src={mainImage || '/placeholder.jpg'}
          alt={title}
          className="menu-image"
        />
        {discount > 0 && (
          <span className="menu-discount-badge">{discount}% OFF</span>
        )}
      </div>

      <div className="menu-info">
        <p className="menu-title">{title}</p>
        <p className="menu-city">{city}</p>
        <p className="menu-price">₦{Number(finalPrice).toLocaleString()}</p>
        {averageRating > 0 && (
          <p className="menu-rating">
            <FaStar size={12} color="gold" /> {averageRating}
          </p>
        )}
      </div>
    </Link>
  );
};

export default MenuCardPublic;
