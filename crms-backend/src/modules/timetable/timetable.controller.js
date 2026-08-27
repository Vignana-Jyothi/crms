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

const debugEduPrime = asyncHandler(async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const resource = await prisma.resource.findFirst({
    where: {
      allocatedSemester: { not: null },
      allocatedBranch: { not: null },
      allocatedSection: { not: null }
    }
  });

  if (!resource) {
    return res.status(404).json({ error: 'No mapped resource found in the database.' });
  }

  const eduprimeService = require('../eduprime/eduprime.service');
  const entries = await eduprimeService.getClassTimeTable(
    resource.allocatedSemester,
    resource.allocatedBranch,
    resource.allocatedSection
  );

  res.json({
    resource,
    sampleEntries: entries.slice(0, 3)
  });
});

const update = asyncHandler(async (req, res) => {
  res.json(await service.update(req.params.timetableId, req.body));
});

module.exports = { list, getById, syncEduPrime, debugEduPrime, update };
