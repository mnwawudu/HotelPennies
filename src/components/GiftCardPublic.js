import React from 'react';
import { Link } from 'react-router-dom';
import { FaStar, FaRegStar } from 'react-icons/fa';
import './GiftCardPublic.css';

const GiftCardPublic = ({ gift }) => {
  const {
    _id,
    name,
    mainImage,
    price,
    promoPrice,
    hasDelivery,
    promo,
    // We’ll read averageRating if present, otherwise fall back to rating
    averageRating,
    rating,
  } = gift;

  const ratingValue =
    typeof averageRating === 'number'
      ? averageRating
      : (typeof rating === 'number' ? rating : 0);

  const roundedRating = ratingValue > 0 ? Math.round(ratingValue) : null;

  const discount =
    promoPrice && price
      ? Math.round(((price - promoPrice) / price) * 100)
      : null;

  return (
    <div className="gift-card-public">
      <Link to={`/gifts/${_id}`} className="gift-link-wrapper">
        <div className="card-image-container">
          <img
            src={mainImage || '/default-gift.jpg'}
            alt={name}
            className="gift-image"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/default-gift.jpg';
            }}
          />
          {promo && discount && (
            <span className="promo-badge">{discount}% OFF</span>
          )}
        </div>

        <div className="gift-info">
          <h4 className="gift-title ellipsis">{name}</h4>

          {hasDelivery && (
            <p className="delivery-badge">🚚 Delivery Included</p>
          )}

          <div className="gift-bottom-row">
            <div className="gift-price-group">
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
              <div className="gift-rating">
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

          <div className="view-details-btn">View Details</div>
        </div>
      </Link>
    </div>
  );
};

export default GiftCardPublic;
