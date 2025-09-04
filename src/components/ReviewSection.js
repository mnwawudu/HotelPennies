// ✅ src/components/ReviewSection.js
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from '../utils/axiosConfig';
import './ReviewSection.css';

const ReviewModal = ({ onClose, onSubmit, newReview, handleChange, refLabel }) =>
  ReactDOM.createPortal(
    <div className="review-modal-overlay">
      <div className="review-modal-content">
        <button className="close-modal-btn" onClick={onClose}>×</button>
        <h3>Drop Your Review</h3>
        <form className="review-form" onSubmit={onSubmit}>
          <label>
            Rating:
            <select name="rating" value={newReview.rating} onChange={handleChange} required>
              <option value="">Select</option>
              {[1, 2, 3, 4, 5].map((num) => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </label>

          <label>
            Comment:
            <textarea
              name="comment"
              value={newReview.comment}
              onChange={handleChange}
              rows="3"
              required
            />
          </label>

          {/* Optional reference to satisfy backend validators for non-room flows */}
          <label>
            {refLabel} <span style={{ opacity: 0.6 }}>(optional)</span>
            <input
              type="text"
              name="reference"
              value={newReview.reference}
              onChange={handleChange}
              placeholder="e.g. BK-12345 / ORD-98765 / RSV-4567"
            />
          </label>

          <button className="submit-btn" type="submit">Submit Review</button>
        </form>
      </div>
    </div>,
    document.body
  );

// ---- Type normalization ----
// Singular tokens the POST route expects:
const toSingular = (type) => {
  const t = String(type || '').toLowerCase().trim();
  if (['tour-guides', 'tourguide', 'tour-guide'].includes(t)) return 'tourguide';
  if (['eventcenters', 'event-center', 'eventcenters'].includes(t)) return 'eventcenter';
  if (['cruises', 'city-cruise', 'cruise'].includes(t)) return 'citycruise';
  if (['chops', 'chop'].includes(t)) return 'chop';
  if (t.endsWith('s')) return t.slice(0, -1);
  return t;
};

// Plural collection used by your detail GET endpoints:
const toPlural = (type) => {
  const map = {
    gift: 'gifts',
    chop: 'chops',
    tourguide: 'tour-guides',
    hotel: 'hotels',
    shortlet: 'shortlets',
    restaurant: 'restaurants',
    eventcenter: 'eventcenters',
    citycruise: 'cruises',
  };
  return map[toSingular(type)] || (String(type || '').endsWith('s') ? type : `${type}s`);
};

// Which reference field name to send for each type
const refKeyFor = (singularType) => {
  switch (singularType) {
    case 'hotel':
    case 'shortlet':
      return 'bookingId';
    case 'restaurant':
    case 'eventcenter':
    case 'tourguide':
    case 'citycruise':
      return 'reservationId';
    case 'gift':
    case 'chop':
      return 'orderId';
    default:
      return null;
  }
};

const refLabelFor = (singularType) => {
  switch (singularType) {
    case 'hotel':
    case 'shortlet':
      return 'Booking Reference';
    case 'restaurant':
    case 'eventcenter':
    case 'tourguide':
    case 'citycruise':
      return 'Reservation Reference';
    case 'gift':
    case 'chop':
      return 'Order Reference';
    default:
      return 'Reference';
  }
};

const ReviewSection = ({ itemId, type = 'hotel' }) => {
  const [reviews, setReviews] = useState([]);
  const [newReview, setNewReview] = useState({ rating: '', comment: '', reference: '' });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [averageRating, setAverageRating] = useState(null);

  const singularType = toSingular(type);
  const pluralType = toPlural(type);
  const detailEndpoint = `/api/${pluralType}/public/${itemId}`;
  const refKey = refKeyFor(singularType);
  const refLabel = refLabelFor(singularType);

  useEffect(() => {
    if (!itemId || !pluralType) return;
    (async () => {
      try {
        const res = await axios.get(detailEndpoint);
        const reviewData = res?.data?.reviews || [];
        setReviews(reviewData);
        if (reviewData.length > 0) {
          const avg = (
            reviewData.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviewData.length
          ).toFixed(1);
          setAverageRating(avg);
        } else {
          setAverageRating(null);
        }
      } catch (err) {
        console.error('❌ Failed to fetch reviews:', err);
        setReviews([]);
        setAverageRating(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [itemId, pluralType, detailEndpoint]);

  const handleChange = (e) => {
    setNewReview({ ...newReview, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newReview.rating || !newReview.comment) return;

    // Explicitly require a USER token to review
    const userToken =
      localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
    const vendorToken =
      localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');

    if (!userToken) {
      if (vendorToken) {
        alert('You are signed in as a vendor. Switch to a user account to leave a review.');
      } else {
        alert('Please log in to drop a review.');
      }
      return;
    }

    try {
      // Build payload with common fields + optional reference (if user provided)
      const payload = {
        itemType: singularType,
        itemId,
        rating: parseInt(newReview.rating, 10),
        comment: String(newReview.comment || '').trim(),
      };
      const refVal = String(newReview.reference || '').trim();
      if (refKey && refVal) payload[refKey] = refVal;

      const res = await axios.post(
        `/api/reviews/${singularType}/${itemId}`,
        payload,
        { headers: { Authorization: `Bearer ${userToken}` } }
      );

      const created = res?.data;
      const next = created ? [created, ...reviews] : reviews;
      setReviews(next);
      if (next.length > 0) {
        const avg = (
          next.reduce((sum, r) => sum + Number(r.rating || 0), 0) / next.length
        ).toFixed(1);
        setAverageRating(avg);
      }

      setNewReview({ rating: '', comment: '', reference: '' });
      setSuccessMessage('✅ Review submitted successfully!');
      setShowForm(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      const serverMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (typeof err?.response?.data === 'string' ? err.response.data : '') ||
        '❌ Failed to submit review. Please try again.';
      console.error('❌ Failed to submit review:', err?.response || err);
      alert(serverMsg);
    }
  };

  const handleDropReviewClick = () => {
    const userToken =
      localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
    const vendorToken =
      localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');

    if (!userToken) {
      if (vendorToken) {
        alert('You are signed in as a vendor. Switch to a user account to leave a review.');
      } else {
        alert('Please log in to drop a review.');
      }
      return;
    }
    setShowForm(true);
  };

  return (
    <div className="review-section">
      <h3 className="review-section-title">
        Guest Reviews {averageRating && <span className="average-rating">⭐ {averageRating}</span>}
      </h3>

      {loading ? (
        <p>Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <p style={{ fontSize: '0.9rem', color: '#777' }}>No reviews yet.</p>
      ) : (
        <ul className="review-list">
          {reviews.map((review, index) => (
            <li key={index} className="review-item">
              <strong>{review.userName || 'Anonymous'}:</strong> ⭐{review.rating}
              <br />
              <span>{review.comment}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="drop-review">
        <button className="navy-button" onClick={handleDropReviewClick}>
          Drop Your Review
        </button>
      </div>

      {showForm && (
        <ReviewModal
          onClose={() => setShowForm(false)}
          onSubmit={handleSubmit}
          newReview={newReview}
          handleChange={handleChange}
          refLabel={refLabel}
        />
      )}

      {successMessage && <p className="success-text">{successMessage}</p>}
    </div>
  );
};

export default ReviewSection;
