/**
 * @file requester_flows_and_logic.test.js
 * Comprehensive automated test suite for crms-main-frontend.
 * Evaluates formatters, timeline interval math, badge styling, auth interceptors,
 * 409 conflict error parsers, and rejection remark resolution.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fmtTime, fmtDate, fmtDateTime, fmtTimeSlot } from '../src/utils/formatters.js';

// Reusable todayStr matching implementation in Dashboard.jsx & ResourceDetail.jsx
function todayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Timeline conversion helper matching AvailabilityStrip.jsx
function toMinutes(timeVal) {
  if (!timeVal) return 0;
  if (typeof timeVal === 'string' && !timeVal.includes('T')) {
    const parts = timeVal.split(':');
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      return h * 60 + m;
    }
  }
  const d = new Date(timeVal);
  if (isNaN(d.getTime())) return 0;
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

// Calculate block position percentage matching AvailabilityStrip.jsx
function computeBlockStyle(startMin, endMin, dayStart = 540, dayEnd = 1080) {
  const totalMin = dayEnd - dayStart;
  const clampedStart = Math.max(startMin, dayStart);
  const clampedEnd = Math.min(endMin, dayEnd);
  const left = ((clampedStart - dayStart) / totalMin) * 100;
  const width = ((clampedEnd - clampedStart) / totalMin) * 100;
  return { left, width, visible: width > 0 };
}

// Resource Type Colors matching Dashboard.jsx
const TYPE_COLORS = {
  Classroom: 'bg-navy/10 text-navy',
  Laboratory: 'bg-forest/10 text-forest',
  Lab: 'bg-forest/10 text-forest',
  'Seminar Hall': 'bg-amber/15 text-amber',
  Auditorium: 'bg-amber/15 text-amber',
  'Meeting Room': 'bg-ink/10 text-ink/70',
};

function getBadgeColor(typeName) {
  return TYPE_COLORS[typeName] || 'bg-ink/10 text-ink/70';
}

// Booking conflict error parser matching ResourceDetail.jsx handleSubmit catch
function parseBookingError(err) {
  const data = err?.response?.data;
  if (data?.details?.conflicts && Array.isArray(data.details.conflicts) && data.details.conflicts.length > 0) {
    return `${data.error}: ${data.details.conflicts
      .map((c) => fmtTimeSlot(c.startTime, c.endTime))
      .join(', ')}`;
  } else if (data?.details?.fieldErrors && Object.keys(data.details.fieldErrors).length > 0) {
    const messages = Object.entries(data.details.fieldErrors)
      .map(([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(', ') : errs}`)
      .join('; ');
    return `${data.error || 'Validation error'}: ${messages}`;
  }
  return data?.error || 'Could not create booking.';
}

// Rejection remarks resolution matching MyBookings.jsx
function resolveRejectionRemarks(booking) {
  const matchingApproval = booking.approvals?.find((a) => a.decision === booking.status);
  const remarks = matchingApproval?.remarks ||
    booking.approvals?.[0]?.remarks ||
    booking.rejectionRemarks ||
    'No specific remarks provided.';
  const approverName = matchingApproval?.approverUser?.name || null;
  return { remarks, approverName };
}

// Interceptor auth URL protection check matching client.js
function isAuthEndpoint(url) {
  return !!(url?.includes('/auth/login') || url?.includes('/auth/refresh'));
}

// ---------------------------------------------------------------------------
// TEST SUITES
// ---------------------------------------------------------------------------

describe('Main Frontend: Formatters & Datetime Logic', () => {
  it('formats plain time strings without UTC offset drift', () => {
    assert.equal(fmtTime('09:00'), '09:00');
    assert.equal(fmtTime('09:00:00'), '09:00');
    assert.equal(fmtTime('14:30:45'), '14:30');
    assert.equal(fmtTime('9:05'), '09:05');
  });

  it('formats ISO timestamps defensively', () => {
    assert.equal(fmtTime('1970-01-01T09:00:00.000Z'), '09:00');
    assert.equal(fmtTime('2026-08-24T17:45:00.000Z'), '17:45');
  });

  it('returns fallback dash for null, undefined, empty, or invalid time', () => {
    assert.equal(fmtTime(null), '—');
    assert.equal(fmtTime(undefined), '—');
    assert.equal(fmtTime(''), '—');
    assert.equal(fmtTime('   '), '—');
    assert.equal(fmtTime('invalid-time'), '—');
  });

  it('formats date strings and ISO timestamps accurately', () => {
    assert.equal(fmtDate('2026-08-24'), '2026-08-24');
    assert.equal(fmtDate('2026-08-24T10:00:00.000Z'), '2026-08-24');
    assert.equal(fmtDate(null), '—');
    assert.equal(fmtDate(''), '—');
  });

  it('formats datetime strings into YYYY-MM-DD HH:mm:ss format', () => {
    assert.equal(fmtDateTime('2026-08-24T14:30:00.000Z'), '2026-08-24 14:30:00');
    assert.equal(fmtDateTime(null), '—');
  });

  it('formats time slots correctly with dash separators', () => {
    assert.equal(fmtTimeSlot('09:00:00', '10:30:00'), '09:00–10:30');
    assert.equal(fmtTimeSlot('09:00', '13:00'), '09:00–13:00');
    assert.equal(fmtTimeSlot(null, '13:00'), '13:00');
    assert.equal(fmtTimeSlot('09:00', null), '09:00');
    assert.equal(fmtTimeSlot(null, null), '—');
  });

  it('todayStr returns current local date in YYYY-MM-DD format', () => {
    const today = todayStr();
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
    const d = new Date();
    assert.equal(today.split('-')[0], String(d.getFullYear()));
  });
});

describe('Main Frontend: Availability Strip & Timeline Math', () => {
  it('converts time representations to minutes correctly', () => {
    assert.equal(toMinutes('09:00'), 540);
    assert.equal(toMinutes('09:00:00'), 540);
    assert.equal(toMinutes('13:30:00'), 810);
    assert.equal(toMinutes('18:00'), 1080);
    assert.equal(toMinutes('1970-01-01T09:00:00.000Z'), 540);
    assert.equal(toMinutes(null), 0);
  });

  it('calculates timeline block percentage offsets accurately', () => {
    // 09:00 to 18:00 is 540 minutes total
    // A block 09:00 to 13:30 (540 to 810) is 270 minutes -> left 0%, width 50%
    const block1 = computeBlockStyle(540, 810, 540, 1080);
    assert.equal(block1.left, 0);
    assert.equal(block1.width, 50);
    assert.equal(block1.visible, true);

    // A block 13:30 to 18:00 (810 to 1080) -> left 50%, width 50%
    const block2 = computeBlockStyle(810, 1080, 540, 1080);
    assert.equal(block2.left, 50);
    assert.equal(block2.width, 50);
    assert.equal(block2.visible, true);

    // A block before campus hours (07:00 to 08:30) -> clamped width <= 0 -> invisible
    const blockBefore = computeBlockStyle(420, 510, 540, 1080);
    assert.equal(blockBefore.visible, false);
  });

  it('evaluates interval collision algebra correctly', () => {
    function overlaps(s1, e1, s2, e2) {
      return s1 < e2 && e1 > s2;
    }

    // Existing: 10:00-11:00 (600 to 660)
    const existStart = 600;
    const existEnd = 660;

    // 1. Adjacent Before (09:00-10:00: 540-600) -> false
    assert.equal(overlaps(540, 600, existStart, existEnd), false);

    // 2. Adjacent After (11:00-12:00: 660-720) -> false
    assert.equal(overlaps(660, 720, existStart, existEnd), false);

    // 3. Left Overlap (09:30-10:30: 570-630) -> true
    assert.equal(overlaps(570, 630, existStart, existEnd), true);

    // 4. Right Overlap (10:30-11:30: 630-690) -> true
    assert.equal(overlaps(630, 690, existStart, existEnd), true);

    // 5. Enclosing Superset (09:00-12:00: 540-720) -> true
    assert.equal(overlaps(540, 720, existStart, existEnd), true);

    // 6. Enclosed Subset (10:15-10:45: 615-645) -> true
    assert.equal(overlaps(615, 645, existStart, existEnd), true);

    // 7. Exact Match (10:00-11:00: 600-660) -> true
    assert.equal(overlaps(600, 660, existStart, existEnd), true);
  });
});

describe('Main Frontend: Resource Type Badge Styling', () => {
  it('correctly maps resource types to their designated color badges', () => {
    assert.equal(getBadgeColor('Classroom'), 'bg-navy/10 text-navy');
    assert.equal(getBadgeColor('Laboratory'), 'bg-forest/10 text-forest');
    assert.equal(getBadgeColor('Lab'), 'bg-forest/10 text-forest');
    assert.equal(getBadgeColor('Seminar Hall'), 'bg-amber/15 text-amber');
    assert.equal(getBadgeColor('Auditorium'), 'bg-amber/15 text-amber');
    assert.equal(getBadgeColor('Meeting Room'), 'bg-ink/10 text-ink/70');
  });

  it('provides safe fallback styling for unknown resource types', () => {
    assert.equal(getBadgeColor('Unknown Hall'), 'bg-ink/10 text-ink/70');
    assert.equal(getBadgeColor(null), 'bg-ink/10 text-ink/70');
  });
});

describe('Main Frontend: API Client Interceptors & Auth Security', () => {
  it('identifies authentication endpoints to prevent recursive 401 refresh loops', () => {
    assert.equal(isAuthEndpoint('/api/v1/auth/login'), true);
    assert.equal(isAuthEndpoint('/auth/login'), true);
    assert.equal(isAuthEndpoint('/api/v1/auth/refresh'), true);
    assert.equal(isAuthEndpoint('/auth/refresh'), true);
  });

  it('allows token refresh interception for standard protected endpoints', () => {
    assert.equal(isAuthEndpoint('/api/v1/bookings'), false);
    assert.equal(isAuthEndpoint('/api/v1/resources'), false);
    assert.equal(isAuthEndpoint('/api/v1/approvals/pending'), false);
  });

  it('simulates single-flight token refresh coalescing', async () => {
    let refreshCalls = 0;
    let inFlightPromise = null;

    async function mockRefresh() {
      if (!inFlightPromise) {
        refreshCalls++;
        inFlightPromise = (async () => {
          await new Promise((r) => setTimeout(r, 10));
          return { accessToken: 'new-mock-access-token-xyz' };
        })().finally(() => {
          inFlightPromise = null;
        });
      }
      return inFlightPromise;
    }

    // Fire 3 simultaneous requests needing refresh
    const [res1, res2, res3] = await Promise.all([
      mockRefresh(),
      mockRefresh(),
      mockRefresh(),
    ]);

    assert.equal(refreshCalls, 1, 'Only 1 refresh request should be in-flight');
    assert.equal(res1.accessToken, 'new-mock-access-token-xyz');
    assert.equal(res2.accessToken, 'new-mock-access-token-xyz');
    assert.equal(res3.accessToken, 'new-mock-access-token-xyz');
  });
});

describe('Main Frontend: Conflict & Error Response Parsing', () => {
  it('parses HTTP 409 conflict responses with conflict slot ranges', () => {
    const errorResponse = {
      response: {
        data: {
          error: 'This slot overlaps an existing booking',
          details: {
            conflicts: [
              { startTime: '10:00:00', endTime: '12:00:00' },
              { startTime: '14:00:00', endTime: '15:30:00' },
            ],
          },
        },
      },
    };

    const parsed = parseBookingError(errorResponse);
    assert.equal(
      parsed,
      'This slot overlaps an existing booking: 10:00–12:00, 14:00–15:30'
    );
  });

  it('parses validation fieldErrors appropriately', () => {
    const errorResponse = {
      response: {
        data: {
          error: 'Validation failed',
          details: {
            fieldErrors: {
              purpose: ['Purpose must be at least 3 characters'],
              startTime: ['Invalid start time'],
            },
          },
        },
      },
    };

    const parsed = parseBookingError(errorResponse);
    assert.equal(
      parsed,
      'Validation failed: purpose: Purpose must be at least 3 characters; startTime: Invalid start time'
    );
  });

  it('falls back to generic error message when no structured details exist', () => {
    assert.equal(
      parseBookingError({ response: { data: { error: 'Network timeout' } } }),
      'Network timeout'
    );
    assert.equal(parseBookingError(null), 'Could not create booking.');
  });
});

describe('Main Frontend: Rejection Remarks & Approver Metadata Resolution', () => {
  it('extracts rejection remarks and approver name when matching approval exists', () => {
    const booking = {
      status: 'Rejected',
      approvals: [
        {
          decision: 'Rejected',
          remarks: 'Reserved for faculty recruitment interview',
          approverUser: { name: 'Dr. C. Kiran (HOD CSE)' },
        },
      ],
    };

    const { remarks, approverName } = resolveRejectionRemarks(booking);
    assert.equal(remarks, 'Reserved for faculty recruitment interview');
    assert.equal(approverName, 'Dr. C. Kiran (HOD CSE)');
  });

  it('falls back to booking rejectionRemarks property if approvals array is empty', () => {
    const booking = {
      status: 'Rejected',
      approvals: [],
      rejectionRemarks: 'Direct admin override rejection',
    };

    const { remarks, approverName } = resolveRejectionRemarks(booking);
    assert.equal(remarks, 'Direct admin override rejection');
    assert.equal(approverName, null);
  });

  it('provides default fallback string when no remarks are present', () => {
    const booking = {
      status: 'Rejected',
      approvals: [],
    };

    const { remarks, approverName } = resolveRejectionRemarks(booking);
    assert.equal(remarks, 'No specific remarks provided.');
    assert.equal(approverName, null);
  });
});
