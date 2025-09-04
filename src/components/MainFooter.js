// ✅ src/components/MainFooter.js
import React from 'react';
import { Link } from 'react-router-dom';

const MainFooter = () => {
  return (
    <div style={footerStyle}>
      <div style={column}>
        <h4>Quick Links</h4>
        <Link to="/hotels">Hotels</Link>
        <Link to="/shortlets">Shortlets</Link>
        <Link to="/restaurants">Restaurants</Link>
        <Link to="/chops">Chops</Link>
        <Link to="/gifts">Gifts</Link>
        <Link to="/tour-guides">Tour Guides</Link>
        <Link to="/cruise">City Cruise</Link>
      </div>

      <div style={column}>
        <h4>Support</h4>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms & Conditions</Link>
        <Link to="/faq">FAQs</Link>
        {/* ✅ New: guest cancellation entry point */}
        <Link to="/manage-booking/cancel">Manage Booking (Cancel)</Link>
        <Link to="/contact">Contact Customer Service</Link>
      </div>

      <div style={column}>
        <h4>Discover</h4>
        <Link to="/auth">List Your Property</Link>
        <Link to="/partner-with-us">Partner With Us</Link>
        <Link to="/management-services">Management Services</Link>
        <Link to="/blogs">Travel Blog</Link>
        <Link to="/about">About HotelPennies</Link>
      </div>

      <div style={column}>
        <h4>Social</h4>
        <a href="https://facebook.com/HotelPennies" target="_blank" rel="noopener noreferrer">Facebook</a>
        <a href="https://instagram.com/HotelPennies" target="_blank" rel="noopener noreferrer">Instagram</a>
        <a href="https://x.com/HotelPennies" target="_blank" rel="noopener noreferrer">X (Twitter)</a>
        <a href="https://https://www.linkedin.com/in/hotel-pennies-b14a89382/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
      </div>

      <div style={bottomBar}>
        &copy; {new Date().getFullYear()} HotelPennies is part of Lamingo Tech Limited. All rights reserved.
      </div>
    </div>
  );
};

// ✅ Styles
const footerStyle = {
  backgroundColor: '#ccc',
  color: '#222',
  padding: '2rem',
  display: 'flex',
  justifyContent: 'space-around',
  flexWrap: 'wrap',
  fontFamily: 'Segoe UI, sans-serif'
};

const column = {
  flex: '1 1 200px',
  marginBottom: '1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem'
};

const bottomBar = {
  width: '100%',
  textAlign: 'center',
  fontSize: '0.8rem',
  marginTop: '2rem',
  color: '#333',
};

export default MainFooter;
