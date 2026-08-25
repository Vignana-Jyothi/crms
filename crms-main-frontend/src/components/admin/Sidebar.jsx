import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth, ROLES } from '../../context/AuthContext';
import { approvalsApi } from '../../api/endpoints';

const NAV = [
  { 
    to: '/', label: 'Find a Resource', exact: true, roles: null,
    icon: <svg className="w-5 h-5 opacity-70 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
  },
  { 
    to: '/bookings', label: 'My Bookings', roles: null,
    icon: <svg className="w-5 h-5 opacity-70 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
  },
  { type: 'divider', roles: [ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN, ROLES.DEPARTMENT_ADMIN] },
  { 
    to: '/admin/overview', label: 'Admin Overview', roles: [ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN, ROLES.DEPARTMENT_ADMIN],
    icon: <svg className="w-5 h-5 opacity-70 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
  },
  { 
    to: '/admin/approvals', label: 'Approvals', badge: true, roles: [ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN, ROLES.DEPARTMENT_ADMIN],
    icon: <svg className="w-5 h-5 opacity-70 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  },
  { 
    to: '/admin/bookings', label: 'All Bookings', roles: [ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN, ROLES.DEPARTMENT_ADMIN],
    icon: <svg className="w-5 h-5 opacity-70 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
  },
  { 
    to: '/admin/live', label: 'Live Status', roles: [ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN, ROLES.DEPARTMENT_ADMIN],
    icon: <svg className="w-5 h-5 opacity-70 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  },
  { 
    to: '/admin/timetables', label: 'All Timetables', roles: [ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN, ROLES.DEPARTMENT_ADMIN],
    icon: <svg className="w-5 h-5 opacity-70 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
  },
  { type: 'divider', roles: [ROLES.SUPER_ADMIN] },
  { 
    to: '/admin/resources', label: 'Resource Database', roles: [ROLES.SUPER_ADMIN],
    icon: <svg className="w-5 h-5 opacity-70 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
  },
  { 
    to: '/admin/users', label: 'User Management', roles: [ROLES.SUPER_ADMIN],
    icon: <svg className="w-5 h-5 opacity-70 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
  },
  { 
    to: '/admin/audit-logs', label: 'Audit Logs', roles: [ROLES.SUPER_ADMIN],
    icon: <svg className="w-5 h-5 opacity-70 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
  },
];

export default function Sidebar({ isOpen, setIsOpen }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    function refreshCount() {
      if (user && [ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN, ROLES.DEPARTMENT_ADMIN].includes(user.roleId)) {
        approvalsApi.pending().then((list) => setPendingCount(list.length)).catch(() => {});
      }
    }
    refreshCount();
    const interval = setInterval(refreshCount, 30_000);
    return () => clearInterval(interval);
  }, [user]);

  const visibleNav = NAV.filter((l) => !l.roles || l.roles.includes(user?.roleId));

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-navy/50 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-line bg-navy text-white transform transition-transform duration-300 md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="border-b border-white/10 px-5 py-5 flex items-center justify-between">
          <div>
            <p className="font-display text-xl font-bold tracking-wide">CRMS</p>
            <div className="mt-1 flex flex-col gap-1">
              <p className="text-xs text-white/50">{user?.role?.roleName || user?.role}</p>
              {(user?.department?.departmentName || (typeof user?.department === 'string' && user?.department)) && (
                <span className="inline-block self-start rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-medium text-white/80">
                  {user?.department?.departmentName || user?.department}
                </span>
              )}
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-white/50 hover:text-white p-1">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleNav.map((l, idx) => {
          if (l.type === 'divider') {
            return <div key={`div-${idx}`} className="my-4 border-t border-white/10 mx-2" />;
          }
          return (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.exact}
              className={({ isActive }) =>
                `group flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive ? 'bg-white/15 text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <div className="flex items-center gap-3">
                {l.icon}
                <span>{l.label}</span>
              </div>
              {l.badge && pendingCount > 0 && (
                <span className="rounded-full bg-amber px-2 py-0.5 text-xs font-semibold text-navy-dark shadow-sm">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        <p className="truncate text-sm font-medium text-white/90">{user?.name}</p>
        <p className="truncate text-xs text-white/50 mb-3">{user?.email}</p>
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="text-xs font-medium text-brick hover:text-brick-light transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
    </>
  );
}
