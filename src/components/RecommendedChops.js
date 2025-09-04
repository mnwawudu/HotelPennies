import React, { useEffect, useState, useRef } from 'react';
import axios from '../utils/axiosConfig';
import ChopsCardPublic from './ChopsCardPublic';
import './RecommendedChops.css';

const RecommendedChops = () => {
  const [chops, setChops] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    const fetchChops = async () => {
      try {
        const res = await axios.get('/api/chops/public');
        setChops(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch recommended chops:', err);
      }
    };

    fetchChops();
  }, []);

  // Auto-slide logic for mobile: slide 1 card per view every 10s
  useEffect(() => {
    const interval = setInterval(() => {
      if (scrollRef.current && window.innerWidth <= 768) {
        const container = scrollRef.current;
        const cardWidth = container.offsetWidth;
        const maxScrollLeft = container.scrollWidth - container.clientWidth;
        const isAtEnd = container.scrollLeft >= maxScrollLeft - 5;

        container.scrollBy({
          left: isAtEnd ? -container.scrollLeft : cardWidth,
          behavior: 'smooth',
        });
      }
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, []);

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -scrollRef.current.offsetWidth, behavior: 'smooth' });
  };

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: scrollRef.current.offsetWidth, behavior: 'smooth' });
  };

  if (!chops.length) return null;

  return (
    <div className="recommended-chops-section">
      <h3 className="section-title">Recommended Chops</h3>

      <div className="carousel-wrapper">
        {chops.length > 4 && (
          <button className="scroll-btn left" onClick={scrollLeft}>
            &#10094;
          </button>
        )}

        <div className="scrollable-container" ref={scrollRef}>
          {chops.map((chop) => (
            <ChopsCardPublic key={chop._id} chop={chop} />
          ))}
        </div>

        {chops.length > 4 && (
          <button className="scroll-btn right" onClick={scrollRight}>
            &#10095;
          </button>
        )}
      </div>
    </div>
  );
};

export default RecommendedChops;
