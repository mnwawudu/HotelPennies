// 📄 src/pages/GiftsDetail.js
import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import ReviewSection from '../components/ReviewSection';
import RecommendedGifts from '../components/RecommendedGifts';
import RecommendedChops from '../components/RecommendedChops';
import BookGiftModal from '../components/BookGiftModal';
import ImageViewerModal from '../components/ImageViewerModal';
import './HotelDetail.css';

const GiftsDetail = () => {
  const { id } = useParams();
  const [gift, setGift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [qty, setQty] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const imageContainerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const fetchGift = async () => {
      setLoading(true);
      setFetchError('');
      setGift(null);

      // Try common endpoints in order
      const endpoints = [
        `/api/gifts/public/${id}`,     // most likely for public detail pages
        `/api/gifts/${id}`,            // fallback if your server exposes direct id route
        `/api/gifts/slug/${encodeURIComponent(id)}`, // slug fallback if you route by slug
      ];

      for (const url of endpoints) {
        try {
          const res = await axios.get(url);
          if (!cancelled && res?.data) {
            setGift(res.data);
            setLoading(false);
            return;
          }
        } catch (err) {
          // keep trying next endpoint
        }
      }

      if (!cancelled) {
        setFetchError('Gift not found or has been removed.');
        setLoading(false);
      }
    };

    fetchGift();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <div className="p-6">Loading gift details...</div>;
  if (!gift) return <div className="p-6">{fetchError || 'Gift not found.'}</div>;

  const {
    name,
    description,
    price,
    promo,
    promoPrice,
    mainImage,
    images = [],
    complimentary,
    hasDelivery,
  } = gift;

  const isPromo = promo === true || promo === 'true';
  const displayPrice = Number(isPromo ? promoPrice : price || 0);

  const allImages = [mainImage, ...(Array.isArray(images) ? images : [])]
    .filter(Boolean)
    .filter((img, i, arr) => arr.indexOf(img) === i);

  const scroll = (direction) => {
    if (!imageContainerRef.current) return;
    imageContainerRef.current.scrollBy({
      left: direction === 'left' ? -300 : 300,
      behavior: 'smooth',
    });
  };

  const handleImageClick = (index) => {
    setCurrentImageIndex(index);
    setImageModalOpen(true);
  };

  const handleBookNow = () => setShowModal(true);

  return (
    <>
      <Header />
     <div className="hotel-detail-container gift-detail">
        {/* ✅ Breadcrumb */}
        <div className="breadcrumb">
          <Link to="/">Home</Link> &gt; <Link to="/gifts">Gifts</Link> &gt; {name}
        </div>

        <div className="hotel-header-text">
          <h2>{name}</h2>
        </div>

        <div className="room-section-with-sidebar">
          <div className="room-section-main">
            <div className="room-card-wrapper hoverable">
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
                          alt={`gift-${idx}`}
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
                    <strong>₦{displayPrice.toLocaleString()}</strong>
                    {isPromo && (
                      <span className="original-price">
                        ₦{Number(price || 0).toLocaleString()}
                      </span>
                    )}
                  </p>

                  {complimentary && <p className="complimentary-text">🎁 {complimentary}</p>}
                  {hasDelivery && <p className="chops-delivery green">🚚 Delivery Included</p>}
                  {description && <p className="room-description">{description}</p>}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '1rem',
                    }}
                  >
                    <label htmlFor="qty" style={{ fontWeight: 500 }}>
                      Qty:
                    </label>
                    <input
                      id="qty"
                      type="number"
                      min="1"
                      value={qty}
                      onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                      style={{
                        width: '70px',
                        padding: '6px 8px',
                        fontSize: '0.9rem',
                        borderRadius: '6px',
                        border: '1px solid #ccc',
                      }}
                    />
                  </div>

                  <button onClick={handleBookNow} className="choose-room-btn">
                    Book Now
                  </button>

                  {showModal && (
                    <BookGiftModal
                      gift={gift}
                      qty={qty}
                      onClose={() => setShowModal(false)}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <RecommendedGifts currentGiftId={id} />
        <RecommendedChops />

        <div
          className="hotel-section review-section-wrapper"
          style={{ marginTop: '3rem' }}
        >
          <ReviewSection itemId={id} type="gift" />
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

export default GiftsDetail;
