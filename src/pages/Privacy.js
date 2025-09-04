// ✅ src/pages/Privacy.js
import React from 'react';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import './Privacy.css';

const Privacy = () => {
  return (
    <>
      <Header />
      <div className="static-page-container">
        <h1>Privacy Policy</h1>
        <p><strong>Last Updated: July 2025</strong></p>

        <p>
          At <strong>HotelPennies</strong>, your privacy is important to us. This Privacy Policy explains how we
          collect, use, disclose, and protect your personal information when you use our platform — including
          our website, mobile services, and any other interactions you have with us.
        </p>

        <h2>1. Information We Collect</h2>
        <h3>a. Personal Information</h3>
        <ul>
          <li>Name, email, phone number</li>
          <li>Billing and payment details</li>
          <li>Identity verification (for vendors/partners)</li>
          <li>Booking and reservation history</li>
        </ul>
        <h3>b. Device & Usage Information</h3>
        <ul>
          <li>IP address and browser type</li>
          <li>Device identifiers</li>
          <li>Pages visited, links clicked, time spent</li>
        </ul>
        <h3>c. Location Data</h3>
        <ul>
          <li>Your city or region based on search or browser permissions</li>
          <li>GPS location if granted (for local recommendations)</li>
        </ul>
        <h3>d. User Content</h3>
        <ul>
          <li>Reviews, ratings, comments, and feedback</li>
          <li>Uploaded images for listings or reviews</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>Process and manage bookings, payments, and confirmations</li>
          <li>Recommend listings and experiences based on your preferences</li>
          <li>Improve platform functionality and customer support</li>
          <li>Prevent fraud, unauthorized access, or illegal activity</li>
          <li>Communicate updates, promotions, or service announcements</li>
        </ul>

        <h2>3. How We Share Your Information</h2>
        <p>We may share data with:</p>
        <ul>
          <li><strong>Vendors & Partners</strong> (to process bookings/reservations)</li>
          <li><strong>Payment processors</strong> (e.g., Paystack, Flutterwave) for secure transactions</li>
          <li><strong>Analytics & advertising partners</strong> (to improve our reach and performance)</li>
          <li><strong>Legal authorities</strong> where required by law or to protect our rights</li>
        </ul>
        <p><strong>We do not sell</strong> your personal information to third parties.</p>

        <h2>4. Data Protection & Security</h2>
        <ul>
          <li>SSL encryption and secure data handling practices</li>
          <li>Restricted access to user data for authorized staff only</li>
          <li>Payment information processed via PCI-compliant platforms</li>
        </ul>

        <h2>5. Your Rights & Choices</h2>
        <ul>
          <li>View, edit, or delete your account information</li>
          <li>Opt-out of promotional emails</li>
          <li>Request access to your data</li>
          <li>Request data deletion (where applicable)</li>
        </ul>

        <h2>6. Children’s Privacy</h2>
        <p>
          HotelPennies does not knowingly collect data from children under the age of 13.
          If you believe a child has provided us with personal information, please contact us and we will delete it.
        </p>

        <h2>7. International Users</h2>
        <p>
          If you are accessing HotelPennies from outside Nigeria, note that your information may be
          transferred to and processed in Nigeria and other countries where we operate.
        </p>

        <h2>8. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy or our data practices, please contact:
        </p>
        <ul>
          <li><strong>Email:</strong> support@hotelpennies.com</li>
          <li><strong>Phone:</strong> +234-XXX-XXX-XXXX</li>
          <li><strong>Address:</strong> HotelPennies HQ, Lagos, Nigeria</li>
        </ul>

        <h2>9. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy occasionally. When we do, we’ll notify you via email or by posting a
          notice on our platform. Continued use of HotelPennies constitutes acceptance of any changes.
        </p>
      </div>
      <MainFooter />
    </>
  );
};

export default Privacy;
