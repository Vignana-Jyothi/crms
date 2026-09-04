const asyncHandler = require('../../utils/asyncHandler');
const service = require('./timetable.service');

const list = asyncHandler(async (req, res) => {
  res.json(await service.list(req.query));
});

const getById = asyncHandler(async (req, res) => {
  res.json(await service.getById(req.params.timetableId));
});

const syncEduPrime = asyncHandler(async (req, res) => {
  res.json(await service.syncEduPrime());
});

const update = asyncHandler(async (req, res) => {
  res.json(await service.update(req.params.timetableId, req.body));
});

const create = asyncHandler(async (req, res) => {
  res.json(await service.create(req.body));
});

module.exports = { list, getById, syncEduPrime, update, create };
