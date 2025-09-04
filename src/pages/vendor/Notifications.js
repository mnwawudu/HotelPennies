import React from 'react';

const Notifications = ({ notifications = [] }) => (
  <div>
    <h3>Notifications</h3>
    {notifications.length === 0 ? (
      <p>No notifications yet.</p>
    ) : (
      notifications.map((note, i) => (
        <div key={i} style={{ borderBottom: '1px solid #eee', padding: '0.5rem 0' }}>
          <p>{note.message}</p>
          <small>{new Date(note.date).toLocaleString()}</small>
        </div>
      ))
    )}
  </div>
);

export default Notifications;
