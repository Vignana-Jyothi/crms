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
  const extractedData = extractionService.parseTextToTimetable(rawText, context);
  res.json(extractedData);
});

const batchCreate = asyncHandler(async (req, res) => {
  // Pass the array of timetable entries to the service
  res.json(await service.batchCreate(req.body.entries));
});

module.exports = { list, getById, syncEduPrime, update, create, extractFromFile, batchCreate };
