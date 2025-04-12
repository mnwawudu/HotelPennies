import React, { useEffect, useState } from 'react';

const AdvertsSection = () => {
  const [adverts, setAdverts] = useState([]);

  useEffect(() => {
    fetch('https://hotelpennies.onrender.com/api/adverts')
      .then(res => res.json())
      .then(data => setAdverts(data))
      .catch(err => console.error('Error fetching adverts:', err));
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Sponsored Adverts</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {adverts.map(ad => (
          <div key={ad._id} className="bg-white rounded-2xl shadow-md p-4 hover:shadow-lg transition">
            <img src={ad.imageUrl} alt={ad.title} className="w-full h-40 object-cover rounded-md mb-2" />
            <h3 className="text-lg font-semibold">{ad.title}</h3>
            <p className="text-sm text-gray-600">{ad.description}</p>
            <a
              href={ad.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-blue-600 hover:underline"
            >
              Learn more →
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdvertsSection;
