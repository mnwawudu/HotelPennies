import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import BusinessSearchBar from '../components/BusinessSearchBar';
import NearbyRestaurants from '../components/NearbyRestaurants';
import RecommendedChops from '../components/RecommendedChops';
import RecommendedGifts from '../components/RecommendedGifts';
import ReviewSection from '../components/ReviewSection';
import BookTourGuideModal from '../components/BookTourGuideModal';
import AdBanner from '../components/AdBanner';
import './TourGuideDetail.css';

const TourGuideDetail = () => {
  const { id } = useParams();
  const [guide, setGuide] = useState(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [selectedGuide, setSelectedGuide] = useState(null);
  const [error, setError] = useState(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const intervalRef = useRef(null);

  useEffect(() => {
    const fetchGuide = async () => {
      try {
        const res = await axios.get(`/api/tour-guides/public/${id}`);
        setGuide(res.data);
      } catch (err) {
        setError('Failed to load tour guide details.');
      }
    };
    fetchGuide();
  }, [id]);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scrollRight = () => {
    if (!guide?.images) return;
    const max = Math.max(guide.images.length - (windowWidth < 768 ? 1 : 4), 0);
    setCarouselIndex(prev => (prev < max ? prev + 1 : 0));
  };

  useEffect(() => {
    intervalRef.current = setInterval(scrollRight, 5000);
    return () => clearInterval(intervalRef.current);
  }, [guide, windowWidth]);

  const scrollLeft = () => {
    setCarouselIndex(prev => Math.max(prev - 1, 0));
  };

  if (error) return <div className="error">{error}</div>;
  if (!guide) return <div>Loading...</div>;

  const {
    name,
    bio,
    hostImage,
    location,
    city = 'Abuja',
    state,
    mainImage,
    images = [],
    language,
    experience,
    price,
    usePromo,
    promoPrice,
    complimentary,
    description,
    termsAndConditions = '',
  } = guide;

  const normalizedCity = city.replace(/ city$/i, '').trim();
  const allImages = [mainImage, ...images.filter(img => img !== mainImage)];
  const visibleCount = windowWidth < 768 ? 1 : 4;
  const offset = carouselIndex * (100 / visibleCount);

  return (
    <>
      <Header />
	   {/* ✅ Breadcrumbs */}
      <div className="breadcrumbs">
        <Link to="/" className="breadcrumb-link">Home</Link> &gt;{' '}
        <Link to="/tour-guides" className="breadcrumb-link">Tour Guides</Link> &gt;{' '}
        <span className="breadcrumb-current">{name}</span>
      </div>
      <BusinessSearchBar businessType="tour-guide" />
      <AdBanner placement="tour-guide" />
	  
      <div className="tourGuide-detail-container">
        <div className="tourGuide-header-text">
          <h2>{name}</h2>
          <p className="tourGuide-full-address">{location}, {city}, {state}</p>
        </div>

        <div className="tourGuide-carousel-wrapper">
          <button className="scroll-btn left" onClick={scrollLeft}>&#10094;</button>
          <div className="tourGuide-carousel" style={{ transform: `translateX(-${offset}%)` }}>
            {allImages.map((img, idx) => (
              <img key={idx} src={img} alt={`guide-${idx}`} />
            ))}
          </div>
          <button className="scroll-btn right" onClick={scrollRight}>&#10095;</button>
        </div>

        <div className="tourGuide-info-summary-box">
          {description && <p><strong>Description:</strong> {description}</p>}
          {experience && <p><strong>Experience:</strong> {experience} years</p>}
          {language && <p><strong>Language:</strong> {language}</p>}

          {price && (
            <p>
              <strong>Price:</strong>{' '}
              {usePromo && promoPrice ? (
                <>
                  <span style={{ textDecoration: 'line-through', color: '#999', marginRight: '10px' }}>
                    ₦{Number(price).toLocaleString()}
                  </span>
                  <span style={{ color: 'green', fontWeight: 'bold' }}>
                    ₦{Number(promoPrice).toLocaleString()}
                  </span>
                </>
              ) : (
                <span style={{ color: 'navy', fontWeight: 'bold' }}>
                  ₦{Number(price).toLocaleString()}
                </span>
              )}
            </p>
          )}

          {complimentary && <p><strong>Complimentary:</strong> {complimentary}</p>}

          <button onClick={() => setSelectedGuide(guide)} className="choose-room-btn" style={{ marginTop: '1rem' }}>
            Book Tour Guide
          </button>
        </div>

        <div className="tourGuide-terms-box">
          <h4 style={{ marginBottom: '10px' }}>Tour Guide Terms & Conditions</h4>
          <ul className="tourGuide-terms-list">
            {(termsAndConditions.trim() ? termsAndConditions.split('\n') : [
              'Availability varies depending on schedule and bookings.',
              'Some tours may require advance notice of at least 24 hours.',
              'Proper identification may be required.',
              'Full payment required to confirm tour appointment.'
            ]).map((line, i) => (
              <li key={i}>{line.trim()}</li>
            ))}
          </ul>
        </div>

        <div className="tourGuide-section">
          <h3>Tour Guide Bio</h3>
          <div className="bio-section-wrapper">
            {hostImage && (
              <img src={hostImage} alt={`${name} Host`} className="bio-host-img" />
            )}
            {bio && <div className="bio-block">{bio}</div>}
          </div>
        </div>

        <div className="tourGuide-section review-section-wrapper">
         <ReviewSection itemId={id} type="tourguide" />




        </div>

        <div className="map-section" style={{ margin: '3rem 0' }}>
          <iframe
            title="Tour Guide Map"
            src={`https://www.google.com/maps?q=${encodeURIComponent(location)}&output=embed`}
            width="100%"
            height="400"
            style={{ border: 0, borderRadius: '12px' }}
            allowFullScreen
            loading="lazy"
          ></iframe>
        </div>

        <NearbyRestaurants city={normalizedCity} />
        <RecommendedChops />
        <RecommendedGifts />
      </div>

      {selectedGuide && (
        <BookTourGuideModal guide={selectedGuide} onClose={() => setSelectedGuide(null)} />
      )}

      <MainFooter />
    </>
  );
};

export default TourGuideDetail;
