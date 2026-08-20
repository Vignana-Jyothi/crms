const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const approvalsService = require('../src/modules/approvals/approvals.service');
const approvalsRepo = require('../src/modules/approvals/approvals.repository');
const resourcesService = require('../src/modules/resources/resources.service');
const bookingsRepo = require('../src/modules/bookings/bookings.repository');
const auditService = require('../src/modules/audit/audit.service');
const prisma = require('../src/config/prisma');
const { ROLES } = require('../src/middleware/authorizeRole');

describe('Approval Engine & State Machine Tests', () => {
  describe('Approver Resolution Policy (Section 56)', () => {
    it('routes Institute-owned types (Seminar Hall, Auditorium) to Institute Admin', async () => {
      const instituteResource = {
        resourceId: 'KS-AUDITORIUM',
        resourceName: 'K.S. Auditorium',
        resourceType: { typeName: 'Auditorium' },
        departmentId: null,
      };

      const mockInstituteAdmin = {
        userId: 2,
        name: 'Dean Admin',
        roleId: ROLES.INSTITUTE_ADMIN,
        status: 'Active',
      };

      prisma.user.findFirst = async ({ where }) => {
        if (where.roleId === ROLES.INSTITUTE_ADMIN && where.status === 'Active') {
          return mockInstituteAdmin;
        }
        return null;
      };

      const approver = await resourcesService.resolveApprover(instituteResource);
      assert.ok(approver);
      assert.equal(approver.userId, 2);
      assert.equal(approver.roleId, ROLES.INSTITUTE_ADMIN);
    });

    it('routes Department-owned resource (Lab, Classroom) to Department Admin of that department', async () => {
      const deptResource = {
        resourceId: 'CSE-LAB-101',
        resourceName: 'CSE Advanced Computing Lab',
        resourceType: { typeName: 'Lab' },
        departmentId: 1, // CSE
      };

      const mockCseDeptAdmin = {
        userId: 3,
        name: 'CSE HOD',
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

      const approver = await resourcesService.resolveApprover(deptResource);
      assert.ok(approver);
      assert.equal(approver.userId, 3);
      assert.equal(approver.departmentId, 1);
      assert.equal(approver.roleId, ROLES.DEPARTMENT_ADMIN);
    });

    it('falls back to Super Admin when no matching department admin is configured', async () => {
      const orphanResource = {
        resourceId: 'MECH-LAB-01',
        resourceName: 'Robotics Lab',
        resourceType: { typeName: 'Lab' },
        departmentId: 4, // MECH - currently no Dept Admin configured
      };

      const mockSuperAdmin = {
        userId: 1,
        name: 'Super Admin',
        roleId: ROLES.SUPER_ADMIN,
        status: 'Active',
      };

      prisma.user.findFirst = async ({ where }) => {
        if (where.roleId === ROLES.SUPER_ADMIN && where.status === 'Active') {
          return mockSuperAdmin;
        }
        return null;
      };

      const approver = await resourcesService.resolveApprover(orphanResource);
      assert.ok(approver);
      assert.equal(approver.userId, 1);
      assert.equal(approver.roleId, ROLES.SUPER_ADMIN);
    });
  });

  describe('Approval Decision State Machine & Audit', () => {
    let mockApproval, mockTx;

    beforeEach(() => {
      mockApproval = {
        approvalId: 15,
        bookingId: 400,
        approverUserId: 3,
        approverRoleId: ROLES.DEPARTMENT_ADMIN,
        decision: null,
        decisionAt: null,
        remarks: null,
        booking: {
          bookingId: 400,
          status: 'Pending',
          resource: {
            resourceId: 'CSE-LAB-101',
            departmentId: 1,
          },
        },
      };

      mockTx = {};
      prisma.$transaction = async (fn) => fn(mockTx);
    });

    it('approves request and updates booking status to Approved with remarks and audit log', async () => {
      approvalsRepo.findById = async () => mockApproval;

      let recordedDecision = null;
      approvalsRepo.recordDecision = async (tx, id, data) => {
        recordedDecision = data;
        return { ...mockApproval, ...data, decisionAt: new Date() };
      };

      let updatedBookingStatus = null;
      bookingsRepo.updateStatus = async (tx, bookingId, status) => {
        updatedBookingStatus = status;
        return { bookingId, status };
      };

      let loggedAudit = null;
      auditService.log = async (audit) => {
        loggedAudit = audit;
      };

      const actingAuth = { userId: 3, roleId: ROLES.DEPARTMENT_ADMIN, departmentId: 1 };
      const result = await approvalsService.decide(15, 'Approved', 'Lab verified available', actingAuth);

      assert.equal(result.decision, 'Approved');
      assert.equal(recordedDecision.decision, 'Approved');
      assert.equal(recordedDecision.remarks, 'Lab verified available');
      assert.equal(updatedBookingStatus, 'Approved');

      assert.ok(loggedAudit);
      assert.equal(loggedAudit.userId, 3);
      assert.equal(loggedAudit.action, 'APPROVED_BOOKING');
      assert.equal(loggedAudit.entityId, 400);
      assert.equal(loggedAudit.details, 'Lab verified available');
    });

    it('rejects request and updates booking status to Rejected with remarks and audit log', async () => {
      approvalsRepo.findById = async () => mockApproval;

      approvalsRepo.recordDecision = async (tx, id, data) => ({
        ...mockApproval,
        ...data,
        decisionAt: new Date(),
      });

      let updatedBookingStatus = null;
      bookingsRepo.updateStatus = async (tx, bookingId, status) => {
        updatedBookingStatus = status;
        return { bookingId, status };
      };

      let loggedAudit = null;
      auditService.log = async (audit) => {
        loggedAudit = audit;
      };

      const actingAuth = { userId: 3, roleId: ROLES.DEPARTMENT_ADMIN, departmentId: 1 };
      const result = await approvalsService.decide(15, 'Rejected', 'Maintenance scheduled during slot', actingAuth);

      assert.equal(result.decision, 'Rejected');
      assert.equal(updatedBookingStatus, 'Rejected');
      assert.equal(loggedAudit.action, 'REJECTED_BOOKING');
      assert.equal(loggedAudit.details, 'Maintenance scheduled during slot');
    });

    it('throws 400 Bad Request if rejecting without remarks', async () => {
      mockApproval.decision = null;
      approvalsRepo.findById = async () => mockApproval;

      const actingAuth = { userId: 3, roleId: ROLES.DEPARTMENT_ADMIN, departmentId: 1 };

      await assert.rejects(
        async () => {
          await approvalsService.decide(15, 'Rejected', '', actingAuth);
        },
        (err) => err.statusCode === 400 && /Remarks are required/.test(err.message)
      );

      await assert.rejects(
        async () => {
          await approvalsService.decide(15, 'Rejected', '   ', actingAuth);
        },
        (err) => err.statusCode === 400 && /Remarks are required/.test(err.message)
      );
    });

    it('throws 409 Conflict if approval was already decided', async () => {
      mockApproval.decision = 'Approved';
      approvalsRepo.findById = async () => mockApproval;

      const actingAuth = { userId: 3, roleId: ROLES.DEPARTMENT_ADMIN, departmentId: 1 };

      await assert.rejects(
        async () => {
          await approvalsService.decide(15, 'Approved', 'Duplicate approve', actingAuth);
        },
        (err) => err.statusCode === 409 && /already Approved/.test(err.message)
      );
    });

    it('throws 403 Forbidden if Department Admin tries to approve a booking for another department', async () => {
      mockApproval.booking.resource.departmentId = 2; // ECE resource
      mockApproval.approverUserId = null;
      mockApproval.approverRoleId = ROLES.DEPARTMENT_ADMIN;
      approvalsRepo.findById = async () => mockApproval;

      // Acting user is CSE Dept Admin (departmentId: 1)
      const cseDeptAdminAuth = { userId: 3, roleId: ROLES.DEPARTMENT_ADMIN, departmentId: 1 };

      await assert.rejects(
        async () => {
          await approvalsService.decide(15, 'Approved', 'Cross-department attempt', cseDeptAdminAuth);
        },
        (err) => err.statusCode === 403 && /not the approver/.test(err.message)
      );
    });

    it('DOES NOT allow Super Admin to approve requests', async () => {
      mockApproval.booking.resource.departmentId = 1;
      approvalsRepo.findById = async () => mockApproval;

      const superAdminAuth = { userId: 1, roleId: ROLES.SUPER_ADMIN, departmentId: null };
      
      await assert.rejects(
        async () => {
          await approvalsService.decide(10, 'Approved', 'Override', superAdminAuth);
        },
        (err) => err.statusCode === 403 && /You are not the approver/.test(err.message)
      );
    });

    it('throws 403 Forbidden if a Requester (role 4) tries to decide an approval', async () => {
      mockApproval.approverUserId = null;
      approvalsRepo.findById = async () => mockApproval;

      const requesterAuth = { userId: 7, roleId: ROLES.REQUESTER, departmentId: 1 };

      await assert.rejects(
        async () => {
          await approvalsService.decide(15, 'Approved', 'Unauthorized', requesterAuth);
        },
        (err) => err.statusCode === 403 && /not the approver/.test(err.message)
      );
    });
  });

  describe('Pending Approvals Listing & Super Admin Visibility', () => {
    it('returns all pending approvals across departments when roleId is Super Admin (role 1)', async () => {
      let queryWhere = null;
      prisma.approval.findMany = async (args) => {
        queryWhere = args.where;
        return [
          { approvalId: 1, decision: null, booking: { resource: { departmentId: 1 } } },
          { approvalId: 2, decision: null, booking: { resource: { departmentId: 2 } } },
          { approvalId: 3, decision: null, booking: { resource: { departmentId: null } } },
        ];
      };

      const result = await approvalsRepo.listPendingFor({
        approverUserId: 1,
        roleId: ROLES.SUPER_ADMIN,
        departmentId: null,
      });

      assert.deepEqual(queryWhere, { decision: null });
      assert.equal(result.length, 3);
    });

    it('scopes pending approvals by role and department for non-Super-Admin roles', async () => {
      let queryWhere = null;
      prisma.approval.findMany = async (args) => {
        queryWhere = args.where;
        return [
          { approvalId: 1, decision: null, booking: { resource: { departmentId: 1 } } },
        ];
      };

      const result = await approvalsRepo.listPendingFor({
        approverUserId: 3,
        roleId: ROLES.DEPARTMENT_ADMIN,
        departmentId: 1,
      });

      assert.equal(queryWhere.decision, null);
      assert.ok(Array.isArray(queryWhere.OR));
      assert.equal(result.length, 1);
    });
  });
});
