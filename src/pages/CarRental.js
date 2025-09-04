import React from 'react';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import './CarRental.css';

const CarRental = () => {
  return (
    <>
      <Header />
      <div className="car-rental-container">
        <h2>Car Rental Services</h2>
        <p>
          Whether you're traveling for business, planning a family getaway, or simply need a temporary ride,
          HotelPennies offers reliable car rental options to get you where you need to go—comfortably and affordably.
        </p>

        <h3>Why Choose HotelPennies Car Rentals?</h3>
        <ul>
          <li>🚗 Wide selection of vehicles — from sedans to SUVs and executive cars</li>
          <li>📍 Pickup and drop-off available across major Nigerian cities</li>
          <li>⏱ Hourly, daily, and long-term rental options</li>
          <li>💼 Professional, vetted drivers available on request</li>
          <li>📱 Easy booking through our platform</li>
        </ul>

        <h3>Available Services</h3>
        <ol>
          <li>Airport pickups and drop-offs</li>
          <li>Inter-city travel</li>
          <li>Event and wedding transportation</li>
          <li>Corporate and business transport solutions</li>
          <li>Chauffeur services</li>
        </ol>

        <h3>How It Works</h3>
        <p>
          Simply select your city, preferred vehicle type, rental duration, and optional driver preference.
          Our partners will confirm availability and pricing, after which you can pay and get your ride details instantly.
        </p>

        <h3>Need Help?</h3>
        <p>
          Our customer service is available 24/7 to guide you through your rental or respond to any questions.
          Contact us anytime via live chat, email, or phone.
        </p>
      </div>
      <MainFooter />
    </>
  );
};

export default CarRental;
