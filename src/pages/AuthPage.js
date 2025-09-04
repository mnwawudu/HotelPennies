// ✅ src/pages/AuthPage.js
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import axios from '../utils/axiosConfig';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import './AuthPage.css';

const Logo = ({ onClick }) => (
  <div
    onClick={onClick}
    role="link"
    tabIndex={0}
    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick?.()}
    style={{
      display: 'inline-block',
      background: '#0a641a',
      color: '#fff',
      padding: '10px 16px',
      borderRadius: 6,
      fontWeight: 700,
      cursor: 'pointer',
      margin: '0 auto 10px',
    }}
    aria-label="Go to homepage"
  >
    HotelPennies
  </div>
);

function PasswordField({ value, onChange, placeholder = 'Password', autoComplete }) {
  const [show, setShow] = useState(false);

  const wrapStyle = useMemo(() => ({ position: 'relative', width: '100%' }), []);
  const inputStyle = useMemo(
    () => ({ width: '100%', boxSizing: 'border-box', padding: '10px 46px 10px 12px' }),
    []
  );
  const btnStyle = useMemo(
    () => ({
      position: 'absolute',
      top: '50%',
      right: 10,
      transform: 'translateY(-50%)',
      width: 32,
      height: 32,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      color: '#111',
      background: 'transparent',
      border: 'none',
      padding: 0,
      margin: 0,
      lineHeight: 1,
      borderRadius: 4,
    }),
    []
  );
  const iconStyle = { width: 20, height: 20, display: 'block' };

  return (
    <div style={wrapStyle}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="auth-input"
        style={inputStyle}
        required
      />
      <button
        type="button"
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        title={show ? 'Hide' : 'Show'}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setShow((s) => !s)}
        style={btnStyle}
      >
        {show ? (
          <svg viewBox="0 0 24 24" fill="currentColor" style={iconStyle} aria-hidden="true">
            <path d="M3.3 2.3 2 3.6l3.6 3.6C3.5 9.5 2.2 11.2 1.1 12.1a1.5 1.5 0 0 0 0 1.8C2.3 15.8 6 20 12 20c2.1 0 4-.5 5.7-.1l3.3 3.3 1.3-1.3L3.3 2.3ZM12 18c-3.3 0-6-2.7-6-6 0-1 .2-1.9.7-2.8l2.1 2.1a3 3 0 0 0 3.9 3.9l2 2c-.9 .5-1.8 .8-2.7 .8Zm9.8-4c.3-.5.3-1.3 0-1.8C20.6 9.3 16.9 6 12 6h-.3l2.5 2.5c1.1 .6 1.8 1.8 1.8 3.1 0 .5-.1 1-.3 1.4l2.5 2.5c1.2-.7 2.2-1.6 3.1-2.5Z"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" style={iconStyle} aria-hidden="true">
            <path d="M12 5C6 5 2.3 9.2 1.1 11.1a1.5 1.5 0 0 0 0 1.8C2.3 14.8 6 19 12 19s9.7-4.2 10.9-6.1c.3-.5.3-1.3 0-1.8C21.7 9.2 18 5 12 5Zm0 11a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/>
          </svg>
        )}
      </button>
    </div>
  );
}

