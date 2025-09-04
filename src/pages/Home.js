// ✅ src/pages/Home.js
import React, { useEffect, useState } from 'react';
import '../pages/Home.css';
import AdBanner from '../components/AdBanner';
import MainFooter from '../components/MainFooter';
import Header from '../components/Header';
import SearchBar from '../components/SearchBar';
import ExploreCategories from '../components/ExploreCategories';
import BlogSection from '../components/BlogSection';
import heroImage from '../images/banner.png';
import axios from '../utils/axiosConfig';
import Slider from 'react-slick';

import HotelCardPublic from '../components/HotelCardPublic';
import ShortletCardFeatured from '../components/ShortletCardFeatured';
import RestaurantCardFeatured from '../components/RestaurantCardFeatured';
import EventCenterCardFeatured from '../components/EventCenterCardFeatured';
import RoomCardPublic from '../components/RoomCardPublic';
import MenuCardPublic from '../components/MenuCardPublic';

// 👉 New: trending/top block component
import HotelsInNigeria from '../components/HotelsInNigeria';

const Home = () => {
  const [featured, setFeatured] = useState({
    rooms: [],
    menus: [],
    shortlets: [],
    restaurants: [],
    eventcenters: [],
  });

  const [popularCities, setPopularCities] = useState([]);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await axios.get('/api/featurelisting/public');
        setFeatured(res.data);

        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
        }, 300);
      } catch (err) {
        console.error('❌ Failed to fetch featured listings:', err);
      }
    };

    const fetchPopularCities = async () => {
      try {
        const res = await axios.get('/api/hotels/public/popular-cities');
        setPopularCities(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch popular cities:', err);
      }
    };

    fetchFeatured();
    fetchPopularCities();
  }, []);

  const renderFeatured = (title, data, CardComponent, propKey) => {
    if (!Array.isArray(data) || data.length === 0) return null;

    const settings = {
      dots: false,
      infinite: true,
      speed: 500,
      autoplay: true,
      autoplaySpeed: 3000,
      slidesToShow: 4,
      slidesToScroll: 1,
      arrows: true,
      responsive: [
        { breakpoint: 1024, settings: { slidesToShow: 3 } },
        { breakpoint: 768, settings: { slidesToShow: 2 } },
        { breakpoint: 480, settings: { slidesToShow: 1 } },
      ],
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

      {/* ✅ Hero Section with SearchBar (added bottom padding to lift the bar off the edge) */}
      <div className="hero-section" style={{ backgroundImage: `url(${heroImage})` }}>
        <div className="hero-overlay" style={{ paddingBottom: 40 }}>
          <div className="hero-text">
            <h1>
              Find Hotels, Shortlets, Event Centers,
              Restaurants, and Tour Guides,
              and have the best time in Nigeria.
            </h1>
            <p>The best deals that you cannot find anywhere else…</p>
          </div>

          <div className="searchbar-wrapper">
            <SearchBar />
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
