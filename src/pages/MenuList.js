// 📁 src/components/MenuList.js
import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import './MenuList.css';
import UploadImageModal from '../components/UploadImageModal';
import EditMenuModal from '../components/EditMenuModal';
import CalendarModal from '../components/CalendarModal';
import FeatureMenuModal from '../components/FeatureMenuModal';
import DeleteModal from '../components/DeleteModal';
import AddMenuModal from '../components/AddMenuModal';

const MenuList = ({ restaurantId }) => {
  const [menuItems, setMenuItems] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeUploadId, setActiveUploadId] = useState(null);
  const [activeEditId, setActiveEditId] = useState(null);
  const [activeCalendarId, setActiveCalendarId] = useState(null);
  const [activeFeatureId, setActiveFeatureId] = useState(null);
  const [activeDeleteId, setActiveDeleteId] = useState(null);

  const token = localStorage.getItem('vendorToken') || sessionStorage.getItem('vendorToken');

  const fetchMenu = async () => {
    try {
      const res = await axios.get(`/api/restaurant-menus/restaurant/${restaurantId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMenuItems(res.data);
    } catch (err) {
      console.error('❌ Failed to fetch menu items:', err);
    }
  };

  useEffect(() => {
    if (restaurantId) fetchMenu();
  }, [restaurantId]);

  return (
    <div className="menu-list-container">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            backgroundColor: '#003366',
            color: '#fff',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          + Add Menu
        </button>
      </div>

      <div className="menu-grid">
        {menuItems.length === 0 ? (
          <p style={{ textAlign: 'center' }}>No menu items found.</p>
        ) : (
          menuItems.map((item) => (
            <div key={item._id} style={{ marginBottom: '20px' }}>
              <div className="menu-card">
                <img
                  src={item.mainImage || item.images?.[0] || '/default-food.jpg'}
                  alt={item.title}
                />
                <h4>{item.title}</h4>

                {item.promoPrice ? (
                  <p>
                    <span style={{ textDecoration: 'line-through', color: 'gray', marginRight: '8px' }}>
                      ₦{item.price?.toLocaleString()}
                    </span>
                    <span style={{ color: '#003366', fontWeight: 'bold' }}>
                      ₦{item.promoPrice?.toLocaleString()}
                    </span>
                  </p>
                ) : (
                  <p style={{ color: '#003366', fontWeight: 'bold' }}>
                    ₦{item.price?.toLocaleString()}
                  </p>
                )}

                {item.complimentary && (
                  <p className="complimentary">Free: {item.complimentary}</p>
                )}

                <p>{item.description}</p>

                <div className="menu-actions">
                  <button className="action-btn">View More</button>
                  <button className="action-btn buy">Buy Now</button>
                </div>
              </div>

              <div className="admin-actions">
                <button className="action-btn" onClick={() => setActiveEditId(item._id)}>Edit</button>
                <button className="action-btn" onClick={() => setActiveUploadId(item._id)}>Upload</button>
                <button className="action-btn" onClick={() => setActiveCalendarId(item._id)}>Calendar</button>
                <button className="action-btn" onClick={() => setActiveFeatureId(item._id)}>Feature</button>
                <button className="action-btn delete" onClick={() => setActiveDeleteId(item._id)}>Delete</button>
              </div>

              {activeUploadId === item._id && (
                <UploadImageModal
                  resource="restaurant-menus"
                  itemId={item._id}
                  onClose={() => setActiveUploadId(null)}
                  onUploaded={fetchMenu}
                />
              )}

              {activeEditId === item._id && (
                <EditMenuModal
                  menuItem={item}
                  onClose={() => setActiveEditId(null)}
                  onSave={fetchMenu}
                />
              )}

              {activeCalendarId === item._id && (
                <CalendarModal
                  itemId={item._id}
                  type="menu"
                  onClose={() => setActiveCalendarId(null)}
                />
              )}

              {activeFeatureId === item._id && (
                <FeatureMenuModal
                 menuId={item._id}
                  onClose={() => setActiveFeatureId(null)}
                  onSuccess={fetchMenu}
                />
              )}

              {activeDeleteId === item._id && (
                <DeleteModal
                  title="Delete Menu Item"
                  message="Are you sure you want to delete this menu item?"
                  itemId={item._id}
                  itemType="menu"
                  onCancel={() => setActiveDeleteId(null)}
                  onDeleted={fetchMenu}
                />
              )}
            </div>
          ))
        )}
      </div>

      {showAddModal && (
        <AddMenuModal
          restaurantId={restaurantId}
          onClose={() => setShowAddModal(false)}
          onMenuAdded={fetchMenu}
        />
      )}
    </div>
  );
};

export default MenuList;
