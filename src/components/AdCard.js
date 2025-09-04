// ✅ src/components/AdCard.js
import React from 'react';
import './AdCard.css';

const AdCard = ({ ad, onEdit, onUpload, onDisable }) => {
  return (
    <div className="ad-card compact">
      <div className="ad-image-wrapper">
        {ad.imageUrl ? (
          <a href={ad.link || '#'} target="_blank" rel="noopener noreferrer">
            <img src={ad.imageUrl} alt={ad.title} />
          </a>
        ) : (
          <div className="image-placeholder">No Image</div>
        )}
      </div>

      <h4>{ad.title}</h4>
      <p className="ad-description">{ad.description}</p>

      {ad.link && (
        <a
          href={ad.link}
          target="_blank"
          rel="noopener noreferrer"
          className="visit-link"
        >
          🔗 Visit Site
        </a>
      )}

      <div className="ad-meta">
        <p><strong>Scope:</strong> {ad.scope}</p>
        <p><strong>Location:</strong> {ad.state}, {ad.city}</p>
        <p><strong>Period:</strong> {ad.subscriptionPeriod}</p>
      </div>

      <div className="ad-actions">
        <button onClick={() => onEdit(ad)} className="edit-btn">Edit</button>
        <button onClick={() => onUpload(ad)} className="upload-btn">Upload Image</button>
        <button onClick={() => onDisable(ad)} className="disable-btn">Disable</button>
      </div>
    </div>
  );
};

export default AdCard;
