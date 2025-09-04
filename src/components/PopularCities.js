// ✅ src/components/PopularCities.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './PopularCities.css';

const cities = [
  { name: 'Lagos', image: '/images/lagos.jpg' },
  { name: 'Abuja', image: '/images/abuja.jpg' },
  { name: 'Port Harcourt', image: '/images/ph.jpg' },
  { name: 'Enugu', image: '/images/enugu.jpg' },
  { name: 'Ibadan', image: '/images/ibadan.jpg' }
];

const PopularCities = () => {
  const navigate = useNavigate();

  return (
    <div className="popular-cities-section">
      <h2>Popular Cities</h2>
      <div className="city-grid">
        {cities.map((city, index) => (
          <div
            key={index}
            className="city-card"
            style={{ backgroundImage: `url(${city.image})` }}
            onClick={() => navigate(`/hotels/city/${city.name.toLowerCase()}`)}
          >
            <div className="city-overlay">
              <h3>{city.name}</h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PopularCities;
