import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import HotelCard from '../components/HotelCard';
import ShortletCard from '../components/ShortletCard';
import RestaurantCard from '../components/RestaurantCard';
import EventCenterCard from '../components/EventCenterCard';
import './ExploreManager.css';

const ExploreManager = () => {
  const [data, setData] = useState({ hotels: [], shortlets: [], restaurants: [], eventcenters: [] });
  const [loading, setLoading] = useState(true);

  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
  });

  const fetchFeatured = async () => {
    try {
      // ✅ only featured items
      const res = await axios.get('/api/admin/explore-list?mode=featured&limit=200', authHeaders());
      setData(res.data || { hotels: [], shortlets: [], restaurants: [], eventcenters: [] });
    } catch (err) {
      console.error('❌ Failed to fetch explore list:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFeatured = async (type, id) => {
    try {
      await axios.post(`/api/admin/toggle-featured/${type}/${id}`, {}, authHeaders());
      fetchFeatured(); // refresh after toggle
    } catch (err) {
      alert('❌ Failed to toggle featured');
    }
  };

  useEffect(() => { fetchFeatured(); }, []);

  const getCardProps = (type, item) => {
    switch (type) {
      case 'hotel':       return { hotel: item };
      case 'shortlet':    return { shortlet: item };
      case 'restaurant':  return { restaurant: item };
      case 'eventcenter': return { eventCenter: item }; // 👈 correct prop for EventCenterCard
      default:            return { item };
    }
  };

  const Section = ({ title, type, items, Card }) => (
    <section className="explore-section">
      <h3>{title}</h3>
      {(!items || items.length === 0) ? (
        <p className="muted">No featured {title.toLowerCase()}</p>
      ) : (
        <div className="card-grid">
          {items.map(item => (
            <div key={item._id} className="card-wrap">
              <Card {...getCardProps(type, item)} />
              <button className="toggle-featured-btn" onClick={() => toggleFeatured(type, item._id)}>
                {item?.isFeatured || item?.featured ? 'Unfeature' : 'Feature'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  if (loading) return <p>Loading explore list...</p>;

  return (
    <div className="explore-manager">
      <h2>Explore Manager</h2>
      <Section title="Hotels"        type="hotel"       items={data.hotels}        Card={HotelCard} />
      <Section title="Shortlets"     type="shortlet"    items={data.shortlets}     Card={ShortletCard} />
      <Section title="Restaurants"   type="restaurant"  items={data.restaurants}   Card={RestaurantCard} />
      <Section title="Event Centers" type="eventcenter" items={data.eventcenters}  Card={EventCenterCard} />
    </div>
  );
};

export default ExploreManager;
