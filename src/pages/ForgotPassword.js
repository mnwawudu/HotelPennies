import React, { useState } from 'react';
import axios from '../utils/axiosConfig';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      await axios.post('/api/auth/forgot-password', { email });
      setSent(true);
      setMsg('If the email exists, you will get instructions.');
    } catch (err) {
      // Backend intentionally returns generic message
      setSent(true);
      setMsg('If the email exists, you will get instructions.');
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }}>
      <h2>Forgot Password</h2>
      <p style={{ color: '#555' }}>
        Enter your account email and we’ll send a reset link.
      </p>
      <form onSubmit={submit}>
        <label>Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        {msg && (
          <p style={{ marginTop: 8, color: sent ? 'green' : '#b00' }}>{msg}</p>
        )}
        <button type="submit" style={{ marginTop: 12 }}>
          Send reset link
        </button>
      </form>
    </div>
  );
};

export default ForgotPassword;
