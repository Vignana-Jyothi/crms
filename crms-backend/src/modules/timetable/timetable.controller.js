const asyncHandler = require('../../utils/asyncHandler');
const service = require('./timetable.service');
const ApiError = require('../../utils/ApiError');
const cache = require('../../utils/cache');
const { ROLES } = require('../../middleware/authorizeRole');

function checkDepartmentAccess(auth, targetDepartmentId) {
  if (auth.roleId === ROLES.SUPER_ADMIN || auth.roleId === ROLES.INSTITUTE_ADMIN) return true;
  
  if (!targetDepartmentId) return false; // Department Admin cannot edit shared/unassigned timetables

  const targetIdStr = targetDepartmentId.toString();
  const primaryId = auth.departmentId?.toString();
  const managedIds = (auth.managedDepartmentIds || []).map(id => id.toString());
  
  return targetIdStr === primaryId || managedIds.includes(targetIdStr);
}

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
  const existing = await service.getById(req.params.timetableId);
  
  // A department admin can only update timetables if they manage the old department AND the new department (if changed)
  if (!checkDepartmentAccess(req.auth, existing.departmentId)) {
    throw ApiError.forbidden("You do not have permission to edit this department's timetable.");
  }
  if (req.body.departmentId && !checkDepartmentAccess(req.auth, req.body.departmentId)) {
    throw ApiError.forbidden("You cannot assign a timetable to a department you do not manage.");
  }

  const result = await service.update(req.params.timetableId, req.body);
  cache.flushAll(); // Invalidate timetable cache
  res.json(result);
});

const create = asyncHandler(async (req, res) => {
  if (!checkDepartmentAccess(req.auth, req.body.departmentId)) {
    throw ApiError.forbidden("You do not have permission to create timetables for this department.");
  }

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
  if (!req.body.entries || !Array.isArray(req.body.entries)) {
    throw ApiError.badRequest("Entries must be an array");
  }

  // Ensure all entries belong to a department the user manages
  for (const entry of req.body.entries) {
    if (!checkDepartmentAccess(req.auth, entry.departmentId)) {
      throw ApiError.forbidden("One or more entries belong to a department you do not manage.");
    }
  }

  // Pass the array of timetable entries to the service
  const result = await service.batchCreate(req.body.entries);
  cache.flushAll(); // Invalidate timetable cache
  res.json(result);
});

module.exports = { list, getById, syncEduPrime, update, create, extractFromFile, batchCreate };
