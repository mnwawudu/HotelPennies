import React from 'react';
import { Link } from 'react-router-dom';
import './RestaurantCardFeatured.css';
import { FaStar } from 'react-icons/fa';

const RestaurantCardFeatured = ({ restaurant }) => {
  if (!restaurant) return null;

  const {
    _id,
    name,
    price,
    promo,
    promoPrice,
    location = '',
    city = '',
    averageRating = 0,
  } = restaurant;

  const finalPrice = promo && promoPrice && promoPrice < price ? promoPrice : price;
  const discount =
    promo && promoPrice && price
      ? Math.round(((price - promoPrice) / price) * 100)
      : 0;

  const fullAddress = location && city ? `${location}, ${city}` : location || city || 'Address not set';

  return (
    <Link to={`/restaurants/${_id}`} className="restaurant-card-featured">
      <div className="restaurant-image-container">
        <img
          src={restaurant.mainImage || '/placeholder.jpg'}
          alt={name}
          className="restaurant-image"
        />
        {discount > 0 && (
          <div className="restaurant-discount-badge">{discount}% OFF</div>
        )}
      </div>

      <div className="restaurant-info">
        <p className="restaurant-title">{name}</p>
        <p className="restaurant-address">{fullAddress}</p>
        <div className="restaurant-price-rating">
          {finalPrice !== undefined && finalPrice !== null && (
            <p className="restaurant-price">{Number(finalPrice).toLocaleString()}</p>
          )}
          {averageRating > 0 && (
            <p className="restaurant-rating">
              <FaStar size={12} color="gold" /> {averageRating.toFixed(1)}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
};

export default RestaurantCardFeatured;
