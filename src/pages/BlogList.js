// ✅ src/pages/BlogList.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import './BlogList.css';

const stripPreviewHtml = (html = '') =>
  String(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '');

// Try to find a cover image for the card:
// 1) blog.image[0] (or string)
// 2) first <img src="..."> inside content
const getCoverImage = (blog) => {
  const direct =
    Array.isArray(blog?.image) ? blog.image[0] :
    blog?.image ? String(blog.image) : '';

  if (direct) return direct;

  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(String(blog?.content || ''));
  return m ? m[1] : '';
};

const BlogList = () => {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBlogs = async () => {
      try {
        const res = await axios.get('/api/blogs');
        setBlogs(res.data || []);
      } catch (err) {
        console.error('Failed to fetch blog posts', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBlogs();
  }, []);

  return (
    <>
      <Header />
      <div className="blog-list-page">
        <h1 className="blog-list-title">Latest Blog Posts</h1>

        {loading ? (
          <p>Loading blogs...</p>
        ) : (
          <div className="blog-list-container">
            {blogs.map((blog) => {
              const cover = getCoverImage(blog);
              const previewHtml = stripPreviewHtml(blog?.snippet || blog?.content || '');
              return (
                <article className="blog-card" key={blog._id}>
                  {cover && (
                    <Link to={`/blogs/${blog._id}`} className="cover-link" aria-label={`Open ${blog.title}`}>
                      <img className="blog-card-cover" src={cover} alt={blog.title} />
                    </Link>
                  )}

                  <div className="blog-card-body">
                    <h2 className="blog-card-title">
                      <Link to={`/blogs/${blog._id}`}>{blog.title}</Link>
                    </h2>

                    <div
                      className="blog-card-preview"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />

                    <div className="blog-card-footer">
                      <time className="blog-card-date">
                        {blog?.createdAt ? new Date(blog.createdAt).toLocaleDateString() : ''}
                      </time>
                      <Link to={`/blogs/${blog._id}`} className="read-more-link">
                        Read More
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      <MainFooter />
    </>
  );
};

export default BlogList;
