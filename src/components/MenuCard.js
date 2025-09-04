// ✅ src/components/MenuCard.js
import React, { useState } from 'react';
import './MenuCard.css';

const MenuCard = ({ menu, onBook }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const images = menu.images?.length ? menu.images : [menu.imageUrl];
  const showArrows = images.length > 1;

  const handlePrev = () => {
    setCurrentImageIndex((prevIndex) =>
      prevIndex === 0 ? images.length - 1 : prevIndex - 1
    );
  };

  const handleNext = () => {
    setCurrentImageIndex((prevIndex) =>
      prevIndex === images.length - 1 ? 0 : prevIndex + 1
    );
  };

  return (
    <div className="menu-card-wrapper">
      <div className="menu-img-container">
        <img
          src={images[currentImageIndex]}
          alt={menu.title}
          className="menu-img"
        />
        {showArrows && (
          <>
            <button className="img-nav left" onClick={handlePrev}>
              &lt;
            </button>
            <button className="img-nav right" onClick={handleNext}>
              &gt;
            </button>
          </>
        )}
        {menu.promo && (
          <div className="discount-badge">{menu.promo}% OFF</div>
        )}
      </div>

      <div className="menu-card-content">
        <div className="menu-title">{menu.title}</div>

        <div className="menu-price-row">
          {menu.promoPrice ? (
            <>
              <span className="old-price">₦{menu.price?.toLocaleString()}</span>
              <span className="menu-price">₦{menu.promoPrice?.toLocaleString()}</span>
            </>
          ) : (
            <span className="menu-price">₦{menu.price?.toLocaleString()}</span>
          )}
        </div>

        {menu.complimentary && (
          <div className="menu-complimentary">{menu.complimentary}</div>
        )}

        <div className="menu-description">
          {menu.description?.length > 70
            ? menu.description.slice(0, 70) + '...'
            : menu.description}
        </div>

        <button
          className="choose-room-btn"
          onClick={() => onBook(menu)}
        >
          Book Now
        </button>
      </div>
    </div>
  );
};

export default MenuCard;
