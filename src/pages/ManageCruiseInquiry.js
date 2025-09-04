// ✅ src/pages/ManageCruiseInquiry.js
import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import './ManageCruiseInquiry.css';

const ManageCruiseInquiry = () => {
  const [inquiries, setInquiries] = useState([]);

  const fetchInquiries = async () => {
    try {
      const res = await axios.get('/api/cruise-inquiries');
      setInquiries(res.data);
    } catch (err) {
      console.error('❌ Failed to fetch inquiries:', err);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  return (
    <div className="manage-inquiry-container">
      <h2>📋 City Cruise Inquiries</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Pickup</th>
            <th>Destinations</th>
            <th>Guests</th>
            <th>Duration</th>
            <th>Date</th>
            <th>Expectations</th>
            <th>Contact Method</th>
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {inquiries.map((inq) => (
            <tr key={inq._id}>
              <td>{inq.fullName}</td>
              <td>{inq.email}</td>
              <td>{inq.phone}</td>
              <td>{inq.pickupLocation}</td>
              <td>{inq.destinations}</td>
              <td>{inq.numberOfGuests}</td>
              <td>{inq.durationHours} hrs</td>
              <td>{new Date(inq.preferredDate).toLocaleDateString()}</td>
              <td>{inq.expectations || '-'}</td>
              <td>{inq.preferredContact}</td>
              <td>{new Date(inq.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ManageCruiseInquiry;
