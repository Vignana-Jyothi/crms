import { useCallback, useEffect, useState } from 'react';
import { bookingsApi, masterDataApi, resourcesApi } from '../../api/endpoints';
import { fmtDay, fmtTimeSlot } from '../../utils/formatters';
import { useAuth } from '../../context/authStore';
import { ROLES } from '../../constants/roles';
import { STRIPE_TONES, bookingTone } from '../../constants/status';
import PageHeader from '../../components/common/PageHeader';
import { BookingStatusPill } from '../../components/common/StatusPill';
import CancelBookingDialog from '../../components/common/CancelBookingDialog';

// The reason recorded when a booking was rejected or cancelled.
function decisionRemarks(b) {
  return b.approvals?.find((a) => a.decision === b.status)?.remarks;
}

export default function Bookings() {
  const { user } = useAuth();
  const isDeptAdmin = user?.roleId === ROLES.DEPARTMENT_ADMIN;

  const [status, setStatus] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [blockId, setBlockId] = useState('');
  const [resourceTypeId, setResourceTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [departments, setDepartments] = useState([]);
  const [resources, setResources] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [resourceTypes, setResourceTypes] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [actionAlert, setActionAlert] = useState(null);

  useEffect(() => {
    masterDataApi.departments().then(setDepartments).catch(() => {});
    masterDataApi.blocks().then(setBlocks).catch(() => {});
    masterDataApi.resourceTypes().then(setResourceTypes).catch(() => {});
    resourcesApi.list({}).then(setResources).catch(() => {});
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  // Every filter is applied by the API, so results stay correct no
  // matter how many bookings exist.
  const refresh = useCallback(() => {
    let isCancelled = false;
    setLoading(true);
    setError('');
    const params = {};
    if (status) params.status = status;
    if (departmentId) params.departmentId = departmentId;
    if (resourceId) params.resourceId = resourceId;
    if (blockId) params.blockId = blockId;
    if (resourceTypeId) params.resourceTypeId = resourceTypeId;
    if (startDate) params.dateFrom = startDate;
    if (endDate) params.dateTo = endDate;
    if (debouncedSearch) params.search = debouncedSearch;

    bookingsApi
      .list(params)
      .then((data) => !isCancelled && setBookings(data))
      .catch((err) => !isCancelled && setError(err.response?.data?.error || 'Failed to load bookings.'))
      .finally(() => !isCancelled && setLoading(false));

    return () => {
      isCancelled = true;
    };
  }, [status, departmentId, resourceId, blockId, resourceTypeId, startDate, endDate, debouncedSearch]);

  useEffect(refresh, [refresh]);

  // Department Admins only ever get bookings for the departments they manage.
  const scopedDepartmentIds = new Set(
    [user?.departmentId, ...(user?.managedDepartments || []).map((d) => d.departmentId)].filter(Boolean)
  );
  const departmentOptions = isDeptAdmin
    ? departments.filter((d) => scopedDepartmentIds.has(d.departmentId))
    : departments;

  function openCancel(b) {
    setCancelError('');
    setCancelModalBooking(b);
  }

  async function handleConfirmCancel(reason) {
    if (!cancelModalBooking) return;
    setCancelling(true);
    setCancelError('');
    setActionAlert(null);
    try {
      await bookingsApi.cancel(cancelModalBooking.bookingId, { reason });
      setActionAlert({
        type: 'success',
        message: `Cancelled ${cancelModalBooking.resource?.resourceName || cancelModalBooking.resourceId} on ${fmtDay(cancelModalBooking.bookingDate)}. The slot is free again.`,
      });
      setCancelModalBooking(null);
      refresh();
    } catch (err) {
      setCancelError(err.response?.data?.error || 'Failed to cancel booking. Please try again.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="All Bookings"
        description="Every room booking on campus, whatever its status. Use the filters to find one."
      />

      <div className="mt-6 rounded-lg border border-line bg-white p-4">
        <div className="flex gap-2">
          <input
            type="text"
            aria-label="Search bookings"
            placeholder="Search by room, person, phone or purpose…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border border-line px-3 py-2 text-xs focus:border-navy focus:outline-none flex-1"
          />
          <button 
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            title="Show filters"
            aria-label="Show filters"
            className="md:hidden flex items-center justify-center rounded border border-line bg-white px-3 py-2 text-ink/70 hover:bg-paper"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
        </div>

        <div className={`${showMobileFilters ? 'grid' : 'hidden'} md:grid mt-3 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5`}>
          <div>
            <label className="block text-xs font-semibold text-ink/70 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded border border-line px-3 py-2 text-xs focus:border-navy focus:outline-none"
            >
              <option value="">Any status</option>
              <option value="Pending">Waiting for approval</option>
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
              <option value="">{isDeptAdmin ? 'All my departments' : 'All departments'}</option>
              {departmentOptions.map((d) => (
                <option key={d.departmentId} value={d.departmentId}>
                  {d.departmentName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink/70 mb-1">Room</label>
            <select
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              className="w-full rounded border border-line px-3 py-2 text-xs focus:border-navy focus:outline-none"
            >
              <option value="">All rooms</option>
              {resources.map((r) => (
                <option key={r.resourceId} value={r.resourceId}>
                  {r.resourceName} ({r.resourceId})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink/70 mb-1">Block</label>
            <select
              value={blockId}
              onChange={(e) => setBlockId(e.target.value)}
              className="w-full rounded border border-line px-3 py-2 text-xs focus:border-navy focus:outline-none"
            >
              <option value="">All blocks</option>
              {blocks.map((b) => (
                <option key={b.blockId} value={b.blockId}>
                  {b.blockName || b.blockCode}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink/70 mb-1">Room type</label>
            <select
              value={resourceTypeId}
              onChange={(e) => setResourceTypeId(e.target.value)}
              className="w-full rounded border border-line px-3 py-2 text-xs focus:border-navy focus:outline-none"
            >
              <option value="">All room types</option>
              {resourceTypes.map((t) => (
                <option key={t.resourceTypeId} value={t.resourceTypeId}>
                  {t.typeName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink/70 mb-1">From</label>
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded border border-line px-3 py-2 text-xs focus:border-navy focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink/70 mb-1">To</label>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded border border-line px-3 py-2 text-xs focus:border-navy focus:outline-none"
            />
          </div>
        </div>
        {(status || departmentId || resourceId || startDate || endDate || search || blockId || resourceTypeId) && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => {
                setStatus('');
                setDepartmentId('');
                setResourceId('');
                setStartDate('');
                setEndDate('');
                setSearch('');
                setBlockId('');
                setResourceTypeId('');
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
        <>
          <p className="mt-6 text-xs text-ink/50">
            {bookings.length} booking{bookings.length === 1 ? '' : 's'}
          </p>
          {/* Desktop Table View */}
          <div className="mt-2 hidden md:block overflow-x-auto rounded-lg border border-line bg-white shadow-sm">
            <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-line bg-paper text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3">Booked by</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {bookings.map((b) => (
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
                  <td className="whitespace-nowrap px-4 py-3 text-ink/70">{fmtDay(b.bookingDate)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink/70">
                    {fmtTimeSlot(b.startTime, b.endTime)}
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    <div>{b.purpose || '—'}</div>
                    {decisionRemarks(b) && ['Rejected', 'Cancelled'].includes(b.status) && (
                      <div className="mt-1 text-xs text-ink/60">
                        <span className={`font-semibold ${b.status === 'Rejected' ? 'text-brick' : 'text-ink'}`}>Reason:</span> {decisionRemarks(b)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <BookingStatusPill status={b.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {['Pending', 'Approved'].includes(b.status) && (
                      <button
                        onClick={() => openCancel(b)}
                        title="Cancel this booking"
                        className="whitespace-nowrap rounded border border-brick/30 px-2.5 py-1 text-xs font-semibold text-brick hover:bg-brick-light"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-ink/50">
                    No bookings match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="mt-2 block md:hidden space-y-4">
            {bookings.map((b) => (
              <div key={b.bookingId} className={`rounded-lg border border-line border-l-4 bg-white p-4 shadow-sm flex flex-col gap-3 ${STRIPE_TONES[bookingTone(b.status)]}`}>
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/50">
                      {b.resource?.resourceType?.typeName || 'Room'} · {b.resource?.department?.departmentName || 'Shared'}
                    </p>
                    <h3 className="mt-0.5 font-display text-lg font-semibold text-ink">{b.resource?.resourceName || b.resourceId || '—'}</h3>
                  </div>
                  <BookingStatusPill status={b.status} />
                </div>
                
                <div className="flex flex-col gap-1.5 text-sm text-ink/80 mt-1">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-ink/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    <span>{b.requester?.name || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ink/60">
                    <svg className="w-4 h-4 text-ink/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span>{fmtDay(b.bookingDate)} · {fmtTimeSlot(b.startTime, b.endTime)}</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-ink/60">
                    <svg className="w-4 h-4 text-ink/40 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <span className="line-clamp-2">{b.purpose || 'No purpose specified'}</span>
                  </div>
                  {decisionRemarks(b) && ['Rejected', 'Cancelled'].includes(b.status) && (
                    <div className="mt-1 text-xs text-ink/60">
                      <span className={`font-semibold ${b.status === 'Rejected' ? 'text-brick' : 'text-ink'}`}>Reason:</span> {decisionRemarks(b)}
                    </div>
                  )}
                </div>

                {['Pending', 'Approved'].includes(b.status) && (
                  <div className="mt-2 pt-3 border-t border-line flex justify-end">
                    <button
                      onClick={() => openCancel(b)}
                      className="rounded border border-brick/30 px-3 py-1.5 text-xs font-semibold text-brick hover:bg-brick-light"
                    >
                      Cancel booking
                    </button>
                  </div>
                )}
              </div>
            ))}
            {bookings.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-ink/50 bg-white rounded-lg border border-line shadow-sm">
                No bookings match the selected filters.
              </div>
            )}
          </div>
        </>
      )}

      {cancelModalBooking && (
        <CancelBookingDialog
          booking={cancelModalBooking}
          note="The slot becomes free for others straight away."
          busy={cancelling}
          error={cancelError}
          onClose={() => setCancelModalBooking(null)}
          onConfirm={handleConfirmCancel}
        />
      )}
    </div>
  );
}
