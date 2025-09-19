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

  // Normalize allowed roles (case-insensitive)
  const allowed = new Set(roles.map(r => String(r || '').trim().toLowerCase()));

  // 1) Token presence gate
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
  if (!token) {
    // Not signed in → go to admin login
    return <Navigate to="/admin/login" state={{ from: loc }} replace />;
  }

  // 2) Figure out the user's role
  let role = null;

  // (a) Prefer the stored "admin" object
  try {
    const raw = localStorage.getItem('admin');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.role) role = String(parsed.role);
    }
  } catch {
    // ignore parse errors
  }

  // (b) Fallback: attempt to read role from a JWT (adminToken) if it's a JWT
  if (!role && token.split('.').length === 3) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1] || ''));
      if (payload && payload.role) role = String(payload.role);
    } catch {
      // ignore invalid JWT
    }
  }

  // 3) Role gate (case-insensitive)
  const roleNorm = String(role || '').trim().toLowerCase();
  if (!roleNorm || !allowed.has(roleNorm)) {
    // Light 403 screen (backend still enforces real authz)
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[RequireAdmin] blocked:', { role, allowed: Array.from(allowed) });
    }
    return (
      <div style={{ padding: 24 }}>
        <h2>403 — Not allowed</h2>
        <p>Your account doesn’t have permission to view this page.</p>
      </div>
    );
  }

  // 4) Success
  return <>{children}</>;
}
