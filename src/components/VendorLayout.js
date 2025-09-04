import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import VendorSidebar from './VendorSidebar';
import '../pages/VendorDashboard.css';

const SIDEBAR_WIDTH = 240;
const HEADER_HEIGHT = 64; // ← adjust if your Header is taller/shorter

const VendorLayout = () => {
  const location = useLocation();

  const initialDesktop = typeof window !== 'undefined' ? window.innerWidth >= 992 : true;
  const [isDesktop, setIsDesktop] = useState(initialDesktop);
  const [isSidebarOpen, setIsSidebarOpen] = useState(initialDesktop);

  useEffect(() => {
    const onResize = () => {
      const nowDesktop = window.innerWidth >= 992;
      setIsDesktop(nowDesktop);
      if (nowDesktop) setIsSidebarOpen(true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!isDesktop) setIsSidebarOpen(false);
  }, [location.pathname, isDesktop]);

  const handleSidebarNavigate = () => {
    if (!isDesktop) setIsSidebarOpen(false);
  };

  return (
    <div className="vendor-layout-root">
      <Header />

      <div className="dashboard-mobile-header" style={{ marginTop: 0 }}>
        <button
          className="hamburger-icon"
          aria-label="Open menu"
          onClick={() => setIsSidebarOpen(true)}
        >
          ☰
        </button>
        <div className="brand-spacer" />
      </div>

      {!isDesktop && isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      <div className="vendor-dashboard">
        <aside
          className={`vendor-sidebar-container ${isSidebarOpen ? 'open' : ''}`}
          style={{
            // offset the fixed sidebar below the header
            top: HEADER_HEIGHT,
            height: `calc(100vh - ${HEADER_HEIGHT}px)`,
          }}
        >
          <button
            className="close-btn-mobile"
            aria-label="Close menu"
            onClick={() => setIsSidebarOpen(false)}
          >
            ×
          </button>
          <VendorSidebar onNavigate={handleSidebarNavigate} />
        </aside>

        <main
          className="vendor-dashboard-content"
          style={{
            marginLeft: isDesktop ? SIDEBAR_WIDTH : 0,
            // make sure main content starts below the header too
            paddingTop: 16,
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default VendorLayout;
