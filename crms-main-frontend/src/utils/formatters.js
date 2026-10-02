/**
 * Safe date, time, and datetime formatting utilities for CRMS Admin Frontend.
 * These formatters defensively handle Postgres TIME ("HH:MM:SS"), ISO strings,
 * Date objects, timestamps, and null/undefined values without throwing RangeError.
 */

/**
 * Format a time value (e.g. "09:00:00", "1970-01-01T09:00:00.000Z") into "HH:mm".
 * Returns "—" for invalid/empty inputs.
 *
 * @param {string|Date|number|null|undefined} val
 * @returns {string} e.g. "09:00" or "—"
 */
export function fmtTime(val) {
  if (val === null || val === undefined || val === '') return '—';

  let h, m;

  // Handle plain time strings like "09:00:00" or "9:30"
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return '—';

    // Matches "HH:MM" or "HH:MM:SS" (without full date prefix)
    const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (timeMatch) {
      h = parseInt(timeMatch[1], 10);
      m = timeMatch[2];
    }
  }

  // Handle ISO strings, Date instances, or numeric timestamps
  if (h === undefined) {
    try {
      const d = val instanceof Date ? val : new Date(val);
      if (isNaN(d.getTime())) return '—';
      h = d.getUTCHours();
      m = d.getUTCMinutes().toString().padStart(2, '0');
    } catch {
      return '—';
    }
  }

  if (h === undefined || isNaN(h)) return '—';

  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  
  const paddedH = h.toString().padStart(2, '0');
  return `${paddedH}:${m} ${ampm}`;
}

/**
 * Format a date value (e.g. "2026-08-16", "2026-08-16T00:00:00.000Z") into "YYYY-MM-DD".
 * Returns "—" for invalid/empty inputs.
 *
 * @param {string|Date|number|null|undefined} val
 * @returns {string} e.g. "2026-08-16" or "—"
 */
export function fmtDate(val) {
  if (val === null || val === undefined || val === '') return '—';

  let d;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return '—';

    // If it's a date-only string like YYYY-MM-DD, parse it carefully
    const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      d = new Date(parseInt(dateMatch[1], 10), parseInt(dateMatch[2], 10) - 1, parseInt(dateMatch[3], 10));
    } else {
      d = new Date(val);
    }
  } else {
    d = val instanceof Date ? val : new Date(val);
  }

  if (isNaN(d.getTime())) return '—';

  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Format a full datetime timestamp into "YYYY-MM-DD HH:mm:ss".
 * Returns "—" for invalid/empty inputs.
 *
 * @param {string|Date|number|null|undefined} val
 * @returns {string} e.g. "2026-08-16 14:30:00" or "—"
 */
export function fmtDateTime(val) {
  if (val === null || val === undefined || val === '') return '—';

  try {
    const d = val instanceof Date ? val : new Date(val);
    if (isNaN(d.getTime())) return '—';
    return d.toISOString().replace('T', ' ').slice(0, 19);
  } catch {
    return '—';
  }
}

/**
 * Format start and end time as a time slot range: "HH:mm–HH:mm".
 *
 * @param {string|Date|null|undefined} startTime
 * @param {string|Date|null|undefined} endTime
 * @returns {string} e.g. "09:00–10:30" or "—"
 */
export function fmtTimeSlot(startTime, endTime) {
  const start = fmtTime(startTime);
  const end = fmtTime(endTime);
  if (start === '—' && end === '—') return '—';
  if (start === '—') return end;
  if (end === '—') return start;
  return `${start}–${end}`;
}
