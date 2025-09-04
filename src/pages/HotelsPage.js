// ✅ src/pages/HotelsPage.js
import React, { useEffect, useMemo, useState } from 'react';
import axios from '../utils/axiosConfig';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import HotelCardPublic from '../components/HotelCardPublic';
import './HotelsPage.css';

// ---------- robust field readers ----------
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const firstNum = (obj, keys) => {
  for (const k of keys) {
    const parts = Array.isArray(k) ? k : String(k).split('.');
    let cur = obj;
    for (const p of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
      else { cur = undefined; break; }
    }
    if (cur !== undefined && cur !== null) {
      const n = num(cur);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
};

// Ratings (0..5) – try lots of shapes
const readRating = (h) => firstNum(h, [
  'rating', 'ratingAvg', 'avgRating', 'ratingAverage', 'averageRating',
  'stars', 'starRating', 'ratings.average', 'metrics.rating', 'metrics.ratingAvg',
  'reviewsAverage', 'reviewAverage', 'ratingValue'
]);

// Review count for rating confidence
const readReviewCount = (h) => firstNum(h, [
  'reviewCount', 'reviewsCount', 'ratings.count', 'metrics.reviewCount'
]) || (Array.isArray(h?.reviews) ? h.reviews.length : 0);

// Bookings volume
const readBookings = (h) => firstNum(h, [
  'bookingCount', 'bookingsCount', 'totalBookings', 'successfulBookings',
  'reservationsCount', 'orders', 'ordersCount', 'metrics.bookings'
]);

// Clicks & Views
const readClicks = (h) => firstNum(h, ['clicks', 'clickCount', 'clicksCount', 'totalClicks', 'metrics.clicks']);
const readViews  = (h) => firstNum(h, ['views', 'viewCount', 'viewsCount', 'impressions', 'impressionCount', 'totalViews', 'metrics.views']);

// CTR (0..1) – accept %, derive if missing
const readCTR = (h) => {
  let ctr = firstNum(h, ['ctr', 'clickThroughRate', 'ctrPercent', 'metrics.ctr', 'metrics.ctrPercent']);
  if (ctr > 1) ctr = ctr / 100;                               // if 23 => 0.23
  if (!ctr) {
    const clicks = readClicks(h);
    const views  = readViews(h);
    if (clicks || views) ctr = clicks / (views > 0 ? views : (clicks || 1));
  }
  if (!Number.isFinite(ctr)) ctr = 0;
  return Math.max(0, Math.min(ctr, 1));
};

// Detect “has rooms”
const hasRooms = (h) => {
  // explicit booleans
  if (h?.hasRooms || h?.hasAvailableRooms || h?.roomsAvailable) return true;

  // explicit arrays
  if (Array.isArray(h?.rooms) && h.rooms.length) return true;
  if (Array.isArray(h?.roomTypes) && h.roomTypes.length) return true;

  // counts
  const count = firstNum(h, ['roomsCount', 'roomCount', 'totalRooms', 'availableRooms']);
  if (count > 0) return true;

  // price hints (typical for card lists when rooms exist)
  const minP = firstNum(h, ['minPrice', 'lowestPrice', 'startingPrice', 'fromPrice', 'priceFrom']);
  const maxP = firstNum(h, ['maxPrice', 'highestPrice', 'toPrice', 'priceTo']);
  if (minP > 0 || maxP > 0) return true;

  return false;
};

// Deterministic tiny tiebreaker so equal scores don’t look like “newest first”
const hashUnit = (str) => {
  if (!str) return 0;
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0) / 2 ** 32; // [0,1)
};

const HotelsPage = () => {
  const [hotels, setHotels] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    const fetchHotels = async () => {
      try {
        const res = await axios.get('/api/hotels/all-public');
        setHotels(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('❌ Failed to fetch hotels:', err);
        setError('❌ Failed to load hotels.');
      } finally {
        setLoading(false);
      }
    };
    fetchHotels();
  }, []);

  // Build score: Ratings (strong), Bookings (medium), CTR (light)
  const rankedHotels = useMemo(() => {
    if (!Array.isArray(hotels) || !hotels.length) return [];

    // Only filter by rooms if we can detect it from payload to avoid blank pages
    const canDetectRooms = hotels.some((h) => hasRooms(h));
    const pool = canDetectRooms ? hotels.filter((h) => hasRooms(h)) : hotels.slice();

    if (!pool.length) return [];

    // Precompute maxima for normalization (log1p to tame outliers)
    let maxBookings = 0;
    let maxReviews = 0;
    let maxViews = 0;
    pool.forEach((h) => {
      maxBookings = Math.max(maxBookings, readBookings(h));
      maxReviews  = Math.max(maxReviews,  readReviewCount(h));
      maxViews    = Math.max(maxViews,    readViews(h));
    });

    const ln = (x) => Math.log1p(x);
    const denomBookings = ln(maxBookings || 1);
    const denomReviews  = ln(maxReviews  || 1);
    const denomViews    = ln(maxViews    || 1);

    // Weights: emphasize rating; bookings next; ctr last
    const W_RATING   = 0.6;
    const W_BOOKINGS = 0.25;
    const W_CTR      = 0.15;

    const scored = pool.map((h) => {
      const rating   = readRating(h);        // 0..5
      const reviews  = readReviewCount(h);   // 0..n
      const bookings = readBookings(h);      // 0..n
      const ctr      = readCTR(h);           // 0..1
      const views    = readViews(h);

      // Rating normalized + confidence by review volume
      const ratingBase  = Math.max(0, Math.min(rating / 5, 1));
      const reviewBoost = denomReviews ? ln(reviews) / denomReviews : 0;
      const ratingScore = ratingBase * (0.65 + 0.35 * reviewBoost); // 0..1

      // Bookings normalized (log)
      const bookingsScore = denomBookings ? ln(bookings) / denomBookings : 0;

      // CTR confidence – small scale by traffic
      const trafficFactor = denomViews ? Math.min(1, (ln(views) / denomViews) || 0) : 0.3;
      const ctrScore = ctr * (0.5 + 0.5 * trafficFactor);

      // Compose score
      let score =
        W_RATING * ratingScore +
        W_BOOKINGS * bookingsScore +
        W_CTR * ctrScore;

      // Deterministic tiebreaker (0..0.02)
      score += hashUnit(h?._id || h?.id || h?.slug || h?.name) * 0.02;

      return { hotel: h, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.hotel);
  }, [hotels]);

  // Pagination runs on ranked list
  const totalPages = Math.max(1, Math.ceil(rankedHotels.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentHotels = rankedHotels.slice(startIndex, endIndex);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo(0, 0);
    }
  };

  return (
    <>
      <Header />
      <div className="hotel-page">
        <h2 style={{ marginTop: '2rem' }}>Available Hotels</h2>
        {error && <p className="error-msg">{error}</p>}

        {loading ? (
          <p>Loading...</p>
        ) : currentHotels.length === 0 ? (
          <p>No hotels found.</p>
        ) : (
          <>
            <div className="hotel-list">
              {currentHotels.map((hotel) => (
                <HotelCardPublic key={hotel._id || hotel.id} hotel={hotel} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination-controls">
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
                  Prev
                </button>
                <span>Page {currentPage} of {totalPages}</span>
                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <MainFooter />
    </>
  );
};

export default HotelsPage;
