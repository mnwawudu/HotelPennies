// ✅ src/constants/serviceMap.js
import {
  FaHotel,
  FaHome,
  FaUtensils,
  FaBuilding,
  FaMapMarkedAlt
} from 'react-icons/fa';

export const serviceRoutes = {
  hotel: {
    path: 'hotels',
    component: 'ManageHotels',
    icon: FaHotel
  },
  shortlet: {
    path: 'shortlets',
    component: 'ManageShortlets',
    icon: FaHome
  },
  restaurant: {
    path: 'restaurants',
    component: 'ManageRestaurants',
    icon: FaUtensils
  },
  'event center': {
    path: 'event-centers',
    component: 'ManageEventCenters',
    icon: FaBuilding
  },
  'tour guide': {
    path: 'tour-guides',
    component: 'ManageTourGuides',
    icon: FaMapMarkedAlt
  }
};
