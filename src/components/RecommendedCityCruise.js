import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import './RecommendedCityCruise.css';

const RecommendedCityCruise = () => {
  const [cruises, setCruises] = useState([]);

  useEffect(() => {
    const fetchCruises = async () => {
      try {
       const res = await axios.get('/api/cruises/public'); // ✅ with 's'
        setCruises(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch cruises');
      }
    };
    fetchCruises();
  }, []);

  const settings = {
    dots: false,
    infinite: true,
    speed: 500,
    slidesToShow: 4,
    slidesToScroll: 1,
    responsive: [
      { breakpoint: 1024, settings: { slidesToShow: 3 } },
      { breakpoint: 768, settings: { slidesToShow: 2 } },
      { breakpoint: 480, settings: { slidesToShow: 1 } },
    ],
  };

  if (!cruises.length) return <p>No cruises available.</p>;

  return (
    <div className="recommended-cruise-section">
      <h3>City Cruise Packages</h3>
      <Slider {...settings}>
        {cruises.map((cruise) => (
          <div key={cruise._id} className="cruise-card">
            <h4>{cruise.title}</h4>
            <p>{cruise.duration}</p>
            <p>₦{cruise.price?.toLocaleString()}</p>
            <p style={{ fontSize: '0.85rem' }}>{cruise.description}</p>
          </div>
        ))}
      </Slider>
    </div>
  );
};

export default RecommendedCityCruise;
