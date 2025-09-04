import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import './ManagePages.css';

const ManagePages = () => {
  const [pages, setPages] = useState([]);
  const [form, setForm] = useState({ type: '', title: '', content: '', showOnHome: false });
  const [editingId, setEditingId] = useState(null);

  const fetchPages = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await axios.get('/api/admin/pages', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPages(res.data);
    } catch (err) {
      console.error('Failed to load pages', err);
    }
  };

  useEffect(() => {
    fetchPages();
  }, []);

  const handleSubmit = async () => {
    const token = localStorage.getItem('adminToken');
    try {
      if (editingId) {
        await axios.put(`/api/admin/pages/${editingId}`, form, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post('/api/admin/pages', form, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setForm({ type: '', title: '', content: '', showOnHome: false });
      setEditingId(null);
      fetchPages();
    } catch (err) {
      console.error('Save failed', err);
    }
  };

  const handleEdit = (page) => {
    setForm({ ...page });
    setEditingId(page._id);
  };

  const handleDelete = async (id) => {
    const token = localStorage.getItem('adminToken');
    try {
      await axios.delete(`/api/admin/pages/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchPages();
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const toggleShow = async (id) => {
    const token = localStorage.getItem('adminToken');
    try {
      await axios.patch(`/api/admin/pages/${id}/toggle-show`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchPages();
    } catch (err) {
      console.error('Toggle failed', err);
    }
  };

  return (
    <div className="admin-page">
      <h2>Manage Pages</h2>

      <input
        placeholder="Type (e.g. shortlet)"
        value={form.type}
        onChange={e => setForm({ ...form, type: e.target.value })}
      />
      <input
        placeholder="Page Title"
        value={form.title}
        onChange={e => setForm({ ...form, title: e.target.value })}
      />
      <textarea
        placeholder="Page Content"
        value={form.content}
        onChange={e => setForm({ ...form, content: e.target.value })}
      />
      <label>
        <input
          type="checkbox"
          checked={form.showOnHome}
          onChange={e => setForm({ ...form, showOnHome: e.target.checked })}
        /> Show on Home
      </label>
      <button onClick={handleSubmit}>{editingId ? 'Update Page' : 'Add Page'}</button>

      <table>
        <thead>
          <tr><th>Type</th><th>Title</th><th>Show</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {pages.map(p => (
            <tr key={p._id}>
              <td>{p.type}</td>
              <td>{p.title}</td>
              <td>{p.showOnHome ? 'Yes' : 'No'}</td>
              <td>
                <button onClick={() => handleEdit(p)}>Edit</button>
                <button onClick={() => toggleShow(p._id)}>Toggle Show</button>
                <button onClick={() => handleDelete(p._id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ManagePages;
