import React from 'react';
import './BlogCard.css';

const stripHtml = (html) => html?.replace(/<[^>]+>/g, '') || '';

const BlogCard = ({
  blog,
  showActions = false,
  buttonLabel = 'Read More',
  hideReadButton = false,
  onEdit,
  onUpload,
  onDelete
}) => {
  return (
    <div className="blog-card">
      <img
        src={blog.image?.[0] || 'https://via.placeholder.com/400x200?text=No+Image'}
        alt={blog.title}
        className="blog-image"
      />
      <h4 className="blog-title">{blog.title}</h4>
      <p className="blog-snippet">
        {blog.snippet
          ? blog.snippet
          : stripHtml(blog.content)?.slice(0, 100) + '...'}
      </p>

      {!hideReadButton && (
        <button className="read-btn">{buttonLabel}</button>
      )}

      {showActions && (
        <div className="blog-actions">
          <button className="small-btn navy" onClick={() => onEdit(blog)}>Edit</button>
          <button className="small-btn gray" onClick={() => onUpload(blog)}>Upload</button>
          <button className="small-btn red" onClick={() => onDelete(blog)}>Delete</button>
        </div>
      )}
    </div>
  );
};

export default BlogCard;
