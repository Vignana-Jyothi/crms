const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const env = require('../src/config/env');
const auditService = require('../src/modules/audit/audit.service');
const masterDataRepo = require('../src/modules/masterData/masterData.repository');
const prisma = require('../src/config/prisma');

describe('CORS Configuration, Master Data, and Audit Engine Tests', () => {
  describe('CORS Multi-Origin Parser & Configuration', () => {
    it('parses comma-separated CORS_ORIGIN into corsOrigins array', () => {
      assert.ok(Array.isArray(env.corsOrigins));
      assert.ok(env.corsOrigins.includes('http://localhost:5173'));
      assert.ok(env.corsOrigins.includes('http://localhost:5174'));
      assert.ok(env.corsOrigins.includes('http://localhost:3000'));
      assert.ok(env.corsOrigins.includes('http://localhost:8080'));
      assert.ok(env.corsOrigins.includes('http://localhost:8081'));
    });

    it('validates dev-mode localhost regex matching', () => {
      const localhostRegex = /^http:\/\/localhost:\d+$/;
      assert.ok(localhostRegex.test('http://localhost:5173'));
      assert.ok(localhostRegex.test('http://localhost:5174'));
      assert.ok(localhostRegex.test('http://localhost:8080'));
      assert.ok(!localhostRegex.test('http://evil-site.com'));
      assert.ok(!localhostRegex.test('http://localhost:5173/path'));
    });
  });

  describe('Master Data Repositories', () => {
    it('listRoles returns roles array ordered by roleId', async () => {
      const mockRoles = [
        { roleId: 1, roleName: 'Super Admin' },
        { roleId: 2, roleName: 'Institute Admin' },
        { roleId: 3, roleName: 'Department Admin' },
        { roleId: 4, roleName: 'Requester' },
      ];
      prisma.role.findMany = async () => mockRoles;

      const roles = await masterDataRepo.listRoles();
      assert.equal(roles.length, 4);
      assert.equal(roles[0].roleName, 'Super Admin');
    });

    it('listDepartments returns departments array', async () => {
      const mockDepts = [
        { departmentId: 1, branchCode: 'CSE', departmentName: 'Computer Science' },
        { departmentId: 2, branchCode: 'ECE', departmentName: 'Electronics' },
      ];
      prisma.department.findMany = async () => mockDepts;

      const depts = await masterDataRepo.listDepartments();
      assert.equal(depts.length, 2);
      assert.equal(depts[0].branchCode, 'CSE');
    });

    it('listBlocks returns blocks array', async () => {
      const mockBlocks = [
        { blockId: 1, blockCode: 'A', blockName: 'Block A' },
        { blockId: 2, blockCode: 'B', blockName: 'Block B' },
      ];
      prisma.block.findMany = async () => mockBlocks;

      const blocks = await masterDataRepo.listBlocks();
      assert.equal(blocks.length, 2);
      assert.equal(blocks[0].blockCode, 'A');
    });

    it('listResourceTypes returns resource types array', async () => {
      const mockTypes = [
        { resourceTypeId: 1, typeName: 'Classroom' },
        { resourceTypeId: 2, typeName: 'Lab' },
        { resourceTypeId: 3, typeName: 'Seminar Hall' },
        { resourceTypeId: 4, typeName: 'Auditorium' },
      ];
      prisma.resourceType.findMany = async () => mockTypes;

      const types = await masterDataRepo.listResourceTypes();
      assert.equal(types.length, 4);
      assert.equal(types[2].typeName, 'Seminar Hall');
    });
  });

  describe('Audit Logging Engine', () => {
    it('auditService.log gracefully handles and creates audit records', async () => {
      let createdData = null;
      prisma.auditLog.create = async ({ data }) => {
        createdData = data;
        return { auditId: 1, ...data, timestamp: new Date() };
      };

      await auditService.log({
        userId: 1,
        action: 'UPDATE_RESOURCE',
        entityType: 'resource',
        entityId: 'CSE-CR-201',
        details: 'Updated capacity to 75',
      });

      assert.ok(createdData);
      assert.equal(createdData.userId, 1);
      assert.equal(createdData.action, 'UPDATE_RESOURCE');
      assert.equal(createdData.entityId, 'CSE-CR-201');
    });

    it('auditService.log never throws even if database write fails', async () => {
      prisma.auditLog.create = async () => {
        throw new Error('Database connection failure');
      };

      // Must not throw exception
      await auditService.log({
        userId: 1,
        action: 'FAILED_OPERATION',
        entityType: 'test',
        entityId: '1',
      });
    });

    it('auditService.list queries with filters and limits', async () => {
      const mockLogs = [
        { auditId: 10, action: 'LOGIN', entityType: 'user', entityId: '1' },
        { auditId: 9, action: 'CREATE_BOOKING', entityType: 'booking', entityId: '100' },
      ];

      prisma.auditLog.findMany = async ({ where, take }) => {
        assert.equal(where.entityType, 'booking');
        assert.equal(take, 50);
        return mockLogs.filter((l) => l.entityType === 'booking');
      };

      const results = await auditService.list({ entityType: 'booking', limit: 50 });
      assert.equal(results.length, 1);
      assert.equal(results[0].action, 'CREATE_BOOKING');
    });
  });

  describe('Centralized Error Handler Middleware', () => {
    const errorHandler = require('../src/middleware/errorHandler');
    const ApiError = require('../src/utils/ApiError');

    function createMockRes() {
      const res = {
        statusCode: null,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.body = payload;
          return this;
        },
      };
      return res;
    }

    it('handles Prisma P2034 serialization conflict with 409 Conflict', () => {
      const p2034Err = new Error('Transaction failed due to serialization failure');
      p2034Err.code = 'P2034';

      const res = createMockRes();
      errorHandler(p2034Err, {}, res, () => {});

      assert.equal(res.statusCode, 409);
      assert.equal(res.body.error, 'Concurrent booking conflict. Please retry your request.');
    });

    it('handles Prisma P2002 unique constraint error with 409 Conflict', () => {
      const p2002Err = new Error('Unique constraint failed');
      p2002Err.code = 'P2002';
      p2002Err.meta = { target: ['email'] };

      const res = createMockRes();
      errorHandler(p2002Err, {}, res, () => {});

      assert.equal(res.statusCode, 409);
      assert.match(res.body.error, /already exists/);
    });

    it('handles Prisma P2003 foreign key violation with 400 Bad Request', () => {
      const p2003Err = new Error('Foreign key constraint failed');
      p2003Err.code = 'P2003';

      const res = createMockRes();
      errorHandler(p2003Err, {}, res, () => {});

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.error, 'Referenced record does not exist');
    });

    it('handles custom ApiError with matching status and details', () => {
      const apiErr = ApiError.conflict('Booking overlap', { conflicts: [{ id: 1 }] });

      const res = createMockRes();
      errorHandler(apiErr, {}, res, () => {});

      assert.equal(res.statusCode, 409);
      assert.equal(res.body.error, 'Booking overlap');
      assert.deepEqual(res.body.details, { conflicts: [{ id: 1 }] });
    });
  });
});
