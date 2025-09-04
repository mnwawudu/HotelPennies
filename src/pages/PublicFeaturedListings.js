import React, { useEffect, useState, useRef } from 'react';
import axios from '../utils/axiosConfig';

import HotelCardPublic from '../components/HotelCardPublic';
import ShortletCardFeatured from '../components/ShortletCardFeatured';
import RestaurantCardFeatured from '../components/RestaurantCardFeatured';
import EventCenterCardFeatured from '../components/EventCenterCardFeatured';
import TourGuideCardPublic from '../components/TourGuideCardPublic';
import ChopsCardPublic from '../components/ChopsCardPublic';
import GiftCardPublic from '../components/GiftCardPublic';
import MenuCardPublic from '../components/MenuCardPublic';
import RoomCardPublic from '../components/RoomCardPublic';

import './PublicFeaturedListings.css';

const PublicFeaturedListings = () => {
  const [listings, setListings] = useState({
    hotels: [],
    shortlets: [],
    restaurants: [],
    eventcenters: [],
    tourguides: [],
    chops: [],
    gifts: [],
    menus: [],
    rooms: [],
  });

  const scrollRefs = useRef({});

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await axios.get('/api/featurelisting/public');
        setListings({
          hotels: res.data.hotels || [],
          shortlets: res.data.shortlets || [],
          restaurants: res.data.restaurants || [],
          eventcenters: res.data.eventcenters || [],
          tourguides: res.data.tourguides || [],
          chops: res.data.chops || [],
          gifts: res.data.gifts || [],
          menus: res.data.menus || [],
          rooms: res.data.rooms || [],
        });
      } catch (err) {
        console.error('❌ Failed to fetch featured listings:', err);
      }
    };

    fetchFeatured();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      Object.values(scrollRefs.current).forEach((ref) => {
        if (ref?.scrollBy) {
          ref.scrollBy({ left: 300, behavior: 'smooth' });
        }
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const scroll = (key, dir) => {
    const ref = scrollRefs.current[key];
    if (ref) ref.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  const renderSlider = (title, data, Card, propKey) => {
    if (!data?.length) return null;
    const key = title.toLowerCase().replace(/\s+/g, '');
    return (
      <div className="slider-section">
        <h3>{title}</h3>
        <div className="slider-controls">
          <button onClick={() => scroll(key, 'left')} className="arrow-btn">&larr;</button>
          <button onClick={() => scroll(key, 'right')} className="arrow-btn">&rarr;</button>
        </div>
        <div className="slider-container" ref={el => (scrollRefs.current[key] = el)}>
          {data.map(item => (
            <div className="slider-item" key={item._id}>
              <Card {...{ [propKey]: item }} />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="public-featured-page">
      <h2>Top Featured Listings</h2>
      {renderSlider('Rooms', listings.rooms, RoomCardPublic, 'room')}
      {renderSlider('Hotels', listings.hotels, HotelCardPublic, 'hotel')}
      {renderSlider('Shortlets', listings.shortlets, ShortletCardFeatured, 'shortlet')}
      {renderSlider('Restaurants', listings.restaurants, RestaurantCardFeatured, 'restaurant')}
      {renderSlider('Popular Dishes', listings.menus, MenuCardPublic, 'menu')}
      {renderSlider('Event Centers', listings.eventcenters, EventCenterCardFeatured, 'center')}
      {renderSlider('Tour Guides', listings.tourguides, TourGuideCardPublic, 'tourguides')}
      {renderSlider('Chops', listings.chops, ChopsCardPublic, 'chop')}
      {renderSlider('Gifts', listings.gifts, GiftCardPublic, 'gift')}
    </div>
  );
};

export default PublicFeaturedListings;
