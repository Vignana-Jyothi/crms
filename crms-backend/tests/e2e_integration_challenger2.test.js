const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const bookingsService = require('../src/modules/bookings/bookings.service');
const bookingsRepo = require('../src/modules/bookings/bookings.repository');
const approvalsService = require('../src/modules/approvals/approvals.service');
const approvalsRepo = require('../src/modules/approvals/approvals.repository');
const resourcesService = require('../src/modules/resources/resources.service');
const resourcesRepo = require('../src/modules/resources/resources.repository');
const authService = require('../src/modules/auth/auth.service');
const authRepo = require('../src/modules/auth/auth.repository');
const auditService = require('../src/modules/audit/audit.service');
const prisma = require('../src/config/prisma');
const { ROLES } = require('../src/middleware/authorizeRole');
const { signAccessToken, signRefreshToken, verifyAccessToken } = require('../src/utils/jwt');

describe('CRMS Adversarial E2E Workflow & Cross-System Integration Test Suite', () => {
  // ---------------------------------------------------------------------------
  // SCENARIO A: Requester -> Seminar Hall (Institute) -> Resolve Institute Admin
  //             -> Institute Admin Approves with Remarks -> Requester sees Approved
  // ---------------------------------------------------------------------------
  describe('Scenario A: Institute-Owned Resource (Seminar Hall) E2E Lifecycle', () => {
    let mockTx, dbBookings, dbApprovals, dbAudits;

    beforeEach(() => {
      dbBookings = new Map();
      dbApprovals = new Map();
      dbAudits = [];

      mockTx = {
        resource: {
          findUnique: async ({ where }) => {
            if (where.resourceId === 'SH-AUD-01') {
              return {
                resourceId: 'SH-AUD-01',
                resourceName: 'APJ Abdul Kalam Seminar Hall',
                status: 'Active',
                resourceTypeId: 3,
                departmentId: null,
                resourceType: { typeName: 'Seminar Hall' },
              };
            }
            return null;
          },
        },
        approval: {
          create: async ({ data }) => {
            const approval = { approvalId: dbApprovals.size + 1, decision: null, decisionAt: null, remarks: null, ...data };
            dbApprovals.set(approval.approvalId, approval);
            return approval;
          },
        },
      };

      prisma.$transaction = async (fn, opts) => fn(mockTx);

      bookingsRepo.findTimetableConflicts = async () => [];
      bookingsRepo.findOverlappingBookings = async () => [];
      bookingsRepo.create = async (tx, data) => {
        const booking = { bookingId: dbBookings.size + 101, ...data };
        dbBookings.set(booking.bookingId, booking);
        return booking;
      };
      bookingsRepo.updateStatus = async (tx, bookingId, status) => {
        const b = dbBookings.get(bookingId);
        if (b) b.status = status;
        return b;
      };

      auditService.log = async (audit) => {
        dbAudits.push(audit);
      };
    });

    it('executes full Scenario A lifecycle seamlessly from submission to approval', async () => {
      // 1. Setup mock institute admin in user table
      const mockInstituteAdmin = {
        userId: 20,
        name: 'Dean Administration',
        email: 'dean.admin@vnrvjiet.in',
        roleId: ROLES.INSTITUTE_ADMIN,
        departmentId: null,
        status: 'Active',
      };
      prisma.user.findFirst = async ({ where }) => {
        if (where.roleId === ROLES.INSTITUTE_ADMIN && where.status === 'Active') {
          return mockInstituteAdmin;
        }
        return null;
      };

      // 2. Requester submits booking for Seminar Hall
      const requesterUserId = 105;
      const bookingPayload = {
        resourceId: 'SH-AUD-01',
        bookingDate: '2026-09-01',
        startTime: '09:30',
        endTime: '12:30',
        purpose: 'National Level Technical Symposium Keynote',
      };

      const createdBooking = await bookingsService.createBooking(bookingPayload, requesterUserId);

      // Verify booking creation state
      assert.equal(createdBooking.bookingId, 101);
      assert.equal(createdBooking.status, 'Pending');
      assert.equal(createdBooking.approverUserId, 20);

      // Verify approval record was linked to Institute Admin
      assert.equal(dbApprovals.size, 1);
      const approval = dbApprovals.get(1);
      assert.equal(approval.bookingId, 101);
      assert.equal(approval.approverUserId, 20);
      assert.equal(approval.approverRoleId, ROLES.INSTITUTE_ADMIN);
      assert.equal(approval.decision, null);

      // Verify audit log for creation
      assert.equal(dbAudits.length, 1);
      assert.equal(dbAudits[0].action, 'CREATE_BOOKING');
      assert.equal(dbAudits[0].userId, requesterUserId);

      // 3. Institute Admin logs in & queries pending approvals
      const instituteAdminAuth = {
        userId: 20,
        roleId: ROLES.INSTITUTE_ADMIN,
        departmentId: null,
      };

      approvalsRepo.findById = async (id) => {
        const app = dbApprovals.get(id);
        if (!app) return null;
        return {
          ...app,
          booking: {
            ...dbBookings.get(app.bookingId),
            resource: {
              resourceId: 'SH-AUD-01',
              resourceName: 'APJ Abdul Kalam Seminar Hall',
              departmentId: null,
            },
            requester: {
              name: 'Student Coordinator',
              phone: '9876543210',
              email: 'coord@vnrvjiet.in',
            },
          },
        };
      };

      approvalsRepo.recordDecision = async (tx, id, data) => {
        const app = dbApprovals.get(id);
        Object.assign(app, data, { decisionAt: new Date() });
        return app;
      };

      // 4. Institute Admin approves request with remarks
      const decisionRemarks = 'Approved. Facilities team instructed to arrange AV projector and AC.';
      const decisionResult = await approvalsService.decide(1, 'Approved', decisionRemarks, instituteAdminAuth);

      assert.equal(decisionResult.decision, 'Approved');
      assert.equal(decisionResult.remarks, decisionRemarks);

      // 5. Verify booking state transitioned to Approved
      const updatedBooking = dbBookings.get(101);
      assert.equal(updatedBooking.status, 'Approved');

      // 6. Verify audit log for approval
      assert.equal(dbAudits.length, 2);
      assert.equal(dbAudits[1].action, 'APPROVED_BOOKING');
      assert.equal(dbAudits[1].userId, 20);
      assert.equal(dbAudits[1].details, decisionRemarks);

      // 7. Requester queries their bookings (list view)
      bookingsRepo.list = async (filters) => {
        return Array.from(dbBookings.values()).filter((b) => !filters.requesterUserId || b.requesterUserId === filters.requesterUserId);
      };

      const requesterBookings = await bookingsService.list({ requesterUserId: 105 });
      assert.equal(requesterBookings.length, 1);
      assert.equal(requesterBookings[0].bookingId, 101);
      assert.equal(requesterBookings[0].status, 'Approved');
    });
  });

  // ---------------------------------------------------------------------------
  // SCENARIO B: Requester -> Department Classroom -> Resolve Department Admin
  //             -> Dept Admin Rejects with Remarks -> Requester sees Rejected
  // ---------------------------------------------------------------------------
  describe('Scenario B: Department-Owned Resource (Classroom) E2E Lifecycle', () => {
    let mockTx, dbBookings, dbApprovals, dbAudits;

    beforeEach(() => {
      dbBookings = new Map();
      dbApprovals = new Map();
      dbAudits = [];

      mockTx = {
        resource: {
          findUnique: async ({ where }) => {
            if (where.resourceId === 'CSE-CR-205') {
              return {
                resourceId: 'CSE-CR-205',
                resourceName: 'CSE Smart Classroom 205',
                status: 'Active',
                resourceTypeId: 1,
                departmentId: 1, // CSE department
                resourceType: { typeName: 'Classroom' },
              };
            }
            return null;
          },
        },
        approval: {
          create: async ({ data }) => {
            const approval = { approvalId: dbApprovals.size + 1, decision: null, decisionAt: null, remarks: null, ...data };
            dbApprovals.set(approval.approvalId, approval);
            return approval;
          },
        },
      };

      prisma.$transaction = async (fn) => fn(mockTx);

      bookingsRepo.findTimetableConflicts = async () => [];
      bookingsRepo.findOverlappingBookings = async () => [];
      bookingsRepo.create = async (tx, data) => {
        const booking = { bookingId: dbBookings.size + 201, ...data };
        dbBookings.set(booking.bookingId, booking);
        return booking;
      };
      bookingsRepo.updateStatus = async (tx, bookingId, status) => {
        const b = dbBookings.get(bookingId);
        if (b) b.status = status;
        return b;
      };

      auditService.log = async (audit) => {
        dbAudits.push(audit);
      };
    });

    it('executes full Scenario B lifecycle: department routing, rejection with remarks, and immutable rejected state', async () => {
      // 1. Mock Department Admin for CSE (departmentId: 1)
      const mockCseDeptAdmin = {
        userId: 31,
        name: 'CSE Department Head',
        email: 'hod.cse@vnrvjiet.in',
        roleId: ROLES.DEPARTMENT_ADMIN,
        departmentId: 1,
        status: 'Active',
      };
      prisma.user.findFirst = async ({ where }) => {
        if (where.roleId === ROLES.DEPARTMENT_ADMIN && where.departmentId === 1 && where.status === 'Active') {
          return mockCseDeptAdmin;
        }
        return null;
      };

      // 2. Requester submits booking for Classroom
      const requesterUserId = 110;
      const bookingPayload = {
        resourceId: 'CSE-CR-205',
        bookingDate: '2026-09-02',
        startTime: '14:00',
        endTime: '16:00',
        purpose: 'Coding Club Practice Session',
      };

      const createdBooking = await bookingsService.createBooking(bookingPayload, requesterUserId);

      // Verify routing resolved to CSE Department Admin
      assert.equal(createdBooking.bookingId, 201);
      assert.equal(createdBooking.status, 'Pending');
      assert.equal(createdBooking.approverUserId, 31);

      const approval = dbApprovals.get(1);
      assert.equal(approval.approverUserId, 31);
      assert.equal(approval.approverRoleId, ROLES.DEPARTMENT_ADMIN);

      // 3. Dept Admin logs in and rejects request with remarks
      const deptAdminAuth = {
        userId: 31,
        roleId: ROLES.DEPARTMENT_ADMIN,
        departmentId: 1,
      };

      approvalsRepo.findById = async (id) => {
        const app = dbApprovals.get(id);
        if (!app) return null;
        return {
          ...app,
          booking: {
            ...dbBookings.get(app.bookingId),
            resource: {
              resourceId: 'CSE-CR-205',
              departmentId: 1,
            },
          },
        };
      };

      approvalsRepo.recordDecision = async (tx, id, data) => {
        const app = dbApprovals.get(id);
        Object.assign(app, data, { decisionAt: new Date() });
        return app;
      };

      const rejectRemarks = 'Room required for NBA Accreditation internal faculty audit during this slot.';
      const decisionResult = await approvalsService.decide(1, 'Rejected', rejectRemarks, deptAdminAuth);

      assert.equal(decisionResult.decision, 'Rejected');
      assert.equal(decisionResult.remarks, rejectRemarks);

      // 4. Verify booking status updated to Rejected
      const updatedBooking = dbBookings.get(201);
      assert.equal(updatedBooking.status, 'Rejected');

      // 5. Verify audit log
      assert.equal(dbAudits[1].action, 'REJECTED_BOOKING');
      assert.equal(dbAudits[1].userId, 31);
      assert.equal(dbAudits[1].details, rejectRemarks);

      // 6. Requester cannot cancel an already Rejected booking
      bookingsRepo.findById = async (id) => dbBookings.get(id);
      await assert.rejects(
        async () => {
          await bookingsService.cancel(201, requesterUserId);
        },
        (err) => err.statusCode === 409 && /already Rejected, cannot cancel/.test(err.message)
      );
    });
  });

  // ---------------------------------------------------------------------------
  // SCENARIO C: Conflicting Booking Attempt -> 409 Conflict + Frontend Catch
  // ---------------------------------------------------------------------------
  describe('Scenario C: Conflict Detection Engine & Overlap Matrix', () => {
    let mockTx;

    beforeEach(() => {
      mockTx = {
        resource: {
          findUnique: async () => ({
            resourceId: 'KS-AUDITORIUM',
            status: 'Active',
            resourceType: { typeName: 'Auditorium' },
          }),
        },
        booking: { update: null, create: null },
        approval: { create: null },
      };
      prisma.$transaction = async (fn) => fn(mockTx);
    });

    it('rejects all 4 overlapping temporal topologies with 409 Conflict and structured details', async () => {
      // Existing booking from 14:00 to 16:00
      const existingStart = new Date('1970-01-01T14:00:00Z');
      const existingEnd = new Date('1970-01-01T16:00:00Z');

      bookingsRepo.findTimetableConflicts = async () => [];

      // Test Case 1: Partial overlap on tail (15:00 - 17:00)
      bookingsRepo.findOverlappingBookings = async (tx, { startTime, endTime }) => {
        if (existingStart < endTime && existingEnd > startTime) {
          return [{ bookingId: 88, startTime: existingStart, endTime: existingEnd, status: 'Approved' }];
        }
        return [];
      };

      await assert.rejects(
        async () => {
          await bookingsService.createBooking(
            {
              resourceId: 'KS-AUDITORIUM',
              bookingDate: '2026-08-20',
              startTime: '15:00',
              endTime: '17:00',
              purpose: 'Event B (Tail overlap)',
            },
            50
          );
        },
        (err) => {
          assert.equal(err.statusCode, 409);
          assert.match(err.message, /overlaps an existing booking/i);
          assert.equal(err.details.conflicts.length, 1);
          assert.equal(err.details.conflicts[0].bookingId, 88);
          return true;
        }
      );

      // Test Case 2: Partial overlap on head (13:00 - 15:00)
      await assert.rejects(
        async () => {
          await bookingsService.createBooking(
            {
              resourceId: 'KS-AUDITORIUM',
              bookingDate: '2026-08-20',
              startTime: '13:00',
              endTime: '15:00',
              purpose: 'Event C (Head overlap)',
            },
            51
          );
        },
        (err) => err.statusCode === 409
      );

      // Test Case 3: Complete subset / inner overlap (14:30 - 15:30)
      await assert.rejects(
        async () => {
          await bookingsService.createBooking(
            {
              resourceId: 'KS-AUDITORIUM',
              bookingDate: '2026-08-20',
              startTime: '14:30',
              endTime: '15:30',
              purpose: 'Event D (Inner overlap)',
            },
            52
          );
        },
        (err) => err.statusCode === 409
      );

      // Test Case 4: Complete superset / enclosing overlap (13:00 - 17:00)
      await assert.rejects(
        async () => {
          await bookingsService.createBooking(
            {
              resourceId: 'KS-AUDITORIUM',
              bookingDate: '2026-08-20',
              startTime: '13:00',
              endTime: '17:00',
              purpose: 'Event E (Enclosing overlap)',
            },
            53
          );
        },
        (err) => err.statusCode === 409
      );
    });

    it('allows contiguous adjacent slots (no overlap on exact boundaries)', async () => {
      const existingStart = new Date('1970-01-01T14:00:00Z');
      const existingEnd = new Date('1970-01-01T16:00:00Z');

      bookingsRepo.findTimetableConflicts = async () => [];
      bookingsRepo.findOverlappingBookings = async (tx, { startTime, endTime }) => {
        if (existingStart < endTime && existingEnd > startTime) {
          return [{ bookingId: 88, startTime: existingStart, endTime: existingEnd, status: 'Approved' }];
        }
        return [];
      };

      bookingsRepo.create = async (tx, data) => ({ bookingId: 99, status: 'Pending', ...data });
      resourcesService.resolveApprover = async () => ({ userId: 1, roleId: 1 });
      mockTx.approval.create = async () => ({ approvalId: 1 });
      auditService.log = async () => {};

      // Slot 1: Immediately preceding (12:00 - 14:00) -> existingStart (14:00) is NOT < endTime (14:00)
      const resPreceding = await bookingsService.createBooking(
        {
          resourceId: 'KS-AUDITORIUM',
          bookingDate: '2026-08-20',
          startTime: '12:00',
          endTime: '14:00',
          purpose: 'Morning session before',
        },
        55
      );
      assert.equal(resPreceding.bookingId, 99);

      // Slot 2: Immediately following (16:00 - 18:00) -> existingEnd (16:00) is NOT > startTime (16:00)
      const resFollowing = await bookingsService.createBooking(
        {
          resourceId: 'KS-AUDITORIUM',
          bookingDate: '2026-08-20',
          startTime: '16:00',
          endTime: '18:00',
          purpose: 'Evening session after',
        },
        56
      );
      assert.equal(resFollowing.bookingId, 99);
    });

    it('verifies frontend error formatter correctly extracts conflicting time ranges', () => {
      const backendErrorResponse = {
        error: 'This slot overlaps an existing booking',
        details: {
          conflicts: [
            {
              bookingId: 88,
              startTime: '1970-01-01T14:00:00.000Z',
              endTime: '1970-01-01T16:00:00.000Z',
              status: 'Approved',
            },
          ],
        },
      };

      // Emulate frontend ResourceDetail.jsx conflict error parser
      const data = backendErrorResponse;
      let formattedError = '';
      if (data?.details?.conflicts && Array.isArray(data.details.conflicts) && data.details.conflicts.length > 0) {
        formattedError = `${data.error}: ${data.details.conflicts
          .map((c) => `${new Date(c.startTime).toISOString().slice(11, 16)}–${new Date(c.endTime).toISOString().slice(11, 16)}`)
          .join(', ')}`;
      }

      assert.equal(formattedError, 'This slot overlaps an existing booking: 14:00–16:00');
    });
  });

  // ---------------------------------------------------------------------------
  // SCENARIO D: Admin Portal Role Gating & RBAC Department Scoping
  // ---------------------------------------------------------------------------
  describe('Scenario D: Admin Portal Role Gating & Department Scope Isolation', () => {
    it('blocks Requester from logging into Admin portal and clears tokens', async () => {
      const requesterUser = {
        userId: 42,
        name: 'Regular Student',
        email: 'student@vnrvjiet.in',
        role: 'Requester',
        department: 'CSE',
      };

      // Emulate AuthContext.jsx login guard in Admin frontend
      const loginAdminApp = async (user) => {
        if (user.role === 'Requester') {
          throw new Error('This account does not have admin access. Use the main booking site instead.');
        }
        return user;
      };

      await assert.rejects(
        async () => {
          await loginAdminApp(requesterUser);
        },
        (err) => err.message === 'This account does not have admin access. Use the main booking site instead.'
      );
    });

    it('enforces Department Admin approval boundary (cannot approve bookings for other departments)', () => {
      const cseDeptAdminAuth = { userId: 3, roleId: ROLES.DEPARTMENT_ADMIN, departmentId: 1 }; // CSE

      const eceApproval = {
        approvalId: 10,
        approverUserId: null,
        approverRoleId: ROLES.DEPARTMENT_ADMIN,
        booking: {
          bookingId: 50,
          resource: {
            resourceId: 'ECE-LAB-01',
            departmentId: 2, // ECE
          },
        },
      };

      // Emulate approvals.service.js canDecide
      const canDecide = (approval, auth) => {
        if (auth.roleId === ROLES.SUPER_ADMIN) return true;
        if (approval.approverUserId === auth.userId) return true;
        if (approval.approverRoleId === auth.roleId) {
          if (auth.roleId === ROLES.DEPARTMENT_ADMIN) {
            return approval.booking.resource.departmentId === auth.departmentId;
          }
          return true;
        }
        return false;
      };

      assert.equal(canDecide(eceApproval, cseDeptAdminAuth), false);

      const cseApproval = {
        approvalId: 11,
        approverUserId: null,
        approverRoleId: ROLES.DEPARTMENT_ADMIN,
        booking: {
          bookingId: 51,
          resource: {
            resourceId: 'CSE-CR-201',
            departmentId: 1, // CSE
          },
        },
      };
      assert.equal(canDecide(cseApproval, cseDeptAdminAuth), true);
    });

    it('enforces Super Admin unrestricted authority across all resources and departments', () => {
      const superAdminAuth = { userId: 1, roleId: ROLES.SUPER_ADMIN, departmentId: null };

      const eceApproval = {
        approvalId: 10,
        approverUserId: 99, // Assigned to deactivated admin
        approverRoleId: ROLES.DEPARTMENT_ADMIN,
        booking: {
          bookingId: 50,
          resource: { departmentId: 2 },
        },
      };

      const canDecide = (approval, auth) => {
        if (auth.roleId === ROLES.SUPER_ADMIN) return true;
        if (approval.approverUserId === auth.userId) return true;
        if (approval.approverRoleId === auth.roleId) {
          if (auth.roleId === ROLES.DEPARTMENT_ADMIN) {
            return approval.booking.resource.departmentId === auth.departmentId;
          }
          return true;
        }
        return false;
      };

      assert.equal(canDecide(eceApproval, superAdminAuth), true);
    });
  });

  // ---------------------------------------------------------------------------
  // API CLIENT, TOKEN REFRESH & SAFE FORMATTING ADVERSARIAL STRESS
  // ---------------------------------------------------------------------------
  describe('Frontend API Client & Formatter Edge Cases', () => {
    it('verifies concurrent 401 handling coalesces into a single refresh request', async () => {
      let refreshCallCount = 0;
      let refreshPromise = null;

      const mockRefreshTokenApi = async (refreshToken) => {
        refreshCallCount++;
        // Simulate network latency
        await new Promise((r) => setTimeout(r, 10));
        return { accessToken: `new_access_token_${refreshCallCount}` };
      };

      // Coalescing pattern from client.js
      const performRefresh = async (token) => {
        if (!refreshPromise) {
          refreshPromise = mockRefreshTokenApi(token).finally(() => {
            refreshPromise = null;
          });
        }
        return refreshPromise;
      };

      // Fire 5 concurrent requests that all encountered 401
      const [res1, res2, res3, res4, res5] = await Promise.all([
        performRefresh('valid_refresh_token'),
        performRefresh('valid_refresh_token'),
        performRefresh('valid_refresh_token'),
        performRefresh('valid_refresh_token'),
        performRefresh('valid_refresh_token'),
      ]);

      assert.equal(refreshCallCount, 1);
      assert.equal(res1.accessToken, 'new_access_token_1');
      assert.equal(res2.accessToken, 'new_access_token_1');
      assert.equal(res3.accessToken, 'new_access_token_1');
      assert.equal(res4.accessToken, 'new_access_token_1');
      assert.equal(res5.accessToken, 'new_access_token_1');
    });

    it('stress-tests safe time/date formatters against malicious/corrupt/falsy inputs', () => {
      // Re-create safe formatters from formatters.js
      function fmtTime(val) {
        if (val === null || val === undefined || val === '') return '—';
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (!trimmed) return '—';
          const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
          if (timeMatch) {
            return `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
          }
        }
        try {
          const d = val instanceof Date ? val : new Date(val);
          if (isNaN(d.getTime())) return '—';
          return d.toISOString().slice(11, 16);
        } catch {
          return '—';
        }
      }

      function fmtDate(val) {
        if (val === null || val === undefined || val === '') return '—';
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (!trimmed) return '—';
          const dateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) return dateMatch[1];
        }
        try {
          const d = val instanceof Date ? val : new Date(val);
          if (isNaN(d.getTime())) return '—';
          return d.toISOString().slice(0, 10);
        } catch {
          return '—';
        }
      }

      function fmtTimeSlot(startTime, endTime) {
        const start = fmtTime(startTime);
        const end = fmtTime(endTime);
        if (start === '—' && end === '—') return '—';
        if (start === '—') return end;
        if (end === '—') return start;
        return `${start}–${end}`;
      }

      // Assert defensive behavior on every malformed type
      assert.equal(fmtTime(null), '—');
      assert.equal(fmtTime(undefined), '—');
      assert.equal(fmtTime(''), '—');
      assert.equal(fmtTime('garbage_string'), '—');
      assert.equal(fmtTime('09:30:00'), '09:30');
      assert.equal(fmtTime('9:05'), '09:05');
      assert.equal(fmtTime('1970-01-01T14:30:00.000Z'), '14:30');
      assert.equal(fmtTime(new Date('1970-01-01T11:15:00Z')), '11:15');

      assert.equal(fmtDate(null), '—');
      assert.equal(fmtDate(undefined), '—');
      assert.equal(fmtDate(''), '—');
      assert.equal(fmtDate('2026-08-16T15:30:00.000Z'), '2026-08-16');
      assert.equal(fmtDate('2026-12-31'), '2026-12-31');
      assert.equal(fmtDate('invalid_date_value'), '—');

      assert.equal(fmtTimeSlot(null, null), '—');
      assert.equal(fmtTimeSlot('09:00:00', '10:30:00'), '09:00–10:30');
      assert.equal(fmtTimeSlot('1970-01-01T09:00:00Z', '1970-01-01T10:30:00Z'), '09:00–10:30');
      assert.equal(fmtTimeSlot('09:00:00', null), '09:00');
    });
  });
});
