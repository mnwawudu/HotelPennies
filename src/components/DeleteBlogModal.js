import React from 'react';
import './DeleteBlogModal.css';
import axios from '../utils/axiosConfig';

const DeleteBlogModal = ({ blog, blogId, onDeleted, onCancel }) => {
  const id = blog?._id || blogId;
  const title = blog?.title || '';
  if (!id) return null;

  const handleConfirmDelete = async () => {
    try {
      await axios.delete(`/api/blogs/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken')}`,
        },
      });
      onDeleted?.(id);
    } catch (err) {
      console.error('❌ Failed to delete blog:', err);
      alert(err?.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div className="delete-modal-overlay">
      <div className="delete-modal-content">
        <h3>Confirm Delete</h3>
        <p>
          Are you sure you want to delete{title ? ' the blog titled:' : ' this blog?'}
          {title && (
            <>
              <br />
              <strong>"{title}"</strong>
            </>
          )}
        </p>
        <div className="delete-modal-buttons">
          <button className="red-btn" onClick={handleConfirmDelete}>Yes, Delete</button>
          <button className="navy-btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default DeleteBlogModal;
