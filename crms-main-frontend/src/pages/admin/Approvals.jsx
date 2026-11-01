import { useEffect, useState } from 'react';
import { CalendarDays, Check, Clock, Info, Mail, Phone, UserRound, X, CircleCheck } from 'lucide-react';
import { approvalsApi } from '../../api/endpoints';
import { fmtDay, fmtTimeSlot, fmtWhen } from '../../utils/formatters';
import { useAuth } from '../../context/authStore';
import PageHeader from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import StatusPill from '../../components/common/StatusPill';

export default function Approvals() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [remarksDraft, setRemarksDraft] = useState({});
  const [error, setError] = useState('');
  const [rejectModalApproval, setRejectModalApproval] = useState(null);
  const [rejectionRemarks, setRejectionRemarks] = useState('');
  const [rejectionError, setRejectionError] = useState('');
  const { user } = useAuth();
  const isSuperAdmin = user?.roleId === 1;

  function refresh() {
    setLoading(true);
    setError('');
    approvalsApi
      .pending()
      .then(setPending)
      .catch((err) => setError(err.response?.data?.error || 'Failed to load pending approvals.'))
      .finally(() => setLoading(false));
  }
  useEffect(refresh, []);

  async function act(approvalId, decision, customRemarks) {
    if (actingId) return;
    setActingId(approvalId);
    setError('');
    try {
      const remarks = customRemarks !== undefined ? customRemarks : remarksDraft[approvalId];
      const fn = decision === 'Approved' ? approvalsApi.approve : approvalsApi.reject;
      await fn(approvalId, remarks || undefined);
      if (rejectModalApproval?.approvalId === approvalId) {
        setRejectModalApproval(null);
        setRejectionRemarks('');
      }
    } catch (err) {
      const msg = err.response?.data?.error || `Failed to ${decision.toLowerCase()} request. Please try again.`;
      if (rejectModalApproval?.approvalId === approvalId) {
        setRejectionError(msg);
      } else {
        setError(msg);
      }
    } finally {
      setActingId(null);
      await refresh();
      window.dispatchEvent(new CustomEvent('approvals-updated'));
    }
  }

  function handleOpenRejectModal(approval) {
    setRejectModalApproval(approval);
    setRejectionRemarks(remarksDraft[approval.approvalId] || '');
    setRejectionError('');
  }

  function handleConfirmRejection(e) {
    e.preventDefault();
    if (!rejectionRemarks.trim()) {
      setRejectionError('Please say why, so the requester knows.');
      return;
    }
    act(rejectModalApproval.approvalId, 'Rejected', rejectionRemarks.trim());
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Approve Requests"
        description={
          isSuperAdmin
            ? 'Every booking request on campus that is still waiting for an answer.'
            : 'People are waiting for your answer on these room requests. Approve or reject each one; they see your decision in My Bookings.'
        }
      />

      {isSuperAdmin && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-navy/10 bg-navy/5 px-4 py-3 text-sm text-navy">
          <Info size={17} className="mt-0.5 shrink-0" />
          You can see every request here, but only the admin in charge of each room can approve or reject it.
        </p>
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
        <p className="mt-6 text-sm text-ink/50">Loading…</p>
      ) : pending.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={CircleCheck} title="Nothing to approve">
            You're all caught up. New requests for your rooms will show up here.
          </EmptyState>
        </div>
      ) : (
        <>
          <h2 className="mt-8 font-sans text-xs font-semibold uppercase tracking-wider text-ink/50">
            Waiting for an answer · {pending.length}
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {pending.map((a) => {
              const b = a.booking || {};
              const requester = b.requester || {};
              return (
                <li key={a.approvalId} className="flex flex-col rounded-lg border border-line border-l-4 border-l-amber bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/50">
                      {b.resource?.resourceType?.typeName || 'Room'} · {b.resource?.department?.departmentName || 'Institute (Shared)'}
                    </p>
                    <StatusPill tone="amber">{isSuperAdmin ? 'Waiting for approval' : 'Waiting for you'}</StatusPill>
                  </div>
                  <p className="mt-1 font-display text-lg font-semibold leading-snug text-ink">
                    {b.resource?.resourceName || 'Unknown room'}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/80">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays size={15} className="text-ink/40" />
                      {fmtDay(b.bookingDate)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={15} className="text-ink/40" />
                      {fmtTimeSlot(b.startTime, b.endTime)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-ink/80">{b.purpose || 'No purpose given'}</p>

                  <div className="mt-3 rounded-md bg-paper px-3 py-2 text-xs text-ink/70">
                    <p className="flex items-center gap-1.5">
                      <UserRound size={14} className="shrink-0 text-ink/40" />
                      <span>
                        Asked by <span className="font-semibold text-ink">{requester.name || 'Unknown'}</span>
                        {requester.department?.departmentName && ` (${requester.department.departmentName})`}
                        {b.createdAt && <span className="text-ink/50"> on {fmtWhen(b.createdAt)}</span>}
                      </span>
                    </p>
                    {(requester.email || requester.phone) && (
                      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        {requester.email && (
                          <a href={`mailto:${requester.email}`} className="inline-flex items-center gap-1.5 text-navy hover:underline">
                            <Mail size={14} className="shrink-0 text-ink/40" />
                            {requester.email}
                          </a>
                        )}
                        {requester.phone && (
                          <a href={`tel:${requester.phone}`} className="inline-flex items-center gap-1.5 font-mono text-navy hover:underline">
                            <Phone size={14} className="shrink-0 text-ink/40" />
                            {requester.phone}
                          </a>
                        )}
                      </p>
                    )}
                  </div>

                  {!isSuperAdmin && (
                    <div className="mt-auto pt-4">
                      <div className="border-t border-line pt-3">
                        <input
                          type="text"
                          aria-label="Note to the requester"
                          placeholder="Note to the requester (optional)"
                          value={remarksDraft[a.approvalId] || ''}
                          onChange={(e) => setRemarksDraft((d) => ({ ...d, [a.approvalId]: e.target.value }))}
                          className="w-full rounded border border-line px-3 py-2 text-sm"
                        />
                        <div className="mt-3 flex gap-3">
                          <button
                            onClick={() => act(a.approvalId, 'Approved')}
                            disabled={actingId === a.approvalId}
                            className="inline-flex items-center gap-1.5 rounded bg-forest px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                          >
                            <Check size={16} />
                            {actingId === a.approvalId ? 'Approving…' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleOpenRejectModal(a)}
                            disabled={actingId === a.approvalId}
                            className="inline-flex items-center gap-1.5 rounded border border-brick/40 px-4 py-2 text-sm font-semibold text-brick hover:bg-brick-light disabled:opacity-50"
                          >
                            <X size={16} />
                            Reject…
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Rejection Modal */}
      {rejectModalApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-line">
            <h3 className="font-display text-lg font-semibold text-navy">Reject this request?</h3>
            <p className="mt-1 text-sm text-ink/60">
              Tell {rejectModalApproval.booking?.requester?.name || 'the requester'} why. They will see your reason in My Bookings.
            </p>

            <div className="mt-4 rounded-lg bg-paper p-3 text-sm text-ink/70">
              <p className="font-semibold text-ink">{rejectModalApproval.booking?.resource?.resourceName}</p>
              <p className="mt-0.5">
                {fmtDay(rejectModalApproval.booking?.bookingDate)} · {fmtTimeSlot(rejectModalApproval.booking?.startTime, rejectModalApproval.booking?.endTime)}
              </p>
              {rejectModalApproval.booking?.purpose && (
                <p className="mt-0.5 text-ink/50">{rejectModalApproval.booking.purpose}</p>
              )}
            </div>

            <form onSubmit={handleConfirmRejection} className="mt-4">
              <label htmlFor="rejection-reason" className="block text-sm font-semibold text-ink mb-1">
                Reason <span className="text-brick">*</span>
              </label>
              <textarea
                id="rejection-reason"
                required
                rows={3}
                placeholder="e.g. The hall is reserved for exams that day"
                value={rejectionRemarks}
                onChange={(e) => {
                  setRejectionRemarks(e.target.value);
                  if (rejectionError) setRejectionError('');
                }}
                className="w-full rounded-lg border border-line p-2.5 text-sm focus:border-navy focus:outline-none"
              />

              {rejectionError && (
                <p className="mt-2 text-xs font-medium text-brick bg-brick-light px-2.5 py-1.5 rounded">
                  {rejectionError}
                </p>
              )}

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRejectModalApproval(null)}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-paper"
                >
                  Go back
                </button>
                <button
                  type="submit"
                  disabled={actingId === rejectModalApproval.approvalId || !rejectionRemarks.trim()}
                  className="rounded-lg bg-brick px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {actingId === rejectModalApproval.approvalId ? 'Rejecting…' : 'Reject request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
