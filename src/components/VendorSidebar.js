// 📁 src/components/VendorSidebar.js
import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  FaHotel, FaUtensils, FaBuilding, FaMapMarkedAlt,
  FaTachometerAlt, FaHome, FaSignOutAlt, FaPlus, FaMinus,
  FaBell, FaCheckCircle, FaTimesCircle, FaKey, FaPaperclip
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import AddServiceModal from './AddServiceModal';
import RemoveServiceModal from './RemoveServiceModal';

// 🔁 Use the shared axios instance (correct baseURL + token interceptor)
import api from '../utils/axiosConfig';

const VendorSidebar = ({ onNavigate }) => {
  const [vendor, setVendor] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showRemoveServiceModal, setShowRemoveServiceModal] = useState(false);

  // Access-gate modal (shown if vendor tries to manage while unverified)
  const [showBlockerModal, setShowBlockerModal] = useState(false);

  // Docs → admin modal
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [docMeans, setDocMeans] = useState(null);
  const [docCAC, setDocCAC] = useState(null);
  const [docPOA, setDocPOA] = useState(null);
  const [docsSubmitting, setDocsSubmitting] = useState(false);

  const navigate = useNavigate();

  const token =
    localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');

  useEffect(() => {
    if (!token) return;
    const fetchVendor = async () => {
      try {
        // interceptor attaches Authorization header
        const res = await api.get('/api/vendor/profile');
        if (res.data) {
          setVendor({
            ...res.data,
            businessTypes: res.data.businessTypes || [],
            notifications: res.data.notifications || [],
          });
        }
      } catch {
        // silent; leave vendor as null so we don't accidentally block navigation
      }
    };
    fetchVendor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('vendorToken');
    sessionStorage.removeItem('vendorToken');
    toast.info('Logged out successfully');
    setTimeout(() => (window.location.href = '/'), 1500);
  };

  const linkClass = ({ isActive }) =>
    isActive ? 'sidebar-link active' : 'sidebar-link';

  // ✅ Only block when we KNOW the vendor is unverified
  const handleProtectedNav = (e) => {
    if (vendor && !vendor.isFullyVerified) {
      e.preventDefault();
      setShowBlockerModal(true);
      if (typeof onNavigate === 'function') onNavigate();
      return;
    }
    if (typeof onNavigate === 'function') onNavigate();
  };

  const renderServiceLinks = () => {
    if (!vendor?.businessTypes?.length) return null;

    return vendor.businessTypes.map((type) => {
      const key =
        typeof type === 'string' ? type : type?.serviceType?.toLowerCase?.();
      if (!key) return null;

      switch (key) {
        case 'hotel':
          return (
            <li key="hotel">
              <NavLink to="/dashboard/hotels" className={linkClass} onClick={handleProtectedNav}>
                <FaHotel /> Manage Hotels
              </NavLink>
            </li>
          );
        case 'shortlet':
          return (
            <li key="shortlet">
              <NavLink to="/dashboard/shortlets" className={linkClass} onClick={handleProtectedNav}>
                <FaHome /> Manage Shortlets
              </NavLink>
            </li>
          );
        case 'restaurant':
          return (
            <li key="restaurant">
              <NavLink to="/dashboard/restaurants" className={linkClass} onClick={handleProtectedNav}>
                <FaUtensils /> Manage Restaurants
              </NavLink>
            </li>
          );
        case 'event center':
          return (
            <li key="event-center">
              <NavLink to="/dashboard/event-centers" className={linkClass} onClick={handleProtectedNav}>
                <FaBuilding /> Manage Event Centers
              </NavLink>
            </li>
          );
        case 'tour guide':
          return (
            <li key="tour-guide">
              <NavLink to="/dashboard/tour-guides" className={linkClass} onClick={handleProtectedNav}>
                <FaMapMarkedAlt /> Manage Tour Guides
              </NavLink>
            </li>
          );
        default:
          return null;
      }
    });
  };

  // Clean checklist (no auto-verification UI)
  const renderVerificationChecklist = () => {
    if (!vendor || vendor.isFullyVerified) return null;

    const steps = [
      { label: 'Phone Number',   complete: !!vendor.phone },
      { label: 'Address',        complete: !!vendor.address },
      { label: 'Means of ID',    complete: !!vendor.documents?.meansOfId },
      { label: 'CAC Certificate',complete: !!vendor.documents?.cacCertificate },
      { label: 'Proof of Address',complete: !!vendor.documents?.proofOfAddress },
    ];

    const isProcessing =
      String(vendor?.kycStatus || '').toUpperCase() === 'PROCESSING';

    return (
      <div
        style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeeba',
          padding: '0.75rem',
          borderRadius: 8,
          marginBottom: '1rem',
          color: '#856404',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h4 style={{ margin: 0, fontSize: 16 }}>Complete your registration</h4>
          {isProcessing && (
            <span
              style={{
                background: '#6c757d',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: 999,
                fontSize: 11,
              }}
            >
              approval in process
            </span>
          )}
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
          {steps.map((step, i) => (
            <li
              key={i}
              style={{ marginBottom: 6, display: 'flex', alignItems: 'center' }}
            >
              {step.complete ? (
                <FaCheckCircle color="green" style={{ marginRight: 8 }} />
              ) : (
                <FaTimesCircle color="red" style={{ marginRight: 8 }} />
              )}
              <span style={{ fontSize: 14 }}>{step.label}</span>
            </li>
          ))}
        </ul>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            title="Go to dashboard to continue setup"
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: 'none',
              background: '#343a40',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Continue setup
          </button>
          <button
            onClick={() => setShowDocsModal(true)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: 'none',
              background: '#0b5ed7',
              color: '#fff',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
            title="Upload documents for manual review"
          >
            <FaPaperclip /> Submit documents
          </button>
        </div>
      </div>
    );
  };

  const allThreePicked = !!(docMeans && docCAC && docPOA);

  const sameFile = (a, b) =>
    a && b && a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

  const handleDocsSubmitToAdmin = async () => {
    const tokenNow =
      localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');
    if (!tokenNow) return;

    if (sameFile(docMeans, docCAC) || sameFile(docMeans, docPOA) || sameFile(docCAC, docPOA)) {
      toast.warn('Each slot must be a different file (ID, CAC, POA).');
      return;
    }
    if (!allThreePicked) {
      toast.warn('Please attach all three documents.');
      return;
    }
    try {
      setDocsSubmitting(true);
      const fd = new FormData();
      fd.append('meansOfId', docMeans);
      fd.append('cacCertificate', docCAC);
      fd.append('proofOfAddress', docPOA);

      // interceptor adds Authorization; let axios set multipart boundary
      await api.post('/api/vendor/kyc/submit-files', fd);

      toast.success('Documents submitted. Approval in process.');
      setDocMeans(null); setDocCAC(null); setDocPOA(null);
      setShowDocsModal(false);

      setVendor((v) => (v ? { ...v, kycStatus: 'PROCESSING' } : v));
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit documents.');
    } finally {
      setDocsSubmitting(false);
    }
  };

  return (
    <>
      <div
        style={{
          width: '240px',
          background: '#1c1c1c',
          color: '#fff',
          height: '100vh',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ fontSize: '1rem', margin: 0 }}>Vendor Menu</h3>
          <div
            onClick={() => setShowNotifications((s) => !s)}
            style={{ cursor: 'pointer', position: 'relative' }}
          >
            <FaBell />
            {vendor?.notifications?.length > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -8,
                  background: 'red',
                  borderRadius: '50%',
                  padding: '2px 5px',
                  fontSize: 12,
                }}
              >
                {vendor.notifications.length}
              </span>
            )}
          </div>
        </div>

        {showNotifications && (
          <div
            style={{
              background: '#333',
              padding: '0.5rem',
              marginBottom: '1rem',
              borderRadius: 6,
              maxHeight: 150,
              overflowY: 'auto',
            }}
          >
            {vendor?.notifications?.length ? (
              vendor.notifications.map((note, i) => (
                <div key={i} style={{ borderBottom: '1px solid #444', padding: '0.25rem 0' }}>
                  <p style={{ fontSize: 14, margin: 0 }}>{note.message}</p>
                  <small style={{ fontSize: 11, color: '#ccc' }}>
                    {new Date(note.date).toLocaleString()}
                  </small>
                </div>
              ))
            ) : (
              <p style={{ fontSize: 14, margin: 0 }}>No notifications.</p>
            )}
          </div>
        )}

        {renderVerificationChecklist()}

        <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
          <li>
            <NavLink to="/dashboard" className={linkClass} onClick={onNavigate}>
              <FaTachometerAlt /> Dashboard Home
            </NavLink>
          </li>

          {renderServiceLinks()}

          <li>
            <button
              onClick={() => {
                if (vendor && !vendor.isFullyVerified) return setShowBlockerModal(true);
                setShowAddServiceModal(true);
              }}
              className="sidebar-link"
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                color: '#fff',
                padding: '0.5rem 0',
              }}
            >
              <FaPlus /> Add Service
            </button>
          </li>
          <li>
            <button
              onClick={() => {
                if (vendor && !vendor.isFullyVerified) return setShowBlockerModal(true);
                setShowRemoveServiceModal(true);
              }}
              className="sidebar-link"
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                color: '#fff',
                padding: '0.5rem 0',
              }}
            >
              <FaMinus /> Remove Service
            </button>
          </li>

          <li>
            <NavLink to="/dashboard/change-password" className={linkClass} onClick={onNavigate}>
              <FaKey /> Change Password
            </NavLink>
          </li>
        </ul>

        <div style={{ marginTop: 'auto', marginBottom: '1.5rem' }}>
          <button
            onClick={handleLogout}
            style={{
              padding: '0.5rem 1rem',
              background: '#dc3545',
              color: '#fff',
              border: 'none',
              borderRadius: 5,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <FaSignOutAlt /> Logout
          </button>
        </div>

        {showAddServiceModal && (
          <AddServiceModal
            onClose={() => setShowAddServiceModal(false)}
            onSuccess={() => {
              setShowAddServiceModal(false);
              window.location.reload();
            }}
          />
        )}
        {showRemoveServiceModal && (
          <RemoveServiceModal
            onClose={() => setShowRemoveServiceModal(false)}
            onSuccess={() => {
              setShowRemoveServiceModal(false);
              window.location.reload();
            }}
          />
        )}
      </div>

      {/* Blocker modal — minimal: only “Submit documents” */}
      {showBlockerModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#fff',
              color: '#222',
              borderRadius: 10,
              padding: 20,
              width: 420,
              maxWidth: '92%',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Submit documents</h3>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowBlockerModal(false)}
                style={{
                  padding: '8px 12px',
                  background: '#e9ecef',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowBlockerModal(false);
                  setShowDocsModal(true);
                }}
                style={{
                  padding: '8px 12px',
                  background: '#0b5ed7',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <FaPaperclip /> Submit documents
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Docs-to-admin modal — requires all 3 files, closes on success */}
      {showDocsModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
          }}
        >
          <div
            style={{
              background: '#fff',
              color: '#222',
              borderRadius: 10,
              padding: 20,
              width: 560,
              maxWidth: '95%',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Submit documents</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              <label style={{ fontSize: 13 }}>
                Means of ID
                <input type="file" onChange={(e) => setDocMeans(e.target.files?.[0] || null)} />
              </label>
              <label style={{ fontSize: 13 }}>
                CAC Certificate
                <input type="file" onChange={(e) => setDocCAC(e.target.files?.[0] || null)} />
              </label>
              <label style={{ fontSize: 13 }}>
                Proof of Address
                <input type="file" onChange={(e) => setDocPOA(e.target.files?.[0] || null)} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              <button
                onClick={() => setShowDocsModal(false)}
                style={{
                  padding: '8px 12px',
                  background: '#e9ecef',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDocsSubmitToAdmin}
                disabled={docsSubmitting || !allThreePicked}
                style={{
                  padding: '8px 12px',
                  background: allThreePicked ? '#198754' : '#9fbdaa',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: allThreePicked ? 'pointer' : 'not-allowed',
                }}
              >
                {docsSubmitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
            {!allThreePicked && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#6b5d33' }}>
                Attach all three documents to enable submit. Each must be a different file.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default VendorSidebar;
