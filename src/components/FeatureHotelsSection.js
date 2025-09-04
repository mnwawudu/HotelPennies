// ✅ src/components/FeaturedHotelsSection.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './FeaturedHotelsSection.css';

const FeaturedHotelsSection = () => {
  const [hotels, setHotels] = useState([]);

  useEffect(() => {
    const fetchFeaturedHotels = async () => {
      try {
        const res = await axios.get('http://localhost:10000/api/hotels/featured');
        setHotels(res.data);
      } catch (error) {
        console.error('Failed to fetch featured hotels');
      }
    };

    fetchFeaturedHotels();
  }, []);

  if (!hotels.length) return null;

  return (
    <section className="featured-hotels">
      <h2>🌟 Featured Hotels</h2>
      <div className="featured-grid">
        {hotels.map((hotel) => (
          <div className="hotel-card" key={hotel._id}>
            <img
              src={hotel.images?.[0] || '/default-hotel.jpg'}
              alt={hotel.name}
              className="hotel-image"
            />
            <h3>{hotel.name}</h3>
            <p>{hotel.location}</p>
            <span className={`badge ${hotel.featureType}`}>
              {hotel.featureType === 'global' ? 'Global Feature' : 'Local Feature'}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default FeaturedHotelsSection;
