# Authentication Integration Guide for auth.vjstartup.com

This guide explains how to integrate your new application with the centralized authentication server at `auth.vjstartup.com`.

## 🏗️ Architecture Overview

- **Auth Server**: `https://auth.vjstartup.com` (production) / `http://localhost:3115` (local)
- **Authentication**: Google OAuth + JWT tokens
- **SSO Method**: HttpOnly cookies with shared domain
- **Session Management**: Automatic across all integrated apps

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
npm install @react-oauth/google js-cookie axios
```

### 2. Environment Variables

Create `.env` files for different environments:

```env
# .env.local
VITE_AUTH_URL=http://localhost:3115

# .env.production  
VITE_AUTH_URL=https://auth.vjstartup.com

# Google OAuth Client ID (same for all apps)
VITE_GOOGLE_CLIENT_ID=522460567146-ubk3ojomopil8f68hl73jt1pj0jbbm68.apps.googleusercontent.com
```

### 3. Setup Google OAuth Provider

```tsx
// main.tsx
import { GoogleOAuthProvider } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>
);
```

## 🔐 Authentication Implementation

### 4. Create Auth Context

```tsx
// AuthContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import Cookies from 'js-cookie';

interface User {
  name: string;
  email: string;
  picture: string;
}

interface AuthContextType {
  user: User | null;
  login: (googleToken: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  const AUTH_URL = import.meta.env.VITE_AUTH_URL;

  // Check authentication on app load
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

  const login = async (googleToken: string) => {
    try {
      const response = await fetch(`${AUTH_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: googleToken }),
        credentials: 'include', // Important: receives cookies
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        
        // Optional: Set client-side cookies for UI display
        const cookieOptions = {
          domain: window.location.hostname === 'localhost' 
            ? 'localhost' 
            : '.vjstartup.com',
          secure: window.location.protocol === 'https:',
          sameSite: 'lax' as const,
          expires: 7 // 7 days
        };
        
        Cookies.set('user', JSON.stringify(data.user), cookieOptions);
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
      
      // Redirect to login or home page
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### 5. Create Login Component

```tsx
// LoginModal.tsx
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from './AuthContext';

const LoginModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { login } = useAuth();

  const handleGoogleLogin = async (response: any) => {
    try {
      await login(response.credential);
      onClose();
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Login</h2>
        <GoogleLogin
          onSuccess={handleGoogleLogin}
          onError={() => console.error('Google Login Failed')}
          useOneTap={false}
        />
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default LoginModal;
```

### 6. Create Protected Route Component

```tsx
// ProtectedRoute.tsx
import { useAuth } from './AuthContext';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
```

### 7. Setup App with Auth Provider

```tsx
// App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import ProtectedRoute from './ProtectedRoute';
import LoginPage from './LoginPage';
import Dashboard from './Dashboard';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
```

## 🔗 API Integration

### 8. Making Authenticated API Calls

```tsx
// apiClient.ts
const API_BASE_URL = import.meta.env.VITE_API_URL;

export const apiClient = {
  async get(endpoint: string) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      credentials: 'include', // Sends userToken cookie
    });
    return response.json();
  },

  async post(endpoint: string, data: any) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });
    return response.json();
  }
};
```

## 🖥️ Backend Integration

### 9. Token Verification Middleware (Node.js/Express)

```javascript
// middleware/auth.js
const axios = require('axios');

const AUTH_URL = process.env.AUTH_URL || 'https://auth.vjstartup.com';

const verifyToken = async (req, res, next) => {
  try {
    const token = req.cookies.userToken;
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token with auth server
    const response = await axios.get(`${AUTH_URL}/verify-token`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 200) {
      req.user = response.data.user;
      next();
    } else {
      res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

module.exports = { verifyToken };
```

### 10. Using the Middleware

```javascript
// routes/api.js
const express = require('express');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Protected route
router.get('/profile', verifyToken, (req, res) => {
  res.json({ user: req.user });
});

router.post('/data', verifyToken, (req, res) => {
  // req.user contains authenticated user info
  res.json({ message: 'Data created', user: req.user });
});

module.exports = router;
```

## 🔧 Configuration Notes

### Cookie Settings

- **Local Development**: `Domain=localhost` (works across all ports)
- **Production**: `Domain=.vjstartup.com` (works across all subdomains)
- **Security**: HttpOnly for userToken, accessible for user info

### CORS Configuration

Ensure your backend allows credentials:

```javascript
app.use(cors({
  origin: ['http://localhost:5173', 'https://yourapp.vjstartup.com'],
  credentials: true
}));
```

## ✅ Testing Checklist

- [ ] Login works and sets cookies
- [ ] User info displays correctly
- [ ] Protected routes redirect when not authenticated
- [ ] Logout clears session
- [ ] SSO works across different apps
- [ ] API calls include authentication

## 🤝 SSO Benefits

Once integrated, your app will automatically:
- ✅ Share login sessions with other VJ apps
- ✅ Allow users to switch between apps without re-login
- ✅ Maintain consistent user experience
- ✅ Handle token refresh automatically

## 📞 Support

For issues or questions, refer to the auth server documentation or contact the development team.


// Middleware to verify auth
const verifyAuth = async (req, res, next) => {
  const token = req.cookies.userToken;
  
  const response = await fetch('https://auth.vjstartup.com/verify-token', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (response.ok) {
    req.user = await response.json();
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

## Smoke Test

node scripts/smoke-test.js
 or
npm run test:smoke