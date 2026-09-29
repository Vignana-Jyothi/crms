import { useEffect, useState } from 'react';
import { auditApi } from '../../api/endpoints';
import { fmtDateTime } from '../../utils/formatters';
import { motion, AnimatePresence } from 'framer-motion';

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
      const safeString = (val) => (val ? String(val).toLowerCase() : '');
      const matchUser = safeString(l.user?.name).includes(q) || safeString(l.userId).includes(q);
      const matchDetails = safeString(l.details).includes(q);
      const matchEntity = safeString(l.entityId).includes(q) || safeString(l.entityType).includes(q);
      const matchAction = safeString(l.action).includes(q);
      const matchTimestamp = safeString(fmtDateTime(l.timestamp)).includes(q);
      
      if (!matchUser && !matchDetails && !matchEntity && !matchAction && !matchTimestamp) return false;
    }
    return true;
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-display font-bold text-ink drop-shadow-sm">Audit logs</h1>
        <p className="mt-2 text-ink/70 text-sm font-medium">Who changed what, and when — most recent first.</p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col md:flex-row items-start md:items-end gap-4 rounded-2xl bg-white/60 backdrop-blur-xl border border-white/40 p-5 shadow-xl shadow-indigo-900/5"
      >
        <div>
          <label className="block text-xs font-semibold text-ink/70 mb-1">Search</label>
          <input
            type="text"
            placeholder="Search details or user…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded border border-line px-3 py-1.5 text-xs w-56 focus:border-navy focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink/70 mb-1">Action Type</label>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="rounded border border-line bg-white px-3 py-1.5 text-xs focus:border-navy focus:outline-none"
          >
            <option value="">All Actions</option>
            <option value="CREATE_BOOKING">CREATE_BOOKING</option>
            <option value="APPROVE_BOOKING">APPROVE_BOOKING</option>
            <option value="REJECT_BOOKING">REJECT_BOOKING</option>
            <option value="CANCEL_BOOKING">CANCEL_BOOKING</option>
            <option value="CREATE_RESOURCE">CREATE_RESOURCE</option>
            <option value="UPDATE_RESOURCE">UPDATE_RESOURCE</option>
            <option value="CREATE_USER">CREATE_USER</option>
            <option value="UPDATE_ROLE">UPDATE_ROLE</option>
            <option value="UPDATE_STATUS">UPDATE_STATUS</option>
            <option value="RESET_PASSWORD">RESET_PASSWORD</option>
            <option value="LOGIN">LOGIN</option>
            <option value="LOGIN_FAILED">LOGIN_FAILED</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink/70 mb-1">Entity Type</label>
          <select
            value={selectedEntityType}
            onChange={(e) => setSelectedEntityType(e.target.value)}
            className="rounded border border-line bg-white px-3 py-1.5 text-xs focus:border-navy focus:outline-none"
          >
            <option value="">All Entities</option>
            <option value="booking">Booking</option>
            <option value="resource">Resource</option>
            <option value="user">User</option>
            <option value="approval">Approval</option>
            <option value="session">Session</option>
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
        <p className="mt-6 text-sm font-medium text-ink/50 animate-pulse">Loading audit logs…</p>
      ) : (
        <>
          <div className="mt-6 hidden md:block overflow-x-auto pb-4">
            <motion.ul 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="min-w-[800px] divide-y divide-white/20 rounded-2xl border border-white/40 bg-white/70 backdrop-blur-xl shadow-xl shadow-indigo-900/5 overflow-hidden"
            >
            <AnimatePresence>
            {filteredLogs.map((l, i) => (
              <motion.li 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.02 }}
                key={l.auditId} 
                className="flex items-start gap-4 px-5 py-4 text-sm hover:bg-white/50 transition-colors duration-200 group"
              >
                <span className="w-40 shrink-0 font-mono text-xs text-ink/40">
                  {fmtDateTime(l.timestamp)}
                </span>
                <span className="w-48 shrink-0">
                  <span className="block font-medium text-ink truncate">{l.user?.name || `User #${l.userId}`}</span>
                  {l.user?.department?.departmentName && (
                    <span className="block text-xs text-ink/50 mt-0.5 truncate">{l.user.department.departmentName}</span>
                  )}
                </span>
                <span className="w-44 shrink-0">
                  <span className="inline-block rounded-full bg-gradient-to-r from-indigo-100 to-violet-100 border border-indigo-200/50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 shadow-sm">
                    {l.action}
                  </span>
                </span>
                <span className="flex-1 text-ink/60 min-w-0 break-words">
                  <span className="font-medium text-ink/70 uppercase text-[11px] tracking-wide mr-1">
                    [{l.entityType}]
                  </span>
                  {l.entityId}
                  {l.details ? ` — ${l.details}` : ''}
                </span>
              </motion.li>
            ))}
            </AnimatePresence>
            {filteredLogs.length === 0 && (
              <li className="px-5 py-12 text-center text-sm font-medium text-ink/50">No audit activity matches filters.</li>
            )}
          </motion.ul>
        </div>

        {/* Mobile Card View */}
        <div className="mt-6 block md:hidden space-y-4">
          {filteredLogs.map((l) => (
            <div key={l.auditId} className="rounded-lg border border-line bg-white p-4 shadow-sm flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <span className="inline-block rounded bg-navy/5 px-2 py-0.5 text-[10px] font-bold text-navy uppercase tracking-wide">
                  {l.action}
                </span>
                <span className="font-mono text-[10px] text-ink/40">
                  {fmtDateTime(l.timestamp)}
                </span>
              </div>
              <div>
                <span className="font-medium text-ink">{l.user?.name || `User #${l.userId}`}</span>
                {l.user?.department?.departmentName && (
                  <span className="text-xs text-ink/50 ml-1.5">({l.user.department.departmentName})</span>
                )}
              </div>
              <div className="text-sm text-ink/70 mt-1 bg-paper p-2.5 rounded border border-line/50">
                <span className="font-medium text-ink/70 uppercase text-[10px] tracking-wide mr-1">
                  [{l.entityType}]
                </span>
                {l.entityId}
                {l.details ? ` — ${l.details}` : ''}
              </div>
            </div>
          ))}
          {filteredLogs.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-ink/50 bg-white rounded-lg border border-line shadow-sm">
              No audit activity matches filters.
            </div>
          )}
        </div>
      </>
    )}
    </div>
  );
}
