// 📁 src/components/ReviewForm.js
import React, { useState } from 'react';
import axios from 'axios';

const ReviewForm = ({ submitUrl, onSubmitted }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [useAnonymous, setUseAnonymous] = useState(true);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
      await axios.post(
        submitUrl,
        { rating, comment, userName: useAnonymous ? 'Anonymous' : userName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRating(5);
      setComment('');
      setUserName('');
      setUseAnonymous(true);
      onSubmitted();
    } catch (err) {
      alert('Failed to submit review.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-2">
      <label className="block font-medium">Your Rating:</label>
      <select
        value={rating}
        onChange={(e) => setRating(Number(e.target.value))}
        className="border p-2 rounded w-24"
      >
        {[5, 4, 3, 2, 1].map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>

      <label className="block font-medium mt-3">Your Review:</label>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        required
        className="w-full border p-2 rounded"
        rows="3"
      ></textarea>

      <div className="flex items-center gap-2 mt-2">
        <input
          type="checkbox"
          checked={useAnonymous}
          onChange={() => setUseAnonymous(!useAnonymous)}
        />
        <label>Submit as Anonymous</label>
      </div>

      {!useAnonymous && (
        <input
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="Your Name"
          className="border p-2 rounded w-full"
          required
        />
      )}

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        {loading ? 'Submitting...' : 'Submit Review'}
      </button>
    </form>
  );
};

export default ReviewForm;

// 📁 src/components/ReviewList.js
import React from 'react';

const ReviewList = ({ reviews }) => {
  if (!reviews || reviews.length === 0) {
    return <p>No reviews yet.</p>;
  }

  return (
    <ul className="space-y-3 mt-4">
      {reviews.map((rev, i) => (
        <li key={i} className="border p-3 rounded">
          <p className="font-semibold">⭐ {rev.rating}/5 — {rev.userName || 'Anonymous'}</p>
          <p>{rev.comment}</p>
          <small className="text-gray-500">{new Date(rev.createdAt).toLocaleString()}</small>
        </li>
      ))}
    </ul>
  );
};

export default ReviewList;

// 📁 src/components/ReviewSection.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import ReviewForm from './ReviewForm';
import ReviewList from './ReviewList';

const ReviewSection = ({ fetchUrl, submitUrl }) => {
  const [reviews, setReviews] = useState([]);

  const fetchReviews = async () => {
    try {
      const res = await axios.get(fetchUrl);
      setReviews(res.data.reverse());
    } catch (err) {
      console.error('Error fetching reviews:', err);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [fetchUrl]);

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-2">Reviews</h3>
      <ReviewList reviews={reviews} />
      <ReviewForm submitUrl={submitUrl} onSubmitted={fetchReviews} />
    </div>
  );
};

export default ReviewSection;
