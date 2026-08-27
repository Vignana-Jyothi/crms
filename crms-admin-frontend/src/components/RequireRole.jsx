import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/authStore';

// Section 15/16 of the doc: some screens (Users, Resources, Audit
// Logs) are Super Admin only, even though Institute/Department
// Admin can log into the same app. Redirect rather than render a
// broken/empty page for roles that shouldn't see it.
export default function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user?.roleId)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
