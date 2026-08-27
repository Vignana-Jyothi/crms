import { useEffect, useState } from 'react';
import { authApi, usersApi } from '../api/endpoints';
import { AuthContext } from './authStore';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On refresh, if a token exists, re-hydrate the session by
    // fetching the current user rather than trusting stale state.
    const hasToken = !!localStorage.getItem('crms_access_token');
    if (!hasToken) {
      setLoading(false);
      return;
    }
    usersApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const loggedInUser = await authApi.login(email, password);
    setUser(loggedInUser);
    return loggedInUser;
  }

  function logout() {
    authApi.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
