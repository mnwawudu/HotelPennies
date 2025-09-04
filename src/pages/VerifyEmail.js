import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import { jwtDecode } from 'jwt-decode';

const VerifyEmail = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('Verifying your email...');
  const [success, setSuccess] = useState(null); // null = in progress
  const ran = useRef(false); // prevent Strict Mode double-run

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const verify = async () => {
      try {
        const res = await axios.get(`/api/user/verify-email/${token}`);
        const returnedToken = res.data?.token;
        if (!returnedToken) throw new Error('No token returned');

        // Decode role for storage + redirect
        let role = 'user';
        try {
          const decoded = jwtDecode(returnedToken);
          if (decoded?.role) role = String(decoded.role).toLowerCase();
          console.log('🔐 [VerifyEmail] Decoded token role:', role);
        } catch (e) {
          console.warn('⚠️ [VerifyEmail] Could not decode role from token.', e);
        }

        // Clear any prior tokens first (avoid conflicts)
        try {
          localStorage.removeItem('userToken');
          localStorage.removeItem('vendorToken');
        } catch {}

        // Put token in THIS tab (so if user stays here, they’re already signed in)
        if (role === 'vendor') localStorage.setItem('vendorToken', returnedToken);
        else localStorage.setItem('userToken', returnedToken);

        // 🔊 Broadcast to other tabs (waiting AuthPage) — 4 ways for maximum reliability
        const payload = JSON.stringify({ role, token: returnedToken, ts: Date.now() });

        // 1) Primary: storage payload (other tabs get 'storage' event)
        try {
          localStorage.setItem('hpVerified', payload);
          // nudge listener loops (some browsers throttle storage events in bg tabs)
          localStorage.setItem('hpVerified_ping', String(Date.now()));
          setTimeout(() => localStorage.removeItem('hpVerified_ping'), 0);
          console.log('📦 [VerifyEmail] Wrote hpVerified payload.');
        } catch (e) {
          console.warn('⚠️ [VerifyEmail] Failed writing hpVerified.', e);
        }

        // 2) BroadcastChannel
        try {
          const bc = new BroadcastChannel('hp-auth');
          bc.postMessage({ type: 'verified', role, token: returnedToken, ts: Date.now() });
          bc.close();
          console.log('📡 [VerifyEmail] Sent BroadcastChannel message.');
        } catch (e) {
          console.warn('⚠️ [VerifyEmail] BroadcastChannel failed.', e);
        }

        // 3) If this tab was opened by another HP tab (rare), notify opener
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type: 'hp-verified', role, token: returnedToken }, window.location.origin);
            console.log('🔁 [VerifyEmail] Posted message to opener.');
          }
        } catch (e) {
          console.warn('⚠️ [VerifyEmail] postMessage to opener failed.', e);
        }

        setSuccess(true);
        setMessage('✅ Email verified successfully! Redirecting…');

        // 4) Give the signals a moment to propagate before we route away
        setTimeout(() => {
          if (role === 'vendor') navigate('/dashboard', { replace: true });
          else navigate('/user-dashboard', { replace: true });
        }, 900);
      } catch (err) {
        console.error('🛑 [VerifyEmail] Verification failed:', err?.response?.data || err?.message || err);
        setSuccess(false);
        setMessage('❌ Verification failed. Token may be invalid or expired.');
      }
    };

    verify();
  }, [token, navigate]);

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>
        {success === null
          ? '🔄 Verifying...'
          : success
          ? '✅ Verification Successful'
          : '❌ Verification Failed'}
      </h2>
      <p>{message}</p>
    </div>
  );
};

export default VerifyEmail;
