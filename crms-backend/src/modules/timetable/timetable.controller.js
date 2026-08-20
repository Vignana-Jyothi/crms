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

module.exports = { list, getById, syncEduPrime };
