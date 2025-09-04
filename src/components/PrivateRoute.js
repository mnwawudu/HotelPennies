import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const PrivateRoute = ({ children }) => {
  const [checked, setChecked] = useState(false);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    const token =
      localStorage.getItem('token') || sessionStorage.getItem('token');

    if (!token) {
      setChecked(true);
      setValid(false);
      return;
    }

    try {
      const decoded = jwtDecode(token);
      if (decoded?.role) {
        setValid(true);
      }
    } catch (err) {
      console.error('❌ Token decode failed:', err);
    } finally {
      setChecked(true);
    }
  }, []);

  if (!checked) return null; // wait until check is complete
  if (!valid) return <Navigate to="/" />;
  return children;
};

export default PrivateRoute;
