import React, { useEffect, useState, useRef } from 'react';
import axios from '../utils/axiosConfig';
import HotelCardPublic from './HotelCardPublic';
import './NearbyHotels.css';

const NearbyHotels = ({ currentHotelId, currentCity }) => {
  const [nearby, setNearby] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchNearby = async () => {
      if (!currentCity || typeof currentCity !== 'string') {
        setNearby([]);
        setLoading(false);
        return;
      }

      try {
        const res = await axios.get(`/api/hotels/public/city/${encodeURIComponent(currentCity.trim())}`);
        const filtered = res.data.filter((hotel) => hotel._id !== currentHotelId);
        setNearby(filtered);
      } catch (error) {
        console.error('❌ Failed to fetch nearby hotels:', error);
        setNearby([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNearby();
  }, [currentHotelId, currentCity]);

  const scrollToIndex = (index) => {
    const container = scrollRef.current;
    if (!container) return;

    const cardWidth = container.firstChild?.offsetWidth || 0;
    container.scrollTo({ left: index * (cardWidth + 16), behavior: 'smooth' }); // 16 = gap between cards
  };

  // 🔁 Auto-scroll one full card at a time, loop back to 0
  useEffect(() => {
    if (nearby.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const newIndex = (prevIndex + 1) % nearby.length;
        scrollToIndex(newIndex);
        return newIndex;
      });
    }, 5000); // 5 seconds per slide

    return () => clearInterval(interval);
  }, [nearby]);

  const scrollLeft = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : nearby.length - 1;
    setCurrentIndex(newIndex);
    scrollToIndex(newIndex);
  };

  const scrollRight = () => {
    const newIndex = (currentIndex + 1) % nearby.length;
    setCurrentIndex(newIndex);
    scrollToIndex(newIndex);
  };

  return (
    <div className="nearby-hotels-container">
      <h3 className="nearby-title">Nearby Hotels</h3>

      {loading ? (
        <p className="nearby-loading">Loading nearby hotels...</p>
      ) : nearby.length === 0 ? (
        <p className="nearby-empty">No nearby hotels found.</p>
      ) : (
        <div className="carousel-wrapper">
          {nearby.length > 1 && (
            <button className="scroll-btn left" onClick={scrollLeft}>&#10094;</button>
          )}

          <div
            className="scrollable-container"
            ref={scrollRef}
            style={{ overflowX: 'hidden' }} // disable manual drag
          >
            {nearby.map((hotel) => (
              <HotelCardPublic key={hotel._id} hotel={hotel} />
            ))}
          </div>

          {nearby.length > 1 && (
            <button className="scroll-btn right" onClick={scrollRight}>&#10095;</button>
          )}
        </div>
      )}
    </div>
  );
};

export default NearbyHotels;
