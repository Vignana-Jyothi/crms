import { createContext, useContext, useEffect, useState } from 'react';
import { authApi, usersApi } from '../api/endpoints';

const AuthContext = createContext(null);

// Matches role_id values seeded in the roles table.
export const ROLES = { SUPER_ADMIN: 1, INSTITUTE_ADMIN: 2, DEPARTMENT_ADMIN: 3, REQUESTER: 4 };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    if (loggedInUser.role === 'Requester') {
      // The requester role has no business in the admin app at all —
      // reject it here rather than letting them in and hiding nav items,
      // since a Requester poking at admin API routes should get a clean
      // "wrong app" message, not a confusing empty dashboard.
      authApi.logout();
      throw new Error('This account does not have admin access. Use the main booking site instead.');
    }
    const fullUser = await usersApi.me();
    setUser(fullUser);
    return fullUser;
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

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
