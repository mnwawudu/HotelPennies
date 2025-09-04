import React, { useState } from 'react';
import axios from 'axios';

const AdminChangePassword = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmNew, setConfirmNew]           = useState('');
  const [busy, setBusy]                       = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmNew) return alert('New passwords do not match');
    setBusy(true);
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return alert('You must be signed in');

      await axios.post(
        'http://localhost:10000/api/admin/change-password',
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('Password changed successfully. Please sign in again.');
      localStorage.removeItem('adminToken');
      localStorage.removeItem('admin');
      window.location.href = '/admin/login';
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to change password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <h2>Change Password (Admin)</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="password"
          placeholder="Current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          className="book-gift-input"
        />
        <input
          type="password"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          className="book-gift-input"
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={confirmNew}
          onChange={(e) => setConfirmNew(e.target.value)}
          required
          className="book-gift-input"
        />
        <button disabled={busy} className="book-gift-button submit" type="submit">
          {busy ? 'Updating…' : 'Update Password'}
        </button>
      </form>
    </div>
  );
};

export default AdminChangePassword;
