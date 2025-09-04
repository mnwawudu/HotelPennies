import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './TourGuideCardPublic.css';

const TourGuideCardPublic = ({ guide }) => {
  const navigate = useNavigate();

  const {
    _id,
    mainImage,
    name,
    location,
    price,
    promoPrice,
    city,
  } = guide;

  // Prefer averageRating, fall back to rating, hide if not > 0
  const rawRating =
    typeof guide.averageRating === 'number'
      ? guide.averageRating
      : Number(guide.rating || 0);

  const hasRating = Number.isFinite(rawRating) && rawRating > 0;
  const roundedRating = hasRating ? Math.round(rawRating) : null;

  const fmt = (n) => `₦${Number(n || 0).toLocaleString()}`;

  return (
    <Link to={`/tour-guides/${_id}`} className="tour-card-public">
      <div className="card-image-container">
        <img
          src={mainImage || '/default-image.jpg'}
          alt={name || 'Tour guide'}
          className="tour-image"
        />
        {city && <span className="city-tag">{city}</span>}
      </div>

      <div className="tour-info">
        {name && <h4 className="tour-title ellipsis">{name}</h4>}
        {location && <p className="tour-location ellipsis">{location}</p>}

        <div className="tour-bottom-row">
          <div className="tour-price-group">
            {promoPrice ? (
              <>
                <span className="actual-price">{fmt(price)}</span>
                <span className="promo-price">{fmt(promoPrice)}</span>
              </>
            ) : (
              <span className="promo-price">{fmt(price)}</span>
            )}
          </div>

          {hasRating && (
            <div className="tour-rating">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={`star ${i < roundedRating ? 'filled' : ''}`}>
                  {i < roundedRating ? '★' : '☆'}
                </span>
              ))}
              <span className="rating-value">{rawRating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Button avoids nested-link issues */}
        <button
          onClick={(e) => {
            e.preventDefault();
            navigate(`/tour-guides/${_id}`);
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

export default TourGuideCardPublic;
