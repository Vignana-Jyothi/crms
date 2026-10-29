import { useEffect, useState } from 'react';
import { authApi, usersApi } from '../api/endpoints';
import { AuthContext } from './authStore';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // silent = true  → used by the initial page-load (swallows errors quietly)
  // silent = false → used by Login.jsx after SSO (re-throws so the caller can inspect)
  async function checkAuthStatus({ silent = true } = {}) {
    setLoading(true);
    try {
      // The backend verifies the SSO cookie with the auth server itself, so
      // one call answers both "signed in?" and "who are you?": signed out
      // gives 401, an unregistered email 403 (EMAIL_NOT_REGISTERED).
      const localProfile = await usersApi.me({ skipAuthRedirect: true });
      setUser(localProfile);
    } catch (err) {
      setUser(null);
      if (!silent) {
        // Re-throw so Login.jsx can inspect the error code (e.g. EMAIL_NOT_REGISTERED)
        throw err;
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkAuthStatus();
  }, []);

  async function logout() {
    await authApi.logout();
    sessionStorage.removeItem('crms_dashboard_filters');
    sessionStorage.removeItem('crms_quick_search_shown');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, checkAuthStatus, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
