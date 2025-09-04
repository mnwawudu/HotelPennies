import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import './UploadImageModal.css'; // reuse same styles

const UploadChopImageModal = ({ chopId, onClose, onUploaded }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState([]);
  const [mainImage, setMainImage] = useState('');

  const token =
    localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');

  const fetchImages = async () => {
    try {
      const res = await axios.get(`/api/chops/${chopId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setImages(res.data.images || []);
      setMainImage(res.data.mainImage || '');
    } catch (err) {
      console.error('❌ Failed to fetch chop images:', err);
    }
  };

  useEffect(() => {
    if (chopId) fetchImages();
  }, [chopId]);

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
    selectedFiles.forEach(file => formData.append('images', file));

    try {
      const res = await axios.post(`/api/chops/upload/${chopId}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      alert('✅ Images uploaded');
      fetchImages();
      setSelectedFiles([]);
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
      await axios.put(`/api/chops/${chopId}`, { mainImage: url }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('✅ Main image set');
      setMainImage(url); // ✅ ensure UI updates instantly
      if (onUploaded) onUploaded();
    } catch (err) {
      console.error('❌ Failed to set main image:', err);
      alert('❌ Main image update failed');
    }
  };

  const handleDeleteImage = async (url) => {
    const confirmDelete = window.confirm('Delete this image?');
    if (!confirmDelete) return;
    try {
      await axios.put(`/api/chops/${chopId}`, {
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

export default UploadChopImageModal;
