import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import ReviewSection from '../components/ReviewSection';
import RecommendedChops from '../components/RecommendedChops';
import RecommendedGifts from '../components/RecommendedGifts';
import BookChopsModal from '../components/BookChopsModal';
import ImageViewerModal from '../components/ImageViewerModal';
import './HotelDetail.css'; // Reused for layout only

const ChopsDetails = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [chop, setChop] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const imageContainerRef = useRef(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const queryParams = new URLSearchParams(location.search);
  const paymentSuccess = queryParams.get('paid');
  const reference = queryParams.get('ref');
  const provider = queryParams.get('provider');

  useEffect(() => {
    const fetchChop = async () => {
      try {
        const res = await axios.get(`/api/chops/public/${id}`);
        setChop(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch chop:', err);
      }
    };
    fetchChop();
  }, [id]);

  useEffect(() => {
    const saveBooking = async () => {
      try {
        const saved = localStorage.getItem('chopsBookingDetails');
        if (!saved) return;

        const parsed = JSON.parse(saved);
        if (!parsed.chopId) return;

        await axios.post('/api/chops/bookings', {
          ...parsed,
          chopId: parsed.chopId,
          paymentReference: reference,
          paymentProvider: provider,
          paymentStatus: paymentSuccess === 'true' ? 'paid' : 'failed',
        });

        localStorage.removeItem('chopsBookingDetails');
      } catch (err) {
        console.error('❌ Booking saving failed:', err);
      }
    };

    if (paymentSuccess && reference && provider) {
      saveBooking();
      setTimeout(() => {
        navigate(location.pathname, { replace: true });
      }, 5000);
    }
  }, [paymentSuccess, reference, provider, location.pathname, navigate]);

  if (!chop) return <div className="p-6">Loading...</div>;

  const {
    name,
    description,
    price,
    promo,
    promoPrice,
    hasDelivery,
    deliveryFee,
    complimentary,
    mainImage,
    images = [],
  } = chop;

  const isPromo = promo === true || promo === 'true';
  const basePrice = isPromo ? Number(promoPrice) : Number(price);
  const allImages = [mainImage, ...images.filter((img) => img !== mainImage)];

  const getDiscount = (qty) => {
    if (qty >= 100) return 5;
    if (qty >= 50) return 4;
    if (qty >= 20) return 3;
    if (qty >= 10) return 2;
    return 0;
  };

  const discount = getDiscount(quantity);
  const subtotal = basePrice * quantity;
  const discountAmount = (subtotal * discount) / 100;

  const deliveryFeeNum = deliveryFee !== undefined && deliveryFee !== null ? Number(deliveryFee) : 0;
  const delivery = hasDelivery === true || hasDelivery === 'true' ? deliveryFeeNum : 0;

  const total = subtotal - discountAmount + delivery;

  const scroll = (direction) => {
    if (imageContainerRef.current) {
      imageContainerRef.current.scrollBy({
        left: direction === 'left' ? -300 : 300,
        behavior: 'smooth',
      });
    }
  };

  const handleImageClick = (index) => {
    setCurrentImageIndex(index);
    setImageModalOpen(true);
  };

  return (
    <>
      <Header />
      <div className="hotel-detail-container">
        {/* ✅ Breadcrumb */}
        <div className="breadcrumb">
          <Link to="/">Home</Link> &gt; <Link to="/chops">Chops</Link> &gt; {name}
        </div>

        <div className="hotel-header-text">
          <h2>{name}</h2>
        </div>

        {paymentSuccess === 'true' && (
          <div className="success-banner">✅ Payment successful. Your booking is confirmed!</div>
        )}
        {paymentSuccess === 'false' && (
          <div className="error-banner">❌ Payment failed. Please try again.</div>
        )}

        <div className="room-section-with-sidebar">
          <div className="room-section-main">
            <div className="room-card-wrapper hoverable" style={{ maxWidth: '850px' }}>
              <div className="room-card-long">
                <div className="room-image-container">
                  <div className="room-carousel-wrapper">
                    <button className="scroll-btn left" onClick={() => scroll('left')}>
                      &#10094;
                    </button>
                    <div className="room-carousel" ref={imageContainerRef}>
                      {allImages.map((img, idx) => (
                        <img
                          key={idx}
                          src={img}
                          alt={`chop-${idx}`}
                          className="room-img-left"
                          onClick={() => handleImageClick(idx)}
                          style={{ cursor: 'pointer' }}
                        />
                      ))}
                    </div>
                    <button className="scroll-btn right" onClick={() => scroll('right')}>
                      &#10095;
                    </button>
                  </div>
                </div>

                <div className="room-info-right">
                  <p className="room-price">
                    <strong>₦{basePrice.toLocaleString()}</strong>
                    {isPromo && (
                      <span className="original-price">₦{Number(price).toLocaleString()}</span>
                    )}
                  </p>

                  {complimentary && <p className="complimentary-text">🎁 {complimentary}</p>}

                  {description && <p className="room-description">{description}</p>}

                  {hasDelivery && deliveryFeeNum === 0 && (
                    <p className="chops-delivery green">🚚 Delivery Included</p>
                  )}
                  {hasDelivery && deliveryFeeNum > 0 && (
                    <p className="chops-delivery gray">
                      🚚 Delivery Fee: ₦{deliveryFeeNum.toLocaleString()}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <label htmlFor="qty" style={{ fontWeight: 500 }}>Qty:</label>
                    <input
                      id="qty"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      style={{
                        width: '70px',
                        padding: '6px 8px',
                        fontSize: '0.9rem',
                        borderRadius: '6px',
                        border: '1px solid #ccc'
                      }}
                    />
                  </div>

                  {discount > 0 && (
                    <p className="bulk-discount">🎉 {discount}% bulk discount applied!</p>
                  )}

                  <p className="room-price">Total: ₦{total.toLocaleString()}</p>

                  <button onClick={() => setShowModal(true)} className="choose-room-btn">
                    Book Now
                  </button>

                  {showModal && (
                    <BookChopsModal
                      chop={chop}
                      quantity={quantity}
                      discount={discount}
                      total={total}
                      onClose={() => setShowModal(false)}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <RecommendedChops excludeId={id} />
        <RecommendedGifts />
        <div className="hotel-section review-section-wrapper" style={{ marginTop: '3rem' }}>
          <ReviewSection itemId={id} type="chop" btnSize="medium" />
        </div>
      </div>
      <MainFooter />

      {imageModalOpen && (
        <ImageViewerModal
          images={allImages}
          currentIndex={currentImageIndex}
          onClose={() => setImageModalOpen(false)}
        />
      )}
    </>
  );
};

export default ChopsDetails;
