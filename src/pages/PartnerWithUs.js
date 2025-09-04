// ✅ src/pages/PartnerWithUs.js
import React from 'react';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import './PartnerWithUs.css';



const PartnerWithUs = () => {
  return (
    <>
      <Header />
      <div className="static-page-container">
        <h1>Partner With HotelPennies</h1>
        <p>
          We’re looking to collaborate with passionate service providers, destination managers, event organizers,
          and property owners to bring the best experiences to our users.
        </p>

        <h2>Who Can Partner?</h2>
        <ul>
          <li>Hotel owners or managers</li>
          <li>Shortlet property investors</li>
          <li>Restaurant and Chops vendors</li>
          <li>Tour guides and tourism operators</li>
          <li>Local governments or tourism boards</li>
        </ul>

        <h2>Why Partner With Us?</h2>
        <ul>
          <li>Massive visibility to a large customer base</li>
          <li>Automated booking and reservation system</li>
          <li>Promotion via social media and search</li>
          <li>Access to performance insights and reviews</li>
          <li>Dedicated vendor support</li>
        </ul>

        <h2>Get Started</h2>
        <p>
          To begin your partnership, please email us at <strong>partners@hotelpennies.com</strong> or
          use our vendor onboarding form.
        </p>
      </div>
      <MainFooter />
    </>
  );
};

export default PartnerWithUs;