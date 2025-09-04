import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import AddBlogModal from './AddBlogModal';
import EditBlogModal from '../components/EditBlogModal';
import DeleteBlogModal from '../components/DeleteBlogModal';
import './ManageBlogs.css';

const ManageBlogs = () => {
  const [blogs, setBlogs] = useState([]);
  const [selectedBlog, setSelectedBlog] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchBlogs = async () => {
    try {
      const { data } = await axios.get('/api/blogs');
      setBlogs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch blogs:', error);
    }
  };

  useEffect(() => {
    fetchBlogs();
  }, []);

  const handleEditClick = (blog) => {
    setSelectedBlog(blog);
    setShowEditModal(true);
  };

  const handleDeleteClick = (blog) => {
    setSelectedBlog(blog);
    setShowDeleteModal(true);
  };

  const handleAddClick = () => setShowAddModal(true);

  const handleUpdate = () => {
    setShowEditModal(false);
    setShowDeleteModal(false);
    setShowAddModal(false);
    fetchBlogs();
  };

  return (
    <div className="manage-blogs">
      <button className="add-blog-btn" onClick={handleAddClick}>+ Add Blog</button>

      <div className="admin-blog-grid">
        {blogs.map((blog) => (
          <div className="admin-blog-card" key={blog._id}>
            {blog.image?.[0] && (
              <img src={blog.image[0]} alt={blog.title} className="blog-image" />
            )}

            <h4 className="blog-title">{blog.title}</h4>

            <div
              className="blog-snippet"
              dangerouslySetInnerHTML={{
                __html: blog.snippet || (blog.content ? `${blog.content.slice(0, 120)}…` : '')
              }}
            />

            <button className="read-more-btn">Read More</button>

            <div className="admin-blog-actions">
              <button className="btn btn-primary" onClick={() => handleEditClick(blog)}>Edit</button>
              <button className="btn btn-danger" onClick={() => handleDeleteClick(blog)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {showEditModal && selectedBlog && (
        <EditBlogModal
          blog={selectedBlog}
          onClose={() => setShowEditModal(false)}
          onUpdate={handleUpdate}
        />
      )}

      {showDeleteModal && selectedBlog && (
        <DeleteBlogModal
          blogId={selectedBlog._id}
          onCancel={() => setShowDeleteModal(false)}
          onDeleted={handleUpdate}
        />
      )}

      {showAddModal && (
        <AddBlogModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleUpdate}
        />
      )}
    </div>
  );
};

export default ManageBlogs;
