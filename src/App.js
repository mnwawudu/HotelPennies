// ✅ src/App.js
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

import Header from './components/Header';
import Toast from './components/Toast';

// ⬇️ App download / PWA prompt
import DownloadAppPrompt from './components/DownloadAppPrompt';

// Public pages
import Home from './pages/Home';
import AuthPage from './pages/AuthPage';
import VerifyEmail from './pages/VerifyEmail';
import ResendVerification from './pages/ResendVerification';
import BlogList from './pages/BlogList';
import BlogDetail from './pages/BlogDetail';
import HotelsPage from './pages/HotelsPage';
import HotelDetail from './pages/HotelDetail';
import ShortletsPage from './pages/ShortletsPage';
import ShortletDetail from './pages/ShortletDetail';
import RestaurantsPage from './pages/RestaurantsPage';
import RestaurantDetail from './pages/RestaurantDetail';
import EventCentersPage from './pages/EventCentersPage';
import EventCenterDetail from './pages/EventCenterDetail';
import TourGuidesPage from './pages/TourGuidesPage';
import TourGuideDetail from './pages/TourGuideDetail';
import ChopsPage from './pages/ChopsPage';
import ChopsDetails from './pages/ChopsDetails';
import GiftsPage from './pages/GiftsPage';
import GiftsDetail from './pages/GiftsDetail';
import CarRental from './pages/CarRental';
import PartnerWithUs from './pages/PartnerWithUs';
import ManagementServices from './pages/ManagementServices';
import About from './pages/About';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Contact from './pages/Contact';
import FAQ from './pages/FAQ';
import CityCruise from './pages/CityCruise';
import ManageBookingCancel from './pages/ManageBookingCancel';
import SearchResults from './pages/SearchResults';

// Admin
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminLayout from './components/AdminLayout';
import AdminRoute from './routes/AdminRoute';
import BusinessListPanel from './pages/BusinessListPanel';
import FeaturedManager from './pages/FeaturedManager';
import ManageChops from './pages/ManageChops';
import ManageGifts from './pages/ManageGifts';
import ManageCruises from './pages/ManageCruises';
import ManageCarHire from './pages/ManageCarHire';
import ExploreManager from './pages/ExploreManager';
import UserList from './pages/UserList';
import VendorList from './pages/VendorList';
import ManagePayout from './pages/ManagePayout';
import ManageAds from './pages/ManageAds';
import PublicFeaturedListings from './pages/PublicFeaturedListings';
import ManagePages from './pages/ManagePages';
import ManageBlogs from './pages/ManageBlogs';
import ManagePickupDelivery from './pages/ManagePickupDelivery';
import ManageCruiseInquiry from './pages/ManageCruiseInquiry';
import AdminFeaturedListings from './pages/AdminFeaturedListings';
import VendorApprovals from './pages/VendorApprovals';
import AdminChangePassword from './pages/AdminChangePassword';
import AdminCommissions from './pages/AdminCommissions';
import RequireAdmin from './admin/RequireAdmin';
import AdminUsers from './admin/AdminUsers';
import AdminSetPassword from './pages/AdminSetPassword';

// Vendor
import VendorLayout from './components/VendorLayout';
import VendorDashboard from './pages/VendorDashboard';
import ManageHotels from './pages/ManageHotels';
import ManageShortlets from './pages/ManageShortlets';
import ManageRestaurants from './pages/ManageRestaurants';
import ManageEventCenters from './pages/ManageEventCenters';
import ManageTourGuides from './pages/ManageTourGuides';
import ManageBusiness from './pages/ManageBusiness';
import VendorChangePassword from './pages/VendorChangePassword';

// User
import UserDashboard from './pages/UserDashboard';
import UserReferrals from './pages/UserReferrals';
import UserPayouts from './pages/UserPayouts';
import UserProfile from './pages/UserProfile';
import UserEditProfile from './pages/UserEditProfile';
import UserSidebar from './components/UserSidebar';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import UserChangePassword from './pages/UserChangePassword';
import MyBookings from './pages/MyBookings';

// ---------- Dashboard layout wrapper ----------
const DashboardLayout = ({ children }) => {
  const [sideOpen, setSideOpen] = useState(false);
  return (
    <div className="dashboard-shell">
      <Header
        showUserHamburger
        sidebarOpen={sideOpen}
        onToggleUserSidebar={setSideOpen}
      />
      <div className="user-dashboard-container">
        <UserSidebar isOpen={sideOpen} setIsOpen={setSideOpen} />
        <div className="dashboard-main">{children}</div>
      </div>
    </div>
  );
};

