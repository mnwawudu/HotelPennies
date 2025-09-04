// ✅ src/pages/BlogPost.js
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import './BlogPost.css';

const BlogPost = () => {
  const { id } = useParams();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBlog = async () => {
      try {
        const res = await axios.get(`/api/blogs/${id}`);
        setBlog(res.data);
      } catch (err) {
        console.error('Failed to load blog post:', err);
        setError('Unable to load blog post.');
      } finally {
        setLoading(false);
      }
    };
    fetchBlog();
  }, [id]);

  if (loading) return <p>Loading blog post...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div className="blog-post-container">
      <h1>{blog.title}</h1>
      <p className="blog-date">{new Date(blog.createdAt).toLocaleDateString()}</p>
      <div className="blog-content">
        {blog.content?.split('\n').map((line, idx) => (
          <p key={idx}>{line}</p>
        ))}
      </div>
    </div>
  );
};

export default BlogPost;
