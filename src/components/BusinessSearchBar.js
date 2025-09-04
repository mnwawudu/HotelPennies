import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './BusinessSearchBar.css';

const BusinessSearchBar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const getBusinessType = () => {
    if (location.pathname.includes('/shortlets')) return 'shortlet';
    if (location.pathname.includes('/hotels')) return 'hotel';
    if (location.pathname.includes('/restaurants')) return 'restaurant';
    if (location.pathname.includes('/event-centers')) return 'event center';
    if (location.pathname.includes('/tour-guides')) return 'tour guide';
    return 'service';
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('');

  const handleSearch = () => {
    const query = new URLSearchParams();
    if (searchTerm) query.append('city', searchTerm.trim());
    if (checkIn) query.append('checkIn', checkIn);
    if (checkOut) query.append('checkOut', checkOut);
    if (guests) query.append('guests', guests);

    navigate(`/search-results?${query.toString()}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className="business-search">
      <input
        type="text"
        placeholder={`Search for a ${getBusinessType()}...`}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <input
        type="date"
        value={checkIn}
        onChange={(e) => setCheckIn(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <input
        type="date"
        value={checkOut}
        onChange={(e) => setCheckOut(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <input
        type="number"
        placeholder="Guests"
        value={guests}
        min="1"
        onChange={(e) => setGuests(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{ width: '80px' }}
      />
      <button onClick={handleSearch}>Find</button>
    </div>
  );
};

export default BusinessSearchBar;
