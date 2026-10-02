import { useEffect, useState } from 'react';
import { authApi, usersApi } from '../api/endpoints';
import { AuthContext } from './authStore';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function checkAuthStatus() {
    setLoading(true);
    try {
      const data = await authApi.checkAuth();
      if (data.logged_in) {
        // Also fetch the local database profile to get role and department!
        // wait, the backend `usersApi.me()` still works because authenticate.js reads the cookie.
        // It's safer to just fetch `usersApi.me()` so we get the full local profile.
        const localProfile = await usersApi.me();
        setUser(localProfile);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
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
    <AuthContext.Provider value={{ user, loading, checkAuthStatus, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
