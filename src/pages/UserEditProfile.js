// 📄 src/pages/UserEditProfile.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axiosConfig';

const UserEditProfile = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const navigate = useNavigate();

  const fetchUser = async () => {
    try {
      // ✅ FIX: correct path prefix
      const res = await axios.get('/api/user/profile');
      const { name = '', email = '', phone = '', address = '' } = res.data?.user || {};
      setFormData({ name, email, phone, address });
      setLoading(false);
    } catch (err) {
      console.error('❌ Fetch error details:', err);
      const status = err?.response?.status;
      // ✅ Treat 401 + 403 as "not logged in / wrong role"
      if (status === 401 || status === 403) {
        setNotLoggedIn(true);
      } else {
        setError('❌ Failed to load profile. Please try again.');
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser(); // axios interceptor will attach the token
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      // ✅ FIX: correct path prefix
      await axios.put('/api/user/update', formData);
      setSuccess('✅ Profile updated successfully!');
    } catch (err) {
      console.error('❌ Update error:', err);
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setNotLoggedIn(true);
      } else {
        setError('❌ Failed to update profile. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const redirectToLogin = () => navigate('/login');

  if (loading) return <p style={{ padding: '2rem' }}>Loading profile...</p>;

  if (notLoggedIn) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>You’re not logged in</h2>
        <p>You need to log in to edit your profile.</p>
        <button
          onClick={redirectToLogin}
          style={{
            padding: '0.7rem 1.5rem',
            backgroundColor: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            marginTop: '1rem',
          }}
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '500px', margin: '0 auto' }}>
      <h2>Edit Profile</h2>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>{success}</p>}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label>Name:</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label>Email:</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label>Phone:</label>
          <input
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label>Address:</label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            padding: '0.7rem 1.5rem',
            backgroundColor: saving ? '#6c757d' : '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            cursor: saving ? 'default' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
};

export default UserEditProfile;
