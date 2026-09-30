import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/authStore';

export default function Login() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(false);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isSignup) {
        await signup({ name, email, phone, password });
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || err.message || (isSignup ? 'Could not sign up.' : 'Could not sign in.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-navy-dark px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-3xl font-semibold text-white">CRMS Admin</p>
          <p className="mt-1 text-sm text-white/50">Super Admin · Institute Admin · Department Admin</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg bg-white p-8 shadow-xl">
          {isSignup && (
            <>
              <label className="mb-1 block text-sm font-medium text-ink/80">Full Name</label>
              <input
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mb-4 w-full rounded border border-line px-3 py-2 text-sm focus:border-navy"
              />
              
              <label className="mb-1 block text-sm font-medium text-ink/80">Phone Number</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mb-4 w-full rounded border border-line px-3 py-2 text-sm focus:border-navy"
              />
            </>
          )}

          <label className="mb-1 block text-sm font-medium text-ink/80">Email</label>
          <input
            type="email"
            required
            autoFocus={!isSignup}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded border border-line px-3 py-2 text-sm focus:border-navy"
          />

          <label className="mb-1 block text-sm font-medium text-ink/80">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-6 w-full rounded border border-line px-3 py-2 text-sm focus:border-navy"
            placeholder={isSignup ? "At least 8 characters" : ""}
          />

          {error && (
            <p className="mb-4 rounded bg-brick-light px-3 py-2 text-sm text-brick">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-navy py-2.5 text-sm font-semibold text-white hover:bg-navy-dark disabled:opacity-60"
          >
            {submitting ? (isSignup ? 'Signing up…' : 'Signing in…') : (isSignup ? 'Sign up' : 'Sign in')}
          </button>
          
          <div className="mt-6 text-center text-sm text-ink/70">
            {isSignup ? "Already have an account?" : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup);
                setError('');
              }}
              className="font-medium text-navy hover:underline"
            >
              {isSignup ? 'Sign in' : 'Sign up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
