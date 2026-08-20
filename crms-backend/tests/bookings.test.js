const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const bookingsService = require('../src/modules/bookings/bookings.service');
const bookingsRepo = require('../src/modules/bookings/bookings.repository');
const resourcesService = require('../src/modules/resources/resources.service');
const auditService = require('../src/modules/audit/audit.service');
const prisma = require('../src/config/prisma');

describe('Booking Engine & Conflict Resolution Tests', () => {
  let mockTx;

  beforeEach(() => {
    mockTx = {
      resource: { findUnique: null },
      approval: { create: null },
    };
    prisma.$transaction = async (fn, options) => {
      // Confirm Serializable isolation level requested
      assert.equal(options?.isolationLevel, 'Serializable');
      return fn(mockTx);
    };
  });

  describe('createBooking Validations & Conflict Prevention', () => {
    it('throws 404 if resource does not exist', async () => {
      mockTx.resource.findUnique = async () => null;

      await assert.rejects(
        async () => {
          await bookingsService.createBooking(
            {
              resourceId: 'NON-EXISTENT',
              bookingDate: '2026-08-17',
              startTime: '10:00',
              endTime: '11:00',
              purpose: 'Project presentation',
            },
            10
          );
        },
        (err) => err.statusCode === 404 && /Resource NON-EXISTENT not found/.test(err.message)
      );
    });

    it('throws 409 if resource is not Active (e.g. Maintenance)', async () => {
      mockTx.resource.findUnique = async () => ({
        resourceId: 'CSE-CR-201',
        status: 'Maintenance',
        resourceType: { typeName: 'Classroom' },
      });

      await assert.rejects(
        async () => {
          await bookingsService.createBooking(
            {
              resourceId: 'CSE-CR-201',
              bookingDate: '2026-08-17',
              startTime: '10:00',
              endTime: '11:00',
              purpose: 'Team meeting',
            },
            10
          );
        },
        (err) => err.statusCode === 409 && /not currently bookable/.test(err.message)
      );
    });

    it('throws 409 Conflict if request overlaps a scheduled timetable class', async () => {
      mockTx.resource.findUnique = async () => ({
        resourceId: 'CSE-CR-201',
        status: 'Active',
        resourceType: { typeName: 'Classroom' },
        departmentId: 1,
      });

      // 2026-08-17 is Monday
      bookingsRepo.findTimetableConflicts = async () => [
        {
          timetableId: 1,
          courseCode: 'CS301',
          section: 'A',
          startTime: new Date('1970-01-01T09:00:00Z'),
          endTime: new Date('1970-01-01T10:30:00Z'),
        },
      ];

      await assert.rejects(
        async () => {
          await bookingsService.createBooking(
            {
              resourceId: 'CSE-CR-201',
              bookingDate: '2026-08-17',
              startTime: '10:00',
              endTime: '11:00',
              purpose: 'Workshop slot test',
            },
            10
          );
        },
        (err) => {
          assert.equal(err.statusCode, 409);
          assert.match(err.message, /overlaps a scheduled class/i);
          assert.equal(err.details.conflicts.length, 1);
          assert.equal(err.details.conflicts[0].courseCode, 'CS301');
          return true;
        }
      );
    });

    it('throws 409 Conflict if request overlaps an existing Pending/Approved booking', async () => {
      mockTx.resource.findUnique = async () => ({
        resourceId: 'KS-AUDITORIUM',
        status: 'Active',
        resourceType: { typeName: 'Auditorium' },
        departmentId: null,
      });

      bookingsRepo.findTimetableConflicts = async () => [];
      bookingsRepo.findOverlappingBookings = async () => [
        {
          bookingId: 88,
          resourceId: 'KS-AUDITORIUM',
          startTime: new Date('1970-01-01T14:00:00Z'),
          endTime: new Date('1970-01-01T16:00:00Z'),
          status: 'Approved',
        },
      ];

      await assert.rejects(
        async () => {
          await bookingsService.createBooking(
            {
              resourceId: 'KS-AUDITORIUM',
              bookingDate: '2026-08-20',
              startTime: '15:00',
              endTime: '17:00',
              purpose: 'Cultural Event',
            },
            12
          );
        },
        (err) => {
          assert.equal(err.statusCode, 409);
          assert.match(err.message, /overlaps an existing booking/i);
          assert.equal(err.details.conflicts[0].bookingId, 88);
          return true;
        }
      );
    });

    it('successfully creates booking, resolves approver, and generates approval request', async () => {
      const mockResource = {
        resourceId: 'CSE-LAB-101',
        resourceName: 'CSE Advanced Computing Lab 1',
        status: 'Active',
        departmentId: 1,
        resourceType: { typeName: 'Lab' },
      };
      mockTx.resource.findUnique = async () => mockResource;

      bookingsRepo.findTimetableConflicts = async () => [];
      bookingsRepo.findOverlappingBookings = async () => [];

      const createdBooking = {
        bookingId: 200,
        resourceId: 'CSE-LAB-101',
        requesterUserId: 4,
        bookingDate: new Date('2026-08-18'),
        startTime: new Date('1970-01-01T10:00:00Z'),
        endTime: new Date('1970-01-01T12:00:00Z'),
        purpose: 'Coding Hackathon Round 1',
        status: 'Pending',
      };

      bookingsRepo.create = async (tx, data) => createdBooking;

      const mockApprover = {
        userId: 3,
        name: 'CSE Dept Admin',
        roleId: 3,
        departmentId: 1,
      };
      resourcesService.resolveApprover = async () => mockApprover;

      let createdApprovalData = null;
      mockTx.approval.create = async ({ data }) => {
        createdApprovalData = data;
        return { approvalId: 50, ...data };
      };

      let loggedAudit = null;
      auditService.log = async (data) => {
        loggedAudit = data;
      };

      const result = await bookingsService.createBooking(
        {
          resourceId: 'CSE-LAB-101',
          bookingDate: '2026-08-18',
          startTime: '10:00',
          endTime: '12:00',
          purpose: 'Coding Hackathon Round 1',
        },
        4
      );

      assert.equal(result.bookingId, 200);
      assert.equal(result.status, 'Pending');
      assert.equal(result.approverUserId, 3);

      assert.ok(createdApprovalData);
      assert.equal(createdApprovalData.bookingId, 200);
      assert.equal(createdApprovalData.approverUserId, 3);
      assert.equal(createdApprovalData.approverRoleId, 3);

      assert.ok(loggedAudit);
      assert.equal(loggedAudit.userId, 4);
      assert.equal(loggedAudit.action, 'CREATE_BOOKING');
      assert.equal(loggedAudit.entityId, 200);
    });
  });

  describe('cancelBooking Logic', () => {
    it('allows requester to cancel Pending booking', async () => {
      const mockBooking = {
        bookingId: 300,
        requesterUserId: 4,
        status: 'Pending',
      };

      bookingsRepo.findById = async () => mockBooking;
      bookingsRepo.updateStatus = async (tx, id, status) => ({
        ...mockBooking,
        status,
      });

      let loggedAudit = null;
      auditService.log = async (audit) => {
        loggedAudit = audit;
      };

      const cancelled = await bookingsService.cancel(300, 4);
      assert.equal(cancelled.status, 'Cancelled');
      assert.equal(loggedAudit.action, 'CANCEL_BOOKING');
      assert.equal(loggedAudit.entityId, 300);
    });

    it('rejects cancellation from user who did not create the booking (403 Forbidden)', async () => {
      const mockBooking = {
        bookingId: 300,
        requesterUserId: 4,
        status: 'Pending',
      };

      bookingsRepo.findById = async () => mockBooking;

      await assert.rejects(
        async () => {
          await bookingsService.cancel(300, 99); // Acting user 99 != requester 4
        },
        (err) => err.statusCode === 403 && /Only the person who made this booking/.test(err.message)
      );
    });

    it('allows Super Admin to cancel any booking administratively', async () => {
      const mockBooking = {
        bookingId: 301,
        requesterUserId: 4,
        status: 'Pending',
      };

      bookingsRepo.findById = async () => mockBooking;
      bookingsRepo.updateStatus = async (tx, id, status) => ({
        ...mockBooking,
        status,
      });

      let loggedAudit = null;
      auditService.log = async (audit) => {
        loggedAudit = audit;
      };

      const superAdminAuth = { userId: 1, roleId: 1 };
      const cancelled = await bookingsService.cancel(301, 1, superAdminAuth);
      assert.equal(cancelled.status, 'Cancelled');
      assert.equal(loggedAudit.action, 'CANCEL_BOOKING');
      assert.equal(loggedAudit.userId, 1);
    });

    it('allows Institute Admin to cancel any booking administratively', async () => {
      const mockBooking = {
        bookingId: 302,
        requesterUserId: 4,
        status: 'Approved',
      };

      bookingsRepo.findById = async () => mockBooking;
      bookingsRepo.updateStatus = async (tx, id, status) => ({
        ...mockBooking,
        status,
      });

      let loggedAudit = null;
      auditService.log = async (audit) => {
        loggedAudit = audit;
      };

      const instAdminAuth = { userId: 2, roleId: 2 };
      const cancelled = await bookingsService.cancel(302, 2, instAdminAuth);
      assert.equal(cancelled.status, 'Cancelled');
      assert.equal(loggedAudit.action, 'CANCEL_BOOKING');
      assert.equal(loggedAudit.userId, 2);
    });

    it('rejects cancellation from Department Admin who is not owner (403 Forbidden)', async () => {
      const mockBooking = {
        bookingId: 303,
        requesterUserId: 4,
        status: 'Pending',
      };

      bookingsRepo.findById = async () => mockBooking;

      const deptAdminAuth = { userId: 3, roleId: 3, departmentId: 1 };
      await assert.rejects(
        async () => {
          await bookingsService.cancel(303, 3, deptAdminAuth);
        },
        (err) => err.statusCode === 403 && /Only the person who made this booking/.test(err.message)
      );
    });

    it('rejects cancellation if booking is already Cancelled or Rejected (409 Conflict)', async () => {
      const mockBooking = {
        bookingId: 300,
        requesterUserId: 4,
        status: 'Cancelled',
      };

      bookingsRepo.findById = async () => mockBooking;

      await assert.rejects(
        async () => {
          await bookingsService.cancel(300, 4);
        },
        (err) => err.statusCode === 409 && /already Cancelled, cannot cancel/.test(err.message)
      );
    });
  });

  describe('dayOfWeek utility', () => {
    it('accurately parses day of week for any date string without timezone drift', () => {
      assert.equal(bookingsService.dayOfWeekFor('2026-08-16'), 'Sunday');
      assert.equal(bookingsService.dayOfWeekFor('2026-08-17'), 'Monday');
      assert.equal(bookingsService.dayOfWeekFor('2026-08-18'), 'Tuesday');
      assert.equal(bookingsService.dayOfWeekFor('2026-08-19'), 'Wednesday');
      assert.equal(bookingsService.dayOfWeekFor('2026-08-20'), 'Thursday');
      assert.equal(bookingsService.dayOfWeekFor('2026-08-21'), 'Friday');
      assert.equal(bookingsService.dayOfWeekFor('2026-08-22'), 'Saturday');
    });
  });

  describe('createBooking auto-approval status', () => {
    it('returns status: Approved when requester is resource owner (auto-approved)', async () => {
      const mockResource = {
        resourceId: 'CSE-LAB-101',
        resourceName: 'CSE Lab',
        status: 'Active',
        departmentId: 1,
        resourceType: { typeName: 'Lab' },
      };
      mockTx.resource.findUnique = async () => mockResource;
      mockTx.booking = {
        update: async () => ({ bookingId: 205, status: 'Approved' }),
      };
      mockTx.approval = {
        create: async () => ({ approvalId: 60 }),
      };

      bookingsRepo.findTimetableConflicts = async () => [];
      bookingsRepo.findOverlappingBookings = async () => [];

      const createdBooking = {
        bookingId: 205,
        resourceId: 'CSE-LAB-101',
        requesterUserId: 3, // requester is HOD (dept admin)
        bookingDate: new Date('2026-08-18'),
        startTime: new Date('1970-01-01T10:00:00Z'),
        endTime: new Date('1970-01-01T12:00:00Z'),
        purpose: 'HOD Session',
        status: 'Pending',
      };

      bookingsRepo.create = async () => createdBooking;
      resourcesService.resolveApprover = async () => ({
        userId: 3, // matching approver
        roleId: 3,
        departmentId: 1,
      });

      const result = await bookingsService.createBooking(
        {
          resourceId: 'CSE-LAB-101',
          bookingDate: '2026-08-18',
          startTime: '10:00',
          endTime: '12:00',
          purpose: 'HOD Session',
        },
        3
      );

      assert.equal(result.status, 'Approved');
      assert.equal(result.bookingId, 205);
    });
  });

  describe('getById IDOR Authorization', () => {
    const mockBooking = {
      bookingId: 501,
      requesterUserId: 10,
      resource: {
        resourceId: 'CSE-LAB-101',
        departmentId: 1,
      },
    };

    it('allows booking requester to view their own booking', async () => {
      bookingsRepo.findById = async () => mockBooking;
      const res = await bookingsService.getById(501, { userId: 10, roleId: 4, departmentId: 1 });
      assert.equal(res.bookingId, 501);
    });

    it('allows Super Admin to view any booking', async () => {
      bookingsRepo.findById = async () => mockBooking;
      const res = await bookingsService.getById(501, { userId: 1, roleId: 1, departmentId: null });
      assert.equal(res.bookingId, 501);
    });

    it('allows Institute Admin to view any booking', async () => {
      bookingsRepo.findById = async () => mockBooking;
      const res = await bookingsService.getById(501, { userId: 2, roleId: 2, departmentId: null });
      assert.equal(res.bookingId, 501);
    });

    it('allows matching Department Admin to view booking for their department', async () => {
      bookingsRepo.findById = async () => mockBooking;
      const res = await bookingsService.getById(501, { userId: 3, roleId: 3, departmentId: 1 });
      assert.equal(res.bookingId, 501);
    });

    it('throws 403 Forbidden if non-owner requester attempts to view booking', async () => {
      bookingsRepo.findById = async () => mockBooking;
      await assert.rejects(
        async () => {
          await bookingsService.getById(501, { userId: 99, roleId: 4, departmentId: 1 });
        },
        (err) => err.statusCode === 403 && /not authorized to view/.test(err.message)
      );
    });

    it('throws 403 Forbidden if Department Admin attempts to view booking of another department', async () => {
      bookingsRepo.findById = async () => mockBooking;
      await assert.rejects(
        async () => {
          await bookingsService.getById(501, { userId: 4, roleId: 3, departmentId: 2 }); // ECE admin
        },
        (err) => err.statusCode === 403 && /not authorized to view/.test(err.message)
      );
    });
  });
});
