// src/components/UserLayout.js
import React from 'react';
import Header from './Header';
import UserSidebar from './UserSidebar';

const styles = {
  // Whole page uses flex column and never scrolls the window
  shell: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden', // ⬅️ lock window scroll
  },
  // Row with sidebar + main
  body: {
    display: 'flex',
    flex: 1,
    minHeight: 0, // ⬅️ critical for flex children to be scrollable
  },
  // Only MAIN scrolls
  main: {
    flex: 1,
    minHeight: 0,       // ⬅️ lets overflow work inside flex
    overflow: 'auto',   // ⬅️ this becomes the scroller
    overflowAnchor: 'none', // ⬅️ prevents “jump to top” on updates
    padding: '2rem',
    width: '100%',
    maxWidth: 1200,
    margin: '0 auto',
    boxSizing: 'border-box',
  },
};

const UserLayout = ({ children }) => {
  return (
    <div style={styles.shell}>
      {/* If your Header is fixed (position: fixed), add paddingTop equal to header height below */}
      <Header />
      <div style={styles.body}>
        <UserSidebar />
        <main style={styles.main}>{children}</main>
      </div>
    </div>
  );
};

export default UserLayout;
