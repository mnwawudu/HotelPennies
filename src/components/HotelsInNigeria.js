// src/components/HotelsInNigeria.js
import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import HotelCardPublic from './HotelCardPublic';
import './HotelsInNigeria.css';

const EXACT_COUNT = 8;

function scoreHotel(h) {
  // Safe defaults
  const avg   = Number(h.avgRating ?? 0);
  const rcnt  = Number(h.ratingCount ?? 0);
  const book  = Number(h.bookingCount ?? 0);
  const click = Number(h.clickCount ?? 0);
  const createdAt = h.createdAt ? new Date(h.createdAt) : new Date(0);

  // Bayesian rating (matches backend constants)
  const priorMean = 3.9;
  const priorN = 20;
  const bayesAvg = (priorMean * priorN + avg * rcnt) / (priorN + rcnt || 1);

  const volFactor = Math.min(1, rcnt / 50);
  const ratingScore = (bayesAvg / 5) * (0.6 + 0.4 * volFactor);

  const bookScore  = Math.min(1, Math.log(1 + book)  / Math.log(51));
  const clickScore = Math.min(1, Math.log(1 + click) / Math.log(201));

  const ninetyDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 90;
  const recency = createdAt.getTime() >= ninetyDaysAgo ? 1 : 0;

  return 0.45 * ratingScore + 0.40 * bookScore + 0.10 * clickScore + 0.05 * recency;
}

const HotelsInNigeria = () => {
  const [rows, setRows] = useState([]);
  const [ready, setReady] = useState(false); // controls rendering

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // 1) Preferred endpoint
        try {
          const res = await axios.get('/api/hotels/public/top?limit=8');
          const apiRows = Array.isArray(res.data?.rows) ? res.data.rows : Array.isArray(res.data) ? res.data : [];
          if (alive && apiRows.length === EXACT_COUNT) {
            setRows(apiRows);
            setReady(true);
            return;
          }
        } catch (_) {
          // fall through to client-side fallback
        }

        // 2) Fallback: use all-public and compute top locally
        try {
          const resAll = await axios.get('/api/hotels/all-public');
          const all = Array.isArray(resAll.data) ? resAll.data : [];
          const topEight = all
            .map(h => ({ h, s: scoreHotel(h) }))
            .sort((a, b) => b.s - a.s)
            .slice(0, EXACT_COUNT)
            .map(x => x.h);

          if (alive && topEight.length === EXACT_COUNT) {
            setRows(topEight);
            setReady(true);
            return;
          }
        } catch (_) {
          // ignore; we’ll hide the block if still not complete
        }

        // If neither path produced 8, hide block
        if (alive) {
          setRows([]);
          setReady(true);
        }
      } catch (e) {
        if (alive) {
          console.error('❌ Top hotels load failed:', e);
          setRows([]);
          setReady(true);
        }
      }
    })();

    return () => { alive = false; };
  }, []);

  // Don’t render anything until we’ve decided, and only show when we have all 8 cards
  if (!ready || rows.length !== EXACT_COUNT) return null;

  return (
    <section className="hotels-ng-section">
      {/* Title intentionally hidden to keep section subtle */}
      {/* <h3>Top Hotels in Nigeria</h3> */}

      <div className="hotels-ng-grid">
        {rows.map(h => (
          <div key={h._id} className="hotels-ng-item">
            <HotelCardPublic hotel={h} />
          </div>
        ))}
      </div>
    </section>
  );
};

export default HotelsInNigeria;
