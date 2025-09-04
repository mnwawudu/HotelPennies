import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import './UploadGiftImageModal.css';

const UploadGiftImageModal = ({ giftId, onClose, onUploaded }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState([]);
  const [mainImage, setMainImage] = useState('');

  const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      const res = await axios.get(`/api/gifts/${giftId}`);
      setImages(res.data.images || []);
      setMainImage(res.data.mainImage || '');
    } catch (error) {
      console.error('❌ Failed to fetch images:', error);
    }
  };

  const handleFileChange = (e) => {
    setSelectedFiles([...e.target.files]);
  };

  const handleUpload = async () => {
    if (!selectedFiles.length) {
      alert('Please select images to upload');
      return;
    }

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append('images', file);
    });

    try {
      setUploading(true);
      await axios.post(`/api/gifts/upload/${giftId}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      await fetchImages();
      alert('✅ Images uploaded successfully');
      onUploaded();
    } catch (error) {
      console.error('❌ Upload error:', error);
      alert('❌ Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSetMainImage = async (imgUrl) => {
    if (!imgUrl || imgUrl === mainImage) return;

    try {
      await axios.put(`/api/gifts/${giftId}/main-image`, { mainImage: imgUrl }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert('✅ Main image saved');
      onUploaded();
      onClose();
    } catch (error) {
      console.error('❌ Failed to save main image:', error);
      alert('❌ Failed to save main image');
    }
  };

  const handleDeleteImage = async (imgUrl) => {
    try {
      const updatedImages = images.filter(img => img !== imgUrl);
      await axios.put(`/api/gifts/${giftId}`, {
        images: updatedImages,
        mainImage: imgUrl === mainImage ? null : mainImage
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchImages();
    } catch (err) {
      console.error('❌ Failed to delete image:', err);
      alert('❌ Failed to delete image');
    }
  };

  return (
    <div className="upload-modal">
      <div className="upload-modal-content">
        <span className="close-button" onClick={onClose}>&times;</span>
        <h3>Upload Gift Images</h3>
        <input type="file" multiple onChange={handleFileChange} />
        <button onClick={handleUpload} disabled={uploading}>
          {uploading ? 'Uploading...' : 'Upload'}
        </button>

        <div className="image-preview-tray">
          {images.map((img, index) => (
            <div
              key={index}
              className={`image-thumb ${img === mainImage ? 'selected' : ''}`}
            >
              <img
                src={img}
                alt="Gift"
                onClick={() => handleSetMainImage(img)}
                title="Click to set as main image"
              />
              <span
                className="delete-x"
                onClick={() => handleDeleteImage(img)}
                title="Delete image"
              >×</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UploadGiftImageModal;
