import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/authStore';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';

const DEAN_EMAIL = 'deanacademics@vnrvjiet.in';
const CC_EMAIL   = 'head.iie@vnrvjiet.in';

function AccessDeniedModal({ email, onClose }) {
  const subject = encodeURIComponent('CRMS Access Request');
  const body = encodeURIComponent(
    `Dear Dean Academics,\n\nI am writing to request access to the Campus Resource Management System (CRMS).\n\nEmail: ${email || '(unknown)'}\n\nPlease grant me access at the earliest convenience.\n\nThank you.`
  );
  const mailtoLink = `mailto:${DEAN_EMAIL}?cc=${CC_EMAIL}&subject=${subject}&body=${body}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden animate-[fadeInUp_0.25s_ease]">
        {/* Header */}
        <div className="bg-gradient-to-r from-brick to-amber-600 px-6 py-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 shrink-0">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Access Denied</h2>
            <p className="text-xs text-white/80">Your email is not authorised to use CRMS</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {email && (
            <div className="mb-4 rounded-lg bg-paper border border-line px-3 py-2 flex items-center gap-2">
              <svg className="h-4 w-4 text-ink/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              <span className="text-xs font-mono text-ink/70 truncate">{email}</span>
            </div>
          )}

          <p className="text-sm text-ink/70 leading-relaxed mb-2">
            This email is not registered in the Campus Resource Management System. Only pre-approved institutional accounts may access CRMS.
          </p>
          <p className="text-sm text-ink/70 leading-relaxed mb-5">
            To request access, click the button below to send an email to the Dean of Academics.
          </p>

          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 mb-5">
            <p className="text-[11px] font-semibold text-amber-800 mb-0.5">Request will be sent to:</p>
            <p className="text-xs text-amber-700">
              <span className="font-medium">To:</span> {DEAN_EMAIL}
            </p>
            <p className="text-xs text-amber-700">
              <span className="font-medium">CC:</span> {CC_EMAIL}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <a
              href={mailtoLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-dark transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
              Send Access Request Email
            </a>
            <button
              onClick={onClose}
              className="w-full rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink hover:bg-paper transition-colors"
            >
              Try Another Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const { user, checkAuthStatus } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deniedEmail, setDeniedEmail] = useState(null); // null = hidden, string = show modal

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleGoogleSuccess = async (response) => {
    setError('');
    setDeniedEmail(null);
    setSubmitting(true);

    // Decode the Google credential JWT to extract the email for the modal
    let googleEmail = '';
    try {
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      googleEmail = payload.email || '';
    } catch (_) {}

    try {
      const authUrl = import.meta.env.VITE_AUTH_URL || 'https://auth.vjstartup.com';
      await axios.post(
        `${authUrl}/auth/google`,
        { token: response.credential },
        { withCredentials: true, headers: { 'x-app-name': 'crms' } }
      );

      // Cookies are now set. Tell context to fetch user profile.
      await checkAuthStatus();
      navigate('/');
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'EMAIL_NOT_REGISTERED') {
        // Show the access-request modal
        setDeniedEmail(googleEmail);
      } else {
        setError(err.response?.data?.error || 'SSO Login failed. Please ensure you use an authorised email.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google Login failed. Please try again.');
  };

  return (
    <>
      {/* Access Denied Modal */}
      {deniedEmail !== null && (
        <AccessDeniedModal email={deniedEmail} onClose={() => setDeniedEmail(null)} />
      )}

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
              Only authorised @vnrvjiet.in accounts are permitted.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
