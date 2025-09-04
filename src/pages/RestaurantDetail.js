// ✅ src/pages/RestaurantDetail.js
import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import BusinessSearchBar from '../components/BusinessSearchBar';
import NearbyRestaurants from '../components/NearbyRestaurants';
import NearbyHotels from '../components/NearbyHotels';
import NearbyShortlets from '../components/NearbyShortlets';
import RecommendedChops from '../components/RecommendedChops';
import ReviewSection from '../components/ReviewSection';
import BookRestaurantModal from '../components/BookRestaurantModal';
import MenuCard from '../components/MenuCard';
import OrderDeliveryModal from '../components/OrderDeliveryModal';
import AdBanner from '../components/AdBanner';
import ImageViewerModal from '../components/ImageViewerModal';
import './RestaurantDetail.css';

const RestaurantDetail = () => {
  const { id } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [menus, setMenus] = useState([]);
  const [city, setCity] = useState('');
  const [imageViewer, setImageViewer] = useState({ isOpen: false, index: 0 });
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [showChoice, setShowChoice] = useState(false);
  const [choice, setChoice] = useState(null);
  const [redirectAfterSuccess, setRedirectAfterSuccess] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const carouselRef = useRef(null);

  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        const res = await axios.get(`/api/restaurants/public/${id}`);
        setRestaurant(res.data);
        if (res.data.city) setCity(res.data.city);
      } catch (err) {
        console.error('❌ Failed to fetch restaurant:', err);
      }
    };

    const fetchMenus = async () => {
      try {
        const res = await axios.get(`/api/restaurant-menus/public/${id}/menus`);
        setMenus(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch menus:', err);
      }
    };

    fetchRestaurant();
    fetchMenus();
  }, [id]);

  const handleResizeScroll = () => {
    if (carouselRef.current && restaurant?.images?.length > 4) {
      const imageWidth = carouselRef.current.offsetWidth / (window.innerWidth < 768 ? 1 : 4);
      const nextIndex = (currentSlide + 1) % restaurant.images.length;
      setCurrentSlide(nextIndex);
      const scrollX = imageWidth * nextIndex;
      carouselRef.current.scrollTo({ left: scrollX, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const interval = setInterval(handleResizeScroll, 7000);
    return () => clearInterval(interval);
  }, [currentSlide, restaurant]);

  const scrollLeft = () => {
    if (carouselRef.current) {
      const imageWidth = carouselRef.current.offsetWidth / (window.innerWidth < 768 ? 1 : 4);
      carouselRef.current.scrollBy({ left: -imageWidth, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (carouselRef.current) {
      const imageWidth = carouselRef.current.offsetWidth / (window.innerWidth < 768 ? 1 : 4);
      carouselRef.current.scrollBy({ left: imageWidth, behavior: 'smooth' });
    }
  };

  const handleBookMenu = (menu) => {
    setSelectedMenu(menu);
    setShowChoice(true);
  };

  const handleChoice = (type) => {
    setChoice(type);
    setShowChoice(false);
  };

  const handleCloseModals = () => {
    setSelectedMenu(null);
    setChoice(null);
    setShowChoice(false);
    setRedirectAfterSuccess(false);
  };

  if (!restaurant) return <div>Loading...</div>;

  const formatTimeToAMPM = (timeStr) => {
    if (!timeStr) return '';
    const [hour, minute] = timeStr.split(':');
    const hourNum = parseInt(hour);
    const suffix = hourNum >= 12 ? 'PM' : 'AM';
    const hour12 = hourNum % 12 || 12;
    return `${hour12}:${minute} ${suffix}`;
  };

  const { name, location, state, mainImage, images = [], termsAndConditions = '', openingHours = {} } = restaurant;
  const allImages = [mainImage, ...images.filter(img => img !== mainImage)];

  return (
    <>
      <Header />
	   {/* ✅ Breadcrumb */}
      <div className="breadcrumb-container">
        <Link to="/" className="breadcrumb-link">Home</Link> &gt;{' '}
        <Link to="/restaurants" className="breadcrumb-link">Restaurants</Link> &gt;{' '}
        <span className="breadcrumb-current">{name}</span>
      </div>
      <BusinessSearchBar businessType="restaurant" />
      <AdBanner placement="restaurant" />

    
      <div className="restaurant-detail-container">
        <div className="restaurant-header-text">
          <h2>{name}</h2>
          <p>{location}, {city}, {state}</p>
        </div>

        <div className="restaurant-carousel-wrapper">
          <button className="scroll-btn left" onClick={scrollLeft}>&#10094;</button>
          <div className="restaurant-carousel" ref={carouselRef}>
            {allImages.map((img, idx) => (
              <div className="carousel-image-wrapper" key={idx}>
                <img
                  src={img}
                  alt={`restaurant-${idx}`}
                  onClick={() => setImageViewer({ isOpen: true, index: idx })}
                />
              </div>
            ))}
          </div>
          <button className="scroll-btn right" onClick={scrollRight}>&#10095;</button>
        </div>

        {imageViewer.isOpen && (
          <ImageViewerModal
            images={allImages}
            currentIndex={imageViewer.index}
            onClose={() => setImageViewer({ isOpen: false, index: 0 })}
          />
        )}

        <div className="restaurant-terms-box">
          <h4>Opening Hours</h4>
          <p><strong>Open:</strong> {openingHours.open ? formatTimeToAMPM(openingHours.open) : '08:00 AM'}</p>
          <p><strong>Close:</strong> {openingHours.close ? formatTimeToAMPM(openingHours.close) : '10:00 PM'}</p>
          <h4>Booking Terms & Conditions</h4>
          {termsAndConditions.trim() ? (
            <ul>{termsAndConditions.split('\n').map((line, i) => <li key={i}>{line.trim()}</li>)}</ul>
          ) : (
            <ul>
              <li>No external food allowed.</li>
              <li>Booking must be confirmed via payment.</li>
              <li>Tables will be held for 15 minutes past reservation time.</li>
            </ul>
          )}
        </div>

        {menus.length > 0 && (
          <div className="menu-section">
            <h3>Menu Items</h3>
            <div className="menu-list">
              {menus.map((menu) => (
                <MenuCard key={menu._id || menu.title} menu={menu} onBook={handleBookMenu} />
              ))}
            </div>
          </div>
        )}

        <div className="hotel-section review-section-wrapper">
          <ReviewSection itemId={id} type="restaurants" />

        </div>
      </div>

      <div className="map-section">
        <iframe
          title="Restaurant Map"
          src={`https://www.google.com/maps?q=${encodeURIComponent(location)}&output=embed`}
          width="100%"
          height="400"
          style={{ border: 0, borderRadius: '12px' }}
          allowFullScreen
          loading="lazy"
        ></iframe>
      </div>

      <div className="hotel-section"><NearbyRestaurants city={city} /></div>
      <div className="hotel-section"><NearbyHotels currentCity={city} /></div>
      <div className="hotel-section"><NearbyShortlets currentCity={city} /></div>
      <div className="hotel-section"><RecommendedChops city={city} /></div>

      {showChoice && selectedMenu && (
        <div className="modal-backdrop">
          <div className="modal-container">
            <h3>How would you like to proceed?</h3>
            <p><strong>{selectedMenu.title}</strong> from <strong>{restaurant.name}</strong></p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button onClick={() => handleChoice('reserve')} className="submit-btn">Reserve Table</button>
              <button onClick={() => handleChoice('delivery')} className="submit-btn">Order for Delivery</button>
              <button onClick={handleCloseModals} className="cancel-btn">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {choice === 'reserve' && selectedMenu && !redirectAfterSuccess && (
        <BookRestaurantModal
          menu={selectedMenu}
          restaurant={restaurant}
          onClose={() => {
            setRedirectAfterSuccess(true);
            handleCloseModals();
          }}
        />
      )}

      {choice === 'delivery' && selectedMenu && !redirectAfterSuccess && (
        <OrderDeliveryModal
          menu={selectedMenu}
          restaurant={restaurant}
          onClose={() => {
            setRedirectAfterSuccess(true);
            handleCloseModals();
          }}
        />
      )}

      <MainFooter />
    </>
  );
};

export default RestaurantDetail;
