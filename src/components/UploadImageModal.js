import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import './UploadImageModal.css';

const UploadImageModal = ({ resource, itemId, onClose, onUploaded }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState([]);
  const [mainImage, setMainImage] = useState(null);

  const token = localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');

  const fetchImages = async () => {
    try {
      const res = await axios.get(`/api/${resource}/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setImages(res.data.images || []);
      setMainImage(res.data.mainImage || '');
    } catch (err) {
      console.error('❌ Failed to fetch item images:', err);
    }
  };

  useEffect(() => {
    if (itemId) fetchImages();
  }, [itemId]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const tooLarge = files.find(f => f.size > 3 * 1024 * 1024);
    if (tooLarge) {
      alert('❌ One or more files are too large (max 3MB)');
      return;
    }
    setSelectedFiles(files);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);

    const formData = new FormData();
    selectedFiles.forEach(file => formData.append('files', file));

    try {
      const res = await axios.post('/api/cloudinary/upload', formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const newUrls = res.data.urls;

      await axios.put(`/api/${resource}/${itemId}`, {
        $push: { images: { $each: newUrls } },
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSelectedFiles([]);
      fetchImages();
      alert('✅ Images uploaded successfully');
      if (onUploaded) onUploaded();
    } catch (err) {
      console.error('❌ Upload error:', err);
      alert('❌ Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSetMainImage = async (url) => {
    try {
      const res = await axios.put(`/api/${resource}/${itemId}`, { mainImage: url }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMainImage(url);
      setImages(res.data.images || []);
      alert('✅ Main image updated');
      if (onUploaded) onUploaded();
    } catch (err) {
      console.error('❌ Failed to set main image:', err);
      alert('❌ Failed to update main image');
    }
  };

  const handleDeleteImage = async (url) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this image?');
    if (!confirmDelete) return;

    try {
      await axios.put(`/api/${resource}/${itemId}`, {
        $pull: { images: url }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('✅ Image deleted');
      fetchImages();
      if (onUploaded) onUploaded();
    } catch (err) {
      console.error('❌ Delete failed:', err);
      alert('❌ Failed to delete image');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div></div>
          <button
            onClick={onClose}
            className="modal-close"
          >
            ×
          </button>
        </div>

        <div className="upload-controls">
          <input type="file" accept="image/*" multiple onChange={handleFileChange} />
          <button
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0}
            className="upload-button"
          >
            {uploading ? 'Uploading...' : 'Upload Images'}
          </button>
        </div>

        {images.length > 0 && (
          <div className="image-grid">
            {images.map((url, index) => (
              <div key={index} className={`image-preview ${mainImage === url ? 'selected' : ''}`}>
                <img
                  src={url}
                  alt={`img-${index}`}
                  onClick={() => handleSetMainImage(url)}
                />
                <button className="delete-btn" onClick={() => handleDeleteImage(url)}>×</button>
              </div>
            ))}
          </div>
        )}

        <div className="done-button-wrapper">
          <button onClick={onClose} className="done-button">Done</button>
        </div>
      </div>
    </div>
  );
};

export default UploadImageModal;
