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
      const data = await authApi.checkAuth();
      if (data.logged_in) {
        // Fetch the full local profile (role, department, etc.) from the backend.
        // authenticate.js middleware will reject unregistered emails with 403 here.
        const localProfile = await usersApi.me();
        setUser(localProfile);
      } else {
        setUser(null);
      }
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
