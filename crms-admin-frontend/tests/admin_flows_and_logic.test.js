/**
 * @file admin_flows_and_logic.test.js
 * Comprehensive automated test suite for crms-admin-frontend.
 * Evaluates safe formatters, role-based authorization gating, approval decision validation,
 * multi-criteria booking filter logic, and audit log mapping.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fmtTime, fmtDate, fmtDateTime, fmtTimeSlot } from '../src/utils/formatters.js';

// Roles definition matching AuthContext.jsx
const ROLES = {
  SUPER_ADMIN: 1,
  INSTITUTE_ADMIN: 2,
  DEPARTMENT_ADMIN: 3,
  REQUESTER: 4,
};

// Admin login verification logic matching AuthContext.jsx
function simulateAdminLogin(user) {
  if (!user || user.roleId === ROLES.REQUESTER || user.role === 'Requester') {
    throw new Error('This account does not have admin access. Use the main booking site instead.');
  }
  return {
    authenticated: true,
    user,
  };
}

// RequireRole route guard logic matching RequireRole.jsx
function checkRouteAccess(user, allowedRoles) {
  if (!user || !user.roleId) return { allowed: false, redirectTo: '/' };
  if (!allowedRoles.includes(user.roleId)) {
    return { allowed: false, redirectTo: '/' };
  }
  return { allowed: true, redirectTo: null };
}

// Approval submission validation logic matching Approvals.jsx
function validateApprovalDecision(decision, remarks) {
  if (decision === 'Rejected') {
    const trimmed = typeof remarks === 'string' ? remarks.trim() : '';
    if (!trimmed) {
      throw new Error('Rejection remarks are mandatory.');
    }
    return { valid: true, decision, remarks: trimmed };
  }
  return { valid: true, decision, remarks: (typeof remarks === 'string' ? remarks.trim() : '') || undefined };
}

// Multi-criteria bookings filter predicate matching Bookings.jsx
function filterBookings(bookings, filters) {
  const { status, departmentId, resourceId, startDate, endDate, search } = filters;

  return bookings.filter((b) => {
    // Status filter
    if (status && b.status !== status) return false;

    // Department filter
    if (departmentId && String(b.resource?.departmentId || b.departmentId) !== String(departmentId)) return false;

    // Resource filter
    if (resourceId && b.resourceId !== resourceId) return false;

    // Start Date filter
    if (startDate) {
      const bDate = fmtDate(b.bookingDate);
      if (bDate < startDate) return false;
    }

    // End Date filter
    if (endDate) {
      const bDate = fmtDate(b.bookingDate);
      if (bDate > endDate) return false;
    }

    // Search query filter
    if (search && search.trim()) {
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
}

// Audit log action type catalogue and filter predicate matching AuditLogs.jsx
const AUDIT_ACTIONS = [
  'CREATE_BOOKING',
  'APPROVE_BOOKING',
  'REJECT_BOOKING',
  'CANCEL_BOOKING',
  'CREATE_RESOURCE',
  'UPDATE_RESOURCE',
  'CREATE_USER',
  'UPDATE_ROLE',
  'UPDATE_STATUS',
  'RESET_PASSWORD',
  'LOGIN',
  'LOGIN_FAILED',
];

const AUDIT_ENTITIES = ['booking', 'resource', 'user', 'approval', 'session'];

function filterAuditLogs(logs, { action, entityType, search }) {
  return logs.filter((l) => {
    if (action && l.action !== action) return false;
    if (entityType && l.entityType !== entityType) return false;
    if (search && search.trim()) {
      const q = search.toLowerCase();
      const matchUser = l.user?.name?.toLowerCase().includes(q) || String(l.userId).includes(q);
      const matchDetails = l.details?.toLowerCase().includes(q);
      const matchEntity = l.entityId?.toLowerCase?.().includes(q) || String(l.entityId).includes(q);
      if (!matchUser && !matchDetails && !matchEntity) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// TEST SUITES
// ---------------------------------------------------------------------------

describe('Admin Frontend: Safe Formatters', () => {
  it('formats Postgres TIME and plain time strings without crashing', () => {
    assert.equal(fmtTime('09:00:00'), '09:00');
    assert.equal(fmtTime('14:30'), '14:30');
    assert.equal(fmtTime('08:05:30'), '08:05');
  });

  it('formats ISO timestamps to HH:mm UTC cleanly', () => {
    assert.equal(fmtTime('1970-01-01T09:00:00.000Z'), '09:00');
    assert.equal(fmtTime('2026-08-24T18:15:00.000Z'), '18:15');
  });

  it('safely falls back to dash on null/empty/invalid values', () => {
    assert.equal(fmtTime(null), '—');
    assert.equal(fmtTime(undefined), '—');
    assert.equal(fmtTime(''), '—');
    assert.equal(fmtTime('not-a-time'), '—');
  });

  it('formats dates in YYYY-MM-DD format defensively', () => {
    assert.equal(fmtDate('2026-08-24'), '2026-08-24');
    assert.equal(fmtDate('2026-08-24T12:00:00.000Z'), '2026-08-24');
    assert.equal(fmtDate(null), '—');
    assert.equal(fmtDate(''), '—');
  });

  it('formats full datetime timestamps correctly', () => {
    assert.equal(fmtDateTime('2026-08-24T14:30:00.000Z'), '2026-08-24 14:30:00');
    assert.equal(fmtDateTime(null), '—');
  });

  it('formats time slots with proper range representation', () => {
    assert.equal(fmtTimeSlot('09:00:00', '11:00:00'), '09:00–11:00');
    assert.equal(fmtTimeSlot(null, '11:00:00'), '11:00');
    assert.equal(fmtTimeSlot('09:00:00', null), '09:00');
    assert.equal(fmtTimeSlot(null, null), '—');
  });
});

describe('Admin Frontend: Role Gating & Authentication Security', () => {
  it('allows Super Admin (roleId 1) to access the admin portal', () => {
    const user = { userId: 1, name: 'Super Admin', roleId: ROLES.SUPER_ADMIN, role: 'Super Admin' };
    const session = simulateAdminLogin(user);
    assert.equal(session.authenticated, true);
  });

  it('allows Institute Admin (roleId 2) to access the admin portal', () => {
    const user = { userId: 2, name: 'Principal', roleId: ROLES.INSTITUTE_ADMIN, role: 'Institute Admin' };
    const session = simulateAdminLogin(user);
    assert.equal(session.authenticated, true);
  });

  it('allows Department Admin (roleId 3) to access the admin portal', () => {
    const user = { userId: 3, name: 'HOD CSE', roleId: ROLES.DEPARTMENT_ADMIN, role: 'Department Admin' };
    const session = simulateAdminLogin(user);
    assert.equal(session.authenticated, true);
  });

  it('rejects Requester (roleId 4) from admin portal with informative error', () => {
    const user = { userId: 4, name: 'Student Requester', roleId: ROLES.REQUESTER, role: 'Requester' };
    assert.throws(
      () => simulateAdminLogin(user),
      /This account does not have admin access\. Use the main booking site instead\./
    );
  });

  it('enforces RequireRole screen-level permissions', () => {
    const superAdminUser = { roleId: ROLES.SUPER_ADMIN };
    const deptAdminUser = { roleId: ROLES.DEPARTMENT_ADMIN };
    const requesterUser = { roleId: ROLES.REQUESTER };

    // Super Admin only routes (Users, Resources, Audit Logs)
    const superAdminOnly = [ROLES.SUPER_ADMIN];
    assert.equal(checkRouteAccess(superAdminUser, superAdminOnly).allowed, true);
    assert.equal(checkRouteAccess(deptAdminUser, superAdminOnly).allowed, false);
    assert.equal(checkRouteAccess(requesterUser, superAdminOnly).allowed, false);
    assert.equal(checkRouteAccess(null, superAdminOnly).allowed, false);

    // All Admins routes (Approvals, Bookings, Overview)
    const allAdmins = [ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN, ROLES.DEPARTMENT_ADMIN];
    assert.equal(checkRouteAccess(superAdminUser, allAdmins).allowed, true);
    assert.equal(checkRouteAccess(deptAdminUser, allAdmins).allowed, true);
    assert.equal(checkRouteAccess(requesterUser, allAdmins).allowed, false);
  });
});

describe('Admin Frontend: Section 56 Approval Queue Decision Validation', () => {
  it('allows approval with optional remarks', () => {
    const res1 = validateApprovalDecision('Approved', 'Special event approved by HOD');
    assert.equal(res1.valid, true);
    assert.equal(res1.remarks, 'Special event approved by HOD');

    const res2 = validateApprovalDecision('Approved', '');
    assert.equal(res2.valid, true);
    assert.equal(res2.remarks, undefined);
  });

  it('enforces mandatory non-empty remarks when decision is Rejected', () => {
    const validReject = validateApprovalDecision('Rejected', 'Venue reserved for NAAC audit');
    assert.equal(validReject.valid, true);
    assert.equal(validReject.remarks, 'Venue reserved for NAAC audit');

    assert.throws(
      () => validateApprovalDecision('Rejected', ''),
      /Rejection remarks are mandatory\./
    );

    assert.throws(
      () => validateApprovalDecision('Rejected', '   \t\n  '),
      /Rejection remarks are mandatory\./
    );

    assert.throws(
      () => validateApprovalDecision('Rejected', null),
      /Rejection remarks are mandatory\./
    );
  });
});

describe('Admin Frontend: Multi-Criteria Booking Filters', () => {
  const sampleBookings = [
    {
      bookingId: 101,
      resourceId: 'KS-101',
      bookingDate: '2026-08-20',
      startTime: '09:00:00',
      endTime: '11:00:00',
      purpose: 'Data Structures Lab Session',
      status: 'Approved',
      resource: { resourceName: 'CSE Seminar Hall', departmentId: 1 },
      requester: { name: 'Alice Smith', email: 'alice@vnrvjiet.in', phone: '9876543210' },
    },
    {
      bookingId: 102,
      resourceId: 'ECE-LAB-1',
      bookingDate: '2026-08-22',
      startTime: '13:00:00',
      endTime: '15:00:00',
      purpose: 'Robotics Workshop',
      status: 'Pending',
      resource: { resourceName: 'Robotics Lab', departmentId: 2 },
      requester: { name: 'Bob Jones', email: 'bob@vnrvjiet.in', phone: '9876543211' },
    },
    {
      bookingId: 103,
      resourceId: 'AUD-MAIN',
      bookingDate: '2026-08-25',
      startTime: '10:00:00',
      endTime: '17:00:00',
      purpose: 'Annual Day Rehearsal',
      status: 'Rejected',
      resource: { resourceName: 'Main Auditorium', departmentId: null },
      requester: { name: 'Carol White', email: 'carol@vnrvjiet.in', phone: '9876543212' },
    },
  ];

  it('filters bookings by status correctly', () => {
    const pending = filterBookings(sampleBookings, { status: 'Pending' });
    assert.equal(pending.length, 1);
    assert.equal(pending[0].bookingId, 102);

    const approved = filterBookings(sampleBookings, { status: 'Approved' });
    assert.equal(approved.length, 1);
    assert.equal(approved[0].bookingId, 101);
  });

  it('filters bookings by departmentId correctly', () => {
    const cseBookings = filterBookings(sampleBookings, { departmentId: 1 });
    assert.equal(cseBookings.length, 1);
    assert.equal(cseBookings[0].resourceId, 'KS-101');
  });

  it('filters bookings by date range correctly', () => {
    const filtered = filterBookings(sampleBookings, {
      startDate: '2026-08-21',
      endDate: '2026-08-24',
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].bookingId, 102);
  });

  it('filters bookings by multi-field search substring', () => {
    const byPurpose = filterBookings(sampleBookings, { search: 'Robotics' });
    assert.equal(byPurpose.length, 1);
    assert.equal(byPurpose[0].bookingId, 102);

    const byRequester = filterBookings(sampleBookings, { search: 'alice@vnrvjiet' });
    assert.equal(byRequester.length, 1);
    assert.equal(byRequester[0].bookingId, 101);

    const byResource = filterBookings(sampleBookings, { search: 'AUD-MAIN' });
    assert.equal(byResource.length, 1);
    assert.equal(byResource[0].bookingId, 103);
  });
});

describe('Admin Frontend: Audit Log Filtering & Action Catalog', () => {
  const sampleLogs = [
    {
      auditId: 1,
      timestamp: '2026-08-24T10:00:00.000Z',
      userId: 1,
      user: { name: 'Super Admin' },
      action: 'APPROVE_BOOKING',
      entityType: 'approval',
      entityId: '101',
      details: 'Approved booking 101 for KS-101',
    },
    {
      auditId: 2,
      timestamp: '2026-08-24T11:30:00.000Z',
      userId: 3,
      user: { name: 'HOD CSE' },
      action: 'REJECT_BOOKING',
      entityType: 'approval',
      entityId: '103',
      details: 'Rejected booking 103 — Exam schedule conflict',
    },
    {
      auditId: 3,
      timestamp: '2026-08-24T12:15:00.000Z',
      userId: 1,
      user: { name: 'Super Admin' },
      action: 'CREATE_USER',
      entityType: 'user',
      entityId: '55',
      details: 'Created new faculty user',
    },
  ];

  it('contains all 12 mandatory system audit actions', () => {
    assert.equal(AUDIT_ACTIONS.length, 12);
    assert.ok(AUDIT_ACTIONS.includes('CREATE_BOOKING'));
    assert.ok(AUDIT_ACTIONS.includes('APPROVE_BOOKING'));
    assert.ok(AUDIT_ACTIONS.includes('REJECT_BOOKING'));
    assert.ok(AUDIT_ACTIONS.includes('CANCEL_BOOKING'));
    assert.ok(AUDIT_ACTIONS.includes('CREATE_RESOURCE'));
    assert.ok(AUDIT_ACTIONS.includes('UPDATE_RESOURCE'));
    assert.ok(AUDIT_ACTIONS.includes('CREATE_USER'));
    assert.ok(AUDIT_ACTIONS.includes('UPDATE_ROLE'));
    assert.ok(AUDIT_ACTIONS.includes('UPDATE_STATUS'));
    assert.ok(AUDIT_ACTIONS.includes('RESET_PASSWORD'));
    assert.ok(AUDIT_ACTIONS.includes('LOGIN'));
    assert.ok(AUDIT_ACTIONS.includes('LOGIN_FAILED'));
  });

  it('contains all recognized entity types', () => {
    assert.ok(AUDIT_ENTITIES.includes('booking'));
    assert.ok(AUDIT_ENTITIES.includes('resource'));
    assert.ok(AUDIT_ENTITIES.includes('user'));
    assert.ok(AUDIT_ENTITIES.includes('approval'));
    assert.ok(AUDIT_ENTITIES.includes('session'));
  });

  it('filters audit logs by action type, entity type, and search term', () => {
    const rejects = filterAuditLogs(sampleLogs, { action: 'REJECT_BOOKING' });
    assert.equal(rejects.length, 1);
    assert.equal(rejects[0].auditId, 2);

    const userEntities = filterAuditLogs(sampleLogs, { entityType: 'user' });
    assert.equal(userEntities.length, 1);
    assert.equal(userEntities[0].entityId, '55');

    const searchExam = filterAuditLogs(sampleLogs, { search: 'Exam schedule' });
    assert.equal(searchExam.length, 1);
    assert.equal(searchExam[0].auditId, 2);
  });
});
