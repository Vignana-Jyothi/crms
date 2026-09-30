import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/authStore';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleGoogleLogin = async (credentialResponse) => {
    try {
      setError('');
      await login(credentialResponse.credential);
      navigate('/');
    } catch (err) {
      setError('Login failed. Please try again.');
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-navy px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-3xl font-semibold text-white">CRMS</p>
          <p className="mt-1 text-sm text-white/60">Campus Resource Management — VNRVJIET</p>
        </div>

        <div className="rounded-lg bg-white p-8 shadow-xl text-center flex flex-col items-center">
          <h2 className="mb-6 text-xl font-medium text-ink">Sign in to continue</h2>
          
          <div className="w-full flex justify-center mb-4">
            <GoogleLogin
              onSuccess={handleGoogleLogin}
              onError={() => setError('Google Login Failed')}
              useOneTap={true}
            />
          </div>

          {error && <p className="mb-4 text-sm text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  );
}
