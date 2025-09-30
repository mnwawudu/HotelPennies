// src/pages/AffiliatePage.js
import React from 'react';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';

// AffiliatePage.jsx
// Standalone, self-styled affiliate program page for HotelPennies.
// This version uses inline styles (no Tailwind required) so it renders cleanly
// wherever you drop it. Default export a React component.

export default function AffiliatePage() {
  const styles = {
    pageWrap: { display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f5f7fb' },
    headerBar: {
      background: '#ffffff',
      borderBottom: '1px solid #e6e9ef',
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 1px 4px rgba(15,23,42,0.03)',
      position: 'sticky',
      top: 0,
      zIndex: 60,
    },
    logo: { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#0f172a' },
    logoMark: { fontSize: 20 },
    navLinks: { display: 'flex', gap: 12, alignItems: 'center' },
    navLink: { color: '#0f172a', textDecoration: 'none', fontWeight: 600, padding: '6px 10px', borderRadius: 8 },
    container: {
      maxWidth: 1000,
      margin: '24px auto',
      padding: 20,
      fontFamily: "Inter, Roboto, 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial",
      color: '#1f2937',
      flex: '1 0 auto',
    },
    card: {
      background: '#ffffff',
      borderRadius: 12,
      boxShadow: '0 6px 18px rgba(15,23,42,0.08)',
      padding: 26,
      lineHeight: 1.5,
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    title: {
      fontSize: 28,
      fontWeight: 700,
      margin: 0,
    },
    lead: {
      marginTop: 6,
      color: '#374151',
      fontSize: 15,
    },
    section: {
      marginTop: 18,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 600,
      marginBottom: 8,
    },
    inputRow: {
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      marginTop: 8,
    },
    input: {
      flex: 1,
      padding: '10px 12px',
      borderRadius: 8,
      border: '1px solid #e5e7eb',
      fontSize: 14,
      background: '#f8fafc',
      color: '#111827',
    },
    copyBtn: {
      padding: '10px 14px',
      borderRadius: 8,
      background: '#0f172a',
      color: '#fff',
      border: 'none',
      cursor: 'pointer',
      fontWeight: 600,
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 20,
      marginTop: 10,
    },
    note: {
      fontSize: 14,
      color: '#374151',
    },
    list: {
      paddingLeft: 18,
      marginTop: 8,
    },
    badgeGreen: {
      display: 'inline-block',
      marginRight: 8,
      color: '#065f46',
    },
    footer: {
      marginTop: 20,
      fontSize: 14,
      color: '#6b7280',
    },
    footerWrap: { marginTop: 24, flexShrink: 0 },
  };

  return (
    <div style={styles.pageWrap}>
      {/* Shared Header component */}
      <Header />

      {/* Page content (unchanged) */}
      <div style={styles.container}>
        <div style={styles.card}>
          <header style={styles.header}>
            <div style={{ fontSize: 26 }}>🌟</div>
            <div>
              <h1 style={styles.title}>HotelPennies Affiliate & Cashback Program</h1>
              <div style={styles.lead}>
                At HotelPennies, <strong>every registered user is automatically an affiliate</strong>. No sign-up forms or hidden fees — your unique affiliate link is generated when you create an account.
              </div>
            </div>
          </header>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>🔗 Your Affiliate Link</h2>
            <p style={styles.note}>
              After registering, you’ll find your referral link in your dashboard. Share it with friends, family, or on social media. Every time someone signs up and makes a booking through your link, you earn rewards.
            </p>
          </section>

          <div style={{ ...styles.grid, marginTop: 22 }}>
            <div>
              <section>
                <h3 style={styles.sectionTitle}>💰 How You Earn</h3>
                <p style={styles.note}>We keep it simple and transparent:</p>
                <ol style={{ marginTop: 8 }}>
                  <li style={{ marginBottom: 8 }}>
                    <strong>Referral Commission</strong>
                    <div style={{ marginTop: 6, color: '#374151' }}>
                      You earn <strong>2% commission</strong> whenever your referral books a <strong>Hotel, Shortlet, or Event Center</strong> through HotelPennies. Commission is tracked in real-time in your dashboard.
                    </div>
                  </li>
                  <li>
                    <strong>Cashback on Your Own Bookings</strong>
                    <div style={{ marginTop: 6, color: '#374151' }}>
                      You also enjoy <strong>2% cashback</strong> when you personally book Hotels, Shortlets, or Event Centers. Cashback is credited to your HotelPennies wallet after booking completion.
                    </div>
                  </li>
                </ol>
              </section>

              <section style={{ marginTop: 14 }}>
                <h3 style={styles.sectionTitle}>📊 Example Earnings</h3>
                <p style={styles.note}>If your friend books a hotel room worth ₦100,000 through your link → <strong>You earn ₦2,000 commission</strong>. If you book a shortlet for ₦50,000 → <strong>You receive ₦1,000 cashback</strong>.</p>
              </section>
            </div>

            <div>
              <section>
                <h3 style={styles.sectionTitle}>🔎 Where It Applies</h3>
                <ul style={styles.list}>
                  <li><span style={styles.badgeGreen}>✅</span>Hotels</li>
                  <li><span style={styles.badgeGreen}>✅</span>Shortlets</li>
                  <li><span style={styles.badgeGreen}>✅</span>Event Centers</li>
                </ul>

                <p style={{ ...styles.note, marginTop: 12 }}>
                  <strong>Not eligible:</strong> Restaurants, Chops, Tour Guides, City Cruise, Taxis, and Gifts operate on different vendor splits and do not earn affiliate commission or cashback.
                </p>
              </section>

              <section style={{ marginTop: 16 }}>
                <h3 style={styles.sectionTitle}>🏦 Withdrawals</h3>
                <p style={styles.note}>Your earnings accumulate in your <strong>affiliate wallet</strong>. Once you reach the minimum payout threshold, request a withdrawal to your bank account from your dashboard.</p>
              </section>

              <section style={{ marginTop: 16 }}>
                <h3 style={styles.sectionTitle}>🚀 Why Join?</h3>
                <ul style={styles.list}>
                  <li>Automatic enrollment — just sign up.</li>
                  <li>No caps on earnings.</li>
                  <li>Transparent tracking in your dashboard.</li>
                  <li>Turn bookings into passive income.</li>
                </ul>
              </section>
            </div>
          </div>

          <div style={styles.footer}>
            <p>Start sharing your link today — let HotelPennies reward you while you and your network enjoy seamless bookings!</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={styles.footerWrap}>
        <MainFooter />
      </div>
    </div>
  );
}
