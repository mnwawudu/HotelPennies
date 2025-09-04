// ✅ src/pages/HotelDetail.js
import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import Header from '../components/Header';
import MainFooter from '../components/MainFooter';
import BusinessSearchBar from '../components/BusinessSearchBar';
import NearbyHotels from '../components/NearbyHotels';
import NearbyRestaurants from '../components/NearbyRestaurants';
import RecommendedChops from '../components/RecommendedChops';
import ReviewSection from '../components/ReviewSection';
import BookRoomModal from '../components/BookRoomModal';
import ImageViewerModal from '../components/ImageViewerModal';
import './HotelDetail.css';

const HotelDetail = () => {
  const { id } = useParams();
  const [hotel, setHotel] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [viewerImages, setViewerImages] = useState([]);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const roomCarouselRefs = useRef([]);
  const hotelCarouselRef = useRef(null);
  const hotelIntervalRef = useRef(null);

  useEffect(() => {
    const fetchHotel = async () => {
      try {
        const res = await axios.get(`/api/hotels/public/${id}`);
        setHotel(res.data);
      } catch (err) {
        console.error('Failed to load hotel details.');
      }
    };

    const fetchRooms = async () => {
      try {
        const res = await axios.get(`/api/hotel-rooms/${id}/rooms`);
        setRooms(res.data);
      } catch (err) {
        console.error('❌ Error fetching rooms:', err);
      }
    };

    fetchHotel();
    fetchRooms();
  }, [id]);

  useEffect(() => {
    if (!hotelCarouselRef.current) return;

    const autoScroll = () => {
      if (!hotelCarouselRef.current) return;
      const carousel = hotelCarouselRef.current;
      const scrollWidth = carousel.scrollWidth;
      const visibleWidth = carousel.clientWidth;
      const scrollLeft = carousel.scrollLeft;
      const newPosition = scrollLeft + visibleWidth >= scrollWidth ? 0 : scrollLeft + visibleWidth;
      carousel.scrollTo({ left: newPosition, behavior: 'smooth' });
    };

    hotelIntervalRef.current = setInterval(autoScroll, 7000);
    return () => clearInterval(hotelIntervalRef.current);
  }, [hotel]);

  const scrollRoomLeft = (index) => {
    roomCarouselRefs.current[index]?.scrollBy({ left: -roomCarouselRefs.current[index].offsetWidth, behavior: 'smooth' });
  };

  const scrollRoomRight = (index) => {
    roomCarouselRefs.current[index]?.scrollBy({ left: roomCarouselRefs.current[index].offsetWidth, behavior: 'smooth' });
  };

  const openImageViewer = (images, startIndex = 0) => {
    setViewerImages(images);
    setViewerIndex(startIndex);
    setIsViewerOpen(true);
  };

  const handleBookRoom = (room) => setSelectedRoom(room);

  if (!hotel) return <div>Loading...</div>;

  const { name, location, city, state, mainImage, images = [], amenities = [], reviews = [], termsAndConditions = '' } = hotel;
  const allImages = [mainImage, ...images.filter((img) => img !== mainImage)];

  return (
    <>
      <Header />
      <div className="breadcrumbs" style={{ marginTop: '1.5rem' }}>
        <p><a href="/">Home</a> &gt; <a href="/hotels">Hotels</a> &gt; {name}</p>
      </div>
      <BusinessSearchBar businessType="hotel" />
      <div className="hotel-detail-container">
        <div className="hotel-header-text">
          <h2>{name}</h2>
          <p className="hotel-full-address">{location}, {city}, {state}</p>
        </div>

        <div className="hotel-carousel-wrapper">
          <button className="carousel-arrow left" onClick={() => hotelCarouselRef.current?.scrollBy({ left: -400, behavior: 'smooth' })}>&lt;</button>
          <div className="hotel-carousel no-scrollbar" ref={hotelCarouselRef} style={{ overflow: 'hidden' }}>
            {allImages.map((img, idx) => (
              <img key={idx} src={img} alt={`hotel-${idx}`} className="hotel-carousel-img" />
            ))}
          </div>
          <button className="carousel-arrow right" onClick={() => hotelCarouselRef.current?.scrollBy({ left: 400, behavior: 'smooth' })}>&gt;</button>
        </div>

        {/* ✅ Amenities card moved BEFORE Booking Terms */}
        {amenities.length > 0 && (
          <div className="hotel-section">
            <h3>Facilities / Amenities</h3>
            <div className="amenities-grid">
              {amenities.map((item, i) => (
                <div className="amenity" key={i}>{item}</div>
              ))}
            </div>
          </div>
        )}

        <div className="hotel-terms-box">
          <h4>Booking Terms & Conditions</h4>
          <ul className="hotel-terms-list">
            {termsAndConditions.trim()
              ? termsAndConditions.split('\n').map((line, i) => <li key={i}>{line.trim()}</li>)
              : <>
                  <li><strong>Check-in:</strong> From 12:00 PM</li>
                  <li><strong>Check-out:</strong> By 12:00 PM (noon)</li>
                  <li><strong>Cancellation:</strong> Free cancellation within 24 hours of booking...</li>
                  <li><strong>Identification:</strong> Valid ID required at check-in</li>
                  <li><strong>Security Deposit:</strong> May apply</li>
                  <li><strong>Payment:</strong> Full payment required</li>
                  <li><strong>No Smoking:</strong> Not allowed inside rooms</li>
                  <li><strong>Guest Policy:</strong> No unregistered guests after 10 PM</li>
                </>
            }
          </ul>
        </div>

        <div className="room-section-main">
          <h3 style={{ marginBottom: '1.5rem', color: 'navy' }}>Find a Room That Suits Your Stay</h3>
          {rooms.map((room, index) => {
            const hasDiscount = room.promoPrice && room.price > room.promoPrice;
            const discountPercent = hasDiscount ? Math.round(((room.price - room.promoPrice) / room.price) * 100) : 0;
            const roomImages = [room.mainImage, ...(room.images || []).filter(img => img !== room.mainImage)];

            return (
              <div className="room-card-wrapper hoverable" key={index}>
                <div className="room-card-long">
                  <div className="room-image-container">
                    <div className="room-carousel-wrapper">
                      <button className="scroll-btn left" onClick={() => scrollRoomLeft(index)}>&#10094;</button>
                      <div className="room-carousel" ref={el => roomCarouselRefs.current[index] = el}>
                        {roomImages.map((img, i) => (
                          <img
                            key={i}
                            src={img || '/fallback-room.jpg'}
                            alt={`${room.name}-${i}`}
                            className="room-img-left"
                            loading="lazy"
                            onClick={() => openImageViewer(roomImages, i)}
                          />
                        ))}
                      </div>
                      <button className="scroll-btn right" onClick={() => scrollRoomRight(index)}>&#10095;</button>
                    </div>
                    {hasDiscount && <div className="discount-badge pink">{discountPercent}% OFF</div>}
                  </div>

                  <div className="room-info-right">
                    <h4>{room.name}</h4>
                    <p className="room-price">
                      <strong>₦{Number(room.promoPrice || room.price).toLocaleString()}</strong>
                    </p>
                    {(room.bedType || room.guests) && (
                      <p style={{ fontSize: '0.9rem', color: '#444' }}>
                        {room.bedType && <>🛏️ {room.bedType}</>}
                        {room.bedType && room.guests && ' | '}
                        {room.guests && <>👥 {room.guests} guest{room.guests > 1 ? 's' : ''}</>}
                      </p>
                    )}
                    {room.complimentary && <p className="complimentary-text">{room.complimentary}</p>}
                    {room.description && <p className="room-description">{room.description}</p>}
                    <button onClick={() => handleBookRoom(room)} className="choose-room-btn">
                      Book Room
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="hotel-section review-section-wrapper">
          <ReviewSection itemId={id} type="hotel" />
        </div>
      </div>

      <div className="map-section" style={{ margin: '3rem 0' }}>
        <iframe
          title="Hotel Map"
          src={`https://www.google.com/maps?q=${encodeURIComponent(location)}&output=embed`}
          width="100%"
          height="400"
          style={{ border: 0, borderRadius: '12px' }}
          allowFullScreen
          loading="lazy"
        ></iframe>
      </div>

      <div className="hotel-section">
        <NearbyHotels currentCity={city?.replace(/ city$/i, '').trim()} currentHotelId={id} />
      </div>

      <div className="hotel-section">
        <NearbyRestaurants city={city?.replace(/ city$/i, '').trim()} />
      </div>

      <div className="hotel-section">
        <RecommendedChops />
      </div>

      {selectedRoom && (
        <BookRoomModal
          room={selectedRoom}
          hotelName={name}
          onClose={() => setSelectedRoom(null)}
        />
      )}

      {isViewerOpen && (
        <ImageViewerModal
          images={viewerImages}
          currentIndex={viewerIndex}
          onClose={() => setIsViewerOpen(false)}
        />
      )}

      <MainFooter />
    </>
  );
};

export default HotelDetail;
