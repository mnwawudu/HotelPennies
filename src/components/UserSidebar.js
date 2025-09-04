import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../pages/UserDashboard.css';

const UserSidebar = ({ isOpen: controlledOpen, setIsOpen: setControlledOpen }) => {
  // Use matchMedia with a non-flapping breakpoint (767px)
  const mq = typeof window !== 'undefined'
    ? window.matchMedia('(max-width: 767px)')
    : { matches: true, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} };

  const [isMobile, setIsMobile] = useState(mq.matches);

  // internal open state only used when not controlled
  const [internalOpen, setInternalOpen] = useState(!mq.matches);

  // resolve effective open + setter
  const isControlled = typeof controlledOpen === 'boolean';
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled && setControlledOpen ? setControlledOpen : setInternalOpen;

  const navigate = useNavigate();
  const location = useLocation();

  const prevIsMobileRef = useRef(null);

  // Listen for breakpoint changes (instead of raw resize)
  useEffect(() => {
    const handleChange = (e) => setIsMobile(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', handleChange);
    else mq.addListener(handleChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handleChange);
      else mq.removeListener(handleChange);
    };
  }, [mq]);

  // Only toggle open/closed when crossing the breakpoint
  useEffect(() => {
    const prev = prevIsMobileRef.current;

    if (prev === null) {
      if (!isControlled) setInternalOpen(!isMobile);
    } else if (prev !== isMobile) {
      const nextOpen = !isMobile;
      if (isControlled && setControlledOpen) setControlledOpen(nextOpen);
      else setInternalOpen(nextOpen);
    }

    prevIsMobileRef.current = isMobile;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, isControlled, setControlledOpen]);

  // Fallback: respond to a custom toggle event if someone dispatches it
  useEffect(() => {
    const handler = () => setIsOpen((prev) => !prev);
    window.addEventListener('userSidebar:toggle', handler);
    return () => window.removeEventListener('userSidebar:toggle', handler);
  }, [setIsOpen]);

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    navigate('/');
  };

  const handleNavigate = (path) => {
    navigate(path);
    if (isMobile) setIsOpen(false);
  };

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <>
      {/* Desktop static sidebar */}
      {!isMobile && (
        <aside className="user-sidebar" aria-label="User navigation">
          <div className="sidebar-header">
            <h3>User Dashboard</h3>
          </div>
          <ul className="sidebar-links">
            <li className={isActive('/user-dashboard') ? 'active' : ''} onClick={() => handleNavigate('/user-dashboard')}>My Earnings</li>
            <li className={isActive('/my-bookings') ? 'active' : ''} onClick={() => handleNavigate('/my-bookings')}>My Bookings</li>
            <li className={isActive('/user-referrals') ? 'active' : ''} onClick={() => handleNavigate('/user-referrals')}>My Referrals</li>
            <li className={isActive('/user-payouts') ? 'active' : ''} onClick={() => handleNavigate('/user-payouts')}>Payout History</li>
            <li className={isActive('/user-profile') ? 'active' : ''} onClick={() => handleNavigate('/user-profile')}>Profile</li>
            <li className={isActive('/user-change-password') ? 'active' : ''} onClick={() => handleNavigate('/user-change-password')}>Change Password</li>
          </ul>
          <button className="logout-button" onClick={handleLogout}>Logout</button>
        </aside>
      )}

      {/* Mobile overlay drawer */}
      {isMobile && isOpen && (
        <div className="user-sidebar-overlay" role="dialog" aria-modal="true" aria-label="User navigation">
          <div className="user-sidebar-content">
            <div className="sidebar-header">
              <h3>User Dashboard</h3>
              <button className="close-icon" onClick={() => setIsOpen(false)} aria-label="Close sidebar">×</button>
            </div>
            <ul className="sidebar-links">
              <li className={isActive('/user-dashboard') ? 'active' : ''} onClick={() => handleNavigate('/user-dashboard')}>My Earnings</li>
              <li className={isActive('/my-bookings') ? 'active' : ''} onClick={() => handleNavigate('/my-bookings')}>My Bookings</li>
              <li className={isActive('/user-referrals') ? 'active' : ''} onClick={() => handleNavigate('/user-referrals')}>My Referrals</li>
              <li className={isActive('/user-payout') ? 'active' : ''} onClick={() => handleNavigate('/user-payout')}>Payout History</li>
              <li className={isActive('/user-profile') ? 'active' : ''} onClick={() => handleNavigate('/user-profile')}>Profile</li>
              <li className={isActive('/user-change-password') ? 'active' : ''} onClick={() => handleNavigate('/user-change-password')}>Change Password</li>
            </ul>
            <button className="logout-button" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      )}
    </>
  );
};

export default UserSidebar;
