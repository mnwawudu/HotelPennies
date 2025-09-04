const DashboardLayout = ({ children }) => (
  <>
    <Header />
    <div className="user-dashboard-container">
      <UserSidebar />
      <div className="dashboard-main">{children}</div>
    </div>
  </>
);
