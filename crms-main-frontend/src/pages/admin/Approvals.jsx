import { useEffect, useState } from 'react';
import { approvalsApi } from '../../api/endpoints';
import { fmtDate, fmtTimeSlot } from '../../utils/formatters';
import { useAuth } from '../../context/authStore';

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
      refresh();
    } catch (err) {
      const msg = err.response?.data?.error || `Failed to ${decision.toLowerCase()} request. Please try again.`;
      if (rejectModalApproval?.approvalId === approvalId) {
        setRejectionError(msg);
      } else {
        setError(msg);
      }
    } finally {
      setActingId(null);
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
      setRejectionError('Rejection remarks are mandatory.');
      return;
    }
    act(rejectModalApproval.approvalId, 'Rejected', rejectionRemarks.trim());
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-navy">Approvals</h1>
      <p className="mt-1 text-sm text-ink/60">
        Requests routed to you, resolved by resource ownership — never a hardcoded list.
      </p>

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
        <div className="mt-16 flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white/50 px-6 py-20 text-center shadow-sm">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-forest/10 ring-8 ring-forest/5">
            <svg className="h-8 w-8 text-forest" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h3 className="font-display text-xl font-semibold text-navy">All Caught Up!</h3>
          <p className="mt-2 max-w-sm text-sm text-ink/60">
            You don't have any pending booking requests to review at the moment. Take a break!
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {pending.map((a) => (
            <li key={a.approvalId} className="rounded-lg border border-line bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-ink">
                    {a.booking?.resource?.resourceName || 'Unknown Resource'}{' '}
                    <span className="font-mono text-xs text-ink/40">
                      {a.booking?.resource?.resourceId || ''}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] font-bold tracking-wide uppercase text-navy/70">
                    {a.booking?.resource?.resourceType?.typeName || 'Unknown Type'} • {a.booking?.resource?.department?.departmentName || 'Institute (Shared)'}
                  </p>
                  <p className="mt-0.5 text-xs text-ink/50">
                    {fmtDate(a.booking?.bookingDate)} · {fmtTimeSlot(a.booking?.startTime, a.booking?.endTime)}
                  </p>
                  <p className="mt-2 text-sm text-ink/80">{a.booking?.purpose || 'No purpose specified'}</p>
                  <p className="mt-2 text-xs text-ink/50">
                    Requested by <span className="font-medium text-ink/70">{a.booking?.requester?.name || 'Unknown'}</span>
                    {a.booking?.requester?.department?.departmentName && (
                      <span className="text-ink/60"> ({a.booking.requester.department.departmentName})</span>
                    )}
                    {a.booking?.requester?.email && (
                      <>
                        {' · '}
                        <a href={`mailto:${a.booking.requester.email}`} className="text-navy hover:underline">
                          {a.booking.requester.email}
                        </a>
                      </>
                    )}
                    {a.booking?.requester?.phone && (
                      <>
                        {' · '}
                        <a href={`tel:${a.booking.requester.phone}`} className="font-mono text-navy hover:underline">
                          {a.booking.requester.phone}
                        </a>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {isSuperAdmin ? (
                <div className="mt-4 rounded-lg bg-navy/5 p-3 text-xs text-navy/70 text-center">
                  Super Admins have universal read-only visibility over pending approvals but cannot approve or reject requests.
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Remarks (optional for approval)"
                    value={remarksDraft[a.approvalId] || ''}
                    onChange={(e) => setRemarksDraft((d) => ({ ...d, [a.approvalId]: e.target.value }))}
                    className="mt-4 w-full rounded border border-line px-3 py-2 text-sm"
                  />

                  <div className="mt-3 flex gap-3">
                    <button
                      onClick={() => act(a.approvalId, 'Approved')}
                      disabled={actingId === a.approvalId}
                      className="rounded bg-forest px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {actingId === a.approvalId ? 'Approving…' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleOpenRejectModal(a)}
                      disabled={actingId === a.approvalId}
                      className="rounded bg-brick px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Reject…
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Rejection Modal */}
      {rejectModalApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-line">
            <h3 className="font-display text-lg font-semibold text-navy">Reject Booking Request</h3>
            <p className="mt-1 text-xs text-ink/60">
              Please provide a clear reason for rejecting this booking request. The requester will be notified of these remarks.
            </p>

            <div className="mt-3 rounded-lg bg-paper p-3 text-xs text-ink/70">
              <p className="font-medium text-ink">{rejectModalApproval.booking?.resource?.resourceName}</p>
              <p className="mt-0.5">
                {fmtDate(rejectModalApproval.booking?.bookingDate)} · {fmtTimeSlot(rejectModalApproval.booking?.startTime, rejectModalApproval.booking?.endTime)}
              </p>
              <p className="mt-0.5 text-ink/50">Requester: {rejectModalApproval.booking?.requester?.name}</p>
            </div>

            <form onSubmit={handleConfirmRejection} className="mt-4">
              <label className="block text-xs font-semibold text-ink/70 mb-1">
                Rejection Remarks <span className="text-brick">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Venue is reserved for scheduled maintenance / academic examination"
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
                  className="rounded-lg border border-line px-4 py-2 text-xs font-medium text-ink hover:bg-paper"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actingId === rejectModalApproval.approvalId || !rejectionRemarks.trim()}
                  className="rounded-lg bg-brick px-4 py-2 text-xs font-semibold text-white hover:bg-brick-dark disabled:opacity-50"
                >
                  {actingId === rejectModalApproval.approvalId ? 'Rejecting…' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
