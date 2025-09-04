import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import './BlogSection.css';
import { useNavigate } from 'react-router-dom';

const BlogSection = () => {
  const [blogs, setBlogs] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBlogs = async () => {
      try {
        const res = await axios.get('/api/blogs');
        setBlogs(res.data.slice(0, 4)); // show latest 4
      } catch (err) {
        console.error('Error fetching blogs:', err);
      }
    };
    fetchBlogs();
  }, []);

  return (
    <div className="blog-section">
      <h2>Latest from Our Travel Blog</h2>
      <div className="blog-cards">
        {blogs.map((blog) => (
          <div className="blog-card" key={blog._id}>
            {blog.image?.[0] && <img src={blog.image[0]} alt={blog.title} />}
            <h4>{blog.title}</h4>
            <p>{blog.snippet || blog.content?.replace(/<[^>]+>/g, '').slice(0, 100) + '...'}</p>
            <button onClick={() => navigate(`/blogs/${blog._id}`)}>Read More</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BlogSection;
