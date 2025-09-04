import React, { useEffect, useState } from 'react';
import axios from 'axios';

const FeaturedManager = () => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('adminToken');

  const fetchData = async () => {
    try {
      const res = await axios.get('/api/admin/featured-items', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch featured items:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFeatured = async (type, id) => {
    try {
      await axios.post(`/api/admin/toggle-featured/${type}/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (err) {
      alert('Failed to toggle');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <p>Loading...</p>;

  const renderList = (type, items) => (
    <>
      <h3 style={{ marginTop: '2rem' }}>{type.charAt(0).toUpperCase() + type.slice(1)}</h3>
      {items.length === 0 ? (
        <p>No featured {type}s</p>
      ) : (
        <ul>
          {items.map(item => (
            <li key={item._id} style={{ marginBottom: '1rem' }}>
              {item.name || item.title} &nbsp;
              <button onClick={() => toggleFeatured(type, item._id)}>Unfeature</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  return (
    <div>
      <h2>Manage Featured Listings</h2>
      {renderList('hotels', data.hotels || [])}
      {renderList('shortlets', data.shortlets || [])}
      {renderList('restaurants', data.restaurants || [])}
      {renderList('eventcenters', data.eventcenters || [])}
    </div>
  );
};

export default FeaturedManager;
