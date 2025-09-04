import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import './AdBanner.css';

const AdBanner = ({ location = 'home' }) => {
  const [ads, setAds] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchAds = async () => {
      try {
        const res = await axios.get('/api/adverts/public/featured');
        const validAds = res.data.filter(
          (ad) =>
            ad?.placement?.includes(location) &&
            typeof ad.imageUrl === 'string' &&
            ad.imageUrl.trim() !== '' &&
            ad.title?.trim() &&
            ad.description?.trim()
        );
        setAds(validAds);
        setCurrentIndex(0); // reset index on new data
      } catch (err) {
        console.error('❌ Failed to fetch ads:', err);
      }
    };

    fetchAds();
  }, [location]);

  useEffect(() => {
    if (ads.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ads.length);
    }, 10000);

    return () => clearInterval(interval);
  }, [ads]);

  // Guard against stale index if ads shrink
  useEffect(() => {
    if (currentIndex > 0 && currentIndex >= ads.length) {
      setCurrentIndex(0);
    }
  }, [ads.length, currentIndex]);

  if (ads.length === 0) return null;

  return (
    <div className="ad-carousel-wrapper">
      <div
        className="ad-carousel-track"
        style={{
          // translate by one slide fraction (fixes blank slide on mobile)
          transform: `translateX(-${(currentIndex * 100) / ads.length}%)`,
          width: `${ads.length * 100}%`,
        }}
      >
        {ads.map((ad) => (
          <div
            className="ad-slide"
            key={ad._id}
            // each slide takes an equal fraction of the track (no overshoot)
            style={{ width: `${100 / ads.length}%`, flex: '0 0 auto' }}
          >
            <a
              href={ad.link || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="ad-content"
            >
              <img src={ad.imageUrl} alt={ad.title} />
              <div className="ad-info-overlay">
                <h4 className="ad-title">{ad.title}</h4>
                <p className="ad-description">{ad.description}</p>
              </div>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdBanner;
