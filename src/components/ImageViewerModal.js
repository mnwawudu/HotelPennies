import React from 'react';
import './ImageViewerModal.css';

const ImageViewerModal = ({ images, currentIndex, onClose }) => {
  const [index, setIndex] = React.useState(currentIndex);

  const handlePrev = () => {
    setIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!images || images.length === 0) return null;

  return (
    <div className="image-viewer-overlay">
      <div className="image-viewer-content">
        <img src={images[index]} alt={`view-${index}`} />
        <button className="image-viewer-close" onClick={onClose}>×</button>
        <button className="image-viewer-prev" onClick={handlePrev}>‹</button>
        <button className="image-viewer-next" onClick={handleNext}>›</button>
      </div>
    </div>
  );
};

export default ImageViewerModal;
