import React, { useEffect, useState } from 'react';
import axios from 'axios';

const BusinessListPanel = () => {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBusinesses = async () => {
    try {
      const res = await axios.get('http://localhost:10000/api/admin/business-listings');
      setBusinesses(res.data); // Assume grouped by category
    } catch (error) {
      console.error('Error fetching businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (businessId, category) => {
    if (!window.confirm('Are you sure you want to delete this business?')) return;
    try {
      await axios.delete(`http://localhost:10000/api/admin/delete-business/${businessId}`, {
        data: { category },
      });
      setBusinesses(prev =>
        prev.map(group =>
          group.category === category
            ? { ...group, listings: group.listings.filter(b => b._id !== businessId) }
            : group
        )
      );
    } catch (error) {
      alert('Failed to delete business');
    }
  };

  useEffect(() => {
    fetchBusinesses();
  }, []);

  if (loading) return <p>Loading business listings...</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <h2>All Listed Businesses</h2>
      {businesses.length === 0 ? (
        <p>No businesses found.</p>
      ) : (
        businesses.map((group, i) => (
          <div key={i} style={{ marginBottom: '2rem' }}>
            <h3>{group.category}</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Business Name</th>
                  <th style={thStyle}>Vendor</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {group.listings.map((item, idx) => (
                  <tr key={idx}>
                    <td style={tdStyle}>{item.name}</td>
                    <td style={tdStyle}>{item.vendor?.name || 'N/A'}</td>
                    <td style={tdStyle}>{item.vendor?.email || 'N/A'}</td>
                    <td style={tdStyle}>Active</td>
                    <td style={tdStyle}>
                      <button onClick={() => alert('Manage coming soon')} style={btnEdit}>Manage</button>{' '}
                      <button onClick={() => handleDelete(item._id, group.category)} style={btnDelete}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
};

const thStyle = { textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ccc' };
const tdStyle = { padding: '0.5rem', borderBottom: '1px solid #eee' };
const btnEdit = { padding: '0.4rem 0.7rem', marginRight: '0.5rem', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const btnDelete = { padding: '0.4rem 0.7rem', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' };

export default BusinessListPanel;
