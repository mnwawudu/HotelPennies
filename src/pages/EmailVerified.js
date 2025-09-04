// ✅ src/pages/EmailVerified.js
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const EmailVerified = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    const role = searchParams.get('role');

    if (token && role) {
      localStorage.setItem('token', token);
      navigate(role === 'vendor' ? '/dashboard' : '/user-dashboard');
    } else {
      navigate('/');
    }
  }, [navigate, searchParams]);

  return <p style={{ padding: '2rem' }}>Verifying and logging you in...</p>;
};

export default EmailVerified;
