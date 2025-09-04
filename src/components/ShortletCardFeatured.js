import React from 'react';
import { Link } from 'react-router-dom';
import { FaStar } from 'react-icons/fa';
import './ShortletCardFeatured.css'; // Assuming you have this CSS

const ShortletCardFeatured = ({ shortlet }) => {
  if (!shortlet) return null;

  const {
    title,
    price,
    mainImage,
    averageRating = 0,
    location = '',
    _id,
  } = shortlet;

  return (
    <Link to={`/shortlets/${_id}`} className="shortlet-card-featured">
      <div className="shortlet-featured-image-container">
        <img
          src={mainImage || '/placeholder.jpg'}
          alt={title}
          className="shortlet-featured-image"
        />
      </div>

      <div className="shortlet-featured-info">
        <p className="shortlet-featured-title">{title}</p>
        <p className="shortlet-featured-location">{location}</p>
        <p className="shortlet-featured-price">₦{Number(price).toLocaleString()}</p>
        {averageRating > 0 && (
          <p className="shortlet-featured-rating">
            <FaStar size={12} color="gold" /> {averageRating}
          </p>
        )}
      </div>
    </Link>
  );
};

export default ShortletCardFeatured;
