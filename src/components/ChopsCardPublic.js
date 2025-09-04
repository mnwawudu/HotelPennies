import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaStar, FaRegStar } from 'react-icons/fa';
import axios from '../utils/axiosConfig'; // ✅ Adjust if using base axios

import './ChopsCardPublic.css';

const ChopsCardPublic = ({ chop }) => {
  const navigate = useNavigate();
  const [availableStates, setAvailableStates] = useState([]);

  const {
    _id,
    name,
    price,
    promo,
    promoPrice,
    hasDelivery,
    complimentary,
    mainImage,
  } = chop || {};

  // ✅ Robust rating: rating → averageRating → compute from reviews
  const computeRating = (c) => {
    const direct = Number(c?.rating);
    if (Number.isFinite(direct) && direct > 0) return direct;

    const avg = Number(c?.averageRating);
    if (Number.isFinite(avg) && avg > 0) return avg;

    if (Array.isArray(c?.reviews) && c.reviews.length) {
      const sum = c.reviews.reduce((acc, r) => acc + Number(r?.rating || 0), 0);
      const calc = sum / c.reviews.length;
      if (Number.isFinite(calc) && calc > 0) return calc;
    }
    return 0;
  };

  const ratingValue = computeRating(chop);
  const roundedRating = ratingValue > 0 ? Math.round(ratingValue) : null;

  const discountPercent = promo && promoPrice && price
    ? Math.round(((price - promoPrice) / price) * 100)
    : 0;

  useEffect(() => {
    const fetchStates = async () => {
      try {
        const res = await axios.get('/api/pickup-delivery');
        const states = res.data
          .filter(
            (opt) =>
              Array.isArray(opt.appliesTo) &&
              opt.appliesTo.includes('chops') &&
              opt.delivery
          )
          .map((opt) => opt.service);

        setAvailableStates(states);
      } catch (err) {
        console.error('❌ Failed to load delivery states:', err);
      }
    };

    fetchStates();
  }, []);

  return (
    <Link to={`/chops/${_id}`} className="shortlet-card-public">
      <div className="card-image-container">
        <img
          src={mainImage || '/default-chop.jpg'}
          alt={name}
          className="shortlet-image"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/default-chop.jpg';
          }}
        />
        {promo && discountPercent > 0 && (
          <span className="city-tag">{discountPercent}% OFF</span>
        )}
      </div>

      <div className="shortlet-info">
        <h4 className="shortlet-title ellipsis">{name}</h4>

        {complimentary && (
          <p className="shortlet-tagline ellipsis">🎁 {complimentary}</p>
        )}

        {hasDelivery && (
          <p className="shortlet-location ellipsis">🚚 Delivery Included</p>
        )}

        {/* ✅ Available States */}
        {hasDelivery && availableStates.length > 0 && (
          <p
            className="shortlet-location ellipsis"
            style={{ color: '#555', fontSize: '12px' }}
          >
            Available in: {availableStates.join(', ')}
          </p>
        )}

        <div className="shortlet-bottom-row">
          <div className="shortlet-price-group">
            {promo && promoPrice ? (
              <>
                <span className="actual-price">
                  ₦{Number(price).toLocaleString()}
                </span>
                <span className="promo-price">
                  ₦{Number(promoPrice).toLocaleString()}
                </span>
              </>
            ) : (
              <span className="promo-price">₦{Number(price).toLocaleString()}</span>
            )}
          </div>

          {/* ⭐ Show only if > 0 */}
          {roundedRating !== null && (
            <div className="shortlet-rating">
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

        <button
          onClick={(e) => {
            e.preventDefault();
            navigate(`/chops/${_id}`);
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

export default ChopsCardPublic;
