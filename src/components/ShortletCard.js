import React from 'react';
import { Link } from 'react-router-dom';
import './ShortletCard.css';

const ShortletCard = ({ shortlet, onEdit, onUpload, onCalendar, onFeature, onDelete }) => {
  const {
    _id,
    title,
    price,
    promoPrice,
    location,
    city,
    state,
    complimentary,
    description,
    mainImage,
    bedType,
    guestCapacity,
  } = shortlet;

  const address = location || '';
  const cityName = city || '';
  const stateName = state ? `${state} State` : '';

  return (
    <div className="shortlet-wrapper">
      <Link to={`/shortlets/${_id}`} className="shortlet-card-link">
        <div className="shortlet-card">
          <div className="shortlet-image-wrapper">
            <img src={mainImage} alt={title} className="shortlet-image-main" />
          </div>
          <div className="shortlet-details">
            <h3 className="shortlet-title">{title}</h3>

            <div className="shortlet-price">
              {promoPrice ? (
                <>
                  <span className="price-original">₦{Number(price).toLocaleString()}</span>
                  <span className="price-promo">₦{Number(promoPrice).toLocaleString()}</span>
                </>
              ) : (
                <span className="price-promo">₦{Number(price).toLocaleString()}</span>
              )}
            </div>

            {address && <div className="shortlet-address">{address}</div>}
            <div className="shortlet-city-state">{cityName}{stateName && `, ${stateName}`}</div>

            {(bedType || guestCapacity) && (
              <div className="shortlet-city-state">{bedType} | {guestCapacity} Guests</div>
            )}

            {complimentary && (
              <div className="shortlet-complimentary">
                ✓ <span className="navy-text">Complimentary:</span> {complimentary}
              </div>
            )}
            {description && <div className="shortlet-description">{description}</div>}
          </div>
        </div>
      </Link>

      {/* 🔒 Admin-only actions (still outside link) */}
      {onEdit && (
        <div className="shortlet-admin-actions left-aligned-button-row">
          <button className="navy-button small" onClick={() => onEdit(shortlet)}>Edit</button>
          <button className="navy-button small" onClick={() => onUpload(shortlet)}>Upload Image</button>
          <button className="navy-button small" onClick={() => onCalendar(shortlet)}>Calendar</button>
          <button className="navy-button small" onClick={() => onFeature(shortlet)}>Feature</button>
          <button
            className="navy-button small"
            style={{ backgroundColor: '#d32f2f', color: 'white' }}
            onClick={() => onDelete(shortlet)}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default ShortletCard;
