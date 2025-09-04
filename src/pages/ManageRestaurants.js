import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import AddRestaurantModal from './AddRestaurantModal';
import UploadImageModal from '../components/UploadImageModal';
import CalendarModal from '../components/CalendarModal';
import DeleteModal from '../components/DeleteModal';
import EditRestaurantModal from '../components/EditRestaurantModal';
import FeatureRestaurantModal from '../components/FeatureRestaurantModal';
import RestaurantCard from '../components/RestaurantCard';
import MenuList from './MenuList';
import './ManageRestaurants.css';

const ManageRestaurants = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [calendaring, setCalendaring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [featuring, setFeaturing] = useState(false);

  const fetchRestaurants = async () => {
    const token = localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');
    try {
      const res = await axios.get('/api/restaurants/my-listings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRestaurants(res.data);
    } catch (err) {
      console.error('❌ Failed to fetch restaurants:', err);
    }
  };

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const handleAdded = (newRestaurant) => setRestaurants(prev => [...prev, newRestaurant]);

  return (
    <div className="manage-page">
      <div className="header-row">
        <h2>My Restaurants</h2>
        <button onClick={() => setShowAddModal(true)} className="add-button">
          + Add Restaurant
        </button>
      </div>

      <div className="card-grid">
        {restaurants.map((restaurant) => (
          <div key={restaurant._id} className="restaurant-wrapper">
            <RestaurantCard
              restaurant={restaurant}
              onView={() =>
                setSelectedRestaurantId(
                  selectedRestaurantId === restaurant._id ? null : restaurant._id
                )
              }
              onBook={() => alert('Booking coming soon')}
            />

            <div className="restaurant-buttons">
              <button onClick={() => { setEditing(true); setSelectedRestaurantId(restaurant._id); }}>Edit</button>
              <button onClick={() => { setUploading(true); setSelectedRestaurantId(restaurant._id); }}>Upload</button>
              <button onClick={() => { setCalendaring(true); setSelectedRestaurantId(restaurant._id); }}>Calendar</button>
              <button onClick={() => { setFeaturing(true); setSelectedRestaurantId(restaurant._id); }}>Feature</button>
              <button className="btn-danger" onClick={() => { setDeleting(true); setSelectedRestaurantId(restaurant._id); }}>Delete</button>
              <button onClick={() =>
                setSelectedRestaurantId(
                  selectedRestaurantId === restaurant._id ? null : restaurant._id
                )
              }>
                {selectedRestaurantId === restaurant._id ? 'Hide Menu' : 'View Menu'}
              </button>
            </div>

            {selectedRestaurantId === restaurant._id && (
              <div className="menu-section">
                <MenuList restaurantId={restaurant._id} />
              </div>
            )}
          </div>
        ))}
      </div>

      {showAddModal && (
        <AddRestaurantModal
          onClose={() => setShowAddModal(false)}
          onAdded={handleAdded}
        />
      )}

      {editing && (
        <EditRestaurantModal
          restaurant={restaurants.find(r => r._id === selectedRestaurantId)}
          onClose={() => setEditing(false)}
          onUpdate={() => {
            fetchRestaurants();
            setEditing(false);
          }}
        />
      )}

      {uploading && (
        <UploadImageModal
          resource="restaurants"
          itemId={selectedRestaurantId}
          onClose={() => {
            setUploading(false);
            fetchRestaurants();
          }}
          onUploaded={() => fetchRestaurants()}
        />
      )}

      {calendaring && (
        <CalendarModal
          itemId={selectedRestaurantId}
          type="restaurant"
          onClose={() => setCalendaring(false)}
          onSaved={fetchRestaurants}
        />
      )}

      {featuring && (
        <FeatureRestaurantModal
          item={restaurants.find(r => r._id === selectedRestaurantId)}
          onClose={() => {
            setFeaturing(false);
            fetchRestaurants();
          }}
        />
      )}

      {deleting && (
        <DeleteModal
    title="Delete Restaurant"
    message="Are you sure you want to delete this restaurant?"
    itemId={selectedRestaurantId}
    itemType="restaurant"
    onCancel={() => setDeleting(false)}
    onDeleted={fetchRestaurants}
  />
      )}
    </div>
  );
};

export default ManageRestaurants;
