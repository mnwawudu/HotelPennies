import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_BASE = 'http://localhost:10000/api';

const ResendVerification = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedEmail = location.state?.email || localStorage.getItem('pendingEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      localStorage.setItem('pendingEmail', savedEmail);

      const interval = setInterval(() => {
        checkVerification(savedEmail);
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [location.state]);

  const checkVerification = async (emailToCheck) => {
    if (!emailToCheck) return;
    try {
      const res = await axios.get(`${API_BASE}/verify-status?email=${emailToCheck}`);
      if (res.data.verified) {
        toast.success('✅ Email verified! Logging you in...', { autoClose: 2000 });
        localStorage.setItem('token', res.data.token);
        localStorage.removeItem('pendingEmail');
        setTimeout(() => {
          navigate(res.data.role === 'vendor' ? '/dashboard' : '/user-dashboard');
        }, 2000);
      }
    } catch (err) {
      console.error('Verification check failed', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/user/resend-verification`, { email });
      toast.success('Verification email sent!', { autoClose: 3000 });
      localStorage.setItem('pendingEmail', email);
    } catch (err) {
      toast.error('❌ ' + (err.response?.data?.message || 'Failed to resend'), { autoClose: 3000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <ToastContainer />
      <h2>Resend Verification Email</h2>
      <p>If you didn’t get the email, you can request it again.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: '0.5rem', width: '300px', marginBottom: '1rem' }}
        />
        <br />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.5rem 1.5rem',
            backgroundColor: '#001f3f',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Sending...' : 'Resend Email'}
        </button>
      </form>
    </div>
  );
};

export default ResendVerification;
