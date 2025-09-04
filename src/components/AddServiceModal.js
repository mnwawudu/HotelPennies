import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';

const ALL_SERVICES = ['hotel', 'shortlet', 'restaurant', 'event center', 'tour guide'];

const AddServiceModal = ({ onClose, onSuccess }) => {
  const [vendorServices, setVendorServices] = useState([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');

  useEffect(() => {
    const fetchVendor = async () => {
      try {
        const res = await axios.get('/api/vendor/profile', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const businessTypes = res.data.businessTypes || [];
        const normalized = businessTypes
          .map(t => (typeof t === 'string' ? t.toLowerCase() : t?.serviceType?.toLowerCase?.()))
          .filter(Boolean);
        setVendorServices(normalized);
      } catch (err) {
        console.error('❌ Failed to fetch vendor services', err);
      }
    };

    fetchVendor();
  }, []);

  const handleAdd = async () => {
    if (!selected) return alert('Please select a service to add');

    setLoading(true);
    try {
      await axios.put(
        '/api/vendor/services',
        { service: selected, action: 'add' },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      alert('✅ Service added successfully');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('❌ Failed to add service:', err);
      alert('❌ Error adding service');
    } finally {
      setLoading(false);
    }
  };

  const filteredOptions = ALL_SERVICES.filter(
    type => !vendorServices.includes(type.toLowerCase())
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          position: 'relative',
          width: '90%',
          maxWidth: '400px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            fontSize: '20px',
            border: 'none',
            background: '#002b5b',
            color: '#fff',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            cursor: 'pointer',
            lineHeight: '1rem'
          }}
        >
          ×
        </button>

        <h2 style={{ marginBottom: '1rem', fontWeight: 600 }}>Add New Service</h2>

        {filteredOptions.length === 0 ? (
          <p style={{ marginBottom: 0 }}>All services already added</p>
        ) : (
          <>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Select Service:</label>
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              style={{
                padding: '0.5rem',
                width: '100%',
                marginBottom: '1rem',
                borderRadius: '5px',
                border: '1px solid #ccc'
              }}
            >
              <option value="">-- Select --</option>
              {filteredOptions.map((service, i) => (
                <option key={i} value={service}>
                  {service.charAt(0).toUpperCase() + service.slice(1)}
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#eee',
                  border: '1px solid #ccc',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={loading}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#002b5b',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                {loading ? 'Adding...' : 'Add'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AddServiceModal;
