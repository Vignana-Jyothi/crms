import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/authStore';
import { ROLES, ADMINS, BOOKERS } from '../../constants/roles';
import { approvalsApi } from '../../api/endpoints';
import {
  Building2, CalendarCheck, CalendarDays, ChevronLeft, CircleCheck, ClipboardList,
  History, LayoutDashboard, LogOut, Pencil, Search, UserRound, Users,
} from 'lucide-react';
import ProfileModal from '../ProfileModal';

// Each label is also the title of the page it opens.
const NAV = [
  { to: '/', label: 'Book a Room', exact: true, roles: BOOKERS, icon: Search },
  { to: '/', label: 'Room Availability', exact: true, roles: [ROLES.VIEWER], icon: Search },
  { to: '/bookings', label: 'My Bookings', roles: BOOKERS, icon: CalendarCheck },
  { to: '/timetables', label: 'Timetables', roles: null, icon: CalendarDays },

  { type: 'heading', label: 'Manage bookings', roles: ADMINS },
  { to: '/admin/overview', label: 'Overview', roles: ADMINS, icon: LayoutDashboard },
  { to: '/admin/approvals', label: 'Approve Requests', badge: true, roles: ADMINS, icon: CircleCheck },
  { to: '/admin/bookings', label: 'All Bookings', roles: ADMINS, icon: ClipboardList },

  { type: 'heading', label: 'Set up', roles: [ROLES.SUPER_ADMIN] },
  { to: '/admin/resources', label: 'Rooms & Labs', roles: [ROLES.SUPER_ADMIN], icon: Building2 },
  { to: '/admin/users', label: 'Users', roles: [ROLES.SUPER_ADMIN], icon: Users },
  { to: '/admin/audit-logs', label: 'Activity Log', roles: [ROLES.SUPER_ADMIN], icon: History },
];

export default function Sidebar({ isOpen, setIsOpen }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    function refreshCount() {
      if (user && ADMINS.includes(user.roleId)) {
        approvalsApi.pending().then((list) => setPendingCount(list.length)).catch(() => {});
      }
    }
    refreshCount();
    const interval = setInterval(refreshCount, 30_000);
    window.addEventListener('approvals-updated', refreshCount);
    return () => {
      clearInterval(interval);
      window.removeEventListener('approvals-updated', refreshCount);
    };
  }, [user]);

  const visibleNav = NAV.filter((l) => !l.roles || l.roles.includes(user?.roleId));

  return (
    <>
      {/* Mobile/Desktop Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-navy/50 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-line bg-navy text-white transform transition-transform duration-300 lg:relative ${isOpen ? 'translate-x-0' : '-translate-x-full lg:hidden'}`}
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
          {/* Close button visible on both mobile and desktop when sidebar is open */}
          <button onClick={() => setIsOpen(false)} title="Hide menu" aria-label="Hide menu" className="text-white/50 hover:text-white p-1 rounded hover:bg-white/10 transition-colors">
            <ChevronLeft size={20} />
          </button>
        </div>

      <nav className="flex-1 space-y-1 px-3 py-3">
        {visibleNav.map((l, idx) => {
          if (l.type === 'heading') {
            return (
              <p key={`heading-${idx}`} className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                {l.label}
              </p>
            );
          }
          const Icon = l.icon;
          return (
            <NavLink
              key={l.label}
              to={l.to}
              end={l.exact}
              className={({ isActive }) =>
                `group flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive ? 'bg-white/15 text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon size={19} className="opacity-70 group-hover:opacity-100" />
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
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="truncate text-sm font-medium text-white/90">{user?.name}</p>
            <p className="truncate text-xs text-white/50">{user?.email}</p>
          </div>
          <button
            onClick={() => setShowProfile(true)}
            className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            title="Edit my profile"
            aria-label="Edit my profile"
          >
            <Pencil size={16} />
          </button>
        </div>
        
        {(!user?.phone || user?.phone === '0000000000') && (
          <button
            onClick={() => setShowProfile(true)}
            className="mt-2.5 w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded bg-amber/20 hover:bg-amber/30 text-amber text-[11px] font-medium border border-amber/30 transition-colors"
          >
            <span>⚠️</span> Add Phone Number
          </button>
        )}

        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => setShowProfile(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white transition-colors"
          >
            <UserRound size={14} />
            My profile
          </button>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    </aside>

    <ProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} />
    </>
  );
}
