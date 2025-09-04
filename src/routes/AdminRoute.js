// ✅ src/routes/AdminRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';

const AdminRoute = ({ children }) => {
  const token = localStorage.getItem('adminToken'); // ✅ Use correct token
  const admin = localStorage.getItem('admin');

  // Check for both token and admin data
  if (!token || !admin) {
    return <Navigate to="/admin/login" replace />;
  }

  try {
    JSON.parse(admin); // Validate JSON format
  } catch (err) {
    // If admin data is corrupted, redirect to login
    return <Navigate to="/admin/login" replace />;
  }

  return children;
};

export default AdminRoute;
