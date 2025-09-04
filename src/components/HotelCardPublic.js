// ✅ Final HotelCardPublic.js without nested <a> warning
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './HotelCardPublic.css';
import { FaStar, FaRegStar } from 'react-icons/fa';

const HotelCardPublic = ({ hotel, featuredRoom }) => {
  const navigate = useNavigate();

  const {
    _id,
    name,
    location,
    images = [],
    averageRating = 0,
    city,
    minPrice,
    maxPrice
  } = hotel;

  const image = images[0] || '/default-hotel.jpg';
  const title = featuredRoom?.title || name;
  const price = featuredRoom
    ? featuredRoom.promoPrice
      ? {
          actual: featuredRoom.price,
          promo: featuredRoom.promoPrice
        }
      : { promo: featuredRoom.price }
    : minPrice && maxPrice
    ? { range: `₦${minPrice.toLocaleString()} – ₦${maxPrice.toLocaleString()}` }
    : null;

  const roundedRating = averageRating > 0 ? Math.round(averageRating) : null;

  return (
    <Link to={`/hotels/${_id}`} className="shortlet-card-public">
      <div className="card-image-container">
        <img src={image} alt={title} className="shortlet-image" />
        {city && <span className="city-tag">{city}</span>}
      </div>
      <div className="shortlet-info">
        <h4 className="shortlet-title ellipsis">{title}</h4>
        <p className="shortlet-location ellipsis">{location || 'Location not set'}</p>

        <div className="shortlet-bottom-row">
          <div className="shortlet-price-group">
            {price?.range ? (
              <span className="promo-price">{price.range}</span>
            ) : price?.promo ? (
              <>
                {price.actual && (
                  <span className="actual-price">₦{price.actual.toLocaleString()}</span>
                )}
                <span className="promo-price">₦{price.promo.toLocaleString()}</span>
              </>
            ) : (
              <span className="promo-price">Price not set</span>
            )}
          </div>
          {roundedRating !== null && (
            <div className="shortlet-rating">
              {Array.from({ length: 5 }, (_, i) =>
                i < roundedRating ? (
                  <FaStar key={i} className="star filled" />
                ) : (
                  <FaRegStar key={i} className="star" />
                )
              )}
              <span className="rating-value">{averageRating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* ✅ Changed from nested <Link> to <button> */}
        <button
          onClick={(e) => {
            e.preventDefault(); // prevent parent <Link> from triggering
            navigate(`/hotels/${_id}`);
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

export default HotelCardPublic;
