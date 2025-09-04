import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import BookCruiseModal from '../components/BookCruiseModal';
import CruiseCard from '../components/CruiseCard';
import ReviewSection from '../components/ReviewSection';
import './CityCruise.css';

const CityCruise = () => {
  const [showModal, setShowModal] = useState(false);
  const [selectedCruise, setSelectedCruise] = useState(null);
  const [cruises, setCruises] = useState([]);

  useEffect(() => {
    const fetchCruises = async () => {
      try {
        const res = await axios.get('/api/cruises/public');
        setCruises(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch cruises:', err);
      }
    };
    fetchCruises();
  }, []);

  // Lock background scroll when modal is open
  useEffect(() => {
    if (!showModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev || ''; };
  }, [showModal]);

  const handleBookNow = (cruise) => {
    setSelectedCruise(cruise);
    setShowModal(true);
  };

  return (
    <>
      <Header />
      <div className="city-cruise-container">
        <h2>🚘 Flexible City Cruise Booking</h2>
        <p className="intro-text">
          HotelPennies offers curated city experiences to top destinations within your city. Tell us where to pick you
          up and where you want to go — we’ll respond with a custom quote.
        </p>
        <ul className="cruise-points">
          <li>🚗 Visit landmarks, food joints, nightlife spots, and more</li>
          <li>🕒 Choose your time and duration</li>
          <li>💬 Get personalized pricing before confirming</li>
        </ul>
        <p style={{ marginTop: '1rem' }}>👉 Select your city and book below.</p>

        <div className="cruise-grid">
          {cruises.map((cruise, index) => (
            <CruiseCard
              key={cruise._id || index}
              cruise={cruise}
              onBook={() => handleBookNow(cruise)}
            />
          ))}
        </div>

        {showModal && selectedCruise && (
          <>
            {/* Keep the overlay above the sticky header and offset under it */}
            <style>{`
              :root { --hp-header-h: 64px; } /* adjust if your header height differs */

              .book-cruise-modal-overlay {
                position: fixed !important;
                inset: 0;
                display: flex;
                align-items: flex-start;
                justify-content: center;
                padding-top: calc(var(--hp-header-h) + 12px);
                background: rgba(0,0,0,0.45);
                z-index: 1200 !important; /* higher than header */
              }
              .book-cruise-modal {
                max-height: calc(100vh - (var(--hp-header-h) + 24px));
                overflow: auto;
              }
            `}</style>

            <BookCruiseModal
              cruise={selectedCruise}
              onClose={() => setShowModal(false)}
            />
          </>
        )}

        {/* Reviews (shared/static ID) */}
        <div style={{ marginTop: '4rem' }}>
          <ReviewSection type="citycruise" itemId="6871db4482fc4b1b2019703c" />
        </div>
      </div>
      <MainFooter />
    </>
  );
};

export default CityCruise;
