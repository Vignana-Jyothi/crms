import { useEffect, useState } from 'react';
import { auditApi } from '../../api/endpoints';
import { fmtWhen } from '../../utils/formatters';
import PageHeader from '../../components/common/PageHeader';
import StatusPill from '../../components/common/StatusPill';

// Every action the backend records (audit.service log calls), in words.
const ACTIONS = {
  CREATE_BOOKING: { label: 'Requested a booking', tone: 'amber' },
  APPROVED_BOOKING: { label: 'Approved a booking', tone: 'green' },
  REJECTED_BOOKING: { label: 'Rejected a booking', tone: 'red' },
  CANCEL_BOOKING: { label: 'Cancelled a booking', tone: 'grey' },
  ESCALATE_APPROVAL: { label: 'Passed a request to Super Admin', tone: 'amber' },
  CREATE_RESOURCE: { label: 'Added a room', tone: 'grey' },
  UPDATE_RESOURCE: { label: 'Changed a room', tone: 'grey' },
  CREATE_USER: { label: 'Added a user', tone: 'grey' },
  UPDATE_USER: { label: 'Changed a user', tone: 'grey' },
  CHANGE_USER_ROLE: { label: "Changed a user's role", tone: 'grey' },
  CHANGE_USER_STATUS: { label: 'Activated or deactivated a user', tone: 'grey' },
  DELETE_USER: { label: 'Deleted a user', tone: 'red' },
  SET_PASSWORD: { label: 'Set a password', tone: 'grey' },
  UPDATE_PROFILE: { label: 'Updated their profile', tone: 'grey' },
  LOGIN: { label: 'Signed in', tone: 'grey' },
  SIGNUP: { label: 'Signed up', tone: 'grey' },
};

const ENTITY_LABELS = { booking: 'Booking', resource: 'Room', user: 'User' };

function actionLabel(action) {
  return ACTIONS[action]?.label || action;
}

// "Booking #8 — Requested D 204 on ...", without the raw IPv6 prefix.
function describe(l) {
  const what = `${ENTITY_LABELS[l.entityType] || l.entityType} ${l.entityType === 'booking' ? '#' : ''}${l.entityId}`;
  return l.details ? `${what} — ${l.details.replace('::ffff:', '')}` : what;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  function refresh() {
    setLoading(true);
    setError('');
    const params = { limit: 200 };
    if (selectedAction) params.action = selectedAction;
    if (selectedEntityType) params.entityType = selectedEntityType;

    auditApi
      .list(params)
      .then(setLogs)
      .catch((err) => setError(err.response?.data?.error || 'Failed to load audit logs.'))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [selectedAction, selectedEntityType]);

  const filteredLogs = logs.filter((l) => {
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchUser = l.user?.name?.toLowerCase().includes(q) || String(l.userId).includes(q);
      const cleanedDetails = (l.details || '').replace('::ffff:', '');
      const matchDetails = cleanedDetails.toLowerCase().includes(q);
      const matchEntity = l.entityId?.toLowerCase?.().includes(q) || String(l.entityId).includes(q);
      const matchDate = fmtWhen(l.timestamp).toLowerCase().includes(q);
      const matchAction = actionLabel(l.action).toLowerCase().includes(q);
      
      if (!matchUser && !matchDetails && !matchEntity && !matchDate && !matchAction) return false;
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Activity Log" description="Who did what in CRMS, and when. Newest first." />

      {/* Filter Controls */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white p-4">
        <div>
          <label htmlFor="activity-search" className="block text-xs font-semibold text-ink/70 mb-1">Search</label>
          <input
            id="activity-search"
            type="text"
            placeholder="Search names, rooms, dates…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded border border-line px-3 py-1.5 text-xs w-56 focus:border-navy focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="activity-action" className="block text-xs font-semibold text-ink/70 mb-1">What happened</label>
          <select
            id="activity-action"
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="rounded border border-line bg-white px-3 py-1.5 text-xs focus:border-navy focus:outline-none"
          >
            <option value="">Anything</option>
            {Object.entries(ACTIONS).map(([value, a]) => (
              <option key={value} value={value}>{a.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="activity-entity" className="block text-xs font-semibold text-ink/70 mb-1">About</label>
          <select
            id="activity-entity"
            value={selectedEntityType}
            onChange={(e) => setSelectedEntityType(e.target.value)}
            className="rounded border border-line bg-white px-3 py-1.5 text-xs focus:border-navy focus:outline-none"
          >
            <option value="">Anything</option>
            <option value="booking">Bookings</option>
            <option value="resource">Rooms</option>
            <option value="user">Users</option>
          </select>
        </div>

        {(selectedAction || selectedEntityType || searchTerm) && (
          <div className="self-end pb-1.5">
            <button
              onClick={() => {
                setSelectedAction('');
                setSelectedEntityType('');
                setSearchTerm('');
              }}
              className="text-xs font-medium text-navy hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

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
      ) : (
        <>
          <div className="mt-6 hidden md:block overflow-x-auto">
            <ul className="min-w-[800px] divide-y divide-line rounded-lg border border-line bg-white shadow-sm">
            {filteredLogs.map((l) => (
              <li key={l.auditId} className="flex items-start gap-4 px-4 py-3 text-sm hover:bg-paper/30">
                <span className="w-44 shrink-0 text-xs text-ink/50">
                  {fmtWhen(l.timestamp)}
                </span>
                <span className="w-48 shrink-0">
                  <span className="block font-medium text-ink truncate">{l.user?.name || `User #${l.userId}`}</span>
                  {l.user?.department?.departmentName && (
                    <span className="block text-xs text-ink/50 mt-0.5 truncate">{l.user.department.departmentName}</span>
                  )}
                </span>
                <span className="w-48 shrink-0">
                  <StatusPill tone={ACTIONS[l.action]?.tone}>{actionLabel(l.action)}</StatusPill>
                </span>
                <span className="flex-1 text-ink/60 min-w-0 break-words">{describe(l)}</span>
              </li>
            ))}
            {filteredLogs.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-ink/50">Nothing matches these filters.</li>
            )}
          </ul>
        </div>

        {/* Mobile Card View */}
        <div className="mt-6 block md:hidden space-y-4">
          {filteredLogs.map((l) => (
            <div key={l.auditId} className="rounded-lg border border-line bg-white p-4 shadow-sm flex flex-col gap-2">
              <div className="flex justify-between items-start gap-3">
                <StatusPill tone={ACTIONS[l.action]?.tone}>{actionLabel(l.action)}</StatusPill>
                <span className="text-[11px] text-ink/50 text-right">
                  {fmtWhen(l.timestamp)}
                </span>
              </div>
              <div>
                <span className="font-medium text-ink">{l.user?.name || `User #${l.userId}`}</span>
                {l.user?.department?.departmentName && (
                  <span className="text-xs text-ink/50 ml-1.5">({l.user.department.departmentName})</span>
                )}
              </div>
              <div className="text-sm text-ink/70 mt-1 bg-paper p-2.5 rounded border border-line/50">
                {describe(l)}
              </div>
            </div>
          ))}
          {filteredLogs.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-ink/50 bg-white rounded-lg border border-line shadow-sm">
              Nothing matches these filters.
            </div>
          )}
        </div>
      </>
    )}
    </div>
  );
}
