import React, { useState } from 'react';
import axios from 'axios';
import './ContinueRegistrationModal.css';

const ContinueRegistrationModal = ({ onClose, fetchVendorProfile }) => {
  const [uploads, setUploads] = useState({ id: null, cac: null, proof: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fileSignature = (file) => `${file.name}-${file.size}`;

  const hasDuplicateFiles = () => {
    const files = Object.values(uploads).filter(Boolean);
    const seen = new Set();

    for (const file of files) {
      const sig = fileSignature(file);
      if (seen.has(sig)) return true;
      seen.add(sig);
    }

    return false;
  };

  const handleFileChange = (e, type) => {
    const newFile = e.target.files[0];
    if (!newFile) return;

    setUploads(prev => ({ ...prev, [type]: newFile }));
    setError('');
  };

  const uploadSingle = async (file, field) => {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('field', field);

    const token =
      localStorage.getItem('token') || sessionStorage.getItem('token');

    if (!token || token.split('.').length !== 3) {
      setError('Authorization failed. Please log in again.');
      return false;
    }

    try {
      await axios.post('http://localhost:10000/api/vendor/upload-document', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      });
      return true;
    } catch (err) {
      console.error(`Upload failed for ${field}`, err);
      setError(`Upload failed for ${field}. Please try again.`);
      return false;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    if (hasDuplicateFiles()) {
      setError('You cannot use the same file for multiple document types.');
      setLoading(false);
      return;
    }

    const results = [];

    if (uploads.id) results.push(await uploadSingle(uploads.id, 'meansOfId'));
    if (uploads.cac) results.push(await uploadSingle(uploads.cac, 'cacCertificate'));
    if (uploads.proof) results.push(await uploadSingle(uploads.proof, 'proofOfAddress'));

    const failed = results.filter(r => r === false).length;

    if (failed > 0) {
      setLoading(false);
      return;
    }

    await fetchVendorProfile();
    alert('Documents submitted successfully! Please wait for verification.');
    setLoading(false);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content custom-modal">
        <h3>Complete your registration to list services:</h3>
        <p>All items must be completed before you can add services.</p>

        <div className="upload-group">
          <label>Means of ID</label>
          <input type="file" onChange={(e) => handleFileChange(e, 'id')} />
        </div>

        <div className="upload-group">
          <label>CAC Certificate</label>
          <input type="file" onChange={(e) => handleFileChange(e, 'cac')} />
        </div>

        <div className="upload-group">
          <label>Proof of Address</label>
          <input type="file" onChange={(e) => handleFileChange(e, 'proof')} />
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="modal-buttons">
          <button className="cancel-btn" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="submit-btn" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContinueRegistrationModal;
