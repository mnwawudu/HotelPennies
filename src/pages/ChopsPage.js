import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import ChopsCardPublic from '../components/ChopsCardPublic';
import './ChopsPage.css';

const ChopsPage = () => {
  const [chops, setChops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    const fetchChops = async () => {
      try {
        const res = await axios.get('/api/chops/public');
        console.log('📦 Fetched chops:', res.data);
        setChops(res.data);
      } catch (err) {
        console.error('❌ Error fetching chops:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChops();
  }, []);

  const totalPages = Math.ceil(chops.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentChops = chops.slice(startIndex, endIndex);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo(0, 0); // scroll to top on page change
    }
  };

  return (
    <>
      <Header />
      <div className="chops-page-container">
        <h1 className="chops-page-title">Order Your Favorite Chops</h1>

        {loading ? (
          <p className="text-center">Loading...</p>
        ) : currentChops.length === 0 ? (
          <p className="text-center text-gray-500">No chops available.</p>
        ) : (
          <>
            <div className="chops-grid">
              {currentChops.map((chop) => (
                <ChopsCardPublic key={chop._id} chop={chop} />
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

export default ChopsPage;
