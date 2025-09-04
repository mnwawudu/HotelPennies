import React, { useEffect, useState, useRef } from 'react';
import axios from '../utils/axiosConfig';
import GiftCardPublic from './GiftCardPublic';
import './RecommendedGifts.css';

const RecommendedGifts = () => {
  const [gifts, setGifts] = useState([]);
  const scrollRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchGifts = async () => {
      try {
        const res = await axios.get('/api/gifts/public');
        setGifts(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch gifts.');
      }
    };
    fetchGifts();
  }, []);

  useEffect(() => {
    if (gifts.length <= 1) return;

    const interval = setInterval(() => {
      const container = scrollRef.current;
      if (!container || !container.firstChild) return;

      const cardWidth = container.firstChild.offsetWidth + 16; // includes margin
      const newIndex = (currentIndex + 1) % gifts.length;
      container.scrollTo({ left: newIndex * cardWidth, behavior: 'smooth' });
      setCurrentIndex(newIndex);
    }, 7000); // every 7 seconds

    return () => clearInterval(interval);
  }, [gifts, currentIndex]);

  if (!gifts.length) {
    return (
      <div className="recommended-gifts-container">
        <h3 className="section-title">Recommended Gifts</h3>
        <p className="nearby-empty">No gifts available.</p>
      </div>
    );
  }

  return (
    <div className="recommended-gifts-container">
      <h3 className="section-title">Recommended Gifts</h3>
      <div className="carousel-wrapper">
        <div className="scrollable-container" ref={scrollRef}>
          {gifts.map((gift) => (
            <GiftCardPublic key={gift._id} gift={gift} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default RecommendedGifts;
