// ✅ src/pages/Contact.js
import React from 'react';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import './Contact.css';

const Contact = () => {
  return (
    <>
      <Header />
      <div className="static-page-container">
        <h1>Contact Customer Service</h1>

        <p>Need help with a booking, service, or partnership? Our support team is here to assist you.</p>

        <h2>Customer Support</h2>
        <ul>
          <li><strong>Email:</strong> <a href="mailto:support@hotelpennies.com">support@hotelpennies.com</a></li>
          <li><strong>Phone:</strong> +234 800 123 4567 (Mon–Fri, 9am–6pm)</li>
          <li><strong>Live Chat:</strong> Available in-app on weekdays</li>
        </ul>

        <h2>Vendor & Partner Support</h2>
        <ul>
          <li><strong>Email:</strong> <a href="mailto:partners@hotelpennies.com">partners@hotelpennies.com</a></li>
          <li><strong>Vendor Portal:</strong> <a href="/auth">Sign in to your dashboard</a> to manage services</li>
        </ul>

        <h2>For Urgent Issues</h2>
        <p>If you’re experiencing a time-sensitive issue with a booking or service, please call or use the live chat option for faster response.</p>

        <h2>Visit Us</h2>
        <p>HotelPennies HQ<br />
        Lagos, Nigeria<br />
        Monday – Friday: 9:00am – 5:00pm</p>

        <h2>Stay Connected</h2>
        <ul>
          <li><a href="https://facebook.com" target="_blank" rel="noreferrer">Facebook</a></li>
          <li><a href="https://instagram.com" target="_blank" rel="noreferrer">Instagram</a></li>
          <li><a href="https://twitter.com" target="_blank" rel="noreferrer">Twitter</a></li>
        </ul>
      </div>
      <MainFooter />
    </>
  );
};

export default Contact;
