const asyncHandler = require('../../utils/asyncHandler');
const service = require('./timetable.service');
const cache = require('../../utils/cache');

const list = asyncHandler(async (req, res) => {
  res.json(await service.list(req.query));
});

const getById = asyncHandler(async (req, res) => {
  res.json(await service.getById(req.params.timetableId));
});

const syncEduPrime = asyncHandler(async (req, res) => {
  const result = await service.syncEduPrime();
  cache.flushAll(); // Invalidate timetable cache
  res.json(result);
});

const update = asyncHandler(async (req, res) => {
  const result = await service.update(req.params.timetableId, req.body);
  cache.flushAll(); // Invalidate timetable cache
  res.json(result);
});

const create = asyncHandler(async (req, res) => {
  const result = await service.create(req.body);
  cache.flushAll(); // Invalidate timetable cache
  res.json(result);
});

const extractFromFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const extractionService = require('./timetable.extraction.service');
  const rawText = await extractionService.extractTextFromFile(req.file);
  const context = {
    departmentId: req.body.departmentId,
    studentYear: req.body.studentYear,
    section: req.body.section
  };
  const extractedData = await extractionService.parseTextToTimetable(rawText, context);
  res.json(extractedData);
});

const batchCreate = asyncHandler(async (req, res) => {
  // Pass the array of timetable entries to the service
  const result = await service.batchCreate(req.body.entries);
  cache.flushAll(); // Invalidate timetable cache
  res.json(result);
});

module.exports = { list, getById, syncEduPrime, update, create, extractFromFile, batchCreate };
