// src/admin/RequireAdmin.js
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * Gate a view by admin roles.
 * Usage:
 *   <RequireAdmin roles={['superadmin','manager']}><AdminUsers/></RequireAdmin>
 */
export default function RequireAdmin({ roles = ['superadmin','manager','staff','admin'], children }) {
  const loc = useLocation();

  // Token check (basic)
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;

  if (!token) {
    // Not signed in → go to admin login
    return <Navigate to="/admin/login" state={{ from: loc }} replace />;
  }

  // Role check
  let role = null;
  try {
    const raw = localStorage.getItem('admin');
    role = raw ? JSON.parse(raw)?.role : null;
  } catch {
    role = null;
  }

  // If no role or not allowed → show a lightweight 403 screen
  if (!role || !roles.map(String).includes(String(role))) {
    return (
      <div style={{ padding: 24 }}>
        <h2>403 — Not allowed</h2>
        <p>Your account doesn’t have permission to view this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}
