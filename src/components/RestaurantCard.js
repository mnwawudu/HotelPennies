import React from 'react';
import './RestaurantCard.css';

const RestaurantCard = ({ restaurant, onView, onBook }) => {
  return (
    <div className="restaurant-card">
      <img
        src={restaurant.mainImage || restaurant.images?.[0] || '/default-restaurant.jpg'}
        alt={restaurant.name}
        className="restaurant-image"
      />
      <div className="restaurant-details">
        <h3 className="restaurant-name">{restaurant.name}</h3>
        <p><strong>Price Range:</strong> ₦{restaurant.priceRange}</p>
        <p><strong>Location:</strong> {restaurant.location}</p>
        <p><strong>City:</strong> {restaurant.city}</p>
        <p><strong>State:</strong> {restaurant.state}</p>
        <p><strong>Description:</strong> {restaurant.description}</p>

        <div className="view-buttons">
          <button onClick={onView}>View Menu</button>
          <button onClick={onBook}>Book Now</button>
        </div>
      </div>
    </div>
  );
};

export default RestaurantCard;
