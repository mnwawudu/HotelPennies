// ✅ src/pages/ShortletsPage.js
import React, { useEffect, useMemo, useState } from 'react';
import axios from '../utils/axiosConfig';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import ShortletCardPublic from '../components/ShortletCardPublic';
import './ShortletsPage.css';

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

// Robust readers (handle many payload shapes)
const readRating = (s) => firstNum(s, [
  'rating', 'ratingAvg', 'avgRating', 'ratingAverage', 'averageRating',
  'stars', 'starRating', 'ratings.average', 'metrics.rating', 'metrics.ratingAvg',
  'reviewsAverage', 'reviewAverage', 'ratingValue'
]);

const readBookings = (s) => firstNum(s, [
  'bookingCount', 'bookingsCount', 'totalBookings', 'successfulBookings',
  'reservationsCount', 'orders', 'ordersCount', 'metrics.bookings'
]);

const readClicks = (s) => firstNum(s, [
  'clicks', 'clickCount', 'clicksCount', 'totalClicks', 'metrics.clicks'
]);
const readViews = (s) => firstNum(s, [
  'views', 'viewCount', 'viewsCount', 'impressions', 'impressionCount', 'totalViews', 'metrics.views'
]);

const readCTR = (s) => {
  let ctr = firstNum(s, ['ctr', 'clickThroughRate', 'ctrPercent', 'metrics.ctr', 'metrics.ctrPercent']);
  if (ctr > 1) ctr = ctr / 100; // accept percentages
  if (!ctr) {
    const clicks = readClicks(s);
    const views  = readViews(s);
    if (clicks || views) ctr = clicks / (views > 0 ? views : (clicks || 1));
  }
  if (!Number.isFinite(ctr)) ctr = 0;
  return Math.max(0, Math.min(ctr, 1));
};

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

const ShortletsPage = () => {
  const [shortlets, setShortlets] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const shortletsPerPage = 12; // ✅ keep 12 per page

  useEffect(() => {
    const fetchShortlets = async () => {
      try {
        // ✅ your original endpoint
        const res = await axios.get('/api/shortlets/public');
        setShortlets(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setError('❌ Failed to load shortlets.');
      } finally {
        setLoading(false);
      }
    };
    fetchShortlets();
  }, []);

  // STRICT priority sort: rating ↓ → bookings ↓ → CTR ↓ → views ↓ → createdAt ↓ → stable hash
  const sortedShortlets = useMemo(() => {
    const arr = Array.isArray(shortlets) ? shortlets.slice() : [];
    arr.sort((a, b) => {
      const ra = readRating(a), rb = readRating(b);
      if (rb !== ra) return rb - ra;

      const ba = readBookings(a), bb = readBookings(b);
      if (bb !== ba) return bb - ba;

      const ctra = readCTR(a), ctrb = readCTR(b);
      if (ctrb !== ctra) return ctrb - ctra;

      const va = readViews(a), vb = readViews(b);
      if (vb !== va) return vb - va;

      const da = new Date(a?.createdAt || 0).getTime();
      const db = new Date(b?.createdAt || 0).getTime();
      if (db !== da) return db - da;

      const ha = hashUnit(a?._id || a?.id || a?.slug || a?.title);
      const hb = hashUnit(b?._id || b?.id || b?.slug || b?.title);
      return hb - ha;
    });
    return arr;
  }, [shortlets]);

  // Get current shortlets (paginate AFTER sorting)
  const indexOfLast = currentPage * shortletsPerPage;
  const indexOfFirst = indexOfLast - shortletsPerPage;
  const currentShortlets = sortedShortlets.slice(indexOfFirst, indexOfLast);

  // Change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const totalPages = Math.ceil(sortedShortlets.length / shortletsPerPage);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <>
      <Header />
      <div className="shortlets-page">
        <h2 style={{ marginTop: '2rem' }}>Available Shortlets</h2>
        {error && <p className="error-msg">{error}</p>}

        <div className="shortlet-list" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {loading ? (
            <p>Loading...</p>
          ) : currentShortlets.length === 0 ? (
            <p>No shortlets found.</p>
          ) : (
            currentShortlets.map(shortlet => (
              <ShortletCardPublic key={shortlet._id || shortlet.id} shortlet={shortlet} />
            ))
          )}
        </div>

        {/* Pagination controls */}
        {!loading && sortedShortlets.length > shortletsPerPage && (
          <div className="pagination" style={{ marginTop: '2rem', textAlign: 'center' }}>
            {pageNumbers.map(number => (
              <button
                key={number}
                onClick={() => paginate(number)}
                className={`pagination-btn ${currentPage === number ? 'active' : ''}`}
                style={{ margin: '0 5px', padding: '6px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                {number}
              </button>
            ))}
          </div>
        )}
      </div>
      <MainFooter />
    </>
  );
};

export default ShortletsPage;
