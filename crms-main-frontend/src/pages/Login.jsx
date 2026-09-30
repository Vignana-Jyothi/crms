import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/authStore';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleGoogleLogin = async (response) => {
    setError('');
    setSubmitting(true);
    try {
      await login(response.credential);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Could not sign in with Google.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-navy px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-3xl font-semibold text-white">CRMS</p>
          <p className="mt-1 text-sm text-white/60">Campus Resource Management — VNRVJIET</p>
        </div>

        <div className="rounded-lg bg-white p-8 shadow-xl text-center">
          <h2 className="mb-6 text-xl font-semibold text-ink">Sign In</h2>
          
          <div className="flex justify-center mb-4">
            <GoogleLogin
              onSuccess={handleGoogleLogin}
              onError={() => setError('Google Login Failed')}
              useOneTap={false}
              shape="rectangular"
              theme="outline"
              size="large"
            />
          </div>

          {submitting && <p className="mt-4 text-sm text-ink/70">Signing in...</p>}
          
          {error && (
            <p className="mt-4 rounded bg-brick-light px-3 py-2 text-sm text-brick">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
