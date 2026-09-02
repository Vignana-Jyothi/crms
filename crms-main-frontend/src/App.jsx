import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/authStore';
import { ROLES } from './constants/roles';
import ProtectedRoute from './components/ProtectedRoute';
import RequireRole from './components/admin/RequireRole';
import Sidebar from './components/admin/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ResourceDetail from './pages/ResourceDetail';
import MyBookings from './pages/MyBookings';
import Overview from './pages/admin/Overview';
import Approvals from './pages/admin/Approvals';
import Bookings from './pages/admin/Bookings';
import TimetablesView from './pages/admin/TimetablesView';
// Force docker cache invalidation

import Resources from './pages/admin/Resources';
import Users from './pages/admin/Users';
import AuditLogs from './pages/admin/AuditLogs';

function MainShell({ children }) {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  if (!user) return children; // login page fallback
  return (
    <div className="flex h-screen relative overflow-hidden bg-paper">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <main className="flex-1 flex flex-col min-w-0 bg-paper overflow-y-auto">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between bg-navy text-white px-4 py-3 shrink-0 sticky top-0 z-10">
          <span className="font-display font-semibold">CRMS</span>
          <button onClick={() => setIsSidebarOpen(true)} className="p-1 hover:text-white/80">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-x-hidden p-4 md:p-8">
          {children}
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
          <Route path="/login" element={<Login />} />
          
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
