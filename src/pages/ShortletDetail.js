import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import BusinessSearchBar from '../components/BusinessSearchBar';
import ReviewSection from '../components/ReviewSection';
import NearbyShortlets from '../components/NearbyShortlets';
import RecommendedChops from '../components/RecommendedChops';
import NearbyRestaurants from '../components/NearbyRestaurants';
import RecommendedGifts from '../components/RecommendedGifts';
import BookShortletModal from '../components/BookShortletModal';
import ImageViewerModal from '../components/ImageViewerModal';
import './ShortletDetail.css';

const ShortletDetail = () => {
  const { id } = useParams();
  const [shortlet, setShortlet] = useState(null);
  const [error, setError] = useState(null);
  const [showBookModal, setShowBookModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [carouselStartIndex, setCarouselStartIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const fetchShortlet = async () => {
      try {
        const res = await axios.get(`/api/shortlets/public/${id}`);
        setShortlet(res.data);
      } catch (err) {
        setError('❌ Failed to load shortlet details.');
      }
    };
    fetchShortlet();
  }, [id]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isMobile) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
      }, 7000);
      return () => clearInterval(interval);
    }
  }, [isMobile, shortlet]);

  if (error) return <div className="error">{error}</div>;
  if (!shortlet) return <div>Loading...</div>;

  const {
    title,
    mainImage,
    images = [],
    price,
    promoPrice,
    location,
    city,
    state,
    complimentary,
    description,
    termsAndConditions,
  } = shortlet;

  const normalizedCity = city?.replace(/ city$/i, '').trim();
  const allImages = [mainImage, ...images.filter((img) => img !== mainImage)];

  const handleImageClick = (index) => {
    setCurrentImageIndex(index);
    setShowImageModal(true);
  };

  const renderAmenities = () => {
    if (!complimentary) return null;
    const iconMap = {
      wifi: '📶',
      breakfast: '🥐',
      'room service': '🛎️',
      parking: '🅿️',
      pool: '🏊',
      gym: '🏋️',
      spa: '💆',
      tv: '📺',
      kitchen: '🍳',
      airconditioner: '❄️',
      bar: '🍷',
      'car hire': '🚗',
    };
    const amenities = complimentary.split('|').map((item) => item.trim());
    return (
      <div className="amenities-section">
        <h4 className="amenities-title">Amenities</h4>
        <div className="amenities-grid">
          {amenities.map((item, index) => {
            const key = item.toLowerCase();
            const icon = iconMap[key] || '🔹';
            return (
              <div key={index} className="amenity-item">
                <span className="amenity-icon">{icon}</span>
                <span className="amenity-label">{item}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      <Header />
      <nav className="breadcrumb">
        <Link to="/">Home</Link> &gt; <Link to="/shortlets">Shortlets</Link> &gt; <span>{title}</span>
      </nav>
      <BusinessSearchBar businessType="shortlet" />

      <div className="shortlet-detail-container">
        <h2 className="shortlet-title-on-top">{title}</h2>

        <div className="shortlet-carousel-wrapper">
          {isMobile ? (
            allImages.map((img, idx) => (
              <img
                key={idx}
                src={img}
                alt={`shortlet-${idx}`}
                onClick={() => handleImageClick(idx)}
                className="carousel-image clickable-image"
                style={{ display: idx === currentImageIndex ? 'block' : 'none' }}
              />
            ))
          ) : (
            <div className="desktop-carousel-container">
              {carouselStartIndex > 0 && (
                <button
                  className="scroll-btn left"
                  onClick={() => setCarouselStartIndex((prev) => Math.max(prev - 1, 0))}
                >
                  &#8249;
                </button>
              )}

              <div className="carousel-row">
                {allImages.slice(carouselStartIndex, carouselStartIndex + 4).map((img, idx) => (
                  <img
                    key={carouselStartIndex + idx}
                    src={img}
                    alt={`shortlet-${carouselStartIndex + idx}`}
                    onClick={() => handleImageClick(carouselStartIndex + idx)}
                    className="carousel-image clickable-image"
                  />
                ))}
              </div>

              {carouselStartIndex + 4 < allImages.length && (
                <button
                  className="scroll-btn right"
                  onClick={() => setCarouselStartIndex((prev) => prev + 1)}
                >
                  &#8250;
                </button>
              )}
            </div>
          )}
        </div>

        <div className="shortlet-content-row">
          <div className="shortlet-wrapper stretch-height">
            <div className="shortlet-card mobile-responsive-card">
              <div className="shortlet-details">
                <div className="shortlet-price">
                  {promoPrice ? (
                    <>
                      <span className="price-original">₦{Number(price).toLocaleString()}</span>
                      <span className="price-promo">₦{Number(promoPrice).toLocaleString()}</span>
                    </>
                  ) : (
                    <span className="price-promo">₦{Number(price).toLocaleString()}</span>
                  )}
                </div>

                {location && <div className="shortlet-address">{location}</div>}
                <div className="shortlet-city-state">{city}{state && `, ${state} State`}</div>

                {description && <div className="shortlet-description">{description}</div>}

                <button className="navy-button small" onClick={() => setShowBookModal(true)}>
                  Book Now
                </button>
              </div>
            </div>

            {renderAmenities()}
          </div>
        </div>

        {termsAndConditions && (
          <div className="terms-section">
            <h3>Booking Terms and Conditions</h3>
            <ul>
              {termsAndConditions
                .split('\n')
                .filter((line) => line.trim() !== '')
                .map((line, idx) => (
                  <li key={idx}>{line.trim()}</li>
                ))}
            </ul>
          </div>
        )}

        <div className="review-section-wrapper">
          <ReviewSection itemId={id} type="shortlet" />
        </div>
      </div>

      <div className="map-section wide-map">
        <iframe
          title="Map Preview"
          src={`https://www.google.com/maps?q=${encodeURIComponent(location)}&output=embed`}
          width="100%"
          height="400"
          style={{ border: 0, borderRadius: '12px' }}
          allowFullScreen=""
          loading="lazy"
        ></iframe>
      </div>

      <div className="extras-section">
        <NearbyShortlets currentShortletId={id} currentCity={normalizedCity} isCarousel />
        <NearbyRestaurants city={normalizedCity} isCarousel />
        <RecommendedChops isCarousel />
        <RecommendedGifts isCarousel />
      </div>

      {showBookModal && (
        <BookShortletModal shortlet={shortlet} onClose={() => setShowBookModal(false)} />
      )}

      {showImageModal && (
        <ImageViewerModal
          images={allImages}
          currentIndex={currentImageIndex}
          onClose={() => setShowImageModal(false)}
        />
      )}

      <MainFooter />
    </>
  );
};

export default ShortletDetail;
