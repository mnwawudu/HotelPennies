import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import BusinessSearchBar from '../components/BusinessSearchBar';
import NearbyRestaurants from '../components/NearbyRestaurants';
import NearbyHotels from '../components/NearbyHotels';
import ReviewSection from '../components/ReviewSection';
import BookEventCenterModal from '../components/BookEventCenterModal';
import AdBanner from '../components/AdBanner';
import ImageViewerModal from '../components/ImageViewerModal';
import './EventCenterDetail.css';

const EventCenterDetail = () => {
  const { id } = useParams();
  const [eventCenter, setEventCenter] = useState(null);
  const [city, setCity] = useState('');
  const carouselRef = useRef(null);
  const [showBookModal, setShowBookModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);

  useEffect(() => {
    const fetchEventCenter = async () => {
      try {
        const res = await axios.get(`/api/eventcenters/public/${id}`);
        setEventCenter(res.data);
        if (res.data.city) setCity(res.data.city);
      } catch (err) {
        console.error('❌ Failed to fetch event center:', err);
      }
    };

    fetchEventCenter();
  }, [id]);

  // Auto-slide carousel on mobile every 5s
  useEffect(() => {
    const interval = window.innerWidth < 768 ? setInterval(() => scrollRight(), 5000) : null;
    return () => clearInterval(interval);
  }, []);

  const scrollLeft = () => {
    if (carouselRef.current) {
      const itemWidth = carouselRef.current.firstChild?.offsetWidth || 300;
      carouselRef.current.scrollBy({ left: -itemWidth, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (carouselRef.current) {
      const itemWidth = carouselRef.current.firstChild?.offsetWidth || 300;
      carouselRef.current.scrollBy({ left: itemWidth, behavior: 'smooth' });
    }
  };

  if (!eventCenter) return <div>Loading...</div>;

  const {
    name,
    location,
    state,
    mainImage,
    images = [],
    termsAndConditions = '',
    price,
    capacity,
    description
  } = eventCenter;

  const allImages = [mainImage, ...images.filter(img => img !== mainImage)];

  return (
    <>
      <Header />

      {/* ✅ Breadcrumbs under header */}
      <nav className="breadcrumbs">
        <span><a href="/">Home</a></span>
        <span> / </span>
        <span><a href="/event-centers">Event Centers</a></span>
        <span> / </span>
        <span className="current">{name}</span>
      </nav>

      <BusinessSearchBar businessType="eventcenter" />
      <AdBanner placement="eventcenter" />

      <div className="event-center-detail-container">
        <div className="event-header-text">
          <h2>{name}</h2>
          <p>{location}, {city}, {state}</p>

          <div className="event-header-info">
            {description && <p className="event-description">{description}</p>}
            {capacity && <p><strong>Capacity:</strong> {capacity} guests</p>}
            {price && <p><strong>Price:</strong> ₦{Number(price).toLocaleString()}</p>}
          </div>
        </div>

        <div className="event-carousel-wrapper">
          <button className="scroll-btn left" onClick={scrollLeft}>&#10094;</button>
          <div className="event-carousel" ref={carouselRef}>
            {allImages.map((img, idx) => (
              <img
                key={idx}
                src={img}
                alt={`event-${idx}`}
                onClick={() => {
                  setCurrentImageIndex(idx);
                  setShowImageModal(true);
                }}
              />
            ))}
          </div>
          <button className="scroll-btn right" onClick={scrollRight}>
            &#10095;
          </button>
        </div>

        <div className="book-button-wrapper">
          <button
            className="submit-btn"
            style={{
              backgroundColor: '#0a3d62',
              padding: '12px 24px',
              fontSize: '1rem',
              borderRadius: '8px'
            }}
            onClick={() => setShowBookModal(true)}
          >
            Book Now
          </button>
        </div>

        {/* ✅ Booking Terms under Book Now */}
        <div className="event-terms-box">
          <h4>Booking Terms & Conditions</h4>
          {termsAndConditions.trim() ? (
            <ul>
              {termsAndConditions
                .split('\n')
                .filter(line => line.trim())
                .map((line, i) => <li key={i}>{line.trim()}</li>)}
            </ul>
          ) : (
            <ul>
              <li>Booking must be confirmed with payment.</li>
              <li>External decorators must be approved.</li>
              <li>No refunds for cancellations within 48 hours of event.</li>
            </ul>
          )}
        </div>

        <div className="hotel-section review-section-wrapper">
        <ReviewSection itemId={id} type="eventcenter" />
        </div>

        <div className="map-section" style={{ margin: '3rem 0' }}>
          <iframe
            title="Event Center Map"
            src={`https://www.google.com/maps?q=${encodeURIComponent(location)}&output=embed`}
            width="100%"
            height="400"
            style={{ border: 0, borderRadius: '12px' }}
            allowFullScreen
            loading="lazy"
          ></iframe>
        </div>

        <div className="hotel-section">
          <NearbyHotels currentCity={city} />
        </div>

        <div className="restaurant-section">
          <NearbyRestaurants city={city} />
        </div>
      </div>

      {showBookModal && (
        <BookEventCenterModal
          eventCenter={eventCenter}
          onClose={() => setShowBookModal(false)}
        />
      )}

      {showImageModal && (
        <ImageViewerModal
          images={allImages}
          currentIndex={currentImageIndex}
          onClose={() => setShowImageModal(false)}
          onNavigate={(newIndex) => setCurrentImageIndex(newIndex)}
        />
      )}

      <MainFooter />
    </>
  );
};

export default EventCenterDetail;
