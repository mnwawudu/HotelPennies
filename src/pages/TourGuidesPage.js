import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import TourGuideCardPublic from '../components/TourGuideCardPublic';
import './TourGuidesPage.css';

const TourGuidesPage = () => {
  const [guides, setGuides] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const guidesPerPage = 12;

  useEffect(() => {
    const fetchGuides = async () => {
      try {
        const res = await axios.get('/api/tour-guides/all-public');
        setGuides(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch tour guides:', err);
        setError('❌ Failed to load tour guides.');
      } finally {
        setLoading(false);
      }
    };

    fetchGuides();
  }, []);

  // ✅ Pagination logic
  const indexOfLast = currentPage * guidesPerPage;
  const indexOfFirst = indexOfLast - guidesPerPage;
  const currentGuides = guides.slice(indexOfFirst, indexOfLast);

  const totalPages = Math.ceil(guides.length / guidesPerPage);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
  const paginate = (number) => setCurrentPage(number);

  return (
    <>
      <Header />
      <div className="tour-guides-page">
        <h2 style={{ margin: '2rem 0 1rem' }}>Available Tour Guides</h2>
        {error && <p className="error-msg">{error}</p>}

        <div className="tour-guides-grid" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {loading ? (
            <p>Loading...</p>
          ) : currentGuides.length === 0 ? (
            <p>No tour guides found.</p>
          ) : (
            currentGuides.map((guide) => (
              <TourGuideCardPublic key={guide._id} guide={guide} />
            ))
          )}
        </div>

        {/* ✅ Pagination controls */}
        {!loading && guides.length > guidesPerPage && (
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

export default TourGuidesPage;
