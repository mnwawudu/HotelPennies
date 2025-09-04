import React, { useEffect, useState, useRef } from 'react';
import axios from '../utils/axiosConfig';
import RestaurantCardPublic from './RestaurantCardPublic';
import './NearbyRestaurants.css';

const NearbyRestaurants = ({ city }) => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!city) return;

    const fetchRestaurants = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`/api/restaurants/public/city/${encodeURIComponent(city.trim())}`);
        setRestaurants(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch nearby restaurants:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, [city]);

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' });
  };

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' });
  };

  // ✅ Auto-scroll every 4s on mobile ONLY if more than 1
  useEffect(() => {
    if (restaurants.length <= 1 || window.innerWidth >= 768) return;

    const container = scrollRef.current;
    const interval = setInterval(() => {
      if (container) {
        container.scrollBy({ left: container.offsetWidth, behavior: 'smooth' });
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [restaurants]);

  return (
    <div className="nearby-restaurants-wrapper">
      <h3 className="nearby-title">Nearby Restaurants</h3>

      {loading ? (
        <p className="loading-text">Loading nearby restaurants...</p>
      ) : restaurants.length === 0 ? (
        <p className="no-results-text">No nearby restaurants found.</p>
      ) : (
        <div className="carousel-wrapper">
          {restaurants.length > 4 && (
            <button className="scroll-btn left" onClick={scrollLeft}>
              &#10094;
            </button>
          )}

          <div
            className="scrollable-container"
            ref={scrollRef}
            style={{ overflowX: restaurants.length > 1 ? 'auto' : 'unset' }} // ✅ changed from >4 to >1
          >
            {restaurants.map((restaurant) => (
              <RestaurantCardPublic key={restaurant._id} restaurant={restaurant} />
            ))}
          </div>

          {restaurants.length > 4 && (
            <button className="scroll-btn right" onClick={scrollRight}>
              &#10095;
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default NearbyRestaurants;
