const asyncHandler = require('../../utils/asyncHandler');
const service = require('./bookings.service');
const { ROLES } = require('../../middleware/authorizeRole');

const create = asyncHandler(async (req, res) => {
  const booking = await service.createBooking(req.body, req.auth.userId);
  res.status(201).json(booking);
});

// Requesters see only their own bookings; Department Admins see
// their department's; Institute Admin/Super Admin see everything
// (via query params, no special-casing needed in the service).
const list = asyncHandler(async (req, res) => {
  const filters = { status: req.query.status, resourceId: req.query.resourceId };

  if (req.auth.roleId === ROLES.REQUESTER) {
    filters.requesterUserId = req.auth.userId;
  } else if (req.auth.roleId === ROLES.DEPARTMENT_ADMIN) {
    filters.departmentId = req.auth.departmentId;
  }
  // Institute Admin / Super Admin: no extra filter -> sees all.

  res.json(await service.list(filters));
});

const listMy = asyncHandler(async (req, res) => {
  const filters = {
    requesterUserId: req.auth.userId,
    status: req.query.status,
    resourceId: req.query.resourceId,
  };
  res.json(await service.list(filters));
});

const getById = asyncHandler(async (req, res) => {
  res.json(await service.getById(req.params.bookingId, req.auth));
});

const cancel = asyncHandler(async (req, res) => {
  res.json(await service.cancel(req.params.bookingId, req.auth.userId, req.auth));
});

module.exports = { create, list, listMy, getById, cancel };

