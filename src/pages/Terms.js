// ✅ src/pages/Terms.js
import React from 'react';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import './Terms.css';

const Terms = () => {
  return (
    <>
      <Header />
      <div className="static-page-container">
        <h1>Terms & Conditions</h1>

        <p>
          Welcome to HotelPennies. By using our platform, you agree to the following terms and
          conditions. Please read them carefully before booking, listing, or interacting with our
          services.
        </p>

        <h2>1. Use of Our Platform</h2>
        <p>
          HotelPennies offers an online marketplace that connects users with hotels, shortlets,
          restaurants, gifts, chops, and tourist services. You must be at least 18 years old to use
          this platform or have permission from a legal guardian.
        </p>

        <h2>2. Booking & Payments</h2>
        <ul>
          <li>All bookings are subject to availability and confirmation by the service provider.</li>
          <li>Full payment or a deposit may be required to confirm a booking.</li>
          <li>
            Payments are processed via secure third-party processors (e.g., Paystack). You authorize
            HotelPennies to debit your selected payment method for amounts due.
          </li>
          <li>
            Pricing, taxes, fees, and any service/handling charges are displayed at checkout or on
            the listing. Currency is typically NGN unless stated otherwise.
          </li>
        </ul>

        <h2>3. Cancellation & Refund Policy</h2>
        <p>
          Policies can vary by listing and vendor. Where a listing does not specify its own policy,
          the default rules below apply. All refunds (full or partial) are returned to the original
          payment method (via Paystack) once approved. Payment processor fees and non-recoverable
          charges may be non-refundable where applicable.
        </p>

        <h3>3.1 Hotels & Shortlets (Default)</h3>
        <ul>
          <li><strong>Free cancellation:</strong> up to <strong>72 hours</strong> before check-in.</li>
          <li>
            <strong>50% refund:</strong> from <strong>72 hours to 24 hours</strong> before check-in.
          </li>
          <li>
            <strong>Non-refundable:</strong> within <strong>24 hours</strong> of check-in and
            <strong> no-shows</strong>.
          </li>
          <li>
            If a vendor’s listing shows stricter or more generous rules, the listing’s rules apply.
          </li>
        </ul>

        <h3>3.2 Restaurants (Table Reservations / Prepaid Menus)</h3>
        <ul>
          <li><strong>Free cancellation:</strong> up to <strong>24 hours</strong> before reservation time.</li>
          <li><strong>Non-refundable:</strong> within <strong>24 hours</strong> and for no-shows.</li>
        </ul>

        <h3>3.3 Event Centers</h3>
        <ul>
          <li><strong>Free cancellation:</strong> up to <strong>7 days</strong> before the event date.</li>
          <li><strong>50% refund:</strong> from <strong>7 days to 48 hours</strong> before the event date.</li>
          <li><strong>Non-refundable:</strong> within <strong>48 hours</strong> of the event date and for no-shows.</li>
          <li>Security deposits (if any) follow the venue’s stated terms and may be excluded.</li>
        </ul>

        <h3>3.4 Tour Guides</h3>
        <ul>
          <li><strong>Free cancellation:</strong> more than <strong>48 hours</strong> before tour start.</li>
          <li><strong>50% refund:</strong> from <strong>48 hours to 24 hours</strong> before tour start.</li>
          <li><strong>Non-refundable:</strong> within <strong>24 hours</strong> and for no-shows.</li>
        </ul>

        <h3>3.5 Gifts & Chops (Delivery-Only)</h3>
        <ul>
          <li>
            <strong>Before dispatch / preparation:</strong> refundable (up to 100%) minus any
            non-recoverable processor or handling fees.
          </li>
          <li>
            <strong>After dispatch / out for delivery:</strong> <strong>non-refundable</strong>.
          </li>
          <li>
            Items that arrive <strong>damaged, incorrect, or undelivered</strong> are eligible for
            replacement or refund per vendor inspection; report within <strong>24 hours</strong> of
            delivery attempt with photos/evidence.
          </li>
        </ul>

        <h3>3.6 How to Cancel</h3>
        <ul>
          <li>
            Logged-in users can cancel from their dashboard (subject to the timelines above). Guests
            can cancel using their <strong>payment reference</strong> and booking email.
          </li>
          <li>
            Where refunds apply, we submit them to Paystack promptly. Banks/payment networks may take
            <strong> 5–10 business days</strong> to reflect funds.
          </li>
        </ul>

        <h2>4. Vendor Responsibility</h2>
        <p>
          Vendors are solely responsible for the accuracy of their listings, the quality of service
          provided, and fulfilling all booked services. HotelPennies does not guarantee the
          performance or reliability of third-party vendors.
        </p>

        <h2>5. User Conduct</h2>
        <ul>
          <li>Users agree not to misuse the platform or its services.</li>
          <li>Harassment, fraud, or any illegal activity will result in account suspension.</li>
          <li>Reviews must be truthful, respectful, and based on actual experience.</li>
        </ul>

        <h2>6. Intellectual Property</h2>
        <p>
          All content on HotelPennies, including logos, designs, and text, is protected by
          intellectual property laws. You may not use our content without written permission.
        </p>

        <h2>7. Limitation of Liability</h2>
        <p>
          HotelPennies is not liable for damages or losses arising from your use of our platform or
          services booked through it. Our role is to facilitate connections between users and service
          providers.
        </p>

        <h2>8. Changes to These Terms</h2>
        <p>
          We may update these terms from time to time. Continued use of the platform after changes
          are posted constitutes your acceptance of the new terms.
        </p>

        <h2>9. Contact Us</h2>
        <p>
          If you have any questions or concerns, contact us at{' '}
          <strong>support@hotelpennies.com</strong>.
        </p>
      </div>
      <MainFooter />
    </>
  );
};

export default Terms;
