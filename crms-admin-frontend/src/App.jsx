import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/authStore';
import { ROLES } from './constants/roles';
import ProtectedRoute from './components/ProtectedRoute';
import RequireRole from './components/RequireRole';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Approvals from './pages/Approvals';
import Bookings from './pages/Bookings';
import Resources from './pages/Resources';
import Users from './pages/Users';
import AuditLogs from './pages/AuditLogs';
import LiveStatus from './pages/LiveStatus';

function AppShell({ children }) {
  const { user } = useAuth();
  if (!user) return children; // login page: no sidebar
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-h-screen flex-1 bg-paper">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Overview /></ProtectedRoute>} />
            <Route path="/approvals" element={<ProtectedRoute><Approvals /></ProtectedRoute>} />
            <Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
            <Route path="/live" element={<ProtectedRoute><LiveStatus /></ProtectedRoute>} />
            <Route
              path="/resources"
              element={
                <ProtectedRoute>
                  <RequireRole roles={[ROLES.SUPER_ADMIN]}><Resources /></RequireRole>
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <RequireRole roles={[ROLES.SUPER_ADMIN]}><Users /></RequireRole>
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit-logs"
              element={
                <ProtectedRoute>
                  <RequireRole roles={[ROLES.SUPER_ADMIN]}><AuditLogs /></RequireRole>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AppShell>
      </AuthProvider>
    </BrowserRouter>
  );
}
