// ✅ src/pages/ManageBusiness.js
import React, { useState, useEffect } from 'react';
import AddHotelModal from './AddHotelModal';
import AddShortletModal from './AddShortletModal';
import AddRestaurantModal from './AddRestaurantModal';
import AddEventCenterModal from './AddEventCenterModal';
import AddTourGuideModal from './AddTourGuideModal';

const ManageBusiness = () => {
  const [hotels, setHotels] = useState([]);
  const [shortlets, setShortlets] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [eventCenters, setEventCenters] = useState([]);
  const [tourGuides, setTourGuides] = useState([]);

  const [activeModal, setActiveModal] = useState(null); // 'hotel', 'shortlet', etc.

  // Replace with your actual API calls or states if already connected
  useEffect(() => {
    // This can be replaced with API fetches for each category if needed
  }, []);

  const btnStyle = {
    marginBottom: '1rem',
    padding: '0.5rem 1rem',
    background: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    marginRight: '10px',
  };

  return (
    <div>
      <h2>Manage Your Business Listings</h2>
      <div>
        <button style={btnStyle} onClick={() => setActiveModal('hotel')}>+ Add Hotel</button>
        <button style={btnStyle} onClick={() => setActiveModal('shortlet')}>+ Add Shortlet</button>
        <button style={btnStyle} onClick={() => setActiveModal('restaurant')}>+ Add Restaurant</button>
        <button style={btnStyle} onClick={() => setActiveModal('eventCenter')}>+ Add Event Center</button>
        <button style={btnStyle} onClick={() => setActiveModal('tourGuide')}>+ Add Tour Guide</button>
      </div>

      {activeModal === 'hotel' && (
        <AddHotelModal
          onClose={() => setActiveModal(null)}
          onHotelAdded={(newHotel) => setHotels(prev => [...prev, newHotel])}
        />
      )}

      {activeModal === 'shortlet' && (
        <AddShortletModal
          onClose={() => setActiveModal(null)}
          onShortletAdded={(newShortlet) => setShortlets(prev => [...prev, newShortlet])}
        />
      )}

      {activeModal === 'restaurant' && (
        <AddRestaurantModal
          onClose={() => setActiveModal(null)}
          onRestaurantAdded={(newRestaurant) => setRestaurants(prev => [...prev, newRestaurant])}
        />
      )}

      {activeModal === 'eventCenter' && (
        <AddEventCenterModal
          onClose={() => setActiveModal(null)}
          onEventCenterAdded={(newEventCenter) => setEventCenters(prev => [...prev, newEventCenter])}
        />
      )}

      {activeModal === 'tourGuide' && (
        <AddTourGuideModal
          onClose={() => setActiveModal(null)}
          onTourGuideAdded={(newTourGuide) => setTourGuides(prev => [...prev, newTourGuide])}
        />
      )}

      {/* Optional: display count or preview */}
      <div style={{ marginTop: '2rem' }}>
        <h4>My Listings Summary:</h4>
        <ul>
          <li>Hotels: {hotels.length}</li>
          <li>Shortlets: {shortlets.length}</li>
          <li>Restaurants: {restaurants.length}</li>
          <li>Event Centers: {eventCenters.length}</li>
          <li>Tour Guides: {tourGuides.length}</li>
        </ul>
      </div>
    </div>
  );
};

export default ManageBusiness;
