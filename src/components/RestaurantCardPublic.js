import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './RestaurantCardPublic.css';
import { FaStar, FaRegStar } from 'react-icons/fa';

const RestaurantCardPublic = ({ restaurant }) => {
  const navigate = useNavigate();

  const {
    _id,
    name,
    city,
    state,
    mainImage,
    priceRange,
  } = restaurant || {};

  // ✅ Be flexible: use rating → averageRating → compute from reviews
  const computeRating = (r) => {
    const val = Number(r?.rating);
    if (Number.isFinite(val) && val > 0) return val;

    const avg = Number(r?.averageRating);
    if (Number.isFinite(avg) && avg > 0) return avg;

    if (Array.isArray(r?.reviews) && r.reviews.length) {
      const sum = r.reviews.reduce((acc, it) => acc + Number(it?.rating || 0), 0);
      const calc = sum / r.reviews.length;
      if (Number.isFinite(calc) && calc > 0) return calc;
    }
    return 0;
  };

  const ratingValue = computeRating(restaurant);
  const roundedRating = ratingValue > 0 ? Math.round(ratingValue) : null;

  return (
    <Link to={`/restaurants/${_id}`} className="restaurant-card-public">
      <div className="card-image-container">
        <img
          src={mainImage || '/fallback-restaurant.jpg'}
          alt={name || 'Restaurant'}
          className="restaurant-image"
        />
        {city && <span className="city-tag">{city}</span>}
      </div>

      <div className="restaurant-info">
        {name && <h4 className="restaurant-title ellipsis">{name}</h4>}
        {(city || state) && (
          <p className="restaurant-location ellipsis">
            {city}{state ? `, ${state}` : ''}
          </p>
        )}

        <div className="restaurant-bottom-row">
          {priceRange && (
            <span className="restaurant-price-range">₦{priceRange}</span>
          )}

          {/* ⭐ Only show if > 0 */}
          {roundedRating !== null && (
            <div className="restaurant-rating">
              {Array.from({ length: 5 }, (_, i) =>
                i < roundedRating ? (
                  <FaStar key={i} className="star filled" />
                ) : (
                  <FaRegStar key={i} className="star" />
                )
              )}
              <span className="rating-value">{ratingValue.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* keep as button to avoid nested Link warnings */}
        <button
          onClick={(e) => {
            e.preventDefault();
            navigate(`/restaurants/${_id}`);
          }}
          className="view-details-btn"
          style={{ fontSize: '10px', padding: '3px 7px' }}
        >
          View Details
        </button>
      </div>
    </Link>
  );
};

export default RestaurantCardPublic;
