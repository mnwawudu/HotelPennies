// ✅ src/pages/ManageCarHire.js
import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import './ManageCarHire.css';

const ManageCarHire = () => {
  const [hires, setHires] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCarHires = async () => {
      try {
        const token = localStorage.getItem('adminToken');
        const res = await axios.get('/api/admin/carhires', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setHires(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch car hire bookings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCarHires();
  }, []);

  return (
    <div className="admin-page">
      <h2>Manage Car Hire</h2>

      {loading ? (
        <p>Loading...</p>
      ) : hires.length === 0 ? (
        <p>No car hire bookings found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Duration</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {hires.map((hire) => (
              <tr key={hire._id}>
                <td>{hire.name}</td>
                <td>{hire.email}</td>
                <td>{hire.phone}</td>
                <td>{hire.duration}</td>
                <td>{new Date(hire.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ManageCarHire;
