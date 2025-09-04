import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import HotelCardPublic from '../components/HotelCardPublic';
import ShortletCardPublic from '../components/ShortletCardPublic';
import RestaurantCardPublic from '../components/RestaurantCardPublic';
import ChopsCardPublic from '../components/ChopsCardPublic';
import GiftCardPublic from '../components/GiftCardPublic';
import EventCenterCardPublic from '../components/EventCenterCardPublic';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import './SearchResults.css';

const ITEMS_PER_PAGE = 12;

const SearchResultsPage = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const rawQuery = (queryParams.get('city') || '').trim();

  // ---------------------------
  // Keyword & amenity detection
  // ---------------------------
  const q = rawQuery.toLowerCase();

  // intents (what to show)
  const wantsHotels       = /(hotel|hotels|lodge|lodges)/i.test(q);
  const wantsShortlets    = /(shortlet|shortlets)/i.test(q);
  const wantsRestaurants  = /(restaurant|restaurants)/i.test(q);
  const wantsEventCenters = /(event\s*center|eventcenter|hall|halls)/i.test(q);
  const wantsChops        = /\bchops?\b/i.test(q);
  const wantsGifts        = /\bgifts?\b/i.test(q);

  const isBroadSearch = !(
    wantsHotels ||
    wantsShortlets ||
    wantsRestaurants ||
    wantsEventCenters ||
    wantsChops ||
    wantsGifts
  );

  // price intent
  const isCheapSearch = /\b(cheap|affordable|budget)\b/i.test(q);

  // amenity intent (normalized)
  const amenityFlags = useMemo(() => {
    const hasPool       = /\b(pool|swim|swimming\s*pool)\b/i.test(q);
    const hasGym        = /\b(gym|fitness)\b/i.test(q);
    const hasRestaurant = /\b(restaurant|dining|eatery)\b/i.test(q) || /\bbreakfast(s)?\b/i.test(q); // breakfast counts as restaurant
    const hasParking    = /\b(parking|car\s*park|carpark|park)\b/i.test(q) && (wantsHotels || wantsShortlets);
    const list = [];
    if (hasPool)       list.push('pool');
    if (hasGym)        list.push('gym');
    if (hasRestaurant) list.push('restaurant'); // we let backend normalize breakfast→restaurant
    if (hasParking)    list.push('parking');
    return { hasPool, hasGym, hasRestaurant, hasParking, list };
  }, [q, wantsHotels, wantsShortlets]);

  // remove non-location terms from the location string we ship to backend
  const extractLocation = (input) => {
    const ban = new Set([
      // category words
      'hotels','hotel','lodges','lodge','shortlet','shortlets','restaurants','restaurant',
      'eventcenter','event','center','eventcenters','halls','hall','gifts','gift','chops','chop',
      // price words
      'cheap','affordable','budget','luxury','premium',
      // connectors
      'with','and','in','near','at','around','of','for',
      // amenity words (normalized)
      'pool','swimming','gym','fitness','restaurant','dining','eatery','parking','car','park','carpark',
      'breakfast','complimentary','free'
    ]);
    return input
      .split(/\s+/)
      .filter(w => !ban.has(w.toLowerCase()))
      .join(' ')
      .trim();
  };

  const cleanedLocation = extractLocation(q);

  // ---------------------------------
  // Data + pagination state (stable)
  // ---------------------------------
  const [results, setResults] = useState({
    hotels: [],
    shortlets: [],
    restaurants: [],
    chops: [],
    gifts: [],
    eventcenters: [],
  });
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    hotels: 1,
    shortlets: 1,
    restaurants: 1,
    chops: 1,
    gifts: 1,
    eventcenters: 1,
  });

  // ---------------------------------
  // Fetch
  // ---------------------------------
  useEffect(() => {
    let cancelled = false;

    const fetchSearchResults = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();

        // send BOTH raw query (“q”) and cleaned location for maximum backend flexibility
        if (rawQuery) params.set('q', rawQuery);
        if (cleanedLocation) params.set('location', cleanedLocation);

        // tell API what we intend (explicit)
        const intents = [];
        if (wantsHotels) intents.push('hotels');
        if (wantsShortlets) intents.push('shortlets');
        if (wantsRestaurants) intents.push('restaurants');
        if (wantsEventCenters) intents.push('eventcenters');
        if (wantsChops) intents.push('chops');
        if (wantsGifts) intents.push('gifts');
        if (intents.length) params.set('intents', intents.join(','));

        if (isCheapSearch) params.set('cheap', '1'); // backend uses CHEAP_MAX_NGN

        // explicit amenities list (backend will normalize breakfast→restaurant in NG mode)
        if (amenityFlags.list.length) params.set('amenities', amenityFlags.list.join(','));

        const res = await axios.get(`/api/search?${params.toString()}`);
        if (cancelled) return;

        const { hotels, shortlets, restaurants, eventcenters, chops, gifts } = res.data;

        // Preserve “cheap” behavior of sorting client-side too (secondary)
        const sortByPrice = (arr) =>
          [...(arr || [])].sort((a, b) => (a.promoPrice || a.price || 0) - (b.promoPrice || b.price || 0));

        setResults({
          hotels: isCheapSearch ? sortByPrice(hotels) : (hotels || []),
          shortlets: isCheapSearch ? sortByPrice(shortlets) : (shortlets || []),
          restaurants: restaurants || [],
          chops: chops || [],
          gifts: gifts || [],
          eventcenters: isCheapSearch ? sortByPrice(eventcenters) : (eventcenters || []),
        });

        // reset pagers on new query
        setPagination({ hotels: 1, shortlets: 1, restaurants: 1, chops: 1, gifts: 1, eventcenters: 1 });
      } catch (err) {
        console.error('❌ Failed to fetch search results:', err);
        setResults({ hotels: [], shortlets: [], restaurants: [], chops: [], gifts: [], eventcenters: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSearchResults();
    return () => { cancelled = true; };
  }, [
    rawQuery, cleanedLocation,
    isCheapSearch,
    wantsHotels, wantsShortlets, wantsRestaurants, wantsEventCenters, wantsChops, wantsGifts,
    amenityFlags.list.join(',')
  ]);

  // ---------------------------------
  // Render helpers
  // ---------------------------------
  const renderSection = (title, data, CardComponent, propName, type) => {
    if (!Array.isArray(data) || data.length === 0) return null;
    const currentPage = pagination[type] || 1;
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = data.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE) || 1;

    return (
      <div className="search-section">
        <h3>{title}</h3>
        <div className="search-card-grid">
          {paginatedData.map((item) => (
            <CardComponent key={item._id} {...{ [propName]: item }} />
          ))}
        </div>
        {totalPages > 1 && (
          <div className="pagination">
            <button
              disabled={currentPage === 1}
              onClick={() => setPagination(prev => ({ ...prev, [type]: currentPage - 1 }))}
            >
              Prev
            </button>
            <span className="page-count">{currentPage} of {totalPages}</span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setPagination(prev => ({ ...prev, [type]: currentPage + 1 }))}
            >
              Next
            </button>
          </div>
        )}
      </div>
    );
  };

  if (loading) return <p>Loading...</p>;

  return (
    <>
      <Header />
      <div className="search-results">
        <h2>Search Results for {rawQuery || 'your query'}</h2>

        {(isBroadSearch || wantsHotels) &&
          renderSection('Hotels', results.hotels, HotelCardPublic, 'hotel', 'hotels')}

        {(isBroadSearch || wantsShortlets) &&
          renderSection('Shortlets', results.shortlets, ShortletCardPublic, 'shortlet', 'shortlets')}

        {(isBroadSearch || wantsEventCenters) &&
          renderSection('Event Centers', results.eventcenters, EventCenterCardPublic, 'eventCenter', 'eventcenters')}

        {(isBroadSearch || wantsRestaurants) &&
          renderSection('Restaurants', results.restaurants, RestaurantCardPublic, 'restaurant', 'restaurants')}

        {(isBroadSearch || wantsChops) &&
          renderSection('Chops', results.chops, ChopsCardPublic, 'chop', 'chops')}

        {(isBroadSearch || wantsGifts) &&
          renderSection('Gifts', results.gifts, GiftCardPublic, 'gift', 'gifts')}

        {Object.values(results).every((list) => (list || []).length === 0) && (
          <p className="text-gray-500">No results found.</p>
        )}
      </div>
      <MainFooter />
    </>
  );
};

export default SearchResultsPage;
