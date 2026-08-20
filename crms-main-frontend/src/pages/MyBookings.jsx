import { useEffect, useState } from 'react';
import { bookingsApi } from '../api/endpoints';

const STATUS_STYLE = {
  Pending: 'bg-amber/15 text-amber',
  Approved: 'bg-forest-light text-forest',
  Rejected: 'bg-brick-light text-brick',
  Cancelled: 'bg-ink/10 text-ink/50',
};

function fmtTime(iso) {
  if (!iso) return '';
  if (typeof iso === 'string') {
    const trimmed = iso.trim();
    const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (timeMatch) {
      return `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
    }
  }
  try {
    const d = iso instanceof Date ? iso : new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 5);
    return d.toISOString().slice(11, 16);
  } catch {
    return String(iso || '').slice(0, 5);
  }
}

function fmtDate(iso) {
  if (!iso) return '';
  if (typeof iso === 'string') {
    const match = iso.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  try {
    const d = iso instanceof Date ? iso : new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    return d.toISOString().slice(0, 10);
  } catch {
    return String(iso || '').slice(0, 10);
  }
}

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [error, setError] = useState('');

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

  async function handleCancel(bookingId) {
    if (!window.confirm('Are you sure you want to cancel this booking?')) {
      return;
    }
    setError('');
    setCancellingId(bookingId);
    try {
      await bookingsApi.cancel(bookingId);
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel booking. Please try again.');
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl">
      <h1 className="font-display text-2xl font-semibold text-navy">My bookings</h1>

      {error && (
        <div className="mt-4 rounded bg-brick-light px-4 py-2.5 text-sm text-brick">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-ink/50">Loading…</p>
      ) : bookings.length === 0 ? (
        <p className="mt-10 rounded border border-dashed border-line px-6 py-10 text-center text-sm text-ink/50">
          You haven't requested anything yet. Head to Search to find a resource.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-line rounded-lg border border-line bg-white">
          {bookings.map((b) => (
            <li key={b.bookingId} className="flex items-center justify-between p-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-ink">{b.resource?.resourceName}</p>
                  {b.resource?.resourceType?.typeName && (
                    <span className="text-[10px] uppercase font-bold tracking-wider text-ink/50 bg-paper px-2 py-0.5 rounded border border-line">
                      {b.resource.resourceType.typeName}
                    </span>
                  )}
                  {b.resource?.department?.departmentName && (
                    <span className="text-[10px] uppercase font-bold tracking-wider text-navy/70 bg-navy/5 px-2 py-0.5 rounded border border-navy/10">
                      {b.resource.department.departmentName}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-ink/50">
                  {fmtDate(b.bookingDate)} · {fmtTime(b.startTime)}–{fmtTime(b.endTime)}
                </p>
                <p className="mt-1 text-sm text-ink/70">{b.purpose}</p>

                {b.status === 'Rejected' && (
                  <div className="mt-2.5 rounded-md border border-brick/20 bg-brick-light/80 px-3 py-2 text-xs text-brick">
                    <p className="font-semibold text-brick flex items-center gap-1.5">
                      <span>Rejection Reason:</span>
                    </p>
                    <p className="mt-0.5 text-ink/80 font-normal">
                      {b.approvals?.find((a) => a.decision === 'Rejected')?.remarks ||
                        b.approvals?.[0]?.remarks ||
                        b.rejectionRemarks ||
                        'No specific remarks provided.'}
                    </p>
                    {b.approvals?.find((a) => a.decision === 'Rejected')?.approverUser?.name && (
                      <p className="mt-1 text-[11px] text-ink/50">
                        Decided by {b.approvals.find((a) => a.decision === 'Rejected').approverUser.name}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[b.status]}`}>
                  {b.status}
                </span>
                {['Pending', 'Approved'].includes(b.status) && (
                  <button
                    onClick={() => handleCancel(b.bookingId)}
                    disabled={cancellingId === b.bookingId}
                    className="text-xs font-medium text-brick hover:underline disabled:opacity-50"
                  >
                    {cancellingId === b.bookingId ? 'Cancelling…' : 'Cancel'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
