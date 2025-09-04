import React from 'react';
import './CruiseCard.css';
import { FaStar } from 'react-icons/fa';

const CruiseCard = ({ cruise, onBook, onEdit, onDelete, onUpload, onCalendar }) => {
  const {
    title,
    price,
    city,
    mainImage,
    reviews = []
  } = cruise;

  const averageRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

  return (
    <div className="cruise-card">
      {mainImage && <img src={mainImage} alt={title} className="cruise-image" />}
      <div className="cruise-info">
        <h3 className="cruise-title">{title}</h3>
        <p className="cruise-city">{city}</p>
        <p className="cruise-note"> Prices may vary based on pickup and destination.</p>

        {averageRating && (
          <div className="cruise-rating">
            <FaStar color="#fbc02d" /> {averageRating} / 5
          </div>
        )}

        <button onClick={onBook} className="book-now-btn">Get Quote</button>

        {/* ✅ Admin Action Buttons */}
        {(onEdit || onDelete || onUpload || onCalendar) && (
          <div className="cruise-admin-buttons">
            {onEdit && <button onClick={() => onEdit(cruise)}>Edit</button>}
            {onDelete && <button onClick={() => onDelete(cruise._id)}>Delete</button>}
            {onUpload && <button onClick={() => onUpload(cruise)}>Upload Image</button>}
            {onCalendar && <button onClick={() => onCalendar(cruise)}>Calendar</button>}
          </div>
        )}
      </div>
    </div>
  );
};

export default CruiseCard;
