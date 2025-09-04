// ✅ src/pages/ManageBookingCancel.js
import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';

const box = {
  maxWidth: '640px',
  margin: '0 auto',
  background: '#fff',
  borderRadius: '12px',
  boxShadow: '0 6px 20px rgba(0,0,0,.08)',
  padding: '1.25rem',
};

const row = { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' };
const label = { fontWeight: 600, fontSize: '.95rem' };
const input = { padding: '.65rem .75rem', border: '1px solid #d6d6d6', borderRadius: '8px', fontSize: '1rem' };
const btn = {
  padding: '.8rem 1rem',
  border: 0,
  borderRadius: '10px',
  background: '#0a3d62',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};
const muted = { color: '#666', fontSize: '.92rem' };
const badge = (ok) => ({
  padding: '.5rem .75rem',
  borderRadius: '8px',
  background: ok ? '#e7f8ee' : '#ffecec',
  color: ok ? '#096a2e' : '#a30000',
  border: `1px solid ${ok ? '#a7e2c1' : '#ffb4b4'}`,
  marginTop: '.75rem',
  wordBreak: 'break-word',
});

export default function ManageBookingCancel() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t');

  // consume-token states
  const [loading, setLoading] = useState(!!token);
  const [done, setDone] = useState(null); // 'success' | 'error' | null
  const [message, setMessage] = useState('');

  // request-link states
  const [email, setEmail] = useState('');
  const [reference, setReference] = useState('');
  const [sending, setSending] = useState(false);
  const [debugLink, setDebugLink] = useState(null); // backend returns link (handy in dev)

  // If token present, immediately cancel
  useEffect(() => {
    let isMounted = true;
    async function consume() {
      try {
        const { data } = await axios.post('/api/bookings/guest/cancel', { token });
        if (!isMounted) return;
        setDone('success');
        setMessage(data?.message || 'Booking cancelled successfully.');
      } catch (err) {
        if (!isMounted) return;
        setDone('error');
        setMessage(err?.response?.data?.message || 'Failed to cancel booking.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    if (token) consume();
    return () => { isMounted = false; };
  }, [token]);

  const requestLink = async (e) => {
    e.preventDefault();
    setDone(null);
    setMessage('');
    setDebugLink(null);

    if (!email || !reference) {
      setDone('error');
      setMessage('Please provide your email and payment reference.');
      return;
    }
    setSending(true);
    try {
      const { data } = await axios.post('/api/bookings/guest/cancel-token', {
        email,
        paymentReference: reference,
      });
      setDone('success');
      setMessage(data?.message || 'Magic link sent. Please check your email.');
      // Only expose debug link during development
      if (process.env.NODE_ENV !== 'production' && data?.link) setDebugLink(data.link);
    } catch (err) {
      setDone('error');
      setMessage(err?.response?.data?.message || 'Unable to generate magic link.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Header />
      <div className="static-page-container">
        <h1>Manage Booking</h1>

        {/* If token in URL: consume/cancel view */}
        {token ? (
          <div style={box}>
            <h3 style={{ marginTop: 0 }}>Cancel your booking</h3>
            {loading && <p>Processing your cancellation…</p>}
            {!loading && done && (
              <div style={badge(done === 'success')}>
                {message}
              </div>
            )}
            {!loading && (
              <div style={{ marginTop: '1rem', display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                <Link to="/" style={{ ...btn, background: '#003366' }}>Go to Home</Link>
                <Link to="/my-bookings" style={{ ...btn, background: '#0a3d62' }}>My Bookings</Link>
              </div>
            )}
          </div>
        ) : (
          // Otherwise: request magic link form
          <div style={box}>
            <h3 style={{ marginTop: 0 }}>Find my booking (Guest)</h3>
            <p style={muted}>
              Enter the <strong>email</strong> you used at checkout and your <strong>payment reference</strong>. We’ll email
              you a secure link to cancel the booking.
            </p>

            <form onSubmit={requestLink}>
              <div style={row}>
                <label style={label} htmlFor="guest-email">Email</label>
                <input
                  id="guest-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={input}
                  required
                />
              </div>

              <div style={row}>
                <label style={label} htmlFor="guest-ref">Payment Reference</label>
                <input
                  id="guest-ref"
                  type="text"
                  placeholder="e.g. PSK_xxx or HP-RES-123..."
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  style={input}
                  required
                />
              </div>

              <div style={{ marginTop: '1rem' }}>
                <button type="submit" disabled={sending} style={btn}>
                  {sending ? 'Sending link…' : 'Email me a cancel link'}
                </button>
              </div>
            </form>

            {done && message && <div style={badge(done === 'success')}>{message}</div>}

            {debugLink && (
              <div style={{ marginTop: '.75rem' }}>
                <a href={debugLink} style={{ textDecoration: 'underline', color: '#0a3d62' }}>
                  Open cancel link now
                </a>
              </div>
            )}

            <hr style={{ margin: '1.5rem 0', border: 0, borderTop: '1px solid #eee' }} />

            <p style={muted}>
              Already logged in? You can also cancel from <Link to="/my-bookings">My Bookings</Link>.
            </p>
          </div>
        )}
      </div>
      <MainFooter />
    </>
  );
}
