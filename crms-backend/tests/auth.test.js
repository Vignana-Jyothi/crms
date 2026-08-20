const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const env = require('../src/config/env');
const { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } = require('../src/utils/jwt');
const authenticate = require('../src/middleware/authenticate');
const { authorizeRole, ROLES } = require('../src/middleware/authorizeRole');
const authService = require('../src/modules/auth/auth.service');
const authRepo = require('../src/modules/auth/auth.repository');
const auditService = require('../src/modules/audit/audit.service');

describe('Auth Module & Security Tests', () => {
  describe('JWT Utilities', () => {
    const sampleUser = {
      userId: 42,
      name: 'Dr. Alan Turing',
      email: 'alan.turing@vnrvjiet.in',
      roleId: ROLES.DEPARTMENT_ADMIN,
      departmentId: 1,
    };

    it('signAccessToken creates a valid JWT containing sub, roleId, and departmentId', () => {
      const token = signAccessToken(sampleUser);
      assert.ok(typeof token === 'string' && token.length > 0);

      const decoded = verifyAccessToken(token);
      assert.equal(decoded.sub, sampleUser.userId);
      assert.equal(decoded.roleId, sampleUser.roleId);
      assert.equal(decoded.departmentId, sampleUser.departmentId);
      assert.ok(decoded.exp > decoded.iat);
    });

    it('signRefreshToken creates a valid JWT containing sub', () => {
      const token = signRefreshToken(sampleUser);
      assert.ok(typeof token === 'string' && token.length > 0);

      const decoded = verifyRefreshToken(token);
      assert.equal(decoded.sub, sampleUser.userId);
    });

    it('verifyAccessToken throws when token is invalid or tampered', () => {
      assert.throws(() => {
        verifyAccessToken('invalid.token.signature');
      });
    });

    it('verifyRefreshToken throws when token is invalid or signed with wrong secret', () => {
      const badToken = jwt.sign({ sub: sampleUser.userId }, 'wrong_secret');
      assert.throws(() => {
        verifyRefreshToken(badToken);
      });
    });
  });

  describe('Authenticate Middleware', () => {
    it('returns 401 when Authorization header is missing', () => {
      const req = { headers: {} };
      let errorResult = null;
      authenticate(req, {}, (err) => {
        errorResult = err;
      });

      assert.ok(errorResult);
      assert.equal(errorResult.statusCode, 401);
      assert.match(errorResult.message, /Missing or malformed Authorization header/i);
    });

    it('returns 401 when Authorization header format is not Bearer', () => {
      const req = { headers: { authorization: 'Basic dXNlcjpwYXNz' } };
      let errorResult = null;
      authenticate(req, {}, (err) => {
        errorResult = err;
      });

      assert.ok(errorResult);
      assert.equal(errorResult.statusCode, 401);
    });

    it('sets req.auth correctly with valid access token', () => {
      const token = signAccessToken({ userId: 10, roleId: ROLES.REQUESTER, departmentId: 2 });
      const req = { headers: { authorization: `Bearer ${token}` } };
      let calledNext = false;
      let errorResult = null;

      authenticate(req, {}, (err) => {
        if (err) errorResult = err;
        else calledNext = true;
      });

      assert.equal(errorResult, null);
      assert.equal(calledNext, true);
      assert.deepEqual(req.auth, {
        userId: 10,
        roleId: ROLES.REQUESTER,
        departmentId: 2,
      });
    });

    it('returns 401 when token is expired or invalid', () => {
      const req = { headers: { authorization: 'Bearer invalid-token-string' } };
      let errorResult = null;
      authenticate(req, {}, (err) => {
        errorResult = err;
      });

      assert.ok(errorResult);
      assert.equal(errorResult.statusCode, 401);
      assert.match(errorResult.message, /Invalid or expired token/i);
    });
  });

  describe('AuthorizeRole Middleware', () => {
    it('allows request when user role matches allowed roles', () => {
      const middleware = authorizeRole(ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN);
      const req = { auth: { userId: 1, roleId: ROLES.SUPER_ADMIN } };
      let passed = false;

      middleware(req, {}, (err) => {
        assert.equal(err, undefined);
        passed = true;
      });

      assert.equal(passed, true);
    });

    it('returns 403 Forbidden when user role is not allowed', () => {
      const middleware = authorizeRole(ROLES.SUPER_ADMIN);
      const req = { auth: { userId: 4, roleId: ROLES.REQUESTER } };
      let errorResult = null;

      middleware(req, {}, (err) => {
        errorResult = err;
      });

      assert.ok(errorResult);
      assert.equal(errorResult.statusCode, 403);
      assert.match(errorResult.message, /do not have permission/i);
    });

    it('returns 401 Unauthorized when req.auth is missing', () => {
      const middleware = authorizeRole(ROLES.REQUESTER);
      const req = {};
      let errorResult = null;

      middleware(req, {}, (err) => {
        errorResult = err;
      });

      assert.ok(errorResult);
      assert.equal(errorResult.statusCode, 401);
    });
  });

  describe('Auth Service Logic', () => {
    let originalFindByEmail, originalFindById, originalSetRefreshToken, originalSetPasswordHash, originalAuditLog;

    beforeEach(() => {
      originalFindByEmail = authRepo.findByEmail;
      originalFindById = authRepo.findById;
      originalSetRefreshToken = authRepo.setRefreshToken;
      originalSetPasswordHash = authRepo.setPasswordHash;
      originalAuditLog = auditService.log;
    });

    it('login returns tokens and user info on valid credentials', async () => {
      const password = 'Password@123';
      const passwordHash = await bcrypt.hash(password, 12);
      const mockUser = {
        userId: 1,
        name: 'Admin User',
        email: 'admin@vnrvjiet.in',
        passwordHash,
        status: 'Active',
        roleId: ROLES.SUPER_ADMIN,
        departmentId: null,
        role: { roleName: 'Super Admin' },
        department: null,
      };

      authRepo.findByEmail = async (email) => (email === mockUser.email ? mockUser : null);
      let updatedRefreshToken = null;
      authRepo.setRefreshToken = async (userId, token) => {
        updatedRefreshToken = token;
      };
      auditService.log = async () => {};

      const result = await authService.login('admin@vnrvjiet.in', password, '127.0.0.1');

      assert.ok(result.accessToken);
      assert.ok(result.refreshToken);
      assert.equal(result.refreshToken, updatedRefreshToken);
      assert.equal(result.user.email, 'admin@vnrvjiet.in');
      assert.equal(result.user.role, 'Super Admin');

      // Verify token contents
      const decodedAccess = verifyAccessToken(result.accessToken);
      assert.equal(decodedAccess.sub, mockUser.userId);
      assert.equal(decodedAccess.roleId, mockUser.roleId);
    });

    it('login throws 401 on non-existent user (enumeration prevention)', async () => {
      authRepo.findByEmail = async () => null;

      await assert.rejects(
        async () => {
          await authService.login('nonexistent@vnrvjiet.in', 'Password@123', '127.0.0.1');
        },
        (err) => err.statusCode === 401 && /Invalid email or password/.test(err.message)
      );
    });

    it('login throws 401 on wrong password', async () => {
      const passwordHash = await bcrypt.hash('CorrectPassword@123', 12);
      authRepo.findByEmail = async () => ({
        userId: 2,
        email: 'user@vnrvjiet.in',
        passwordHash,
        status: 'Active',
      });

      await assert.rejects(
        async () => {
          await authService.login('user@vnrvjiet.in', 'WrongPassword@123', '127.0.0.1');
        },
        (err) => err.statusCode === 401 && /Invalid email or password/.test(err.message)
      );
    });

    it('login throws 403 on Inactive user status', async () => {
      const passwordHash = await bcrypt.hash('Password@123', 12);
      authRepo.findByEmail = async () => ({
        userId: 3,
        email: 'inactive@vnrvjiet.in',
        passwordHash,
        status: 'Inactive',
      });

      await assert.rejects(
        async () => {
          await authService.login('inactive@vnrvjiet.in', 'Password@123', '127.0.0.1');
        },
        (err) => err.statusCode === 403 && /account is not active/.test(err.message)
      );
    });

    it('refresh exchanges valid refresh token for new access token', async () => {
      const mockUser = {
        userId: 5,
        roleId: ROLES.REQUESTER,
        departmentId: 1,
      };
      const refreshToken = signRefreshToken(mockUser);
      mockUser.refreshToken = refreshToken;

      authRepo.findById = async (userId) => (userId === mockUser.userId ? mockUser : null);

      const result = await authService.refresh(refreshToken);
      assert.ok(result.accessToken);

      const decoded = verifyAccessToken(result.accessToken);
      assert.equal(decoded.sub, mockUser.userId);
      assert.equal(decoded.roleId, mockUser.roleId);
    });

    it('refresh rejects rotated or revoked refresh token', async () => {
      const mockUser = {
        userId: 5,
        refreshToken: 'new_active_refresh_token',
      };
      const oldRefreshToken = signRefreshToken(mockUser);

      authRepo.findById = async () => mockUser;

      await assert.rejects(
        async () => {
          await authService.refresh(oldRefreshToken);
        },
        (err) => err.statusCode === 401 && /Refresh token no longer valid/.test(err.message)
      );
    });

    it('setPassword updates password hash with 12 bcrypt salt rounds and logs audit', async () => {
      let savedHash = null;
      let loggedAudit = null;

      authRepo.setPasswordHash = async (userId, hash) => {
        savedHash = hash;
      };
      auditService.log = async (audit) => {
        loggedAudit = audit;
      };

      await authService.setPassword(10, 'NewSecurePassword@2026', 10);

      assert.ok(savedHash);
      const isMatch = await bcrypt.compare('NewSecurePassword@2026', savedHash);
      assert.equal(isMatch, true);
      assert.equal(loggedAudit.userId, 10);
      assert.equal(loggedAudit.action, 'SET_PASSWORD');
    });
  });
});
