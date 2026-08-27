const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const env = require('../src/config/env');
const prisma = require('../src/config/prisma');
const bookingsService = require('../src/modules/bookings/bookings.service');
const bookingsRepo = require('../src/modules/bookings/bookings.repository');
const resourcesService = require('../src/modules/resources/resources.service');
const approvalsService = require('../src/modules/approvals/approvals.service');
const approvalsRepo = require('../src/modules/approvals/approvals.repository');
const authService = require('../src/modules/auth/auth.service');
const authRepo = require('../src/modules/auth/auth.repository');
const auditService = require('../src/modules/audit/audit.service');
const authenticate = require('../src/middleware/authenticate');
const { authorizeRole, ROLES } = require('../src/middleware/authorizeRole');
const { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } = require('../src/utils/jwt');

const originalResolveApprover = resourcesService.resolveApprover;

// Helper to simulate interval overlap mathematically:
// existing.start < new.end AND existing.end > new.start
function checkIntervalOverlap(existingStartStr, existingEndStr, newStartStr, newEndStr) {
  const eStart = new Date(`1970-01-01T${existingStartStr}:00Z`);
  const eEnd = new Date(`1970-01-01T${existingEndStr}:00Z`);
  const nStart = new Date(`1970-01-01T${newStartStr}:00Z`);
  const nEnd = new Date(`1970-01-01T${newEndStr}:00Z`);

  return eStart < nEnd && eEnd > nStart;
}