function App() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem('referralCode', ref);
      console.log('✅ Referral code saved to localStorage:', ref);
    }
  }, []);

  return (
    <Router>
      <Toast />

      {/* ⬇️ App download / PWA prompt (mobile-only) */}
      <DownloadAppPrompt
        playUrl="#"
        appStoreUrl="#"
        delayMs={5000}
        remindDays={7}
        neverDays={180}
      />

      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />
        <Route path="/resend-verification" element={<ResendVerification />} />
        <Route path="/blogs" element={<BlogList />} />
        <Route path="/blogs/:id" element={<BlogDetail />} />
        <Route path="/hotels" element={<HotelsPage />} />
        <Route path="/hotels/:id" element={<HotelDetail />} />
        <Route path="/shortlets" element={<ShortletsPage />} />
        <Route path="/shortlets/:id" element={<ShortletDetail />} />
        <Route path="/car-rental" element={<CarRental />} />
        <Route path="/partner-with-us" element={<PartnerWithUs />} />
        <Route path="/management-services" element={<ManagementServices />} />
        <Route path="/about" element={<About />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/cruise" element={<CityCruise />} />
        <Route path="/manage-booking/cancel" element={<ManageBookingCancel />} />

        {/* Search */}
        <Route path="/search" element={<SearchResults />} />
        <Route path="/search-results" element={<Navigate to="/search" replace />} />

        {/* Restaurants */}
        <Route path="/restaurants" element={<RestaurantsPage />} />
        <Route path="/restaurants/:id" element={<RestaurantDetail />} />

        {/* Event Centers */}
        <Route path="/event-centers" element={<EventCentersPage />} />
        <Route path="/event-centers/:id" element={<EventCenterDetail />} />

        {/* Tour Guides */}
        <Route path="/tour-guides" element={<TourGuidesPage />} />
        <Route path="/tour-guides/:id" element={<TourGuideDetail />} />

        {/* Chops */}
        <Route path="/chops" element={<ChopsPage />} />
        <Route path="/chops/:id" element={<ChopsDetails />} />

        {/* Gifts */}
        <Route path="/gifts" element={<GiftsPage />} />
        <Route path="/gifts/:id" element={<GiftsDetail />} />

        {/* Admin */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="business-list" element={<BusinessListPanel />} />
          <Route path="features" element={<FeaturedManager />} />
          <Route path="manage-chops" element={<ManageChops />} />
          <Route path="manage-gifts" element={<ManageGifts />} />
          <Route path="manage-cruise" element={<ManageCruises />} />
          <Route path="manage-carhire" element={<ManageCarHire />} />
          <Route path="manage-pages" element={<ManagePages />} />
          <Route path="explore-manager" element={<ExploreManager />} />
          <Route path="user-list" element={<UserList />} />
          <Route path="vendor-list" element={<VendorList />} />

          {/* 🔒 Payout – gated to manager|superadmin */}
          <Route
            path="manage-payout"
            element={
              <RequireAdmin roles={['manager','superadmin']}>
                <ManagePayout />
              </RequireAdmin>
            }
          />

          <Route path="manage-ads" element={<ManageAds />} />
          <Route path="featured-listings" element={<PublicFeaturedListings />} />
          <Route path="manage-blogs" element={<ManageBlogs />} />
          <Route path="manage-pickup-delivery" element={<ManagePickupDelivery />} />
          <Route path="manage-inquiries" element={<ManageCruiseInquiry />} />
          <Route path="change-password" element={<AdminChangePassword />} />
          <Route path="feature-manager" element={<AdminFeaturedListings />} />
          <Route path="vendor-approvals" element={<VendorApprovals />} />

          {/* You asked to keep this absolute path style */}
          <Route path="/admin/settings/commissions" element={<AdminCommissions />} />

          {/* 🔒 Admin Users – superadmin only */}
          <Route
            path="users"
            element={
              <RequireAdmin roles={['superadmin']}>
                <AdminUsers />
              </RequireAdmin>
            }
          />
        </Route>

        {/* Absolute invite page (accessible without auth) */}
        <Route path="/admin/set-password" element={<AdminSetPassword />} />

        {/* Vendor */}
        <Route path="/dashboard" element={<VendorLayout />}>
          <Route index element={<VendorDashboard />} />
          <Route path="hotels" element={<ManageHotels />} />
          <Route path="shortlets" element={<ManageShortlets />} />
          <Route path="restaurants" element={<ManageRestaurants />} />
          <Route path="event-centers" element={<ManageEventCenters />} />
          <Route path="tour-guides" element={<ManageTourGuides />} />
          <Route path="manage-business" element={<ManageBusiness />} />
          <Route path="add-service" element={<ManageBusiness type="add" />} />
          <Route path="remove-service" element={<ManageBusiness type="remove" />} />
          <Route path="change-password" element={<VendorChangePassword />} />
        </Route>

        {/* User */}
        <Route path="/user-dashboard" element={<DashboardLayout><UserDashboard /></DashboardLayout>} />
        <Route path="/my-bookings" element={<DashboardLayout><MyBookings /></DashboardLayout>} />
        <Route path="/user-referrals" element={<DashboardLayout><UserReferrals /></DashboardLayout>} />
        <Route path="/user-payouts" element={<DashboardLayout><UserPayouts /></DashboardLayout>} />
        <Route path="/user-profile" element={<DashboardLayout><UserProfile /></DashboardLayout>} />
        <Route path="/user-edit-profile" element={<DashboardLayout><UserEditProfile /></DashboardLayout>} />
        <Route path="/user-change-password" element={<DashboardLayout><UserChangePassword /></DashboardLayout>} />

        {/* Forgot/Reset */}
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    </Router>
  );
}

export default App;
