// ✅ src/pages/Home.js 
import React, { useEffect, useState } from 'react';
import '../pages/Home.css';
import AdBanner from '../components/AdBanner';
import MainFooter from '../components/MainFooter';
import Header from '../components/Header';
import SearchBar from '../components/SearchBar';
import ExploreCategories from '../components/ExploreCategories';
import BlogSection from '../components/BlogSection';
import axios from '../utils/axiosConfig';
import Slider from 'react-slick';

import ShortletCardFeatured from '../components/ShortletCardFeatured';
import RestaurantCardFeatured from '../components/RestaurantCardFeatured';
import EventCenterCardFeatured from '../components/EventCenterCardFeatured';
import RoomCardPublic from '../components/RoomCardPublic';
import MenuCardPublic from '../components/MenuCardPublic';

const Home = () => {
  const [featured, setFeatured] = useState({
    rooms: [],
    menus: [],
    shortlets: [],
    restaurants: [],
    eventcenters: [],
  });

  // ✅ control slides per viewport without extra React imports
  const [slidesToShow, setSlidesToShow] = useState(4);

  useEffect(() => {
    const computeSlides = () => {
      const w = window.innerWidth || 1200;
      if (w <= 640) setSlidesToShow(1);       // phones
      else if (w <= 1024) setSlidesToShow(2); // tablets
      else setSlidesToShow(4);                 // desktop
    };
    computeSlides();
    window.addEventListener('resize', computeSlides, { passive: true });
    return () => window.removeEventListener('resize', computeSlides);
  }, []);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await axios.get('/api/featurelisting/public');
        setFeatured(res.data);

        // Nudge slick to recalc once DOM/images settle
        setTimeout(() => window.dispatchEvent(new Event('resize')), 150);
      } catch (err) {
        console.error('❌ Failed to fetch featured listings:', err);
      }
    };

    fetchFeatured();
  }, []);

  const sliderBase = {
    dots: false,
    infinite: true,
    speed: 500,
    autoplay: true,
    autoplaySpeed: 3000,
    swipeToSlide: true,
    adaptiveHeight: true,
    arrows: true,
  };

  const renderFeatured = (title, data, CardComponent, propKey) => {
    if (!Array.isArray(data) || data.length === 0) return null;

    const settings = {
      ...sliderBase,
      slidesToShow,
      slidesToScroll: 1,
    };

    return (
      <div className="featured-subsection">
        <h4>{title}</h4>
        <Slider {...settings} className="custom-slider">
          {data.map((item) => (
            <div key={item._id}>
              <CardComponent {...{ [propKey]: item }} />
            </div>
          ))}
        </Slider>
      </div>
    );
  };

  return (
    <div>
      <Header />

      {/* ✅ Hero Section with responsive sources + centered SearchBar (no header changes) */}
      <div className="hero-section" style={{ position: 'relative' }}>
        <picture>
          {/* desktop first */}
          <source
            media="(min-width: 1025px)"
            srcSet="/img/hero-city-desktop.webp"
            type="image/webp"
          />
          <source
            media="(min-width: 641px)"
            srcSet="/img/hero-city-tablet.webp"
            type="image/webp"
          />
          <img
            src="/img/hero-city-mobile.webp"
            alt="A modern Nigerian city skyline with a soft gradient overlay"
            style={{
              width: '100%',
              height: '420px',
              objectFit: 'cover',
              display: 'block'
            }}
          />
        </picture>

        {/* dark overlay for legibility */}
        <div
          className="hero-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingBottom: 40
          }}
        >
          <div className="hero-text" style={{ textAlign: 'center', color: '#fff', maxWidth: 1000, padding: '0 12px' }}>
            <h1>
              Find Hotels, Shortlets, Event Centers,
              Restaurants, and Tour Guides,
              and have the best time in Nigeria.
            </h1>
            <p style={{ color: '#e9eef5' }}>The best deals that you cannot find anywhere else…</p>

            {/* hard-center the SearchBar container */}
            <div className="searchbar-wrapper" style={{ maxWidth: 820, width: '100%', margin: '0 auto' }}>
              <SearchBar />
            </div>
          </div>
        </div>
      </div>

      <AdBanner />
      <ExploreCategories />

      {/* ✅ Featured Listings */}
      <section className="featured-section">
        <h3>Featured Listings</h3>
        {renderFeatured('Rooms', featured.rooms, RoomCardPublic, 'room')}
        {renderFeatured('Shortlets', featured.shortlets, ShortletCardFeatured, 'shortlet')}
        {renderFeatured('Restaurants', featured.restaurants, RestaurantCardFeatured, 'restaurant')}
        {renderFeatured('Popular Dishes', featured.menus, MenuCardPublic, 'menu')}
        {renderFeatured('Event Centers', featured.eventcenters, EventCenterCardFeatured, 'center')}
      </section>

      {/* ✅ Why Choose Section */}
      <section className="why-section">
        <h3>Why Choose HotelPennies?</h3>
        <div className="why-grid">
          {[
            { icon: '🛡️', title: 'Verified & Safe Listings', desc: 'Every listing is reviewed to ensure safety and accuracy.' },
            { icon: '💳', title: 'Secure Payments', desc: 'Pay online with confidence through trusted gateways.' },
            { icon: '📍', title: 'Nationwide Coverage', desc: 'Book hotels, shortlets & venues across all major cities.' },
            { icon: '💰', title: 'Best Deals', desc: 'Access local & international promotions and exclusive rates.' },
            { icon: '🎁', title: '5% Cashback & Commissions', desc: 'Earn instant cashback and referral commissions on every booking.' },
            { icon: '📲', title: 'Everything in One Platform', desc: 'Book hotels, shortlets, event venues, restaurants, tours, and transport—all in one place.' },
          ].map((item, i) => (
            <div className="why-card" key={i}>
              <div className="icon">{item.icon}</div>
              <h4>{item.title}</h4>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <BlogSection />
      <MainFooter />
    </div>
  );
};

export default Home;
