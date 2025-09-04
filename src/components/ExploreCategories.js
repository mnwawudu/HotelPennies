// ✅ src/components/ExploreCategories.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import './ExploreCategories.css';

const ExploreCategories = () => {
  const navigate = useNavigate();
  const [images, setImages] = useState({});

 useEffect(() => {
  const fetchImages = async () => {
    try {
      const [
        hotelsRes,
        shortletsRes,
        restaurantsRes,
        eventCentersRes,
        guidesRes,
        chopsRes,
        giftsRes,
        cruisesRes
      ] = await Promise.all([
        axios.get('/api/hotels/all-public'),
        axios.get('/api/shortlets/public'),
        axios.get('/api/restaurants'),
        axios.get('/api/eventcenters/all-public'),
        axios.get('/api/tour-guides/all-public'),
        axios.get('/api/chops/public'),
        axios.get('/api/gifts/public'),
        axios.get('/api/cruises/public') // ✅ Add cruise fetch
      ]);

      setImages({
        Hotels: hotelsRes.data[0]?.mainImage || '/images/fallback.jpg',
        Shortlets: shortletsRes.data[0]?.mainImage || '/images/fallback.jpg',
        Restaurants: restaurantsRes.data[0]?.mainImage || '/images/fallback.jpg',
        'Event Centers': eventCentersRes.data[0]?.mainImage || '/images/fallback.jpg',
        'Tour Guides': guidesRes.data[0]?.mainImage || '/images/fallback.jpg',
        Chops: chopsRes.data[0]?.mainImage || '/images/fallback.jpg',
        Gifts: giftsRes.data[0]?.mainImage || '/images/fallback.jpg',
        'City Cruise': cruisesRes.data[0]?.mainImage || '/images/fallback.jpg' // ✅ Dynamic fetch
      });
    } catch (err) {
      console.error('❌ Failed to fetch category images:', err);
    }
  };

  fetchImages();
}, []);


  const categories = [
    { name: 'Hotels', path: '/hotels' },
    { name: 'Shortlets', path: '/shortlets' },
    { name: 'Restaurants', path: '/restaurants' },
    { name: 'Event Centers', path: '/event-centers' },
    { name: 'Tour Guides', path: '/tour-guides' },
    { name: 'City Cruise', path: '/cruise' },
    { name: 'Chops', path: '/chops' },
    { name: 'Gifts', path: '/gifts' }
  ];

  return (
    <div className="explore-section">
      <h2>Explore Categories</h2>
      <div className="category-grid">
        {categories.map((category, index) => (
          <div
            key={index}
            className="category-card"
            style={{
              backgroundImage: `url(${images[category.name] || '/images/fallback.jpg'})`
            }}
            onClick={() => navigate(category.path)}
          >
            <div className="overlay">
              <h3>{category.name}</h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExploreCategories;
