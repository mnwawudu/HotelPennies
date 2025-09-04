// ✅ src/components/AdminLayout.js
import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import './AdminLayout.css';

const AdminLayout = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('admin');
    navigate('/admin/login');
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <h2>Admin Panel</h2>
        <ul>
          {/* Overview */}
          <li><Link to="/admin/dashboard">Dashboard</Link></li>

          {/* Earnings & Payouts */}
          <li><Link to="/admin/manage-payout">Payout</Link></li>

          {/* Listings & Promotions */}
          <li><Link to="/admin/manage-ads">Manage Ads</Link></li>
          <li><Link to="/admin/featured-listings">Featured Listings</Link></li>
          <li><Link to="/admin/explore-manager">Explore Manager</Link></li>

          {/* People */}
          <li><Link to="/admin/user-list">User List</Link></li>
          <li><Link to="/admin/vendor-list">Vendor List</Link></li>
          <li><Link to="/admin/vendor-approvals">Vendor Approvals</Link></li>

          {/* Admin Services */}
          <li><Link to="/admin/manage-chops">Manage Chops</Link></li>
          <li><Link to="/admin/manage-gifts">Manage Gifts</Link></li>
          <li><Link to="/admin/manage-cruise">Manage City Cruise</Link></li>
          <li><Link to="/admin/manage-inquiries">Cruise Inquiries</Link></li>
          <li><Link to="/admin/manage-carhire">Manage Car Hire</Link></li>
          <li><Link to="/admin/manage-pages">Manage Pages</Link></li>
          <li><Link to="/admin/manage-blogs">Manage Blogs</Link></li>
          <li><Link to="/admin/manage-pickup-delivery">Manage Pickup & Delivery</Link></li>
          <li><Link to="/admin/feature-manager">Feature Manager</Link></li>

          {/* ⚙️ Settings */}
          <li><Link to="/admin/settings/commissions">Commission & Cashback</Link></li>

          {/* 🔐 Security */}
          <li><Link to="/admin/change-password">Change Password</Link></li>
        </ul>

        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </aside>

      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
