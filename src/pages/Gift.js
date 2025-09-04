// ✅ src/pages/Gift.js
import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import ReviewSection from '../components/ReviewSection';
import './Gift.css';

const Gift = () => {
  const [gifts, setGifts] = useState([]);
  const [selectedGift, setSelectedGift] = useState(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const fetchGifts = async () => {
      try {
        const res = await axios.get('/api/gifts');
        setGifts(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch gifts:', err);
      }
    };

    fetchGifts();
  }, []);

  const getUnitPrice = (gift) =>
    gift.promo && gift.promoPrice ? Number(gift.promoPrice) : Number(gift.price);

  const getDiscountedPrice = (price, qty) => {
    let discount = 0;
    if (qty >= 100) discount = 5;
    else if (qty >= 50) discount = 4;
    else if (qty >= 20) discount = 3;
    else if (qty >= 10) discount = 2;

    const total = price * qty;
    return total - (total * discount) / 100;
  };

  const getFinalPrice = (gift, qty) => {
    const unit = getUnitPrice(gift);
    const subtotal = getDiscountedPrice(unit, qty);
    const deliveryFee = gift.hasDelivery ? Number(gift.deliveryFee || 0) : 0;
    return subtotal + deliveryFee;
  };

  const handleBuyNow = (gift) => {
    const unit = getUnitPrice(gift);
    const subtotal = getDiscountedPrice(unit, quantity);
    const deliveryFee = gift.hasDelivery ? Number(gift.deliveryFee || 0) : 0;
    const total = subtotal + deliveryFee;

    alert(`🛍️ Order Summary:
- Gift: ${gift.name}
- Quantity: ${quantity}
- Unit Price: ₦${unit}
- Total (After Discount): ₦${subtotal}
- Delivery Fee: ₦${deliveryFee}
- Final Amount: ₦${total}`);
  };

  return (
    <div className="gift-page">
      <h2 className="gift-heading">🎁 Gift Packs</h2>
      <div className="gift-grid">
        {gifts.map((gift) => (
          <div key={gift._id} className="gift-card">
            {(gift.mainImage || gift.images?.[0]) && (
              <img
                src={gift.mainImage || gift.images[0]}
                alt={gift.name}
                className="gift-image"
                onClick={() => window.open(gift.mainImage || gift.images[0], '_blank')}
              />
            )}
            <h4 className="gift-title">{gift.name}</h4>
            {gift.promo && gift.promoPrice ? (
              <p className="price-row">
                <span className="old-price">₦{gift.price}</span>
                <span className="promo-price">₦{gift.promoPrice}</span>
              </p>
            ) : (
              <p className="promo-price">₦{gift.price}</p>
            )}
            {gift.complimentary && <p className="complimentary">{gift.complimentary}</p>}
            {gift.description && <p className="description">{gift.description}</p>}
            {gift.hasDelivery && <p className="delivery-included">Delivery Included</p>}

            <div className="quantity-section">
              <label>Qty:</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              />
            </div>

            <button className="buy-now-btn" onClick={() => handleBuyNow(gift)}>
              Buy Now
            </button>

            <ReviewSection
              reviews={gift.reviews || []}
              resourceId={gift._id}
              resourceType="gift"
              endpointBase="/api/gifts"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Gift;
