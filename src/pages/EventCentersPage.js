import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import EventCenterCardPublic from '../components/EventCenterCardPublic';
import './EventCentersPage.css';

const EventCentersPage = () => {
  const [eventCenters, setEventCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ✅ Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    const fetchEventCenters = async () => {
      try {
        const res = await axios.get('/api/eventcenters/all-public');
        setEventCenters(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch event centers:', err);
        setError('❌ Failed to load event centers.');
      } finally {
        setLoading(false);
      }
    };

    fetchEventCenters();
  }, []);

  // ✅ Slice for current page
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentCenters = eventCenters.slice(indexOfFirst, indexOfLast);

  // ✅ Pagination logic
  const totalPages = Math.ceil(eventCenters.length / itemsPerPage);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <>
      <Header />
      <div className="event-centers-page">
        <h2 style={{ marginTop: '2rem' }}>Available Event Centers</h2>
        {error && <p className="error-msg">{error}</p>}

        <div className="event-centers-list" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {loading ? (
            <p>Loading...</p>
          ) : currentCenters.length === 0 ? (
            <p>No event centers found.</p>
          ) : (
            currentCenters.map((center) => (
              <EventCenterCardPublic key={center._id} eventCenter={center} />
            ))
          )}
        </div>

        {/* ✅ Pagination buttons */}
        {!loading && eventCenters.length > itemsPerPage && (
          <div className="pagination" style={{ marginTop: '2rem', textAlign: 'center' }}>
            {pageNumbers.map((number) => (
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

export default EventCentersPage;
