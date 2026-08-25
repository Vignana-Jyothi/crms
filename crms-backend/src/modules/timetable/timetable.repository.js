const prisma = require('../../config/prisma');

function list({ departmentId, resourceId, dayOfWeek, academicYear, courseCode, section, facultyName, startTime, endTime }) {
  return prisma.timetable.findMany({
    where: {
      ...(departmentId && { departmentId: Number(departmentId) }),
      ...(resourceId && { resourceId }),
      ...(dayOfWeek && { dayOfWeek }),
      ...(academicYear && { academicYear }),
      ...(courseCode && { courseCode }),
      ...(section && { section }),
      ...(facultyName && { facultyName: { contains: facultyName, mode: 'insensitive' } }),
      ...(startTime && { endTime: { gt: startTime } }),
      ...(endTime && { startTime: { lt: endTime } }),
    },
    include: {
      resource: {
        select: {
          resourceId: true,
          resourceName: true,
          resourceTypeId: true,
          blockId: true,
          capacityOrAreaSqm: true,
          status: true,
          resourceType: { select: { typeName: true } },
          block: { select: { blockCode: true, blockName: true } },
        },
      },
      department: {
        select: {
          departmentId: true,
          departmentName: true,
          branchCode: true,
        },
      },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
}

function findById(timetableId) {
  return prisma.timetable.findUnique({
    where: { timetableId: Number(timetableId) },
    include: {
      resource: {
        include: {
          resourceType: true,
          block: true,
        },
      },
      department: true,
      uploadedBy: {
        select: { userId: true, name: true, email: true },
      },
    },
  });
}

module.exports = { list, findById };
