import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authStore';
import { ROLES } from '../constants/roles';
import { approvalsApi } from '../api/endpoints';

const NAV = [
  { to: '/', label: 'Overview', roles: null },
  { to: '/approvals', label: 'Approvals', roles: null, badge: true },
  { to: '/bookings', label: 'Bookings', roles: null },
  { to: '/live', label: 'Live Status', roles: null },
  { to: '/resources', label: 'Resources', roles: [ROLES.SUPER_ADMIN] },
  { to: '/users', label: 'Users', roles: [ROLES.SUPER_ADMIN] },
  { to: '/audit-logs', label: 'Audit logs', roles: [ROLES.SUPER_ADMIN] },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    function refreshCount() {
      approvalsApi.pending().then((list) => setPendingCount(list.length)).catch(() => {});
    }
    refreshCount();
    // Cheap polling rather than sockets/notifications module (not built
    // yet — see backend README) — keeps the badge honest without the
    // admin needing to manually refresh the page.
    const interval = setInterval(refreshCount, 30_000);
    return () => clearInterval(interval);
  }, []);

  const visibleLinks = NAV.filter((l) => !l.roles || l.roles.includes(user?.roleId));

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-line bg-navy text-white">
      <div className="border-b border-white/10 px-5 py-5">
        <p className="font-display text-lg font-semibold">CRMS Admin</p>
        <div className="mt-1 flex flex-col gap-1">
          <p className="text-xs text-white/50">{user?.role?.roleName || user?.role}</p>
          {(user?.department?.departmentName || (typeof user?.department === 'string' && user?.department)) && (
            <span className="inline-block self-start rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-medium text-white/80">
              {user?.department?.departmentName || user?.department}
            </span>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleLinks.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            className={({ isActive }) =>
              `flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <span>{l.label}</span>
            {l.badge && pendingCount > 0 && (
              <span className="rounded-full bg-amber px-2 py-0.5 text-xs font-semibold text-navy-dark">
                {pendingCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        <p className="truncate text-sm text-white/80">{user?.name}</p>
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="mt-1 text-xs font-medium text-white/50 hover:text-white"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
