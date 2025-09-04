// ✅ src/pages/About.js
import React from 'react';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import { Link } from 'react-router-dom';
import './About.css';


const About = () => {
  return (
    <>
      <Header />
      <div className="static-page-container">
        <h1>About HotelPennies</h1>

        <p>
          Welcome to <strong>HotelPennies</strong>, your one-stop <em>travel booking platform</em> designed to simplify how you
          <strong> book hotels, shortlets, event venues, tour guides</strong>, and even <strong>chops and gifts</strong> across Nigeria.
        </p>

        <p>
          We believe in more than just reservations — <strong>we connect travelers, families, and business professionals</strong> to the best
          <em> accommodation, hospitality, and curated experiences</em> tailored to their location and preferences.
        </p>

        <p>
          Whether you're looking for an <em>affordable boutique hotel in Lagos</em>, a cozy <strong>shortlet in Abuja</strong>, or a scenic
          <strong> tour guide in Calabar</strong>, HotelPennies helps you <strong>book with confidence and ease</strong>.
        </p>

        <h2>What We Offer</h2>
        <ul>
          <li><strong>Hotel Booking:</strong> Browse and book from a wide selection of hotels in major cities like Lagos, Abuja, Port Harcourt, and more.</li>
          <li><strong>Shortlet Rentals:</strong> Comfort and flexibility for solo travelers, families, and professionals.</li>
          <li><strong>Event Centers:</strong> Reserve venues for weddings, parties, and corporate events near you.</li>
          <li><strong>Tour Guides:</strong> Discover local gems through trusted tour operators across Nigeria.</li>
          <li><strong>Chops & Gifts:</strong> Food platters, surprises, and deliveries made easy for any occasion.</li>
        </ul>

        <h2>Why Choose HotelPennies?</h2>
        <ul>
          <li><strong>All-in-One Booking App</strong> – Hotels, events, food, and experiences in one place.</li>
          <li><strong>Verified Listings</strong> – Quality assurance from vetted providers.</li>
          <li><strong>Nationwide Reach</strong> – From “shortlet near me” to remote tourism spots.</li>
          <li><strong>Transparent Pricing</strong> – Real-time rates, discounts, and promos.</li>
          <li><strong>Customer Support</strong> – Responsive help from our dedicated team.</li>
        </ul>

        <h2>Built for Nigeria. Made for You.</h2>
        <p>
          HotelPennies is proudly built in Nigeria to serve locals and travelers alike — making
          <em> travel, booking, and hospitality seamless, reliable, and delightful</em>.
        </p>

        <p>
          Whether you’re a <strong>corporate guest</strong>, a <strong>family planner</strong>, or a visitor searching for
          <em>event centers in Lagos</em> or <em>restaurants in Enugu</em>, HotelPennies gives you the power to plan, book, and enjoy.
        </p>

        <h2>Partner With Us</h2>
        <p>
          Are you a <strong>hotel owner</strong>, <strong>shortlet manager</strong>, <strong>tour operator</strong>, or <strong>chops vendor</strong>? 
          <Link to="/partner-with-us">Partner with HotelPennies</Link> today to grow your visibility and reach a wider audience.
        </p>
      </div>
      <MainFooter />
    </>
  );
};

export default About;
