const { Router } = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const authenticate = require('../../middleware/authenticate');
const { authorizeRole, ROLES } = require('../../middleware/authorizeRole');
const auditService = require('../audit/audit.service');
const repo = require('./users.repository');

const router = Router();
router.use(authenticate);

const PHONE_REGEX = /^[6-9]\d{9}$/;
const VALID_ROLE_IDS = new Set(Object.values(ROLES));

function canReadUser(user, auth) {
  if ([ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN].includes(auth.roleId)) return true;
  if (auth.roleId === ROLES.DEPARTMENT_ADMIN) return user.departmentId === auth.departmentId;
  return user.userId === auth.userId;
}

// Only Super Admin creates accounts (Section 15: "Create users").
// A random temporary password is generated and returned ONCE in the
// response — the admin is expected to relay it to the person out of
// band, who should then call /auth/set-password on first login.
// (A "send an invite email" flow belongs in the notifications module
// once that's built — see backend README TODOs.)
router.post(
  '/',
  authorizeRole(ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { name, email, phone, roleId, departmentId, notes, roomNo } = req.body;

    if (!name || !email || !phone || !roleId) {
      throw ApiError.badRequest('name, email, phone, and roleId are required');
    }
    if (!VALID_ROLE_IDS.has(Number(roleId))) {
      throw ApiError.badRequest('roleId must be a valid role');
    }
    if (Number(roleId) === ROLES.DEPARTMENT_ADMIN && !departmentId) {
      throw ApiError.badRequest('departmentId is required for Department Admin users');
    }
    if (!PHONE_REGEX.test(phone)) {
      throw ApiError.badRequest('phone must be a valid 10-digit Indian mobile number');
    }

    const tempPassword = crypto.randomBytes(9).toString('base64url'); // 12-char random string
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await repo.create({
      name,
      email,
      phone,
      roleId,
      departmentId: departmentId ?? null,
      notes: notes || null,
      roomNo: roomNo || null,
      passwordHash,
    });

    await auditService.log({
      userId: req.auth.userId,
      action: 'CREATE_USER',
      entityType: 'user',
      entityId: user.userId,
      details: `Created ${user.name} (${user.email || user.phone})`,
    });

    res.status(201).json({ ...user, tempPassword });
  })
);

// Deactivate/reactivate rather than delete — keeps booking/audit
// history intact for a person who left or changed roles.
router.patch(
  '/:userId/status',
  authorizeRole(ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!['Active', 'Inactive'].includes(status)) {
      throw ApiError.badRequest("status must be 'Active' or 'Inactive'");
    }
    const updated = await repo.updateStatus(Number(req.params.userId), status);
    await auditService.log({
      userId: req.auth.userId,
      action: 'CHANGE_USER_STATUS',
      entityType: 'user',
      entityId: req.params.userId,
      details: `status -> ${status}`,
    });
    res.json(updated);
  })
);

// Super Admin sees everyone; Department Admin sees only their own
// department's people (Section 15: "Cannot manage other departments").
router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.auth.roleId === ROLES.REQUESTER) {
      throw ApiError.forbidden('Requesters can only view their own profile');
    }
    const departmentId =
      req.auth.roleId === ROLES.DEPARTMENT_ADMIN ? req.auth.departmentId : req.query.departmentId;
    res.json(await repo.list(departmentId ? Number(departmentId) : undefined));
  })
);

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.json(await repo.findById(req.auth.userId));
  })
);

router.get(
  '/:userId',
  asyncHandler(async (req, res) => {
    const user = await repo.findById(Number(req.params.userId));
    if (!user) throw ApiError.notFound('User not found');
    if (!canReadUser(user, req.auth)) {
      throw ApiError.forbidden('You do not have permission to view this user');
    }
    res.json(user);
  })
);

// Only Super Admin assigns roles — Section 15: "Assign roles" is
// explicitly a Super Admin capability, not even Institute Admin's.
router.patch(
  '/:userId/role',
  authorizeRole(ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { roleId, departmentId } = req.body;
    if (!VALID_ROLE_IDS.has(Number(roleId))) {
      throw ApiError.badRequest('roleId must be a valid role');
    }
    if (Number(roleId) === ROLES.DEPARTMENT_ADMIN && !departmentId) {
      throw ApiError.badRequest('departmentId is required for Department Admin users');
    }
    const updated = await repo.updateRole(Number(req.params.userId), roleId, departmentId ?? null);
    await auditService.log({
      userId: req.auth.userId,
      action: 'CHANGE_USER_ROLE',
      entityType: 'user',
      entityId: req.params.userId,
      details: `roleId -> ${roleId}, departmentId -> ${departmentId ?? 'null'}`,
    });
    res.json(updated);
  })
);

module.exports = router;