describe('CRMS Backend Adversarial Stress & Verification Suite', () => {
  afterEach(() => {
    resourcesService.resolveApprover = originalResolveApprover;
  });

  // =========================================================================
  // 1. CONCURRENCY, TRANSACTION ISOLATION & INTERVAL-OVERLAP QUERY LOGIC
  // =========================================================================
  describe('1. Concurrency & Interval-Overlap Verification', () => {
    let mockTx;

    beforeEach(() => {
      mockTx = {
        resource: { findUnique: null },
        booking: { create: null },
        approval: { create: null },
      };
      prisma.$transaction = async (fn, options) => {
        // Enforce Serializable isolation verification
        assert.equal(options?.isolationLevel, 'Serializable', 'Transaction MUST specify Serializable isolation level');
        return fn(mockTx);
      };
      auditService.log = async () => {};
    });

    describe('Interval Overlap Boundary Matrix (Mathematical & Repository Level)', () => {
      it('Adjacent before (09:00-10:00 vs 10:00-11:00) -> MUST NOT conflict', () => {
        const overlap = checkIntervalOverlap('09:00', '10:00', '10:00', '11:00');
        assert.equal(overlap, false, 'Adjacent interval meeting at boundary must not conflict');
      });

      it('Adjacent after (11:00-12:00 vs 10:00-11:00) -> MUST NOT conflict', () => {
        const overlap = checkIntervalOverlap('11:00', '12:00', '10:00', '11:00');
        assert.equal(overlap, false, 'Adjacent interval starting at boundary must not conflict');
      });

      it('Left overlap (09:00-10:15 vs 10:00-11:00) -> MUST conflict', () => {
        const overlap = checkIntervalOverlap('09:00', '10:15', '10:00', '11:00');
        assert.equal(overlap, true, 'Left overlapping interval must conflict');
      });

      it('Right overlap (10:45-12:00 vs 10:00-11:00) -> MUST conflict', () => {
        const overlap = checkIntervalOverlap('10:45', '12:00', '10:00', '11:00');
        assert.equal(overlap, true, 'Right overlapping interval must conflict');
      });

      it('Enclosing interval (09:00-12:00 vs 10:00-11:00) -> MUST conflict', () => {
        const overlap = checkIntervalOverlap('09:00', '12:00', '10:00', '11:00');
        assert.equal(overlap, true, 'Enclosing interval must conflict');
      });

      it('Enclosed interval (10:15-10:45 vs 10:00-11:00) -> MUST conflict', () => {
        const overlap = checkIntervalOverlap('10:15', '10:45', '10:00', '11:00');
        assert.equal(overlap, true, 'Enclosed interval must conflict');
      });

      it('Exact match (10:00-11:00 vs 10:00-11:00) -> MUST conflict', () => {
        const overlap = checkIntervalOverlap('10:00', '11:00', '10:00', '11:00');
        assert.equal(overlap, true, 'Exact match interval must conflict');
      });

      it('Disjoint interval (08:00-09:00 vs 14:00-15:00) -> MUST NOT conflict', () => {
        const overlap = checkIntervalOverlap('08:00', '09:00', '14:00', '15:00');
        assert.equal(overlap, false, 'Disjoint interval must not conflict');
      });
    });

    describe('Service-Level Conflict Enforcement & Status Filtering', () => {
      it('blocks booking when overlapping with Pending status booking', async () => {
        mockTx.resource.findUnique = async () => ({
          resourceId: 'CSE-CR-201',
          status: 'Active',
          resourceType: { typeName: 'Classroom' },
          departmentId: 1,
        });

        bookingsRepo.findTimetableConflicts = async () => [];
        bookingsRepo.findOverlappingBookings = async () => [
          {
            bookingId: 101,
            resourceId: 'CSE-CR-201',
            startTime: new Date('1970-01-01T10:00:00Z'),
            endTime: new Date('1970-01-01T11:00:00Z'),
            status: 'Pending',
          },
        ];

        await assert.rejects(
          async () => {
            await bookingsService.createBooking(
              {
                resourceId: 'CSE-CR-201',
                bookingDate: '2026-08-17',
                startTime: '10:30',
                endTime: '11:30',
                purpose: 'Conflict test',
              },
              5
            );
          },
          (err) => err.statusCode === 409 && /overlaps an existing booking/.test(err.message)
        );
      });

      it('blocks booking when overlapping with Approved status booking', async () => {
        mockTx.resource.findUnique = async () => ({
          resourceId: 'CSE-CR-201',
          status: 'Active',
          resourceType: { typeName: 'Classroom' },
          departmentId: 1,
        });

        bookingsRepo.findTimetableConflicts = async () => [];
        bookingsRepo.findOverlappingBookings = async () => [
          {
            bookingId: 102,
            resourceId: 'CSE-CR-201',
            startTime: new Date('1970-01-01T14:00:00Z'),
            endTime: new Date('1970-01-01T16:00:00Z'),
            status: 'Approved',
          },
        ];

        await assert.rejects(
          async () => {
            await bookingsService.createBooking(
              {
                resourceId: 'CSE-CR-201',
                bookingDate: '2026-08-17',
                startTime: '13:00',
                endTime: '15:00',
                purpose: 'Conflict test',
              },
              5
            );
          },
          (err) => err.statusCode === 409 && /overlaps an existing booking/.test(err.message)
        );
      });

      it('ACTIVE_STATUSES contains only Pending and Approved (Cancelled & Rejected do not block)', () => {
        assert.deepEqual(bookingsRepo.ACTIVE_STATUSES, ['Pending', 'Approved']);
      });
    });

    describe('Timetable Day-of-Week Specificity', () => {
      it('detects timetable conflict on matching day of week', async () => {
        mockTx.resource.findUnique = async () => ({
          resourceId: 'CSE-CR-201',
          status: 'Active',
          resourceType: { typeName: 'Classroom' },
          departmentId: 1,
        });

        // 2026-08-17 is Monday
        assert.equal(bookingsService.dayOfWeekFor('2026-08-17'), 'Monday');

        bookingsRepo.findTimetableConflicts = async (tx, { dayOfWeek }) => {
          if (dayOfWeek === 'Monday') {
            return [
              {
                timetableId: 1,
                courseCode: 'CS301',
                section: 'A',
                startTime: new Date('1970-01-01T09:00:00Z'),
                endTime: new Date('1970-01-01T10:00:00Z'),
              },
            ];
          }
          return [];
        };

        await assert.rejects(
          async () => {
            await bookingsService.createBooking(
              {
                resourceId: 'CSE-CR-201',
                bookingDate: '2026-08-17',
                startTime: '09:00',
                endTime: '10:00',
                purpose: 'Monday class collision',
              },
              5
            );
          },
          (err) => err.statusCode === 409 && /overlaps a scheduled class/.test(err.message)
        );
      });

      it('allows booking on non-matching day of week even if time slot matches timetable entry', async () => {
        mockTx.resource.findUnique = async () => ({
          resourceId: 'CSE-CR-201',
          status: 'Active',
          resourceType: { typeName: 'Classroom' },
          departmentId: 1,
        });

        // 2026-08-18 is Tuesday
        assert.equal(bookingsService.dayOfWeekFor('2026-08-18'), 'Tuesday');

        bookingsRepo.findTimetableConflicts = async (tx, { dayOfWeek }) => {
          if (dayOfWeek === 'Monday') {
            return [{ courseCode: 'CS301' }];
          }
          return []; // Tuesday has no class at this time
        };
        bookingsRepo.findOverlappingBookings = async () => [];

        bookingsRepo.create = async (tx, data) => ({
          bookingId: 301,
          ...data,
        });

        resourcesService.resolveApprover = async () => ({ userId: 3, roleId: 3 });
        mockTx.approval.create = async ({ data }) => ({ approvalId: 55, ...data });

        const result = await bookingsService.createBooking(
          {
            resourceId: 'CSE-CR-201',
            bookingDate: '2026-08-18', // Tuesday
            startTime: '09:00',
            endTime: '10:00',
            purpose: 'Tuesday slot test',
          },
          5
        );

        assert.equal(result.bookingId, 301);
        assert.equal(result.status, 'Pending');
      });
    });
  });

  // =========================================================================
  // 2. APPROVER RESOLUTION (SECTION 56) & STATE MACHINE
  // =========================================================================
  describe('2. Approver Resolution & State Machine Verification', () => {
    describe('Section 56 Ownership Matrix', () => {
      it('Seminar Hall (Institute-owned) -> Routes to Institute Admin', async () => {
        const resource = {
          resourceId: 'SH-01',
          resourceName: 'Main Seminar Hall',
          resourceType: { typeName: 'Seminar Hall' },
          departmentId: 1, // Even if departmentId is set, typeName takes precedence
        };

        const mockInstAdmin = { userId: 2, roleId: ROLES.INSTITUTE_ADMIN, status: 'Active' };
        prisma.user.findFirst = async ({ where }) => {
          if (where.roleId === ROLES.INSTITUTE_ADMIN && where.status === 'Active') {
            return mockInstAdmin;
          }
          return null;
        };

        const approver = await resourcesService.resolveApprover(resource);
        assert.equal(approver.userId, 2);
        assert.equal(approver.roleId, ROLES.INSTITUTE_ADMIN);
      });

      it('Auditorium (Institute-owned) -> Routes to Institute Admin', async () => {
        const resource = {
          resourceId: 'AUD-01',
          resourceName: 'K.S. Auditorium',
          resourceType: { typeName: 'Auditorium' },
          departmentId: null,
        };

        const mockInstAdmin = { userId: 2, roleId: ROLES.INSTITUTE_ADMIN, status: 'Active' };
        prisma.user.findFirst = async ({ where }) => {
          if (where.roleId === ROLES.INSTITUTE_ADMIN && where.status === 'Active') {
            return mockInstAdmin;
          }
          return null;
        };

        const approver = await resourcesService.resolveApprover(resource);
        assert.equal(approver.userId, 2);
        assert.equal(approver.roleId, ROLES.INSTITUTE_ADMIN);
      });

      it('Department-owned Lab/Classroom -> Routes to Department Admin of that department', async () => {
        const resource = {
          resourceId: 'ECE-LAB-201',
          resourceName: 'DSP Lab',
          resourceType: { typeName: 'Lab' },
          departmentId: 2, // ECE
        };

        const mockEceAdmin = { userId: 12, roleId: ROLES.DEPARTMENT_ADMIN, departmentId: 2, status: 'Active' };
        prisma.user.findFirst = async ({ where }) => {
          if (where.roleId === ROLES.DEPARTMENT_ADMIN && where.departmentId === 2 && where.status === 'Active') {
            return mockEceAdmin;
          }
          return null;
        };

        const approver = await resourcesService.resolveApprover(resource);
        assert.equal(approver.userId, 12);
        assert.equal(approver.departmentId, 2);
        assert.equal(approver.roleId, ROLES.DEPARTMENT_ADMIN);
      });

      it('Unassigned Resource (departmentId: null, non-institute) -> Falls back to Super Admin', async () => {
        const resource = {
          resourceId: 'GEN-CR-01',
          resourceName: 'General Purpose Classroom',
          resourceType: { typeName: 'Classroom' },
          departmentId: null,
        };

        const mockSuperAdmin = { userId: 1, roleId: ROLES.SUPER_ADMIN, status: 'Active' };
        prisma.user.findFirst = async ({ where }) => {
          if (where.roleId === ROLES.SUPER_ADMIN && where.status === 'Active') {
            return mockSuperAdmin;
          }
          return null;
        };

        const approver = await resourcesService.resolveApprover(resource);
        assert.equal(approver.userId, 1);
        assert.equal(approver.roleId, ROLES.SUPER_ADMIN);
      });

      it('Missing department admin for department -> Falls back to Super Admin', async () => {
        const resource = {
          resourceId: 'CIVIL-LAB-01',
          resourceName: 'Surveying Lab',
          resourceType: { typeName: 'Lab' },
          departmentId: 5, // Civil - no admin seeded
        };

        const mockSuperAdmin = { userId: 1, roleId: ROLES.SUPER_ADMIN, status: 'Active' };
        prisma.user.findFirst = async ({ where }) => {
          if (where.roleId === ROLES.DEPARTMENT_ADMIN && where.departmentId === 5) {
            return null; // Not found
          }
          if (where.roleId === ROLES.SUPER_ADMIN && where.status === 'Active') {
            return mockSuperAdmin;
          }
          return null;
        };

        const approver = await resourcesService.resolveApprover(resource);
        assert.equal(approver.userId, 1);
        assert.equal(approver.roleId, ROLES.SUPER_ADMIN);
      });
    });

    describe('Decision Authorization & State Machine', () => {
      let mockApproval, mockTx;

      beforeEach(() => {
        mockApproval = {
          approvalId: 25,
          bookingId: 500,
          approverUserId: 3,
          approverRoleId: ROLES.DEPARTMENT_ADMIN,
          decision: null,
          decisionAt: null,
          remarks: null,
          booking: {
            bookingId: 500,
            requesterUserId: 8,
            status: 'Pending',
            resource: {
              resourceId: 'CSE-LAB-101',
              departmentId: 1,
            },
          },
        };

        mockTx = {};
        prisma.$transaction = async (fn) => fn(mockTx);
        auditService.log = async () => {};
      });

      it('Requester (Role 4) CANNOT decide an approval (403 Forbidden)', async () => {
        approvalsRepo.findById = async () => mockApproval;

        const requesterAuth = { userId: 8, roleId: ROLES.REQUESTER, departmentId: 1 };

        await assert.rejects(
          async () => {
            await approvalsService.decide(25, 'Approved', 'Self approve attempt', requesterAuth);
          },
          (err) => err.statusCode === 403 && /not the approver/.test(err.message)
        );
      });

      it('Cross-department Dept Admin CANNOT decide another department approval (403 Forbidden)', async () => {
        mockApproval.approverUserId = null;
        mockApproval.booking.resource.departmentId = 1; // CSE resource
        approvalsRepo.findById = async () => mockApproval;

        // ECE Dept Admin attempting decision on CSE approval
        const eceDeptAdminAuth = { userId: 12, roleId: ROLES.DEPARTMENT_ADMIN, departmentId: 2 };

        await assert.rejects(
          async () => {
            await approvalsService.decide(25, 'Approved', 'Cross dept hack', eceDeptAdminAuth);
          },
          (err) => err.statusCode === 403 && /not the approver/.test(err.message)
        );
      });

      it('Throws 409 Conflict if approval was already decided as Approved', async () => {
        mockApproval.decision = 'Approved';
        approvalsRepo.findById = async () => mockApproval;

        const cseDeptAdminAuth = { userId: 3, roleId: ROLES.DEPARTMENT_ADMIN, departmentId: 1 };

        await assert.rejects(
          async () => {
            await approvalsService.decide(25, 'Approved', 'Duplicate approve', cseDeptAdminAuth);
          },
          (err) => err.statusCode === 409 && /already Approved/.test(err.message)
        );
      });

      it('Throws 409 Conflict if approval was already decided as Rejected', async () => {
        mockApproval.decision = 'Rejected';
        approvalsRepo.findById = async () => mockApproval;

        const cseDeptAdminAuth = { userId: 3, roleId: ROLES.DEPARTMENT_ADMIN, departmentId: 1 };

        await assert.rejects(
          async () => {
            await approvalsService.decide(25, 'Rejected', 'Duplicate reject', cseDeptAdminAuth);
          },
          (err) => err.statusCode === 409 && /already Rejected/.test(err.message)
        );
      });
    });

    describe('Cancellation Security & State Validation', () => {
      it('allows requester to cancel Pending booking', async () => {
        const mockBooking = {
          bookingId: 601,
          requesterUserId: 15,
          status: 'Pending',
        };
        bookingsRepo.findById = async () => mockBooking;
        bookingsRepo.updateStatus = async (tx, id, status) => ({ ...mockBooking, status });

        const result = await bookingsService.cancel(601, 15);
        assert.equal(result.status, 'Cancelled');
      });

      it('allows requester to cancel Approved booking', async () => {
        const mockBooking = {
          bookingId: 602,
          requesterUserId: 15,
          status: 'Approved',
        };
        bookingsRepo.findById = async () => mockBooking;
        bookingsRepo.updateStatus = async (tx, id, status) => ({ ...mockBooking, status });

        const result = await bookingsService.cancel(602, 15);
        assert.equal(result.status, 'Cancelled');
      });

      it('rejects cancellation by unauthorized user (403 Forbidden)', async () => {
        const mockBooking = {
          bookingId: 603,
          requesterUserId: 15,
          status: 'Pending',
        };
        bookingsRepo.findById = async () => mockBooking;

        await assert.rejects(
          async () => {
            await bookingsService.cancel(603, 999); // 999 !== 15
          },
          (err) => err.statusCode === 403 && /Only the person who made this booking/.test(err.message)
        );
      });

      it('rejects cancellation on already Cancelled booking (409 Conflict)', async () => {
        const mockBooking = {
          bookingId: 604,
          requesterUserId: 15,
          status: 'Cancelled',
        };
        bookingsRepo.findById = async () => mockBooking;

        await assert.rejects(
          async () => {
            await bookingsService.cancel(604, 15);
          },
          (err) => err.statusCode === 409 && /already Cancelled/.test(err.message)
        );
      });

      it('rejects cancellation on already Rejected booking (409 Conflict)', async () => {
        const mockBooking = {
          bookingId: 605,
          requesterUserId: 15,
          status: 'Rejected',
        };
        bookingsRepo.findById = async () => mockBooking;

        await assert.rejects(
          async () => {
            await bookingsService.cancel(605, 15);
          },
          (err) => err.statusCode === 409 && /already Rejected/.test(err.message)
        );
      });
    });
  });

  // =========================================================================
  // 3. AUTH & TOKEN SECURITY
  // =========================================================================
  describe('3. Auth, JWT & Role Security Verification', () => {
    describe('JWT Signature, Expiration & Secret Tampering', () => {
      it('rejects token signed with forged/wrong secret', () => {
        const forgedToken = jwt.sign(
          { sub: 1, roleId: ROLES.SUPER_ADMIN, departmentId: null },
          'forged_attacker_secret_key_12345'
        );

        assert.throws(
          () => {
            verifyAccessToken(forgedToken);
          },
          (err) => err.name === 'JsonWebTokenError' && err.message === 'invalid signature'
        );
      });

      it('rejects expired JWT token', () => {
        const expiredToken = jwt.sign(
          { sub: 1, roleId: ROLES.SUPER_ADMIN, departmentId: null },
          env.jwt.accessSecret,
          { expiresIn: -10 } // Expired 10 seconds ago
        );

        assert.throws(
          () => {
            verifyAccessToken(expiredToken);
          },
          (err) => err.name === 'TokenExpiredError' && err.message === 'jwt expired'
        );
      });

      it('rejects token with algorithm none (alg: none attack)', () => {
        // Construct header and payload base64 with alg: 'none'
        const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({ sub: 1, roleId: 1 })).toString('base64url');
        const unsignedToken = `${header}.${payload}.`;

        assert.throws(() => {
          verifyAccessToken(unsignedToken);
        });
      });
    });

    describe('Authenticate Middleware Security Scenarios', () => {
      it('rejects request with missing Authorization header (401)', () => {
        const req = { headers: {} };
        let errResult = null;
        authenticate(req, {}, (err) => {
          errResult = err;
        });

        assert.ok(errResult);
        assert.equal(errResult.statusCode, 401);
        assert.match(errResult.message, /Missing or malformed/i);
      });

      it('rejects request with empty Authorization header (401)', () => {
        const req = { headers: { authorization: '' } };
        let errResult = null;
        authenticate(req, {}, (err) => {
          errResult = err;
        });

        assert.ok(errResult);
        assert.equal(errResult.statusCode, 401);
      });

      it('rejects request with non-Bearer scheme (e.g. Basic) (401)', () => {
        const req = { headers: { authorization: 'Basic dXNlcjpwYXNz' } };
        let errResult = null;
        authenticate(req, {}, (err) => {
          errResult = err;
        });

        assert.ok(errResult);
        assert.equal(errResult.statusCode, 401);
      });

      it('rejects request with "Bearer" but no token string (401)', () => {
        const req = { headers: { authorization: 'Bearer ' } };
        let errResult = null;
        authenticate(req, {}, (err) => {
          errResult = err;
        });

        assert.ok(errResult);
        assert.equal(errResult.statusCode, 401);
      });

      it('rejects request with expired token through middleware (401)', () => {
        const expiredToken = jwt.sign(
          { sub: 5, roleId: ROLES.REQUESTER, departmentId: 1 },
          env.jwt.accessSecret,
          { expiresIn: -5 }
        );
        const req = { headers: { authorization: `Bearer ${expiredToken}` } };
        let errResult = null;
        authenticate(req, {}, (err) => {
          errResult = err;
        });

        assert.ok(errResult);
        assert.equal(errResult.statusCode, 401);
        assert.match(errResult.message, /Invalid or expired token/i);
      });

      it('populates req.auth correctly with valid token', () => {
        const token = signAccessToken({ userId: 42, roleId: ROLES.DEPARTMENT_ADMIN, departmentId: 1 });
        const req = { headers: { authorization: `Bearer ${token}` } };
        let calledNext = false;
        authenticate(req, {}, (err) => {
          if (!err) calledNext = true;
        });

        assert.equal(calledNext, true);
        assert.deepEqual(req.auth, {
          userId: 42,
          roleId: ROLES.DEPARTMENT_ADMIN,
          departmentId: 1,
        });
      });
    });

    describe('AuthorizeRole Middleware Hierarchy & Department Scoping', () => {
      it('rejects unauthenticated request (missing req.auth) (401)', () => {
        const middleware = authorizeRole(ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN);
        const req = {};
        let errResult = null;
        middleware(req, {}, (err) => {
          errResult = err;
        });

        assert.ok(errResult);
        assert.equal(errResult.statusCode, 401);
      });

      it('allows Super Admin on Super Admin only route', () => {
        const middleware = authorizeRole(ROLES.SUPER_ADMIN);
        const req = { auth: { userId: 1, roleId: ROLES.SUPER_ADMIN } };
        let passed = false;
        middleware(req, {}, (err) => {
          assert.equal(err, undefined);
          passed = true;
        });
        assert.equal(passed, true);
      });

      it('rejects Dept Admin on Super Admin only route (403)', () => {
        const middleware = authorizeRole(ROLES.SUPER_ADMIN);
        const req = { auth: { userId: 3, roleId: ROLES.DEPARTMENT_ADMIN } };
        let errResult = null;
        middleware(req, {}, (err) => {
          errResult = err;
        });

        assert.ok(errResult);
        assert.equal(errResult.statusCode, 403);
      });

      it('rejects Requester on Admin routes (403)', () => {
        const middleware = authorizeRole(ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN, ROLES.DEPARTMENT_ADMIN);
        const req = { auth: { userId: 10, roleId: ROLES.REQUESTER } };
        let errResult = null;
        middleware(req, {}, (err) => {
          errResult = err;
        });

        assert.ok(errResult);
        assert.equal(errResult.statusCode, 403);
      });

      it('allows Dept Admin and Institute Admin on general admin route', () => {
        const middleware = authorizeRole(ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN, ROLES.DEPARTMENT_ADMIN);
        
        let deptAdminPassed = false;
        middleware({ auth: { userId: 3, roleId: ROLES.DEPARTMENT_ADMIN } }, {}, (err) => {
          if (!err) deptAdminPassed = true;
        });
        assert.equal(deptAdminPassed, true);

        let instAdminPassed = false;
        middleware({ auth: { userId: 2, roleId: ROLES.INSTITUTE_ADMIN } }, {}, (err) => {
          if (!err) instAdminPassed = true;
        });
        assert.equal(instAdminPassed, true);
      });
    });
  });
});
