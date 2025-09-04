// ✅ src/pages/BlogPage.js
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import './BlogPage.css';

const BlogPage = () => {
  const { blogId } = useParams();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBlog = async () => {
      try {
        const res = await axios.get(`/api/blogs/${blogId}`);
        setBlog(res.data);
      } catch (err) {
        console.error('❌ Failed to load blog:', err);
        setError('Failed to load blog');
      } finally {
        setLoading(false);
      }
    };

    fetchBlog();
  }, [blogId]);

  return (
    <>
      <Header />
      <div className="blog-page">
        {loading && <p>Loading...</p>}
        {error && <p className="error">{error}</p>}

        {blog && (
          <div className="blog-detail">
            <h2>{blog.title}</h2>
            <p className="date">{new Date(blog.createdAt).toDateString()}</p>
            <div
              className="content"
              dangerouslySetInnerHTML={{ __html: blog.content }}
            />
          </div>
        )}
      </div>
      <MainFooter />
    </>
  );
};

export default BlogPage;
