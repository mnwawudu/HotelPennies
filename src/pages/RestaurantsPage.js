import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import RestaurantCardPublic from '../components/RestaurantCardPublic';
import './RestaurantsPage.css';

const RestaurantsPage = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const res = await axios.get('/api/restaurants');
        setRestaurants(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch restaurants:', err);
        setError('❌ Failed to load restaurants.');
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  const totalPages = Math.ceil(restaurants.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRestaurants = restaurants.slice(startIndex, endIndex);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo(0, 0);
    }
  };

  return (
    <>
      <Header />
      <div className="restaurant-page">
        <h2 style={{ marginTop: '2rem' }}>Available Restaurants</h2>
        {error && <p className="error-msg">{error}</p>}

        {loading ? (
          <p>Loading...</p>
        ) : currentRestaurants.length === 0 ? (
          <p>No restaurants found.</p>
        ) : (
          <>
            <div className="restaurant-list">
              {currentRestaurants.map((restaurant) => (
                <RestaurantCardPublic key={restaurant._id} restaurant={restaurant} />
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

export default RestaurantsPage;
