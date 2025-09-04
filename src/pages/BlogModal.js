// ✅ AddBlogModal.js and EditBlogModal.js using TinyMCE with image upload, full-width, and caption support
import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import { Editor } from '@tinymce/tinymce-react';
import '../components/EditBlogModal.css';

const BlogModal = ({ onClose, onSubmit, existingBlog }) => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    snippet: '',
    author: '',
    image: []
  });
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    if (existingBlog) {
      setFormData({
        title: existingBlog.title || '',
        content: existingBlog.content || '',
        snippet: existingBlog.snippet || '',
        author: existingBlog.author || '',
        image: existingBlog.image || []
      });
    }
  }, [existingBlog]);

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let imageUrls = [...formData.image];

      if (selectedFile) {
        const imageData = new FormData();
        imageData.append('image', selectedFile);

        const uploadRes = await axios.post('/api/blogs/upload', imageData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken')}`,
          },
        });

        if (uploadRes.data.url) {
          imageUrls = [uploadRes.data.url];
        }
      }

      const blogPayload = {
        ...formData,
        image: imageUrls,
      };

      if (existingBlog) {
        await axios.put(`/api/blogs/${existingBlog._id}`, blogPayload, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken')}`,
          },
        });
      } else {
        await axios.post('/api/blogs', blogPayload, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken')}`,
          },
        });
      }

      onSubmit();
      onClose();
    } catch (err) {
      console.error('❌ Failed to submit blog:', err);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="edit-blog-modal">
        <button className="close-btn" onClick={onClose}>×</button>
        <h3>{existingBlog ? 'Edit Blog' : 'Add Blog'}</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Blog Title"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            required
          />

          <Editor
            apiKey="gjqj6xwr2m4ojs78p6aval77s56m215fa45ghex8nyir0ua4"
            value={formData.content}
            init={{
              height: 350,
              menubar: true,
              plugins: [
                'advlist autolink lists link image imagetools media charmap preview anchor',
                'searchreplace visualblocks code fullscreen',
                'insertdatetime table paste code help wordcount'
              ],
              toolbar:
                'undo redo | formatselect | bold italic underline | ' +
                'alignleft aligncenter alignright alignjustify | ' +
                'bullist numlist outdent indent | link image | removeformat | help',
              image_caption: true,
              image_dimensions: true,
              automatic_uploads: true,
              images_upload_handler: async (blobInfo, success, failure) => {
                try {
                  const data = new FormData();
                  data.append('image', blobInfo.blob());

                  const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');

                  const res = await axios.post('/api/blogs/upload', data, {
                    headers: {
                      'Content-Type': 'multipart/form-data',
                      Authorization: `Bearer ${token}`,
                    },
                  });

                  success(res.data.url);
                } catch (err) {
                  console.error('Upload error:', err);
                  failure('Upload failed');
                }
              },
              file_picker_types: 'image',
              file_picker_callback: (cb, value, meta) => {
                if (meta.filetype === 'image') {
                  const input = document.createElement('input');
                  input.setAttribute('type', 'file');
                  input.setAttribute('accept', 'image/*');
                  input.onchange = async () => {
                    const file = input.files[0];
                    const formData = new FormData();
                    formData.append('image', file);
                    try {
                      const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
                      const res = await axios.post('/api/blogs/upload', formData, {
                        headers: {
                          'Content-Type': 'multipart/form-data',
                          Authorization: `Bearer ${token}`,
                        },
                      });
                      cb(res.data.url, { title: file.name });
                    } catch (err) {
                      console.error('File picker upload failed', err);
                    }
                  };
                  input.click();
                }
              }
            }}
            onEditorChange={(content) => handleChange('content', content)}
          />

          <input
            type="text"
            placeholder="Optional Snippet"
            value={formData.snippet}
            onChange={(e) => handleChange('snippet', e.target.value)}
          />

          <input
            type="text"
            placeholder="Author"
            value={formData.author}
            onChange={(e) => handleChange('author', e.target.value)}
          />

       {formData.image.length > 0 && (
  <div className="image-preview-wrapper">
    <img
      src={formData.image[0]}
      alt="Blog cover"
      className="image-preview"
    />
    <button
      type="button"
      className="remove-image-btn"
      onClick={() => {
        setFormData({ ...formData, image: [] });
        setSelectedFile(null);
      }}
    >
      ×
    </button>
  </div>
)}

<label className="upload-label">Upload New Title Image</label>
<input type="file" accept="image/*" onChange={handleFileChange} />


          <button type="submit" className="navy-btn">{existingBlog ? 'Update Blog' : 'Create Blog'}</button>
        </form>
      </div>
    </div>
  );
};

export default BlogModal;
