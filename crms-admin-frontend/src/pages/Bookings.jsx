import { useEffect, useState } from 'react';
import { bookingsApi, masterDataApi, resourcesApi } from '../api/endpoints';
import { fmtDate, fmtTimeSlot } from '../utils/formatters';

const STATUS_STYLE = {
  Pending: 'bg-amber/15 text-amber',
  Approved: 'bg-forest-light text-forest',
  Rejected: 'bg-brick-light text-brick',
  Cancelled: 'bg-ink/10 text-ink/50',
};

export default function Bookings() {
  const [status, setStatus] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');

  const [departments, setDepartments] = useState([]);
  const [resources, setResources] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [actionAlert, setActionAlert] = useState(null);

  useEffect(() => {
    masterDataApi.departments().then(setDepartments).catch(() => {});
    resourcesApi.list({}).then(setResources).catch(() => {});
  }, []);

  function refresh() {
    setLoading(true);
    setError('');
    const params = {};
    if (status) params.status = status;
    if (departmentId) params.departmentId = departmentId;
    if (resourceId) params.resourceId = resourceId;

    bookingsApi
      .list(params)
      .then(setBookings)
      .catch((err) => setError(err.response?.data?.error || 'Failed to load bookings.'))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [status, departmentId, resourceId]);

  const filteredBookings = bookings.filter((b) => {
    if (startDate) {
      const bDate = fmtDate(b.bookingDate);
      if (bDate < startDate) return false;
    }
    if (endDate) {
      const bDate = fmtDate(b.bookingDate);
      if (bDate > endDate) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchResource =
        b.resource?.resourceName?.toLowerCase().includes(q) ||
        b.resourceId?.toLowerCase().includes(q);
      const matchRequester =
        b.requester?.name?.toLowerCase().includes(q) ||
        b.requester?.email?.toLowerCase().includes(q) ||
        b.requester?.phone?.toLowerCase().includes(q);
      const matchPurpose = b.purpose?.toLowerCase().includes(q);
      if (!matchResource && !matchRequester && !matchPurpose) return false;
    }
    return true;
  });

  async function handleConfirmCancel() {
    if (!cancelModalBooking) return;
    setCancelling(true);
    setActionAlert(null);
    try {
      await bookingsApi.cancel(cancelModalBooking.bookingId);
      setActionAlert({
        type: 'success',
        message: `Booking #${cancelModalBooking.bookingId} cancelled successfully.`,
      });
      setCancelModalBooking(null);
      refresh();
    } catch (err) {
      setActionAlert({
        type: 'error',
        message: err.response?.data?.error || 'Failed to cancel booking. Please try again.',
      });
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="p-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold text-navy">Bookings</h1>
        <p className="text-sm text-ink/60">
          Campus-wide booking records with multi-dimensional filtering and administrative controls.
        </p>
      </div>

      {/* Filter Controls */}
      <div className="mt-6 rounded-lg border border-line bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div>
            <label className="block text-xs font-semibold text-ink/70 mb-1">Search</label>
            <input
              type="text"
              placeholder="Search bookings…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded border border-line px-3 py-2 text-xs focus:border-navy focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink/70 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded border border-line px-3 py-2 text-xs focus:border-navy focus:outline-none"
            >
              <option value="">All statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink/70 mb-1">Department</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full rounded border border-line px-3 py-2 text-xs focus:border-navy focus:outline-none"
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.departmentId} value={d.departmentId}>
                  {d.departmentName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink/70 mb-1">Resource</label>
            <select
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              className="w-full rounded border border-line px-3 py-2 text-xs focus:border-navy focus:outline-none"
            >
              <option value="">All resources</option>
              {resources.map((r) => (
                <option key={r.resourceId} value={r.resourceId}>
                  {r.resourceName} ({r.resourceId})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink/70 mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded border border-line px-3 py-2 text-xs focus:border-navy focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink/70 mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded border border-line px-3 py-2 text-xs focus:border-navy focus:outline-none"
            />
          </div>
        </div>
        {(status || departmentId || resourceId || startDate || endDate || search) && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => {
                setStatus('');
                setDepartmentId('');
                setResourceId('');
                setStartDate('');
                setEndDate('');
                setSearch('');
              }}
              className="text-xs font-medium text-navy hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {actionAlert && (
        <div
          className={`mt-4 flex items-center justify-between rounded-lg border p-4 text-sm ${
            actionAlert.type === 'success'
              ? 'border-forest/40 bg-forest-light text-forest'
              : 'border-brick/40 bg-brick-light text-brick'
          }`}
        >
          <span>{actionAlert.message}</span>
          <button onClick={() => setActionAlert(null)} className="text-xs font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-brick/40 bg-brick-light p-4 text-sm text-brick">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-xs font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-ink/50">Loading bookings…</p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-line bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-paper text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">Requester</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Time Slot</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredBookings.map((b) => (
                <tr key={b.bookingId} className="hover:bg-paper/40">
                  <td className="px-4 py-3 font-medium text-ink">
                    <div>{b.resource?.resourceName || b.resourceId || '—'}</div>
                    <div className="mt-0.5 text-[11px] font-bold tracking-wide uppercase text-navy/70">
                      {b.resource?.resourceType?.typeName || 'Unknown Type'} •{' '}
                      {b.resource?.department?.departmentName || 'Institute (Shared)'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    <div className="font-medium text-ink/80">{b.requester?.name || '—'}</div>
                    {b.requester?.email && (
                      <div className="text-xs text-ink/40">
                        <a href={`mailto:${b.requester.email}`} className="hover:underline">
                          {b.requester.email}
                        </a>
                      </div>
                    )}
                    {b.requester?.phone && (
                      <div className="font-mono text-xs text-ink/40">{b.requester.phone}</div>
                    )}
                    {b.requester?.department && (
                      <div className="mt-0.5 text-xs text-ink/50">{b.requester.department.departmentName}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink/60">{fmtDate(b.bookingDate)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink/60">
                    {fmtTimeSlot(b.startTime, b.endTime)}
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    <div>{b.purpose || '—'}</div>
                    {b.status === 'Rejected' && (
                      <div className="mt-1 text-xs text-brick font-medium">
                        Reason: {b.approvals?.find((a) => a.decision === 'Rejected')?.remarks || 'Rejected'}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        STATUS_STYLE[b.status] || 'bg-ink/10 text-ink/60'
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {['Pending', 'Approved'].includes(b.status) && (
                      <button
                        onClick={() => setCancelModalBooking(b)}
                        className="rounded border border-brick/30 px-2.5 py-1 text-xs font-medium text-brick hover:bg-brick-light"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredBookings.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-ink/50">
                    No bookings match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Admin Cancel Confirmation Modal */}
      {cancelModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-line">
            <h3 className="font-display text-lg font-semibold text-navy">Admin Cancel Booking</h3>
            <p className="mt-1 text-xs text-ink/60">
              Are you sure you want to administratively cancel booking #{cancelModalBooking.bookingId}? This will free up the slot immediately.
            </p>

            <div className="mt-3 rounded-lg bg-paper p-3 text-xs text-ink/70">
              <p className="font-semibold text-ink">
                {cancelModalBooking.resource?.resourceName || cancelModalBooking.resourceId}
              </p>
              <p className="mt-0.5">
                {fmtDate(cancelModalBooking.bookingDate)} · {fmtTimeSlot(cancelModalBooking.startTime, cancelModalBooking.endTime)}
              </p>
              <p className="mt-0.5 text-ink/50">Requester: {cancelModalBooking.requester?.name}</p>
              <p className="mt-0.5 text-ink/50">Purpose: {cancelModalBooking.purpose}</p>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCancelModalBooking(null)}
                disabled={cancelling}
                className="rounded-lg border border-line px-4 py-2 text-xs font-medium text-ink hover:bg-paper"
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="rounded-lg bg-brick px-4 py-2 text-xs font-semibold text-white hover:bg-brick-dark disabled:opacity-50"
              >
                {cancelling ? 'Cancelling…' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
