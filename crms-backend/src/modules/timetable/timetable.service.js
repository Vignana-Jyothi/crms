const repo = require('./timetable.repository');
const ApiError = require('../../utils/ApiError');
const prisma = require('../../config/prisma');
const eduprimeService = require('../eduprime/eduprime.service');

// Maps EduPrime 1-7 (Monday=1, Sunday=7) to DAY_NAMES
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function list(filters) {
  return repo.list(filters);
}

async function getById(timetableId) {
  const item = await repo.findById(timetableId);
  if (!item) {
    throw ApiError.notFound(`Timetable entry ${timetableId} not found`);
  }
  return item;
}

function toTimeValue(timeStr) {
  if (!timeStr) return null;
  const match12h = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12h) {
    let hours = parseInt(match12h[1], 10);
    const minutes = parseInt(match12h[2], 10);
    const period = match12h[3].toUpperCase();
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return new Date(`1970-01-01T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`);
  }
  
  const match24h = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (match24h) {
    return new Date(`1970-01-01T${String(match24h[1]).padStart(2, '0')}:${String(match24h[2]).padStart(2, '0')}:00Z`);
  }
  return null;
}

async function syncEduPrime() {
  const resources = await prisma.resource.findMany({
    where: {
      allocatedSemester: { not: null },
      allocatedBranch: { not: null },
      allocatedSection: { not: null }
    }
  });

  let totalSynced = 0;

  for (const resource of resources) {
    const entries = await eduprimeService.getClassTimeTable(
      resource.allocatedSemester,
      resource.allocatedBranch,
      resource.allocatedSection
    );

    if (entries.length > 0) {
      // Clear existing timetable for this resource
      await prisma.timetable.deleteMany({
        where: { resourceId: resource.resourceId, uploadedByUserId: null }
      });

      // Insert new entries
      const dataToInsert = entries.map(entry => {
        // Entry.Day is 1=Monday...7=Sunday. Our DB stores string 'Monday' etc.
        const jsDayNum = entry.Day === 7 ? 0 : entry.Day;
        const dayName = DAY_NAMES[jsDayNum];

        const startT = toTimeValue(entry.StartTime);
        const endT = toTimeValue(entry.EndTime);

        // Only insert if times are valid
        if (!startT || !endT) return null;

        return {
          resourceId: resource.resourceId,
          departmentId: resource.departmentId,
          dayOfWeek: dayName,
          startTime: startT,
          endTime: endT,
          courseCode: entry.CourseCode,
          section: resource.allocatedSection,
          academicYear: '2026-27'
        };
      }).filter(Boolean);

      if (dataToInsert.length > 0) {
        await prisma.timetable.createMany({ data: dataToInsert });
        totalSynced += dataToInsert.length;
      }
    }
  }

  return { success: true, totalSynced };
}

module.exports = { list, getById, syncEduPrime };