const AuthPage = () => {
  // 🔄 Handshake support: if we ever land here with #token=…&role=… (belt & suspenders)
  const initialHash = typeof window !== 'undefined' ? window.location.hash : '';
  const initialParams = initialHash.startsWith('#') ? new URLSearchParams(initialHash.slice(1)) : null;
  const initialToken = initialParams?.get('token') || null;
  const initialRole  = initialParams?.get('role') || null;
  const [handshaking, setHandshaking] = useState(Boolean(initialToken));

  const [isLogin, setIsLogin] = useState(true);
  const [userType, setUserType] = useState('user'); // 'user' | 'vendor'
  const [businessTypes, setBusinessTypes] = useState([]);
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', phone: '', address: '', state: '', city: '',
  });
  const [loading, setLoading] = useState(false);
  const [waitingVerify, setWaitingVerify] = useState(false);
  const [resending, setResending] = useState(false);

  const navigate = useNavigate();
  const waitingRef = useRef(false);

  const toggleType = (type) =>
    setBusinessTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const clearAllTokens = () => {
    try {
      localStorage.removeItem('userToken');
      localStorage.removeItem('vendorToken');
      localStorage.removeItem('adminToken');
      sessionStorage.removeItem('userToken');
      sessionStorage.removeItem('vendorToken');
      sessionStorage.removeItem('adminToken');
    } catch {}
  };

  const hydrateFromHpVerified = () => {
    try {
      const raw = localStorage.getItem('hpVerified');
      if (!raw) return { hydrated: false };
      const data = JSON.parse(raw);
      const role = String(data?.role || '').toLowerCase();
      const token = data?.token;
      if (!token) return { hydrated: false };

      if (role === 'vendor') localStorage.setItem('vendorToken', token);
      else localStorage.setItem('userToken', token);

      console.log('✅ [AuthPage] Hydrated token from hpVerified.');
      return { hydrated: true, role };
    } catch (e) {
      console.warn('⚠️ [AuthPage] Failed parsing hpVerified payload.', e);
      return { hydrated: false };
    }
  };

  // Only navigate when a token exists in THIS tab
  const finalizeIfTokenPresent = (roleHint) => {
    const hasVendor = !!localStorage.getItem('vendorToken');
    const hasUser = !!localStorage.getItem('userToken');
    if (!hasVendor && !hasUser) {
      console.log('⏳ [AuthPage] No token in this tab yet — still waiting.');
      return false;
    }
    const role = (roleHint || (hasVendor ? 'vendor' : 'user')).toLowerCase();
    waitingRef.current = false;
    setWaitingVerify(false);
    console.log('👉 [AuthPage] Token present. Redirecting:', role);
    navigate(role === 'vendor' ? '/dashboard' : '/user-dashboard', { replace: true });
    return true;
  };

  // 🔁 Listen while waiting for verification
  useEffect(() => {
    if (!waitingVerify) return;
    waitingRef.current = true;
    console.log('🔔 [AuthPage] Waiting for verification signal…');

    const onSignal = (roleFromSignal) => {
      if (!waitingRef.current) return;

      // 1) If token already present, finish
      if (finalizeIfTokenPresent(roleFromSignal)) return;

      // 2) Try to hydrate from hpVerified payload
      const { hydrated, role } = hydrateFromHpVerified();
      if (hydrated && finalizeIfTokenPresent(role)) return;

      // 3) Fallback: poll server for verified flag (don’t navigate without a token)
      const email = sessionStorage.getItem('hpRegEmail') || '';
      if (!email) return;
      axios
        .get('/api/verification-status', { params: { email } })
        .then((r) => {
          if (r?.data?.verified) {
            console.log('ℹ️ [AuthPage] Verified on server — waiting for token signal…');
          }
        })
        .catch(() => {});
    };

    const storageListener = (e) => {
      if (e.key === 'hpVerified' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          onSignal((data?.role || '').toLowerCase());
        } catch {}
      }
      if (e.key === 'hpVerified_ping' && e.newValue) {
        onSignal();
      }
    };
    window.addEventListener('storage', storageListener);

    let bc;
    try {
      bc = new BroadcastChannel('hp-auth');
      bc.onmessage = (ev) => {
        if (ev?.data?.type === 'verified') onSignal((ev.data.role || '').toLowerCase());
      };
    } catch {}

    const interval = setInterval(() => onSignal(), 1200);
    const vis = () => { if (!document.hidden) onSignal(); };
    window.addEventListener('focus', vis);
    document.addEventListener('visibilitychange', vis);

    // Run once immediately (handles case where verify tab already wrote)
    setTimeout(() => onSignal(), 0);

    return () => {
      waitingRef.current = false;
      window.removeEventListener('storage', storageListener);
      window.removeEventListener('focus', vis);
      document.removeEventListener('visibilitychange', vis);
      clearInterval(interval);
      try { bc && bc.close(); } catch {}
    };
  }, [waitingVerify, navigate]);

  // 🔁 Hash handshake (if verify flow ever routes back to /auth#token=…)
  useEffect(() => {
    if (!handshaking || !initialToken) return;

    const token = initialToken;
    const roleFromHash = (initialRole || '').toLowerCase();
    console.log('🤝 [AuthPage] Handshake token found in URL hash.');

    const placeTokenRouteAndSignal = () => {
      try {
        localStorage.removeItem('userToken');
        localStorage.removeItem('vendorToken');
      } catch {}

      let finalRole = (roleFromHash || 'user').toLowerCase();
      try {
        const decoded = jwtDecode(token);
        finalRole = (roleFromHash || decoded.role || 'user').toLowerCase();
      } catch {}

      if (finalRole === 'vendor') localStorage.setItem('vendorToken', token);
      else localStorage.setItem('userToken', token);

      // Signal other tabs with the token
      const payload = JSON.stringify({ role: finalRole, token, ts: Date.now() });
      try {
        localStorage.setItem('hpVerified', payload);
        localStorage.setItem('hpVerified_ping', String(Date.now()));
        setTimeout(() => localStorage.removeItem('hpVerified_ping'), 0);
      } catch {}
      try {
        const bc = new BroadcastChannel('hp-auth');
        bc.postMessage({ type: 'verified', role: finalRole, token, ts: Date.now() });
        bc.close();
      } catch {}

      // Clean hash & go
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      navigate(finalRole === 'vendor' ? '/dashboard' : '/user-dashboard', { replace: true });

      setHandshaking(false);
    };

    placeTokenRouteAndSignal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handshaking]);

  const toggleForm = () => {
    setIsLogin(!isLogin);
    setFormData({ email: '', password: '', name: '', phone: '', address: '', state: '', city: '' });
    setBusinessTypes([]);
    setUserType('user');
    setWaitingVerify(false);
    waitingRef.current = false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const url = isLogin ? '/api/login' : '/api/register';

    try {
      const payload = isLogin
        ? { email: formData.email, password: formData.password }
        : {
            name: formData.name,
            email: formData.email,
            password: formData.password,
            phone: formData.phone,
            address: formData.address,
            state: formData.state,
            city: formData.city,
            userType,
            businessTypes,
          };

      // Optional phone check (server still validates)
      if (!isLogin && formData.phone) {
        try {
          const { data } = await axios.get('/api/phone-available', { params: { phone: formData.phone } });
          if (!data?.available) {
            toast.error('Phone number is already in use.');
            setLoading(false);
            return;
          }
        } catch {}
      }

      const res = await axios.post(url, payload);
      const token = res.data?.token;

      if (!isLogin) {
        // Park THIS tab and wait
        sessionStorage.setItem('hpRegEmail', formData.email || '');
        setWaitingVerify(true);
        waitingRef.current = true;
        toast.success(res.data?.message || 'Verification email sent — check your inbox.');
        setLoading(false);
        return;
      }

      // Sign in
      setWaitingVerify(false);
      waitingRef.current = false;
      if (token) {
        clearAllTokens();
        const decoded = jwtDecode(token);
        const r = (decoded.role || 'user').toLowerCase();
        if (r === 'vendor') {
          localStorage.setItem('vendorToken', token);
          navigate('/dashboard');
        } else {
          localStorage.setItem('userToken', token);
          navigate('/user-dashboard');
        }
      } else {
        toast.info(res.data?.message || 'Unable to sign in.');
      }
    } catch (err) {
      console.error('🛑 [AuthPage] Auth failed:', err?.response?.data || err?.message || err);
      toast.error(
        err?.response?.data?.message || (isLogin ? 'Authentication failed.' : 'Registration failed.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLoginSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      toast.error('Google login failed: no credential received');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/google', { token: credentialResponse.credential });
      const token = res.data?.token;
      clearAllTokens();
      const decoded = jwtDecode(token);
      const r = (decoded.role || 'user').toLowerCase();
      if (r === 'vendor') {
        localStorage.setItem('vendorToken', token);
        navigate('/dashboard');
      } else {
        localStorage.setItem('userToken', token);
        navigate('/user-dashboard');
      }
    } catch (err) {
      console.error('🛑 [AuthPage] Google login failed:', err?.response?.data || err?.message || err);
      toast.error('Google login failed.');
    } finally {
      setLoading(false);
    }
  };

  // ⏳ Waiting screen
  if (waitingVerify) {
    const email = sessionStorage.getItem('hpRegEmail') || '';
    const resend = async () => {
      if (!email) return;
      try {
        setResending(true);
        const r = await axios.post('/api/resend-verification', { email });
        toast.success(r.data?.message || 'Verification email resent.');
        if (r.data?.devActivationLink) window.open(r.data.devActivationLink, '_blank', 'noopener');
      } catch (e) {
        toast.error(e?.response?.data?.message || 'Could not resend.');
      } finally {
        setResending(false);
      }
    };

    return (
      <div className="auth-container" style={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 520 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📧 Check your inbox</div>
          <p>We’ve sent a verification link {email ? `to ${email}` : ''}. Click it to activate your account.</p>
          <p style={{ fontSize: 13, color: '#666' }}>
            Keep this tab open — we’ll sign you in automatically after verification.
          </p>
          <div style={{ marginTop: 14, display: 'flex', gap: 12, justifyContent: 'center' }}>
            <a href="mailto:" className="auth-link">Open email app</a>
            <button className="link-btn" onClick={resend} disabled={resending || !email}>
              {resending ? 'Resending…' : 'Resend email'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ⏳ Handshaking screen (rare, but avoids flicker if /auth#token=… is used)
  if (handshaking) return <div style={{ minHeight: '80vh' }} />;

  // 🧾 Normal auth page
  return (
    <div className="auth-container">
      <Logo onClick={() => navigate('/')} />
      <h2>{isLogin ? 'Sign In' : 'Register'}</h2>

      <form onSubmit={handleSubmit} style={{ width: '100%' }}>
        {!isLogin ? (
          <>
            {/* User/Vendor selection */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="radio"
                  name="userType"
                  value="user"
                  checked={userType === 'user'}
                  onChange={() => setUserType('user')}
                />
                <span>Register as User</span>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="radio"
                  name="userType"
                  value="vendor"
                  checked={userType === 'vendor'}
                  onChange={() => setUserType('vendor')}
                />
                <span>Register as Vendor</span>
              </label>
            </div>

            {/* Registration fields */}
            <input
              type="text"
              name="name"
              placeholder="Full Name"
              value={formData.name}
              onChange={handleChange}
              required
              className="auth-input"
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input
                type="text"
                name="state"
                placeholder="State"
                value={formData.state}
                onChange={handleChange}
                className="auth-input"
              />
              <input
                type="text"
                name="city"
                placeholder="City"
                value={formData.city}
                onChange={handleChange}
                className="auth-input"
              />
            </div>

            <input
              type="tel"
              name="phone"
              placeholder="Phone"
              value={formData.phone}
              onChange={handleChange}
              required={userType === 'vendor'}
              className="auth-input"
            />
            <input
              type="text"
              name="address"
              placeholder="Address"
              value={formData.address}
              onChange={handleChange}
              required={userType === 'vendor'}
              className="auth-input"
            />

            {userType === 'vendor' && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 13, marginBottom: 6 }}>Business Types:</div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                  {['hotel', 'shortlet', 'restaurant', 'event center', 'tour guide'].map((t) => (
                    <label key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={businessTypes.includes(t)}
                        onChange={() => toggleType(t)}
                      />
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}

        {/* Shared fields */}
        <input
          type="email"
          name="email"
          placeholder="Email address"
          value={formData.email}
          onChange={handleChange}
          required
          className="auth-input"
        />

        <PasswordField
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          placeholder="Password"
          autoComplete={isLogin ? 'current-password' : 'new-password'}
        />

        {isLogin && (
          <div style={{ marginTop: 8, marginBottom: 4 }}>
            <a href="/forgot-password" className="auth-link">Forgot password?</a>
          </div>
        )}

        <button type="submit" disabled={loading} className="auth-submit">
          {loading ? (isLogin ? 'Signing in…' : 'Registering…') : (isLogin ? 'Sign In' : 'Register')}
        </button>
      </form>

      <p style={{ marginTop: 10 }}>
        {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
        <button onClick={toggleForm} className="link-btn" disabled={loading}>
          {isLogin ? 'Register' : 'Sign In'}
        </button>
      </p>

      <hr />

      <GoogleLogin
        onSuccess={async (credentialResponse) => {
          if (!credentialResponse?.credential) {
            toast.error('Google login failed: no credential received');
            return;
          }
          setLoading(true);
          try {
            const res = await axios.post('/api/auth/google', { token: credentialResponse.credential });
            const token = res.data?.token;
            if (!token) throw new Error('No token from Google login');
            const decoded = jwtDecode(token);
            const r = (decoded.role || 'user').toLowerCase();
            clearAllTokens();
            if (r === 'vendor') {
              localStorage.setItem('vendorToken', token);
              navigate('/dashboard');
            } else {
              localStorage.setItem('userToken', token);
              navigate('/user-dashboard');
            }
          } catch (err) {
            console.error('🛑 [AuthPage] Google login failed:', err?.response?.data || err?.message || err);
            toast.error('Google login failed.');
          } finally {
            setLoading(false);
          }
        }}
        onError={() => toast.error('Google login failed.')}
      />
    </div>
  );
};

export default AuthPage;
