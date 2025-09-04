import React from 'react';
import { Link } from 'react-router-dom';
import './EventCenterCardPublic.css';
import { FaStar, FaRegStar } from 'react-icons/fa';

const EventCenterCardPublic = ({ eventCenter }) => {
  const {
    _id,
    name,
    location,
    city,
    state,
    capacity,
    price,
    promoPrice,
    mainImage,
    usePromo,

    // your model usually stores averageRating, not rating
    averageRating,
    rating, // keep this just in case some docs still use it
  } = eventCenter;

  const displayPrice = usePromo && promoPrice ? promoPrice : price;

  // ✅ only show when strictly > 0
  const rawRating = Number(
    averageRating ?? rating ?? 0
  );
  const showRating = Number.isFinite(rawRating) && rawRating > 0;
  const roundedRating = showRating ? Math.round(rawRating) : 0;

  return (
    <Link to={`/event-centers/${_id}`} className="event-center-card-public shortlet-card-public">
      <div className="card-image-container">
        <img
          src={mainImage || '/placeholder-eventcenter.png'}
          alt={name}
          className="shortlet-image"
        />
        {city && <span className="city-tag">{city}</span>}
      </div>

      <div className="shortlet-info">
        <h4 className="shortlet-title ellipsis">{name}</h4>
        <p className="shortlet-location ellipsis">{`${location}, ${state}`}</p>
        <p className="shortlet-tagline ellipsis">Capacity: {capacity}</p>

        <div className="shortlet-bottom-row">
          <div className="shortlet-price-group">
            {usePromo && promoPrice ? (
              <>
                <span className="actual-price">₦{Number(price).toLocaleString()}</span>
                <span className="promo-price">₦{Number(promoPrice).toLocaleString()}</span>
              </>
            ) : (
              <span className="promo-price">₦{Number(displayPrice).toLocaleString()}</span>
            )}
          </div>

          {/* ✅ render nothing at all when rating is 0/undefined */}
          {showRating && (
            <div className="shortlet-rating" aria-label={`Rated ${rawRating.toFixed(1)} out of 5`}>
              {Array.from({ length: 5 }, (_, i) =>
                i < roundedRating ? (
                  <FaStar key={i} className="star filled" />
                ) : (
                  <FaRegStar key={i} className="star" />
                )
              )}
              <span className="rating-value">{rawRating.toFixed(1)}</span>
            </div>
          )}
        </div>

        <span className="ec-view-btn">View Details</span>
      </div>
    </Link>
  );
};

export default EventCenterCardPublic;
