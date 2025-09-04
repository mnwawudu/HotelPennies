// ✅ src/utils/token.js
import { jwtDecode } from 'jwt-decode';

export const getDecodedToken = () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    return jwtDecode(token);
  } catch (err) {
    console.error('Invalid token:', err);
    return null;
  }
};
