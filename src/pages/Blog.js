// ✅ src/pages/Blog.js
import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import './Blog.css';

const Blog = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await axios.get('/api/blog');
        setPosts(res.data);
      } catch (err) {
        setError('Failed to load blog posts');
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

  return (
    <div className="blog-page">
      <h1>HotelPennies Blog</h1>
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      <div className="blog-list">
        {posts.map(post => (
          <div className="blog-card" key={post._id}>
            <h2>{post.title}</h2>
            <p className="snippet">{post.content.slice(0, 200)}...</p>
            <button className="read-more">Read More</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Blog;
