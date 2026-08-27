import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/authStore';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not sign in. Check your email and password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-navy px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-3xl font-semibold text-white">CRMS</p>
          <p className="mt-1 text-sm text-white/60">Campus Resource Management — VNRVJIET</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg bg-white p-8 shadow-xl">
          <label className="mb-1 block text-sm font-medium text-ink/80">Email</label>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded border border-line px-3 py-2 text-sm focus:border-navy"
            placeholder="you@vnrvjiet.in"
          />

          <label className="mb-1 block text-sm font-medium text-ink/80">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-6 w-full rounded border border-line px-3 py-2 text-sm focus:border-navy"
            placeholder="••••••••"
          />

          {error && (
            <p className="mb-4 rounded bg-brick-light px-3 py-2 text-sm text-brick">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-navy py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-dark disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
