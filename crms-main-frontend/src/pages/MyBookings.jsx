import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Check, Clock, Hourglass, Inbox, Plus } from 'lucide-react';
import { bookingsApi } from '../api/endpoints';
import { fmtDay, fmtTimeSlot, fmtWhen } from '../utils/formatters';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import CancelBookingDialog from '../components/common/CancelBookingDialog';
import { BookingStatusPill } from '../components/common/StatusPill';
import { STRIPE_TONES, bookingTone } from '../constants/status';

function todayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const dayOf = (b) => String(b.bookingDate).slice(0, 10);
const sortKey = (b) => `${dayOf(b)} ${b.startTime}`;

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  function refresh() {
    setLoading(true);
    setError('');
    bookingsApi
      .mine()
      .then(setBookings)
      .catch((err) => setError(err.response?.data?.error || 'Failed to load bookings.'))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function handleCancel(reason) {
    setCancelError('');
    setCancelling(true);
    try {
      await bookingsApi.cancel(cancelTarget.bookingId, { reason });
      setCancelTarget(null);
      refresh();
    } catch (err) {
      setCancelError(err.response?.data?.error || 'Failed to cancel booking. Please try again.');
    } finally {
      setCancelling(false);
    }
  }

  const today = todayStr();
  const upcoming = bookings.filter((b) => dayOf(b) >= today).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const earlier = bookings.filter((b) => dayOf(b) < today).sort((a, b) => sortKey(b).localeCompare(sortKey(a)));

  function openCancel(b) {
    setCancelError('');
    setCancelTarget(b);
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="My Bookings"
        description="Rooms you have asked for, and whether each request has been approved."
      >
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark"
        >
          <Plus size={16} />
          Book a Room
        </Link>
      </PageHeader>

      {error && (
        <div className="mt-4 rounded bg-brick-light px-4 py-2.5 text-sm text-brick">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-ink/50">Loading your bookings…</p>
      ) : bookings.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={Inbox} title="No bookings yet" action={{ to: '/', label: 'Book a Room' }}>
            When you request a room, it shows up here along with whether it has been approved.
          </EmptyState>
        </div>
      ) : (
        <>
          <SectionTitle count={upcoming.length}>Coming up</SectionTitle>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-ink/50">Nothing coming up.</p>
          ) : (
            <ul className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {upcoming.map((b) => (
                <BookingCard key={b.bookingId} b={b} onCancel={() => openCancel(b)} />
              ))}
            </ul>
          )}

          {earlier.length > 0 && (
            <>
              <SectionTitle count={earlier.length}>Earlier</SectionTitle>
              <ul className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {earlier.map((b) => (
                  <BookingCard key={b.bookingId} b={b} />
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {cancelTarget && (
        <CancelBookingDialog
          booking={cancelTarget}
          note="The room becomes free for others straight away."
          busy={cancelling}
          error={cancelError}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleCancel}
        />
      )}
    </div>
  );
}

function SectionTitle({ count, children }) {
  return (
    <h2 className="mt-8 font-sans text-xs font-semibold uppercase tracking-wider text-ink/50">
      {children} · {count}
    </h2>
  );
}

// onCancel is only passed for bookings that can still be cancelled.
function BookingCard({ b, onCancel }) {
  const decision = b.approvals?.find((a) => a.decision === b.status);
  const reason = decision?.remarks || b.approvals?.[0]?.remarks || b.rejectionRemarks;
  const canCancel = onCancel && ['Pending', 'Approved'].includes(b.status);

  return (
    <li
      className={`flex flex-col rounded-lg border border-line border-l-4 bg-white p-4 shadow-sm ${STRIPE_TONES[bookingTone(b.status)]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/50">
          {b.resource?.resourceType?.typeName || 'Room'}
        </p>
        <BookingStatusPill status={b.status} />
      </div>
      <p className="mt-1 font-display text-lg font-semibold leading-snug text-ink">
        {b.resource?.resourceName || b.resourceId}
      </p>
      {b.resource?.department?.departmentName && (
        <p className="truncate text-sm text-ink/60" title={b.resource.department.departmentName}>
          {b.resource.department.departmentName}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/80">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays size={15} className="text-ink/40" />
          {fmtDay(b.bookingDate)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock size={15} className="text-ink/40" />
          {fmtTimeSlot(b.startTime, b.endTime)}
        </span>
      </div>
      {b.purpose && <p className="mt-2 text-sm text-ink/70">{b.purpose}</p>}
      <p className="mt-1 text-xs text-ink/40">Requested {fmtWhen(b.createdAt)}</p>

      <div className="mt-auto pt-4">
        <div className="flex items-start justify-between gap-3 border-t border-line pt-3 text-sm">
          <div className="min-w-0 text-ink/70">
            {b.status === 'Pending' && (
              <p className="flex items-center gap-1.5">
                <Hourglass size={15} className="shrink-0 text-amber" />
                Waiting for the room's admin to decide.
              </p>
            )}
            {b.status === 'Approved' && (
              <p className="flex items-center gap-1.5">
                <Check size={15} className="shrink-0 text-forest" />
                The room is booked for you.
              </p>
            )}
            {['Rejected', 'Cancelled'].includes(b.status) && (
              <>
                <p>
                  <span className={`font-semibold ${b.status === 'Rejected' ? 'text-brick' : 'text-ink'}`}>Reason: </span>
                  {reason || 'No reason given.'}
                </p>
                {decision?.approverUser?.name && (
                  <p className="mt-0.5 text-xs text-ink/50">
                    {b.status === 'Rejected' ? 'Rejected' : 'Cancelled'} by {decision.approverUser.name}
                  </p>
                )}
              </>
            )}
          </div>
          {canCancel && (
            <button
              onClick={onCancel}
              className="shrink-0 rounded border border-brick/30 px-2.5 py-1 text-xs font-semibold text-brick hover:bg-brick-light"
            >
              Cancel booking
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
