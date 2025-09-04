// ✅ src/components/FeatureListing.js
import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import { Link } from 'react-router-dom';
import './FeatureListing.css';

const FeatureListing = () => {
  const [listings, setListings] = useState([]);

  useEffect(() => {
    const fetchFeaturedListings = async () => {
      try {
        const res = await axios.get('/api/featured/listings');
        setListings(res.data);
      } catch (error) {
        console.error('❌ Failed to fetch featured listings', error);
      }
    };

    fetchFeaturedListings();
  }, []);

  if (!listings.length) return null;

  return (
    <section className="featured-listing-section">
      <h2>🔥 Featured Listings</h2>
      <div className="featured-listing-grid">
        {listings.map((item) => (
          <Link
            to={`/${item.type}/details/${item._id}`}
            key={item._id}
            className="featured-card"
          >
            <img
              src={item.image || '/default.jpg'}
              alt={item.name}
              className="featured-image"
            />
            <div className="featured-card-info">
              <h4>{item.name}</h4>
              <p>{item.location}</p>
              <span className={`badge ${item.featureType}`}>
                {item.featureType === 'global' ? '🌍 Global' : '📍 Local'}
              </span>
              <small className="listing-type">Type: {item.type}</small>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default FeatureListing;
