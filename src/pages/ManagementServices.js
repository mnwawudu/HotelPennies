
// ✅ src/pages/ManagementServices.js
import React from 'react';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import './ManagementServices.css';



const ManagementServices = () => {
  return (
    <>
      <Header />
      <div className="static-page-container">
        <h1>Property & Hospitality Management</h1>
        <p>
          HotelPennies provides management services for property owners, investors, and state governments
          who want to delegate the day-to-day operations of hotels, shortlets, tourist parks, and other
          hospitality-related assets.
        </p>

        <h2>Our Expertise Covers:</h2>
        <ul>
          <li>Hotel & Shortlet Management</li>
          <li>Tourist Center Operations</li>
          <li>Event Venue Management</li>
          <li>Vendor & Staff Coordination</li>
          <li>Performance Monitoring & Reporting</li>
        </ul>

        <h2>Who Is It For?</h2>
        <ul>
          <li>Private owners seeking passive income</li>
          <li>Corporate or diaspora investors</li>
          <li>Governments needing local operations support</li>
        </ul>

        <h2>Let’s Help You Grow</h2>
        <p>
          Interested in management partnership? Reach us via
          <strong> management@hotelpennies.com</strong> and we’ll walk you through our onboarding and setup process.
        </p>
      </div>
      <MainFooter />
    </>
  );
};

export default ManagementServices;
