// ✅ src/pages/DeleteAccount.js
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const DeleteAccount = () => {
  const [confirmText, setConfirmText] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') {
      setMessage('❌ Please type DELETE to confirm.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('❌ You must be logged in.');
      return;
    }

    try {
      await axios.delete('http://localhost:10000/api/user/delete-account', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('✅ Account deleted successfully.');
      localStorage.removeItem('token');
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      console.error('Delete error:', err);
      setMessage('❌ Failed to delete account.');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Delete Account</h2>
      <p style={{ color: 'red' }}>
        Warning: This will permanently delete your account and all data associated with it.
      </p>
      <p>Type <strong>DELETE</strong> below to confirm:</p>
      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder="Type DELETE"
        style={{ padding: '0.5rem', marginBottom: '1rem', width: '200px' }}
      />
      <br />
      <button onClick={handleDelete} style={{ background: 'darkred', color: '#fff', padding: '0.5rem 1rem', border: 'none', cursor: 'pointer' }}>
        Delete Account
      </button>
      <p style={{ marginTop: '1rem' }}>{message}</p>
    </div>
  );
};

export default DeleteAccount;
