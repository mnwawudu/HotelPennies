import React from 'react';

const ProfileCard = ({ vendor }) => (
  <div style={{ marginBottom: '1.5rem', border: '1px solid #ccc', padding: '1rem', borderRadius: 8 }}>
    <h3>Profile Info</h3>
    <p><strong>Email:</strong> {vendor.email}</p>
    <p><strong>Phone:</strong> {vendor.phone}</p>
    <p><strong>Address:</strong> {vendor.address}</p>
    <p><strong>Verified Types:</strong> {vendor.isVerifiedTypes.join(', ') || 'None'}</p>
    <p><strong>Fully Verified:</strong> {vendor.isFullyVerified ? 'Yes' : 'No'}</p>
  </div>
);

export default ProfileCard;
