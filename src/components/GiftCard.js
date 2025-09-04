import React, { useState } from 'react';
import './GiftCard.css';

const GiftCard = ({ gift, onEdit, onUpload, onCalendar, onFeature, onDelete }) => {
  const [quantity, setQuantity] = useState(1);

  const handleImageClick = () => {
    const image = gift.mainImage || (gift.images?.[0] || '');
    if (image) window.open(image, '_blank');
  };

  const handleBuyNow = () => {
    const unitPrice = gift.promo && gift.promoPrice ? gift.promoPrice : gift.price;
    const total = unitPrice * quantity;
    alert(`🛒 You are about to buy ${quantity} x ${gift.name} = ₦${total.toLocaleString()}`);
  };

  return (
    <div className="gift-card-wrapper">
      <div className="gift-card">
        {(gift.mainImage || gift.images?.[0]) && (
          <img
            src={gift.mainImage || gift.images[0]}
            alt={gift.name}
            className="gift-image"
            onClick={handleImageClick}
          />
        )}

        <h4 className="gift-title">{gift.name}</h4>

        {gift.promo && gift.promoPrice ? (
          <div className="price-row">
            <span className="old-price">₦{gift.price}</span>
            <span className="promo-price">₦{gift.promoPrice}</span>
          </div>
        ) : (
          <p className="promo-price">₦{gift.price}</p>
        )}

        {gift.complimentary && <p className="complimentary">{gift.complimentary}</p>}
        {gift.description && <p className="description">{gift.description}</p>}
        {gift.hasDelivery && <p className="delivery-included">Delivery Included</p>}

        <div className="qty-line" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginTop: '8px' }}>
          <label className="qty-label-inline" style={{ fontWeight: 'bold' }}>Qty:</label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="qty-input-inline"
            style={{ width: '45px', padding: '4px', borderRadius: '4px', border: '1px solid #ccc', textAlign: 'center' }}
          />
        </div>

        <button className="buy-now-btn" onClick={handleBuyNow}>Buy Now</button>
      </div>

      <div className="gift-actions">
        <button className="action-btn navy" onClick={() => onEdit(gift)}>Edit</button>
        <button className="action-btn navy" onClick={() => onUpload(gift)}>Upload</button>
        <button className="action-btn navy" onClick={() => onCalendar(gift)}>Calendar</button>
        <button className="action-btn navy" onClick={() => onFeature(gift)}>Feature</button>
        <button className="action-btn red" onClick={() => onDelete(gift._id)}>Delete</button>
      </div>
    </div>
  );
};

export default GiftCard;
