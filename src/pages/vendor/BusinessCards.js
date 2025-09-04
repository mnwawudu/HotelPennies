import React from 'react';

const BusinessCards = ({ types = [], verified = [] }) => (
  <div style={{ marginBottom: '1.5rem' }}>
    <h3>Business Types</h3>
    {types.length === 0 ? (
      <p>No business types found.</p>
    ) : (
      types.map((type) => (
        <div key={type} style={{
          margin: '0.5rem 0',
          padding: '0.75rem',
          border: '1px solid #eee',
          borderRadius: 6,
          backgroundColor: verified.includes(type) ? '#e0ffe0' : '#fff3cd'
        }}>
          <strong>{type.toUpperCase()}</strong> — {verified.includes(type) ? 'Verified ✅' : 'Pending ⚠️'}
        </div>
      ))
    )}
  </div>
);

export default BusinessCards;
