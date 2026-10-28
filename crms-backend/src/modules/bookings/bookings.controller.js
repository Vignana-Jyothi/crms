const asyncHandler = require('../../utils/asyncHandler');
const service = require('./bookings.service');
const { ROLES, departmentScopeOf } = require('../../middleware/authorizeRole');

const create = asyncHandler(async (req, res) => {
  const booking = await service.createBooking(req.body, req.auth.userId);
  res.status(201).json(booking);
});

// Institute Admin/Super Admin see everything; Department Admins see
// bookings for the departments they manage; everyone else sees only
// their own bookings. All filtering happens in the database so the
// admin table never has to guess at fields the API didn't return.
const list = asyncHandler(async (req, res) => {
  const { departmentId, ...rest } = req.query;
  const filters = {
    status: rest.status,
    resourceId: rest.resourceId,
    blockId: rest.blockId,
    resourceTypeId: rest.resourceTypeId,
    dateFrom: rest.dateFrom,
    dateTo: rest.dateTo,
    search: rest.search,
  };

  const seesAll = [ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN].includes(req.auth.roleId);

  if (seesAll) {
    if (departmentId !== undefined) filters.departmentIds = [departmentId];
  } else if (req.auth.roleId === ROLES.DEPARTMENT_ADMIN) {
    // A Department Admin with no department assigned sees nothing.
    const scope = departmentScopeOf(req.auth);
    filters.departmentIds =
      departmentId === undefined ? scope : scope.filter((id) => id === departmentId);
  } else {
    filters.requesterUserId = req.auth.userId;
  }

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
  res.json(await service.cancel(req.params.bookingId, req.auth.userId, req.auth, req.body.reason));
});

module.exports = { create, list, listMy, getById, cancel };

