// src/components/FeatureListingModal.js
import React, { useState } from 'react';
import axios from 'axios';

const FeatureListingModal = ({ hotelId, onClose }) => {
  const [room, setRoom] = useState('');
  const [type, setType] = useState('local'); // global or local
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFeature = async () => {
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:10000/api/feature-pricing/pay', {
        hotelId,
        room,
        type,
        email,
        name,
        description: `Feature listing for ${room || 'hotel'}`,
      });

      if (res.data && res.data.payment_link) {
        window.location.href = res.data.payment_link;
      }
    } catch (err) {
      alert('Payment initiation failed.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={modalStyle}>
      <h3>Feature Listing</h3>
      <input
        type="text"
        placeholder="Room Name (optional)"
        value={room}
        onChange={(e) => setRoom(e.target.value)}
      />
      <select value={type} onChange={(e) => setType(e.target.value)}>
        <option value="local">Local</option>
        <option value="global">Global</option>
      </select>
      <input
        type="email"
        placeholder="Your Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="text"
        placeholder="Your Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button onClick={handleFeature} disabled={loading}>
        {loading ? 'Redirecting...' : 'Pay to Feature'}
      </button>
      <button onClick={onClose} style={{ marginTop: '1rem', background: '#ccc' }}>
        Cancel
      </button>
    </div>
  );
};

const modalStyle = {
  background: '#fff',
  padding: '2rem',
  borderRadius: '10px',
  width: '350px',
  margin: '5rem auto',
  textAlign: 'center',
  boxShadow: '0 0 10px rgba(0,0,0,0.3)',
};

export default FeatureListingModal;
