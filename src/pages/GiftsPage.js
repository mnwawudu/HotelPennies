import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import GiftCardPublic from '../components/GiftCardPublic';
import './GiftsPage.css';

const GiftsPage = () => {
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    const fetchGifts = async () => {
      try {
        const res = await axios.get('/api/gifts/public');
        setGifts(res.data);
      } catch (error) {
        console.error('❌ Failed to fetch gifts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGifts();
  }, []);

  const totalPages = Math.ceil(gifts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentGifts = gifts.slice(startIndex, endIndex);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo(0, 0); // scroll to top on page change
    }
  };

  return (
    <>
      <Header />
      <div className="gifts-page-container">
        <h1 className="gifts-page-title">Thoughtful Gift Packs</h1>

        {loading ? (
          <p className="text-center">Loading...</p>
        ) : currentGifts.length === 0 ? (
          <p className="text-center text-gray-500">No gifts available.</p>
        ) : (
          <>
            <div className="gifts-grid">
              {currentGifts.map((gift) => (
                <GiftCardPublic key={gift._id} gift={gift} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination-controls">
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
                  Prev
                </button>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
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

export default GiftsPage;
