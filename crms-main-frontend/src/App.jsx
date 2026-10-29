import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/authStore';
import { ROLES } from './constants/roles';
import ProtectedRoute from './components/ProtectedRoute';
import RequireRole from './components/admin/RequireRole';
import Sidebar from './components/admin/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// The other pages download when first opened, so the landing page doesn't
// wait for admin screens (and their libraries) most visitors never see.
const ResourceDetail = lazy(() => import('./pages/ResourceDetail'));
const MyBookings = lazy(() => import('./pages/MyBookings'));
const Overview = lazy(() => import('./pages/admin/Overview'));
const Approvals = lazy(() => import('./pages/admin/Approvals'));
const Bookings = lazy(() => import('./pages/admin/Bookings'));
const TimetablesView = lazy(() => import('./pages/admin/TimetablesView'));
// Force docker cache invalidation

const Resources = lazy(() => import('./pages/admin/Resources'));
const Users = lazy(() => import('./pages/admin/Users'));
const AuditLogs = lazy(() => import('./pages/admin/AuditLogs'));

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id';

function MainShell({ children }) {
  const { user } = useAuth();
  // Default to open on desktop (lg), closed on tablet/mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 1024);
  
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  
  if (!user) return children; // login page fallback
  return (
    <div className="flex h-screen relative overflow-hidden bg-paper">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <main className="flex-1 flex flex-col min-w-0 bg-paper overflow-y-auto">
        {/* Header - shown on mobile always, shown on desktop only when sidebar is closed */}
        <div className={`${isSidebarOpen ? 'lg:hidden' : ''} flex items-center justify-between bg-navy text-white px-4 py-3 shrink-0 sticky top-0 z-10`}>
          <span className="font-display font-semibold">CRMS</span>
          <button onClick={() => setIsSidebarOpen(true)} className="p-1 hover:text-white/80">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-x-hidden p-4 md:p-8">
          <Suspense fallback={<p className="text-sm text-ink/50">Loading…</p>}>
            {children}
          </Suspense>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Google's sign-in script (~100 KB) is only needed here. */}
          <Route path="/login" element={<GoogleOAuthProvider clientId={googleClientId}><Login /></GoogleOAuthProvider>} />
          
          {/* Main App Routes */}
          <Route path="/" element={<ProtectedRoute><MainShell><Dashboard /></MainShell></ProtectedRoute>} />
          <Route path="/resources/:resourceId" element={<ProtectedRoute><MainShell><ResourceDetail /></MainShell></ProtectedRoute>} />
          <Route path="/bookings" element={<ProtectedRoute><MainShell><MyBookings /></MainShell></ProtectedRoute>} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<Navigate to="/admin/approvals" replace />} />
          <Route path="/admin/overview" element={<ProtectedRoute><RequireRole roles={[ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN, ROLES.DEPARTMENT_ADMIN]}><MainShell><Overview /></MainShell></RequireRole></ProtectedRoute>} />
          <Route path="/admin/approvals" element={<ProtectedRoute><RequireRole roles={[ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN, ROLES.DEPARTMENT_ADMIN]}><MainShell><Approvals /></MainShell></RequireRole></ProtectedRoute>} />
          <Route path="/admin/bookings" element={<ProtectedRoute><RequireRole roles={[ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN, ROLES.DEPARTMENT_ADMIN]}><MainShell><Bookings /></MainShell></RequireRole></ProtectedRoute>} />

          <Route path="/admin/timetables" element={<ProtectedRoute><RequireRole roles={[ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN, ROLES.DEPARTMENT_ADMIN]}><MainShell><TimetablesView /></MainShell></RequireRole></ProtectedRoute>} />

          <Route path="/admin/resources" element={<ProtectedRoute><RequireRole roles={[ROLES.SUPER_ADMIN]}><MainShell><Resources /></MainShell></RequireRole></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><RequireRole roles={[ROLES.SUPER_ADMIN]}><MainShell><Users /></MainShell></RequireRole></ProtectedRoute>} />
          <Route path="/admin/audit-logs" element={<ProtectedRoute><RequireRole roles={[ROLES.SUPER_ADMIN]}><MainShell><AuditLogs /></MainShell></RequireRole></ProtectedRoute>} />

          {/* Catch-all 404 Route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
