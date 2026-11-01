import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, CalendarCheck, CircleCheck, Hourglass } from 'lucide-react';
import { approvalsApi, bookingsApi, resourcesApi } from '../../api/endpoints';
import { useAuth } from '../../context/authStore';
import { ROLES } from '../../constants/roles';
import { fmtDay, fmtTimeSlot } from '../../utils/formatters';
import PageHeader from '../../components/common/PageHeader';
import StatusPill from '../../components/common/StatusPill';

const STAT_TONES = {
  amber: 'bg-amber-light text-amber',
  green: 'bg-forest-light text-forest',
  navy: 'bg-navy/5 text-navy',
};

function StatCard({ icon: Icon, label, value, hint, to, tone = 'navy' }) {
  const content = (
    <div className={`group flex h-full items-start gap-4 rounded-lg border border-line bg-white p-5 shadow-sm transition-shadow ${to ? 'hover:shadow-md' : ''}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${STAT_TONES[tone]}`}>
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink/70">{label}</p>
        <p className="mt-0.5 font-display text-3xl font-bold text-ink">{value}</p>
        <p className="mt-1 text-xs text-ink/50">{hint}</p>
      </div>
      {to && <ArrowRight size={16} className="mt-1 shrink-0 text-ink/30 transition-transform group-hover:translate-x-0.5 group-hover:text-navy" />}
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function Panel({ title, to, linkLabel, children }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-line bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="font-semibold text-navy">{title}</h2>
        <Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold text-navy hover:underline">
          {linkLabel}
          <ArrowRight size={13} />
        </Link>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
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
    <div className="mx-auto max-w-7xl">
      <PageHeader title={`Welcome back, ${user?.name || ''}`} description="What needs your attention, at a glance." />

      {loading ? (
        <div className="mt-6 animate-pulse space-y-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[1, 2, 3].map(i => <div key={i} className="h-28 bg-line/20 rounded-lg"></div>)}
          </div>
          <div className="h-64 bg-line/20 rounded-lg"></div>
        </div>
      ) : (
        <>
          <div className="mt-6 mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={Hourglass}
              label="Waiting for approval"
              value={stats.pending ?? 0}
              hint={stats.pending > 0 ? 'Requests waiting for an answer' : 'Nothing waiting right now'}
              to="/admin/approvals"
              tone={stats.pending > 0 ? 'amber' : 'navy'}
            />
            <StatCard
              icon={CalendarCheck}
              label="Approved bookings"
              value={stats.activeBookings ?? 0}
              hint="Rooms confirmed for people"
              to="/admin/bookings"
              tone="green"
            />
            <StatCard
              icon={Building2}
              label="Rooms & labs"
              value={stats.totalResources ?? 0}
              hint="Places people can book"
              to={canManageResources ? '/admin/resources' : undefined}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel title="Waiting for an answer" to="/admin/approvals" linkLabel="See all">
              {pendingApprovals.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-10 text-center">
                  <CircleCheck size={28} className="mb-2 text-forest" />
                  <p className="text-sm font-medium text-ink">You're all caught up</p>
                  <p className="mt-1 text-xs text-ink/50">No requests are waiting for an answer.</p>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {pendingApprovals.map(a => (
                    <li key={a.approvalId}>
                      <Link to="/admin/approvals" className="block px-5 py-3.5 hover:bg-paper/50">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-medium text-ink text-sm">
                            {a.booking?.resource?.resourceName || 'Unknown room'}
                          </p>
                          <StatusPill tone="amber">Waiting</StatusPill>
                        </div>
                        <p className="mt-0.5 text-xs text-ink/60">
                          {fmtDay(a.booking?.bookingDate)} · {fmtTimeSlot(a.booking?.startTime, a.booking?.endTime)}
                          {a.booking?.requester?.name && ` · ${a.booking.requester.name}`}
                        </p>
                        <p className="mt-1 text-xs text-ink/70 line-clamp-1">{a.booking?.purpose}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Recently approved" to="/admin/bookings" linkLabel="See all bookings">
              {recentBookings.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-10 text-center">
                  <p className="text-sm text-ink/50">No approved bookings yet.</p>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {recentBookings.map(b => (
                    <li key={b.bookingId} className="px-5 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-ink text-sm">
                          {b.resource?.resourceName || 'Unknown room'}
                        </p>
                        <StatusPill tone="green">Approved</StatusPill>
                      </div>
                      <p className="mt-0.5 text-xs text-ink/60">
                        {fmtDay(b.bookingDate)} · {fmtTimeSlot(b.startTime, b.endTime)}
                        {b.requester?.name && ` · ${b.requester.name}`}
                      </p>
                      <p className="mt-1 text-xs text-ink/70 truncate">{b.purpose}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
