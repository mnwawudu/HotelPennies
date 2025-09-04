import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './ShortletCardPublic.css';
import { FaStar, FaRegStar } from 'react-icons/fa';

const ShortletCardPublic = ({ shortlet }) => {
  const navigate = useNavigate();

  const {
    _id,
    name,
    title,
    location,
    price,
    promoPrice,
    images,
    city,
    averageRating,
    rating,
    reviews,
  } = shortlet || {};

  const displayTitle = name || title || '—';
  const mainImage = images?.[0] || '/default-image.jpg';

  // derive rating: averageRating → rating → compute from reviews
  let ratingValue = Number(averageRating ?? rating ?? 0);
  if (!ratingValue && Array.isArray(reviews) && reviews.length) {
    const sum = reviews.reduce((acc, r) => acc + Number(r?.rating || 0), 0);
    ratingValue = sum / reviews.length || 0;
  }
  const roundedRating = ratingValue > 0 ? Math.round(ratingValue) : null;

  return (
    <Link to={`/shortlets/${_id}`} className="shortlet-card-public">
      <div className="card-image-container">
        <img src={mainImage} alt={displayTitle} className="shortlet-image" />
        {city && <span className="city-tag">{city}</span>}
      </div>

      <div className="shortlet-info">
        <h4 className="shortlet-title ellipsis">{displayTitle}</h4>
        {location && <p className="shortlet-location ellipsis">{location}</p>}

        {/* PRICE (left) + RATING (right) in one row */}
        <div
          className="shortlet-bottom-row"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
        >
          <div className="shortlet-price-group">
            {promoPrice ? (
              <>
                <span className="actual-price">₦{Number(price).toLocaleString()}</span>
                <span className="promo-price">₦{Number(promoPrice).toLocaleString()}</span>
              </>
            ) : (
              <span className="promo-price">₦{Number(price).toLocaleString()}</span>
            )}
          </div>

          {roundedRating !== null && (
            <div
              className="shortlet-rating"
              style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 90, justifyContent: 'flex-end' }}
            >
              {Array.from({ length: 5 }, (_, i) =>
                i < roundedRating ? (
                  <FaStar key={i} className="star filled" />
                ) : (
                  <FaRegStar key={i} className="star" />
                )
              )}
              <span className="rating-value" style={{ fontSize: 12, opacity: 0.85 }}>
                {ratingValue.toFixed(1)}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={(e) => {
            e.preventDefault();
            navigate(`/shortlets/${_id}`);
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

export default ShortletCardPublic;
