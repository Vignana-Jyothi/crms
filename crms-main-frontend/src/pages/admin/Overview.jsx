import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { approvalsApi, bookingsApi, resourcesApi } from '../../api/endpoints';
import { useAuth, ROLES } from '../../context/AuthContext';
import { fmtDate, fmtTimeSlot } from '../../utils/formatters';

function StatCard({ label, value, to, color = 'navy' }) {
  const content = (
    <div className={`rounded-lg border border-line bg-white p-6 transition-shadow ${to ? 'hover:shadow-md cursor-pointer hover:border-navy/30' : ''}`}>
      <p className="text-sm font-medium text-ink/60">{label}</p>
      <p className={`mt-2 font-display text-4xl font-bold text-${color}`}>{value}</p>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export default function Overview() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ pending: null, totalResources: null, activeBookings: null });
  
  // Storing full lists for the recent activity sections
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      approvalsApi.pending().then((list) => {
        setPendingApprovals(list.slice(0, 5));
        setStats((s) => ({ ...s, pending: list.length }));
      }),
      resourcesApi.list({}).then((list) => {
        setStats((s) => ({ ...s, totalResources: list.length }));
      }),
      bookingsApi.list({ status: 'Approved' }).then((list) => {
        setRecentBookings(list.slice(0, 5));
        setStats((s) => ({ ...s, activeBookings: list.length }));
      })
    ]).finally(() => setLoading(false));
  }, []);

  const canManageResources = user?.roleId === ROLES.SUPER_ADMIN;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold text-navy">Welcome back, {user?.name}</h1>
          <p className="mt-1 text-sm text-ink/60">Here is what is happening across your resources today.</p>
        </div>
        <Link to="/admin/live" className="rounded bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark transition-colors shadow-sm">
          View Live Status
        </Link>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[1, 2, 3].map(i => <div key={i} className="h-28 bg-line/20 rounded-lg"></div>)}
          </div>
          <div className="h-64 bg-line/20 rounded-lg"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-10">
            <StatCard label="Pending Approvals" value={stats.pending ?? '0'} to="/admin/approvals" color={stats.pending > 0 ? 'amber' : 'navy'} />
            <StatCard label="Approved Bookings" value={stats.activeBookings ?? '0'} to="/admin/bookings" color="forest" />
            <StatCard
              label="Total Resources"
              value={stats.totalResources ?? '0'}
              to={canManageResources ? '/admin/resources' : undefined}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Needs Attention Column */}
            <div className="rounded-xl border border-line bg-white shadow-sm overflow-hidden flex flex-col">
              <div className="border-b border-line bg-paper/50 px-6 py-4 flex items-center justify-between">
                <h2 className="font-semibold text-navy">Needs Attention</h2>
                <Link to="/admin/approvals" className="text-xs font-semibold text-navy hover:underline">View all</Link>
              </div>
              <div className="p-0 flex-1">
                {pendingApprovals.length === 0 ? (
                  <div className="p-10 flex flex-col items-center justify-center text-center h-full">
                    <div className="h-12 w-12 rounded-full bg-forest/10 flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-ink">You're all caught up!</p>
                    <p className="mt-1 text-xs text-ink/50">No pending approvals require your attention.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {pendingApprovals.map(a => (
                      <li key={a.approvalId} className="p-4 hover:bg-paper/30 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-ink text-sm">
                              {a.booking?.resource?.resourceName || 'Unknown Resource'}
                            </p>
                            <p className="mt-0.5 text-xs text-ink/60">
                              {fmtDate(a.booking?.bookingDate)} • {fmtTimeSlot(a.booking?.startTime, a.booking?.endTime)}
                            </p>
                          </div>
                          <Link to="/admin/approvals" className="text-xs bg-amber/20 text-amber-dark font-medium px-2 py-1 rounded">
                            Review
                          </Link>
                        </div>
                        <p className="mt-2 text-xs text-ink/70 line-clamp-1">{a.booking?.purpose}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Upcoming Activity Column */}
            <div className="rounded-xl border border-line bg-white shadow-sm overflow-hidden flex flex-col">
              <div className="border-b border-line bg-paper/50 px-6 py-4 flex items-center justify-between">
                <h2 className="font-semibold text-navy">Recent Approved Bookings</h2>
                <Link to="/admin/bookings" className="text-xs font-semibold text-navy hover:underline">View all</Link>
              </div>
              <div className="p-0 flex-1">
                {recentBookings.length === 0 ? (
                  <div className="p-10 flex flex-col items-center justify-center text-center h-full">
                    <p className="text-sm text-ink/50">No approved bookings found.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {recentBookings.map(b => (
                      <li key={b.bookingId} className="p-4 hover:bg-paper/30 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-ink text-sm">
                              {b.resource?.resourceName || 'Unknown Resource'}
                            </p>
                            <p className="mt-0.5 text-xs text-ink/60">
                              {fmtDate(b.bookingDate)} • {fmtTimeSlot(b.startTime, b.endTime)}
                            </p>
                          </div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-ink/40">
                            {b.resource?.department?.departmentName || 'Shared'}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-xs text-ink/70 truncate mr-4">{b.purpose}</p>
                          <p className="text-xs font-medium text-ink/50 whitespace-nowrap">{b.requester?.name}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
