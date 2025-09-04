// ✅ ManagePickupDeliveryOptions.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AddPickupDeliveryModal from '../components/AddPickupDeliveryModal';
import EditPickupDeliveryModal from '../components/EditPickupDeliveryModal';
import DeletePickupDeliveryModal from '../components/DeletePickupDeliveryModal';

const ManagePickupDeliveryOptions = () => {
  const [options, setOptions] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  const fetchOptions = async () => {
    try {
      const res = await axios.get('/api/pickup-delivery');
      setOptions(res.data);
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Pickup & Delivery Options</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          + Add Option
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {options.map((opt) => (
          <div key={opt._id} className="border p-4 rounded shadow">
            <h3 className="font-semibold">{opt.service}</h3>
            <p className="text-sm text-gray-600">Applies To: {opt.appliesTo.join(', ')}</p>
            <p className="text-sm">Pickup: {opt.pickup ? 'Yes' : 'No'}</p>
            <p className="text-sm">Delivery: {opt.delivery ? 'Yes' : 'No'}</p>
            <div className="mt-3 flex gap-3">
              <button
                onClick={() => setEditItem(opt)}
                className="text-blue-600 underline"
              >
                Edit
              </button>
              <button
                onClick={() => setDeleteItem(opt)}
                className="text-red-600 underline"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAdd && <AddPickupDeliveryModal onClose={() => { setShowAdd(false); fetchOptions(); }} />}
      {editItem && (
        <EditPickupDeliveryModal
          item={editItem}
          onClose={() => { setEditItem(null); fetchOptions(); }}
        />
      )}
      {deleteItem && (
        <DeletePickupDeliveryModal
          title="Delete Option"
          message={`Are you sure you want to delete this option for ${deleteItem.service}?`}
          onCancel={() => setDeleteItem(null)}
          onConfirm={async () => {
            await axios.delete(`/api/pickup-delivery/${deleteItem._id}`);
            setDeleteItem(null);
            fetchOptions();
          }}
        />
      )}
    </div>
  );
};

export default ManagePickupDeliveryOptions;
