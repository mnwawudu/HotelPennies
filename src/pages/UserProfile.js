// 📄 src/pages/UserProfile.js
import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig'; // ✅ use configured axios (baseURL + auth)
import { useNavigate } from 'react-router-dom';

const UserProfile = () => {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // ✅ correct path; token is attached by axiosConfig
        const res = await axios.get('/api/user/profile');
        if (!cancelled) setUser(res.data?.user || null);
      } catch (err) {
        console.error(err);
        const status = err?.response?.status;
        if (!cancelled) {
          if (status === 401 || status === 403) {
            setError('You need to log in to view your profile.');
          } else {
            setError('Failed to load profile');
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleDeleteAccount = async () => {
    try {
      // ✅ correct path; token from interceptor
      await axios.delete('/api/user/delete');

      // ✅ clear the right keys for a user session
      localStorage.removeItem('userToken');
      sessionStorage.removeItem('userToken');

      setSuccess('✅ Account deleted. Redirecting...');
      setTimeout(() => {
        navigate('/'); // soft redirect; use window.location if you need full reload
      }, 1500);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || '❌ Failed to delete account');
    }
  };

  if (error)
    return <div style={{ color: 'red', padding: '2rem' }}>{error}</div>;

  if (!user)
    return <div style={{ padding: '2rem' }}>Loading profile...</div>;

  return (
    <div style={{ padding: '2rem' }}>
      <h2>User Profile</h2>
      {success && <p style={{ color: 'green' }}>{success}</p>}

      <p><strong>Name:</strong> {user.name}</p>
      <p><strong>Email:</strong> {user.email}</p>
      <p><strong>Phone:</strong> {user.phone || '—'}</p>
      <p><strong>Address:</strong> {user.address || '—'}</p>
      <p><strong>Referral Code:</strong> {user.userCode}</p>
      <p>
        <strong>Affiliate Link:</strong>{' '}
        {user.affiliateLink ? (
          <a href={user.affiliateLink} target="_blank" rel="noopener noreferrer">
            {user.affiliateLink}
          </a>
        ) : '—'}
      </p>
      <p><strong>Email Verified:</strong> {user.isEmailVerified ? '✅ Yes' : '❌ No'}</p>

      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
        <button
          onClick={() => navigate('/user-edit-profile')}
          style={{
            background: '#007bff',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Edit Profile
        </button>

        <button
          onClick={() => setConfirmDelete(true)}
          style={{
            background: 'red',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Delete Account
        </button>
      </div>

      {confirmDelete && (
        <div style={{ marginTop: '1rem' }}>
          <p style={{ color: 'red' }}>Are you sure? This action cannot be undone.</p>
          <button
            onClick={handleDeleteAccount}
            style={{
              marginRight: '1rem',
              backgroundColor: '#333',
              color: '#fff',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
            }}
          >
            Yes, Delete
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            style={{ padding: '8px 16px', border: '1px solid #ccc' }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
