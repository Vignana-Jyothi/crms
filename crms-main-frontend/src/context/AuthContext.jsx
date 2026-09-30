import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { AuthContext } from './authStore';

const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:3115';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch(`${AUTH_URL}/check-auth`, {
        credentials: 'include', // Important: sends cookies
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (googleToken) => {
    try {
      const response = await fetch(`${AUTH_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: googleToken }),
        credentials: 'include', // receives cookies
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        
        const cookieOptions = {
          domain: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
          secure: window.location.protocol === 'https:',
          sameSite: 'lax',
          expires: 7 // 7 days
        };
        
        Cookies.set('user', JSON.stringify(data.user), cookieOptions);
        return data.user;
      } else {
        throw new Error('Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await fetch(`${AUTH_URL}/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      
      setUser(null);
      Cookies.remove('user');
      sessionStorage.removeItem('crms_dashboard_filters');
      sessionStorage.removeItem('crms_quick_search_shown');
      
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
