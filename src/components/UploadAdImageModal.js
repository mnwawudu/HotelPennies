import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import './CreateAdModal.css';

const UploadAdImageModal = ({ adId, onClose, onImageUploaded }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [adData, setAdData] = useState(null);
  const token = localStorage.getItem('adminToken');

  useEffect(() => {
    const fetchAd = async () => {
      try {
        const res = await axios.get(`/api/adverts/${adId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAdData(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch ad:', err);
      }
    };

    fetchAd();
  }, [adId]);

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      await axios.post(`/api/adverts/upload/${adId}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      setSelectedFile(null);
      onImageUploaded();
      onClose(); // Optional: close immediately
    } catch (err) {
      console.error('❌ Upload failed:', err);
      alert('Failed to upload image');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteImage = async () => {
    try {
      await axios.delete(`/api/adverts/${adId}/image`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      onImageUploaded();
      setAdData({ ...adData, image: '' });
    } catch (err) {
      console.error('❌ Failed to delete image:', err);
      alert('Failed to delete image');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="close-btn" onClick={onClose}>
          &times;
        </button>
        <h2 className="modal-title">Upload Ad Image</h2>

        {adData?.image && (
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <img
              src={adData.image}
              alt="Ad Preview"
              style={{ width: '100%', borderRadius: '8px' }}
            />
            <button
              onClick={handleDeleteImage}
              style={{
                position: 'absolute',
                top: '5px',
                right: '5px',
                background: 'red',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '25px',
                height: '25px',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleUpload} className="modal-form">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            required
          />

          <button
            type="submit"
            className="submit-btn"
            style={{ backgroundColor: 'navy', color: 'white' }}
          >
            {loading ? 'Uploading...' : 'Upload Image'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UploadAdImageModal;
