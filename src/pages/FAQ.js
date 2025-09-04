// ✅ src/pages/FAQ.js
import React from 'react';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import './FAQ.css';

const FAQ = () => {
  return (
    <>
      <Header />
      <div className="static-page-container">
        <h1>Frequently Asked Questions (FAQ)</h1>

        <h2>For Guests</h2>
        <ul>
          <li><strong>How do I book a hotel, shortlet, or tour?</strong><br />Use the search bar to select your city, dates, and preferences. Click “Book Now” and complete your payment to confirm.</li>

          <li><strong>Do I pay immediately or on arrival?</strong><br />Payment is required online to confirm your booking.</li>

          <li><strong>Can I cancel or change my booking?</strong><br />Yes, cancellation policies vary by vendor. Check the listing page for details.</li>

          <li><strong>Is it safe to book through HotelPennies?</strong><br />Yes, we use secure payment gateways and verify all vendors.</li>

          <li><strong>Are there discounts for group bookings?</strong><br />Some vendors offer bulk discounts. Look out for promotions or contact support.</li>
        </ul>

        <h2>For Vendors</h2>
        <ul>
          <li><strong>How do I list my hotel or shortlet?</strong><br />Register as a vendor, verify your account, then list directly from your dashboard.</li>

          <li><strong>What services can I list?</strong><br />Hotels, shortlets, restaurants, chops, tour guides, gift packages, and more.</li>

          <li><strong>How do I get paid?</strong><br />Vendor wallets are credited after successful bookings. You can withdraw anytime.</li>

          <li><strong>Can I manage my availability?</strong><br />Yes, each listing includes a calendar for setting availability and pricing.</li>

          <li><strong>Do I pay to list?</strong><br />No. Listing is free; only a small commission is charged per booking.</li>
        </ul>

        <h2>General</h2>
        <ul>
          <li><strong>What is HotelPennies?</strong><br />A travel and hospitality platform for hotels, shortlets, food, tours, and experiences across Nigeria.</li>

          <li><strong>I didn’t receive a confirmation email. What do I do?</strong><br />Check your spam. Still missing? Email us at support@hotelpennies.com.</li>

          <li><strong>How do I contact support?</strong><br />Use the Help Center or email support@hotelpennies.com.</li>

          <li><strong>How do I report a problem?</strong><br />Use the “Report an Issue” option in your dashboard.</li>

          <li><strong>Is HotelPennies available outside Nigeria?</strong><br />We currently serve Nigeria, with plans to expand.</li>
        </ul>
      </div>
      <MainFooter />
    </>
  );
};

export default FAQ;
