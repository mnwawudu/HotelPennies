// ✅ src/components/UploadCruiseImageModal.js
import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import './UploadImageModal.css'; // shared modal styles

const UploadCruiseImageModal = ({ cruiseId, onClose, onUploaded }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState([]);
  const [mainImage, setMainImage] = useState('');

  const token =
    localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');

  useEffect(() => {
    if (cruiseId) fetchImages();
  }, [cruiseId]);

  const fetchImages = async () => {
    try {
      const res = await axios.get(`/api/cruises/${cruiseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setImages(res.data.images || []);
      setMainImage(res.data.mainImage || '');
    } catch (err) {
      console.error('❌ Failed to fetch cruise images:', err);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const tooLarge = files.find((f) => f.size > 3 * 1024 * 1024);
    if (tooLarge) {
      alert('❌ One or more files are too large (max 3MB)');
      return;
    }
    setSelectedFiles(files);
  };

  const handleUpload = async () => {
    if (!cruiseId || selectedFiles.length === 0) {
      alert('⛔ No image selected or missing cruise ID');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append('images', file));

    try {
      await axios.post(`/api/cruises/upload/${cruiseId}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      alert('✅ Images uploaded');
      setSelectedFiles([]);
      fetchImages();
      if (onUploaded) onUploaded();
    } catch (err) {
      console.error('❌ Upload failed:', err);
      alert('❌ Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSetMainImage = async (url) => {
    try {
      await axios.put(
        `/api/cruises/${cruiseId}`,
        { mainImage: url },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('✅ Main image set');
      setMainImage(url);
      if (onUploaded) onUploaded();
    } catch (err) {
      console.error('❌ Failed to set main image:', err);
      alert('❌ Failed to set main image');
    }
  };

  const handleDeleteImage = async (url) => {
    const confirm = window.confirm('Delete this image?');
    if (!confirm) return;

    try {
      await axios.put(
        `/api/cruises/${cruiseId}`,
        { $pull: { images: url } },
        { headers: { Authorization: `Bearer ${token}` } }
      );
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
          <button onClick={onClose} className="modal-close">×</button>
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
              <div
                key={index}
                className={`image-preview ${mainImage === url ? 'selected' : ''}`}
              >
                <img
                  src={url}
                  alt={`img-${index}`}
                  onClick={() => handleSetMainImage(url)}
                />
                <button className="delete-btn" onClick={() => handleDeleteImage(url)}>
                  ×
                </button>
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

export default UploadCruiseImageModal;
