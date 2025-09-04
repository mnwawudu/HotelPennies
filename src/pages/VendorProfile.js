// ✅ src/pages/VendorProfile.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const VendorProfile = () => {
  const [vendor, setVendor] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  });

  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('vendorToken');
    if (!token) {
      setError('No token found');
      return;
    }

    const fetchVendor = async () => {
      try {
        const res = await axios.get('http://localhost:10000/api/vendor/profile', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setVendor(res.data.vendor);
        setFormData({
          name: res.data.vendor.name || '',
          email: res.data.vendor.email || '',
          phone: res.data.vendor.phone || '',
          address: res.data.vendor.address || '',
        });
      } catch (err) {
        setError('Failed to fetch profile');
      }
    };

    fetchVendor();
  }, []);

  const handleSave = async () => {
    const token = localStorage.getItem('vendorToken');
    const form = new FormData();

    form.append('name', formData.name);
    form.append('phone', formData.phone);
    form.append('address', formData.address);

    if (Array.isArray(vendor.businessTypes)) {
      vendor.businessTypes.forEach(bt => {
        form.append('businessTypes[]', bt);
      });
    }

    try {
      const res = await axios.put('http://localhost:10000/api/vendor/profile', form, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setVendor(res.data.vendor);
      setSuccess('Profile updated successfully');
      setShowEditModal(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    }
  };

  const handleDelete = async () => {
    const confirmDelete = window.confirm('Are you sure you want to delete your vendor account? This action cannot be undone.');
    if (!confirmDelete) return;

    const token = localStorage.getItem('vendorToken');
    try {
      await axios.delete('http://localhost:10000/api/vendor/delete', {
        headers: { Authorization: `Bearer ${token}` }
      });
      localStorage.removeItem('vendorToken');
      navigate('/');
    } catch (err) {
      setError('Failed to delete account');
    }
  };

  if (error) return <div style={{ color: 'red', padding: '2rem' }}>{error}</div>;
  if (!vendor) return <p style={{ padding: '2rem' }}>Loading profile...</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <p><strong>Name:</strong> {vendor.name}</p>
      <p><strong>Email:</strong> {vendor.email}</p>
      <p><strong>Phone:</strong> {vendor.phone || '—'}</p>
      <p><strong>Address:</strong> {vendor.address || '—'}</p>
      <p><strong>ID:</strong> {vendor._id}</p>
      <p><strong>Verified:</strong> {vendor.isFullyVerified ? '✅ Yes' : '❌ No'}</p>
      {success && <p style={{ color: 'green' }}>{success}</p>}

      <div style={{ marginTop: '1rem' }}>
        <button
          onClick={() => setShowEditModal(true)}
          style={{ padding: '0.5rem 1rem', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '5px' }}
        >
          Edit Profile
        </button>
      </div>

      <div style={{ marginTop: '3rem', borderTop: '1px solid #ccc', paddingTop: '2rem' }}>
        <h4 style={{ color: 'red' }}>Danger Zone</h4>
        <p style={{ marginBottom: '1rem' }}>This action is irreversible.</p>
        <button
          onClick={handleDelete}
          style={{ padding: '0.5rem 1rem', backgroundColor: 'darkred', color: '#fff', border: 'none', borderRadius: '5px' }}
        >
          Delete Account
        </button>
      </div>

      {showEditModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '8px', width: '90%', maxWidth: '500px' }}>
            <h3>Edit Profile</h3>
            <input
              type="text"
              placeholder="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={{ width: '100%', marginBottom: '1rem' }}
            />
            <input
              type="text"
              placeholder="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              style={{ width: '100%', marginBottom: '1rem' }}
            />
            <input
              type="text"
              placeholder="Address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              style={{ width: '100%', marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowEditModal(false)} style={{ marginRight: '1rem' }}>Cancel</button>
              <button onClick={handleSave} style={{ backgroundColor: 'green', color: '#fff', padding: '0.5rem 1rem' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorProfile;
