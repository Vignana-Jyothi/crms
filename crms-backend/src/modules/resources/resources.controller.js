const asyncHandler = require('../../utils/asyncHandler');
const service = require('./resources.service');
const bookingsService = require('../bookings/bookings.service');
const { ROLES } = require('../../middleware/authorizeRole');

const list = asyncHandler(async (req, res) => {
  res.json(await service.list(req.query));
});

const getById = asyncHandler(async (req, res) => {
  res.json(await service.getById(req.params.resourceId));
});

const create = asyncHandler(async (req, res) => {
  const resource = await service.create(req.body, req.auth.userId);
  res.status(201).json(resource);
});

const update = asyncHandler(async (req, res) => {
  const resource = await service.update(req.params.resourceId, req.body, req.auth.userId);
  res.json(resource);
});

// GET /resources/:resourceId/availability?date=YYYY-MM-DD
// Returns booked/blocked time windows for that resource on that day
// (timetable classes + existing bookings), so the frontend can grey
// out slots before the user even tries to submit a request.
const availability = asyncHandler(async (req, res) => {
  const result = await bookingsService.getAvailability(req.params.resourceId, req.query.date);
  res.json(result);
});

// The booker's email and phone are for admins (the "Contact Details"
// box); everyone else gets the same rooms without them.
const liveStatus = asyncHandler(async (req, res) => {
  const result = await bookingsService.getLiveStatus(req.query.date, req.query.startTime, req.query.endTime);
  const isAdmin = [ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN, ROLES.DEPARTMENT_ADMIN].includes(req.auth.roleId);
  res.json(isAdmin ? result : result.map(({ occupantContact, ...room }) => room));
});

const aiRecommend = asyncHandler(async (req, res) => {
  const result = await service.aiRecommend(req.query);
  res.json(result);
});

module.exports = { list, getById, create, update, availability, liveStatus, aiRecommend };
