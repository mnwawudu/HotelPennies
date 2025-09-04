import React, { useEffect, useState, useRef } from 'react';
import axios from '../utils/axiosConfig';
import ShortletCardPublic from './ShortletCardPublic';
import './NearbyShortlets.css';

const NearbyShortlets = ({ currentShortletId, currentCity }) => {
  const [nearby, setNearby] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    const fetchNearby = async () => {
      try {
        if (!currentCity || typeof currentCity !== 'string') return;

        const res = await axios.get(`/api/shortlets/public/city/${encodeURIComponent(currentCity.trim())}`);
        const filtered = res.data.filter((item) => item._id !== currentShortletId);
        setNearby(filtered);
      } catch (err) {
        console.error('❌ Failed to fetch nearby shortlets:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNearby();
  }, [currentShortletId, currentCity]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!scrollRef.current || nearby.length <= 1) return;
      const container = scrollRef.current;
      const scrollAmount = container.offsetWidth;
      const maxScrollLeft = container.scrollWidth - scrollAmount;

      if (container.scrollLeft + scrollAmount >= maxScrollLeft) {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }, 7000); // slide every 7 seconds

    return () => clearInterval(interval);
  }, [nearby]);

  if (loading) {
    return (
      <div className="nearby-shortlets-container">
        <h3 className="nearby-title">Nearby Shortlets</h3>
        <p className="nearby-loading">Loading nearby shortlets...</p>
      </div>
    );
  }

  if (!nearby.length) {
    return (
      <div className="nearby-shortlets-container">
        <h3 className="nearby-title">Nearby Shortlets</h3>
        <p className="nearby-empty">No nearby shortlets found.</p>
      </div>
    );
  }

  return (
    <div className="nearby-shortlets-container">
      <h3 className="nearby-title">Nearby Shortlets</h3>
      <div className="carousel-wrapper">
        <div className="scrollable-container" ref={scrollRef}>
          {nearby.map((shortlet) => (
            <ShortletCardPublic key={shortlet._id} shortlet={shortlet} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default NearbyShortlets;
