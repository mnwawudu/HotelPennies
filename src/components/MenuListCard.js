// 📁 src/components/MenuListCard.js
import React from 'react';
import './MenuListCard.css';

const MenuListCard = ({
  item,
  onEdit,
  onUpload,
  onCalendar,
  onFeature,
  onDelete
}) => {
  const displayImage = item.mainImage || (item.images?.[0] || '');

  return (
    <div className="menu-card">
      {displayImage && <img src={displayImage} alt={item.title} />}
      
      <h4>{item.title}</h4>

      {item.promoPrice ? (
        <p>
          <span style={{ textDecoration: 'line-through', color: 'gray', marginRight: '8px' }}>
            ₦{Number(item.price).toLocaleString()}
          </span>
          <span style={{ color: 'navy', fontWeight: 'bold' }}>
            ₦{Number(item.promoPrice).toLocaleString()}
          </span>
        </p>
      ) : (
        <p style={{ color: 'navy', fontWeight: 'bold' }}>
          ₦{Number(item.price).toLocaleString()}
        </p>
      )}

      {item.complimentary && <p className="complimentary">Free: {item.complimentary}</p>}
      {item.description && <p>{item.description}</p>}

      <div className="menu-actions" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
        <button className="action-btn">View More</button>
        <button className="action-btn buy">Buy Now</button>
      </div>

      <div className="admin-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
        <button className="action-btn" onClick={() => onEdit(item)}>Edit</button>
        <button className="action-btn" onClick={() => onUpload(item)}>Upload</button>
        <button className="action-btn" onClick={() => onCalendar(item)}>Calendar</button>
        <button className="action-btn" onClick={() => onFeature(item)}>Feature</button>
        <button className="action-btn delete" onClick={() => onDelete(item)}>Delete</button>
      </div>
    </div>
  );
};

export default MenuListCard;
