// ✅ src/pages/DashboardLayout.js
import React from 'react';
import Header from '../components/Header';
import UserSidebar from '../components/UserSidebar';
import './DashboardLayout.css';

export default function DashboardLayout({ children }) {
  return (
    <>
      <Header />
      <div className="user-dashboard-container">
        <UserSidebar />
        <div className="dashboard-main">{children}</div>
      </div>
    </>
  );
}
