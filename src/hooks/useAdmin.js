import { useEffect, useState } from 'react';

const useAdmin = () => {
  const [admin, setAdmin] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('admin');
    if (stored) setAdmin(JSON.parse(stored));
  }, []);

  return admin;
};

export default useAdmin;
