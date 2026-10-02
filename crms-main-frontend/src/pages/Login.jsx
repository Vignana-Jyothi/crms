import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/authStore';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import axios from 'axios';

export default function Login() {
  const { user, checkAuthStatus } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleGoogleSuccess = async (response) => {
    setError('');
    setSubmitting(true);
    try {
      const authUrl = import.meta.env.VITE_AUTH_URL || 'http://localhost:3115';
      await axios.post(
        `${authUrl}/auth/google`,
        { token: response.credential },
        { withCredentials: true, headers: { 'x-app-name': 'crms' } }
      );
      
      // Cookies are now set. Tell context to fetch user profile.
      await checkAuthStatus();
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'SSO Login failed. Please ensure you use an authorized email.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google Login failed. Please try again.');
  };

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id';

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <div className="grid min-h-screen place-items-center bg-navy px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <p className="font-display text-3xl font-semibold text-white">CRMS</p>
            <p className="mt-1 text-sm text-white/60">Campus Resource Management — VNRVJIET</p>
          </div>

          <div className="rounded-lg bg-white p-8 shadow-xl text-center">
            <h2 className="mb-6 text-xl font-medium text-ink">Sign in with SSO</h2>
            
            {error && (
              <p className="mb-4 rounded bg-brick-light px-3 py-2 text-sm text-brick">{error}</p>
            )}

            <div className="flex justify-center pointer-events-auto">
              {submitting ? (
                <p className="text-sm text-ink/60">Authenticating...</p>
              ) : (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  useOneTap
                  theme="outline"
                  shape="rectangular"
                  size="large"
                />
              )}
            </div>
            
            <p className="mt-6 text-xs text-ink/50">
              Only authorized @vnrvjiet.in accounts are permitted.
            </p>
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}
