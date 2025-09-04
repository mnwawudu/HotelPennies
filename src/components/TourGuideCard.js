// 📁 components/TourGuideCard.js
import React from 'react';
import './TourGuideCard.css';

const TourGuideCard = ({ guide, onEdit, onUpload, onCalendar, onFeature, onDelete }) => {
  return (
    <div className="tour-guide-wrapper">
      <div className="tour-guide-card">
        <img src={guide.mainImage || guide.images?.[0]} alt={guide.name} className="tour-guide-img" />
        <div className="tour-guide-info">
          <h3>{guide.name}</h3>
          <p><strong>₦</strong>{Number(guide.price).toLocaleString()}</p>
          {guide.location && <p><strong>Location:</strong> {guide.location}</p>}
          {guide.city && <p><strong>City:</strong> {guide.city}</p>}
          {guide.state && <p><strong>State:</strong> {guide.state}</p>}
         {guide.language && <p><strong>Language:</strong> {guide.language}</p>}
{guide.experience && <p><strong>Experience:</strong> {guide.experience} year(s)</p>}
          {guide.complimentary && <p><strong>Complimentary:</strong> {guide.complimentary}</p>}
          {guide.description && (
            <p className="description"><em>{guide.description.slice(0, 100)}...</em></p>
          )}
          <div className="tour-guide-btns">
            <button className="btn-dark">View More</button>
            <button className="btn-dark">Book Now</button>
          </div>
        </div>
      </div>
      <div className="tour-guide-actions">
        <button className="btn-dark" onClick={onEdit}>Edit</button>
        <button className="btn-dark" onClick={onUpload}>Upload</button>
        <button className="btn-dark" onClick={onCalendar}>Calendar</button>
     
        <button className="btn-dark" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
};

export default TourGuideCard;
