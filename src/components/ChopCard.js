// ✅ ChopCard.js
import React, { useState } from 'react';
import './ChopCard.css';
import AdminCalendarModal from './AdminCalendarModal';
import FeatureChopModal from './FeatureChopModal';
import DeleteChopModal from './DeleteChopModal';

const ChopCard = ({ chop, onEdit, onDelete, onUpload, onCalendar }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const handleImageClick = () => {
    const image = chop.mainImage || (chop.images?.length ? chop.images[0] : null);
    if (image) window.open(image, '_blank');
  };

  const getUnitPrice = () => (chop.promo && chop.promoPrice ? Number(chop.promoPrice) : Number(chop.price));

  const getDiscountedPrice = (price, qty) => {
    let discount = 0;
    if (qty >= 100) discount = 5;
    else if (qty >= 50) discount = 4;
    else if (qty >= 20) discount = 3;
    else if (qty >= 10) discount = 2;

    const total = price * qty;
    return total - (total * discount) / 100;
  };

  const getTotalPrice = () => {
    const unit = getUnitPrice();
    const discounted = getDiscountedPrice(unit, quantity);
    const deliveryFee = chop.hasDelivery ? Number(chop.deliveryFee || 0) : 0;
    return discounted + deliveryFee;
  };

  const renderPrice = () => {
    const normal = Number(chop.price) + (chop.hasDelivery ? Number(chop.deliveryFee || 0) : 0);
    const promo = Number(chop.promoPrice) + (chop.hasDelivery ? Number(chop.deliveryFee || 0) : 0);

    if (chop.promo && chop.promoPrice) {
      return (
        <p className="price-row">
          <span className="old-price">₦{normal}</span>
          <span className="promo-price">₦{promo}</span>
        </p>
      );
    } else {
      return <p className="promo-price">₦{normal}</p>;
    }
  };

  const handleBuyNow = () => {
    const summary = {
      chopName: chop.name,
      quantity,
      unitPrice: getUnitPrice(),
      totalPrice: getDiscountedPrice(getUnitPrice(), quantity),
      deliveryFee: chop.hasDelivery ? Number(chop.deliveryFee || 0) : 0,
      finalPrice: getTotalPrice(),
    };

    alert(`Order Summary:
- Item: ${summary.chopName}
- Quantity: ${summary.quantity}
- Unit Price: ₦${summary.unitPrice}
- Total (After Discount): ₦${summary.totalPrice}
- Delivery Fee: ₦${summary.deliveryFee}
- Final Amount: ₦${summary.finalPrice}`);
  };

  return (
    <div className="chop-card-wrapper">
      <div className="chop-card">
        {(chop.mainImage || chop.images?.[0]) && (
          <img
            src={chop.mainImage || chop.images[0]}
            alt="Chop"
            className="chop-image"
            onClick={handleImageClick}
          />
        )}

        <h4 className="chop-title">{chop.name}</h4>

        {renderPrice()}

        {chop.complimentary && <p className="complimentary">{chop.complimentary}</p>}
        {chop.description && <p className="description">{chop.description}</p>}
        {chop.hasDelivery && <p className="delivery-included">Delivery Included</p>}

       <div className="quantity-section">
  <label>Qty:</label>
  <input
    type="number"
    min={1}
    value={quantity}
    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
  />
</div>


        <button className="buy-now-btn" onClick={handleBuyNow}>Buy Now</button>
      </div>

      <div className="chop-actions">
        <button onClick={() => onEdit(chop)} className="action-btn navy">Edit</button>
        <button onClick={() => onUpload(chop)} className="action-btn navy">Upload</button>
        <button onClick={() => setShowCalendar(true)} className="action-btn navy">Calendar</button>
        <button onClick={() => setShowFeatureModal(true)} className="action-btn navy">Feature</button>
        <button onClick={() => setShowDeleteModal(true)} className="action-btn red">Delete</button>
      </div>

      {showCalendar && (
        <AdminCalendarModal
          item={chop}
          onClose={() => setShowCalendar(false)}
          itemType="chop"
        />
      )}

      {showFeatureModal && (
        <FeatureChopModal
          chop={chop}
          onClose={() => setShowFeatureModal(false)}
        />
      )}

      {showDeleteModal && (
        <DeleteChopModal
          chop={chop}
          onDeleted={(id) => {
            onDelete(id);
            setShowDeleteModal(false);
          }}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
};

export default ChopCard;
