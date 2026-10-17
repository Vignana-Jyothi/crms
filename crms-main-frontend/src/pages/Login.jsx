import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/authStore';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';

const DEAN_EMAIL = 'deanacademics@vnrvjiet.in';
const CC_EMAIL   = 'head.iie@vnrvjiet.in';

function AccessDeniedModal({ email, onClose }) {
  const [showPreview, setShowPreview] = useState(false);

  const emailBody =
`Dear Dean Academics,

I am writing to request access to the Campus Resource Management System (CRMS) at VNRVJIET.

Requested Email: ${email || '(unknown)'}

Kindly register this email in the CRMS so that I may log in and use the system.

Thank you.`;

  // Gmail compose URL — opens Gmail directly in the browser (no mail client needed)
  const gmailUrl =
    'https://mail.google.com/mail/?view=cm' +
    `&to=${encodeURIComponent(DEAN_EMAIL)}` +
    `&cc=${encodeURIComponent(CC_EMAIL)}` +
    `&su=${encodeURIComponent('CRMS Access Request')}` +
    `&body=${encodeURIComponent(emailBody)}`;

  // Fallback mailto for Outlook / native mail apps
  const mailtoLink =
    `mailto:${DEAN_EMAIL}?cc=${encodeURIComponent(CC_EMAIL)}` +
    `&subject=${encodeURIComponent('CRMS Access Request')}` +
    `&body=${encodeURIComponent(emailBody)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">

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
        <div className="px-6 py-5 space-y-4">

          {/* Attempted email */}
          {email && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 flex items-center gap-2">
              <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              <span className="text-xs font-mono text-gray-600 truncate">{email}</span>
            </div>
          )}

          <p className="text-sm text-gray-600 leading-relaxed">
            This email is not registered in CRMS. Only pre-approved institutional accounts may access the system.
          </p>

          {/* Recipients summary */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 space-y-0.5">
            <p className="font-semibold mb-1">Request will be sent to:</p>
            <p><span className="font-medium">To:</span> {DEAN_EMAIL}</p>
            <p><span className="font-medium">CC:</span> {CC_EMAIL}</p>
            <p><span className="font-medium">Subject:</span> CRMS Access Request</p>
          </div>

          {/* Email body preview toggle */}
          <div>
            <button
              onClick={() => setShowPreview(v => !v)}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              <svg
                className={`h-3.5 w-3.5 transition-transform ${showPreview ? 'rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
              {showPreview ? 'Hide email preview' : 'Preview email body'}
            </button>

            {showPreview && (
              <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {emailBody}
                </pre>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-1">

            {/* Primary — open Gmail compose directly */}
            <a
              href={gmailUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              {/* Envelope icon */}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              Open in Gmail &amp; Send Request
            </a>

            {/* Secondary — native mail client (Outlook etc.) */}
            <a
              href={mailtoLink}
              className="flex items-center justify-center gap-2 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
              Open in Outlook / Mail App
            </a>

            <button
              onClick={onClose}
              className="w-full rounded-lg px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← Try Another Account
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

    // Decode the Google credential JWT to get the email for the modal
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

      // Fetch full profile — throws 403 if email not registered in CRMS
      await checkAuthStatus({ silent: false });
      navigate('/');
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'EMAIL_NOT_REGISTERED') {
        setDeniedEmail(googleEmail);
      } else {
        setError(
          err.response?.data?.error ||
          'SSO Login failed. Please ensure you use an authorised email.'
        );
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
