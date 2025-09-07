// src/components/Header.js
import React, { useEffect, useRef, useState, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Header.css";
import DownloadAppPrompt from "./DownloadAppPrompt";

const Header = () => {
  // Memoized media query to avoid ESLint warning
  const mq = useMemo(() => {
    if (typeof window !== "undefined" && "matchMedia" in window) {
      return window.matchMedia("(max-width: 767px)");
    }
    return {
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    };
  }, []);

  const [isMobile, setIsMobile] = useState(mq.matches);
  const [role, setRole] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const primaryLinks = [
    { to: "/hotels", label: "Hotels" },
    { to: "/shortlets", label: "Shortlets" },
    { to: "/event-centers", label: "Event Centers" },
    { to: "/restaurants", label: "Restaurants" },
    { to: "/tour-guides", label: "Tour Guides" },
    { to: "/chops", label: "Chops" },
    { to: "/gifts", label: "Gifts" },
  ];

  const userLinks = [
    { to: "/user-dashboard", label: "My Earnings" },
    { to: "/my-bookings", label: "My Bookings" },
    { to: "/user-referrals", label: "My Referrals" },
    { to: "/user-payouts", label: "Payout History" },
    { to: "/user-profile", label: "Profile" },
    { to: "/user-change-password", label: "Change Password" },
  ];

  const isDashboardRoute =
    location.pathname.startsWith("/user-") ||
    location.pathname.startsWith("/dashboard") ||
    location.pathname === "/my-bookings" ||
    location.pathname === "/user-dashboard";

  useEffect(() => {
    const vendorToken = localStorage.getItem("vendorToken");
    const userToken = localStorage.getItem("userToken");
    if (vendorToken) setRole("vendor");
    else if (userToken) setRole("user");
    else setRole(null);
  }, []);

  useEffect(() => {
    const onChange = (e) => setIsMobile(!!e.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, [mq]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      const prev = window.history.scrollRestoration;
      window.history.scrollRestoration = "manual";
      return () => {
        window.history.scrollRestoration = prev;
      };
    }
  }, []);

  useEffect(() => {
    if (isDashboardRoute) document.body.classList.add("hp-dashboard-route");
    else document.body.classList.remove("hp-dashboard-route");
    return () => document.body.classList.remove("hp-dashboard-route");
  }, [isDashboardRoute]);

  const handleLogout = () => {
    localStorage.removeItem("vendorToken");
    localStorage.removeItem("userToken");
    setRole(null);
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    navigate("/");
  };

  return (
    <header className={`custom-header ${isDashboardRoute ? "dashboard-header" : ""}`}>
      <div className="top-header-row">
        <div className="left-pack">
          {isMobile && (
            <button
              className="menu-toggle"
              aria-label="Open menu"
              onClick={() => setMobileMenuOpen(true)}
            >
              ☰
            </button>
          )}

          {/* ✅ Wordmark image from /public (keeps your header logic unchanged) */}
          <Link to="/" className="logo" aria-label="HotelPennies home">
            <img
              className="logo-img"
              src={process.env.PUBLIC_URL + "/logo-hotelpennies-wordmark-white.svg"}
              alt="HotelPennies"
            />
          </Link>
        </div>

        <div className="header-buttons">
          {!isMobile && (
            <>
              {!role && (
                <>
                  <Link to="/auth" className="list-service">List Your Service</Link>
                  <Link to="/auth" className="auth">Register / Sign In</Link>
                </>
              )}

              {role && (
                <div className="profile-menu" ref={dropdownRef}>
                  <button
                    className="profile-button"
                    onClick={() => setDropdownOpen((o) => !o)}
                    aria-haspopup="menu"
                    aria-expanded={dropdownOpen}
                    aria-label="Open profile menu"
                    title="Profile"
                  >
                    <svg
                      className="profile-icon"
                      viewBox="0 0 24 24"
                      width="24"
                      height="24"
                      aria-hidden="true"
                    >
                      <path
                        fill="currentColor"
                        d="M12 12c2.761 0 5-2.239 5-5S14.761 2 12 2 7 4.239 7 7s2.239 5 5 5zm0 2c-4.418 0-8 3.134-8 7h16c0-3.866-3.582-7-8-7z"
                      />
                    </svg>
                  </button>

                  {dropdownOpen && (
                    <div className="dropdown-menu" role="menu">
                      {role === "vendor" ? (
                        <>
                          <Link to="/dashboard" onClick={() => setDropdownOpen(false)}>Vendor Dashboard</Link>
                          <button onClick={handleLogout}>Logout</button>
                        </>
                      ) : (
                        <>
                          {userLinks.map((l) => (
                            <Link key={l.to} to={l.to} onClick={() => setDropdownOpen(false)}>
                              {l.label}
                            </Link>
                          ))}
                          <button onClick={handleLogout}>Logout</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {!isMobile && (
        <ul className="menu-left">
          {primaryLinks.map((l) => (
            <li key={l.to}><Link to={l.to}>{l.label}</Link></li>
          ))}
        </ul>
      )}

      {isMobile && mobileMenuOpen && (
        <>
          <div className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)} />
          <div className="mobile-menu-sheet" role="dialog" aria-modal="true">
            <div className="sheet-header">
              <span>Menu</span>
              <button className="sheet-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">×</button>
            </div>

            <ul className="sheet-list">
              {primaryLinks.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} onClick={() => setMobileMenuOpen(false)}>{l.label}</Link>
                </li>
              ))}
            </ul>

            <div className="sheet-divider" />

            {role ? (
              role === "vendor" ? (
                <div className="sheet-section">
                  <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>Vendor Dashboard</Link>
                  <button className="sheet-logout" onClick={handleLogout}>Logout</button>
                </div>
              ) : (
                <ul className="sheet-list">
                  {userLinks.map((l) => (
                    <li key={l.to}>
                      <Link to={l.to} onClick={() => setMobileMenuOpen(false)}>{l.label}</Link>
                    </li>
                  ))}
                  <li><button className="sheet-logout" onClick={handleLogout}>Logout</button></li>
                </ul>
              )
            ) : (
              <div className="sheet-section">
                <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>Register / Sign In</Link>
                <Link to="/auth" className="sheet-cta" onClick={() => setMobileMenuOpen(false)}>List Your Service</Link>
              </div>
            )}
          </div>
        </>
      )}

      {/* Tiny install/download pill */}
      <DownloadAppPrompt />
    </header>
  );
};

export default Header;
