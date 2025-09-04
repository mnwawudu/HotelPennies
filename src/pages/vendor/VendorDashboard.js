import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import jwt_decode from 'jwt-decode';

const VendorDashboard = () => {
  const { hotelId } = useParams();
  const [vendorInfo, setVendorInfo] = useState({
    name: '',
    id: '',
  });

  // Extract vendor information from JWT token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decodedToken = jwt_decode(token);
      setVendorInfo({
        name: decodedToken.name,  // Replace with actual key in JWT payload
        id: decodedToken.vendorId,  // Replace with actual key in JWT payload
      });
    }
  }, []);

  const handleLogout = () => {
    // Remove token and redirect to login
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <div>
      {/* Vendor Info Section */}
      <div className="vendor-info">
        <h2>Vendor Dashboard</h2>
        <p><strong>Vendor Name:</strong> {vendorInfo.name}</p>
        <p><strong>Vendor ID:</strong> {vendorInfo.id}</p>
      </div>

      {/* Logout Button */}
      <button onClick={handleLogout} className="btn btn-danger">Logout</button>

      {/* Hotel Management Links */}
      <div className="management-links">
        <Link to={`/manage-hotel/${hotelId}`} className="btn btn-info">Manage Hotel</Link>
        <Link to={`/manage-rooms/${hotelId}`} className="btn btn-info">Manage Rooms</Link>
      </div>
    </div>
  );
};

export default VendorDashboard;
