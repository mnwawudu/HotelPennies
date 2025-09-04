import React from 'react';
import './EventCenterCard.css';

const EventCenterCard = ({ data }) => {
  const {
    name,
    price,
    promoPrice,
    usePromo,
    location,
    city,
    state,
    capacity,
    description,
    complimentary,
    mainImage,
    images
  } = data;

  return (
    <div className="event-card">
      <img
        src={mainImage || images?.[0] || '/default-hotel.jpg'}
        alt={name}
        className="event-image"
        onError={(e) => { e.target.src = '/default-hotel.jpg'; }}
      />

      <div className="event-info">
        <h3 className="text-lg font-semibold mb-1">{name}</h3>
        <p className="event-price">
          {usePromo && promoPrice ? (
            <>
              <span className="line-through">₦{price}</span>
              <span className="text-navy">₦{promoPrice}</span>
            </>
          ) : (
            <span className="text-navy">₦{price}</span>
          )}
        </p>
        <p><strong>Location:</strong> {location}</p>
        <p><strong>City:</strong> {city}</p>
        <p><strong>State:</strong> {state}</p>
        <p><strong>Capacity:</strong> {capacity}</p>
        {complimentary && <p><strong>Complimentary:</strong> {complimentary}</p>}
        <p><strong>Description:</strong> {description}</p>

        <div className="btn-row">
          <button className="btn-blue">View More</button>
          <button className="btn-blue">Book Now</button>
        </div>
      </div>
    </div>
  );
};

export default EventCenterCard;
