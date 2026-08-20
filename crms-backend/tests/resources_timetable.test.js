const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const resourcesService = require('../src/modules/resources/resources.service');
const resourcesRepo = require('../src/modules/resources/resources.repository');
const timetableService = require('../src/modules/timetable/timetable.service');
const timetableRepo = require('../src/modules/timetable/timetable.repository');
const bookingsService = require('../src/modules/bookings/bookings.service');
const prisma = require('../src/config/prisma');

describe('Resources & Timetable Modules Tests', () => {
  describe('Resources Service & Repository Filters', () => {
    let mockResources;

    beforeEach(() => {
      mockResources = [
        {
          resourceId: 'CSE-LAB-101',
          resourceName: 'CSE Advanced Computing Lab 1',
          resourceTypeId: 2,
          departmentId: 1,
          blockId: 2,
          floor: '1',
          capacityOrAreaSqm: 60,
          status: 'Active',
          resourceType: { typeName: 'Lab' },
          department: { branchCode: 'CSE', departmentName: 'Computer Science' },
          block: { blockCode: 'B', blockName: 'Babbage' },
        },
        {
          resourceId: 'CSE-CR-201',
          resourceName: 'CSE Smart Classroom 201',
          resourceTypeId: 1,
          departmentId: 1,
          blockId: 2,
          floor: '2',
          capacityOrAreaSqm: 70,
          status: 'Active',
          resourceType: { typeName: 'Classroom' },
          department: { branchCode: 'CSE', departmentName: 'Computer Science' },
          block: { blockCode: 'B', blockName: 'Babbage' },
        },
        {
          resourceId: 'KS-AUDITORIUM',
          resourceName: 'K.S. Auditorium',
          resourceTypeId: 4,
          departmentId: null,
          blockId: 1,
          floor: 'Ground',
          capacityOrAreaSqm: 1200,
          status: 'Active',
          resourceType: { typeName: 'Auditorium' },
          department: null,
          block: { blockCode: 'A', blockName: 'Kalam' },
        },
        {
          resourceId: 'ECE-LAB-101',
          resourceName: 'ECE Embedded Systems Lab',
          resourceTypeId: 2,
          departmentId: 2,
          blockId: 3,
          floor: '1',
          capacityOrAreaSqm: 40,
          status: 'Maintenance',
          resourceType: { typeName: 'Lab' },
          department: { branchCode: 'ECE', departmentName: 'Electronics' },
          block: { blockCode: 'C', blockName: 'Raman' },
        },
      ];
    });

    it('filters resources by departmentId', async () => {
      resourcesRepo.list = async (filters) =>
        mockResources.filter((r) => !filters.departmentId || r.departmentId === filters.departmentId);

      const cseResources = await resourcesService.list({ departmentId: 1 });
      assert.equal(cseResources.length, 2);
      assert.ok(cseResources.every((r) => r.departmentId === 1));
    });

    it('filters resources by resourceTypeId', async () => {
      resourcesRepo.list = async (filters) =>
        mockResources.filter((r) => !filters.resourceTypeId || r.resourceTypeId === filters.resourceTypeId);

      const labs = await resourcesService.list({ resourceTypeId: 2 });
      assert.equal(labs.length, 2);
      assert.ok(labs.every((r) => r.resourceTypeId === 2));
    });

    it('filters resources by minimum capacity', async () => {
      resourcesRepo.list = async (filters) => {
        const cap = filters.minCapacity || filters.capacity;
        return mockResources.filter((r) => !cap || r.capacityOrAreaSqm >= cap);
      };

      const largeVenues = await resourcesService.list({ minCapacity: 100 });
      assert.equal(largeVenues.length, 1);
      assert.equal(largeVenues[0].resourceId, 'KS-AUDITORIUM');
    });

    it('filters resources by search term (case-insensitive substring)', async () => {
      resourcesRepo.list = async (filters) =>
        mockResources.filter(
          (r) => !filters.search || r.resourceName.toLowerCase().includes(filters.search.toLowerCase())
        );

      const matched = await resourcesService.list({ search: 'smart' });
      assert.equal(matched.length, 1);
      assert.equal(matched[0].resourceId, 'CSE-CR-201');
    });

    it('getById returns resource when exists and throws 404 when not found', async () => {
      resourcesRepo.findById = async (id) => mockResources.find((r) => r.resourceId === id) || null;

      const res = await resourcesService.getById('CSE-LAB-101');
      assert.equal(res.resourceId, 'CSE-LAB-101');

      await assert.rejects(
        async () => {
          await resourcesService.getById('NON-EXISTENT');
        },
        (err) => err.statusCode === 404
      );
    });
  });

  describe('Resource Availability Calculation', () => {
    it('correctly returns day of week and blocked windows for date', async () => {
      const mockResource = {
        resourceId: 'CSE-CR-201',
        resourceName: 'CSE Smart Classroom 201',
        status: 'Active',
      };

      const mockTimetable = [
        {
          timetableId: 1,
          resourceId: 'CSE-CR-201',
          dayOfWeek: 'Monday',
          startTime: new Date('1970-01-01T09:00:00Z'),
          endTime: new Date('1970-01-01T10:00:00Z'),
          courseCode: 'CS301',
        },
      ];

      const mockBookings = [
        {
          bookingId: 101,
          resourceId: 'CSE-CR-201',
          bookingDate: new Date('2026-08-17T00:00:00Z'),
          startTime: new Date('1970-01-01T14:00:00Z'),
          endTime: new Date('1970-01-01T16:00:00Z'),
          status: 'Approved',
        },
      ];

      prisma.resource.findUnique = async () => mockResource;
      prisma.timetable.findMany = async () => mockTimetable;
      prisma.booking.findMany = async () => mockBookings;

      // 2026-08-17 is a Monday
      const availability = await bookingsService.getAvailability('CSE-CR-201', '2026-08-17');

      assert.equal(availability.resourceId, 'CSE-CR-201');
      assert.equal(availability.date, '2026-08-17');
      assert.equal(availability.dayOfWeek, 'Monday');
      assert.equal(availability.blockedByTimetable.length, 1);
      assert.equal(availability.blockedByTimetable[0].courseCode, 'CS301');
      assert.equal(availability.blockedByBookings.length, 1);
      assert.equal(availability.blockedByBookings[0].status, 'Approved');
    });

    it('throws 404 for availability check on non-existent resource', async () => {
      prisma.resource.findUnique = async () => null;

      await assert.rejects(
        async () => {
          await bookingsService.getAvailability('UNKNOWN-RES', '2026-08-17');
        },
        (err) => err.statusCode === 404
      );
    });
  });

  describe('Timetable Query & Management', () => {
    const mockTimetableData = [
      {
        timetableId: 1,
        resourceId: 'CSE-CR-201',
        departmentId: 1,
        dayOfWeek: 'Monday',
        startTime: new Date('1970-01-01T09:00:00Z'),
        endTime: new Date('1970-01-01T10:00:00Z'),
        courseCode: 'CS301',
        section: 'A',
        academicYear: '2025-2026',
      },
      {
        timetableId: 2,
        resourceId: 'CSE-CR-201',
        departmentId: 1,
        dayOfWeek: 'Tuesday',
        startTime: new Date('1970-01-01T11:00:00Z'),
        endTime: new Date('1970-01-01T12:00:00Z'),
        courseCode: 'CS302',
        section: 'B',
        academicYear: '2025-2026',
      },
      {
        timetableId: 3,
        resourceId: 'ECE-LAB-101',
        departmentId: 2,
        dayOfWeek: 'Monday',
        startTime: new Date('1970-01-01T14:00:00Z'),
        endTime: new Date('1970-01-01T17:00:00Z'),
        courseCode: 'EC351',
        section: 'A',
        academicYear: '2025-2026',
      },
    ];

    it('queries timetable entries filtered by departmentId and dayOfWeek', async () => {
      timetableRepo.list = async (filters) =>
        mockTimetableData.filter(
          (t) =>
            (!filters.departmentId || t.departmentId === Number(filters.departmentId)) &&
            (!filters.dayOfWeek || t.dayOfWeek === filters.dayOfWeek)
        );

      const results = await timetableService.list({ departmentId: 1, dayOfWeek: 'Monday' });
      assert.equal(results.length, 1);
      assert.equal(results[0].courseCode, 'CS301');
      assert.equal(results[0].dayOfWeek, 'Monday');
    });

    it('queries timetable entries filtered by resourceId', async () => {
      timetableRepo.list = async (filters) =>
        mockTimetableData.filter((t) => !filters.resourceId || t.resourceId === filters.resourceId);

      const results = await timetableService.list({ resourceId: 'ECE-LAB-101' });
      assert.equal(results.length, 1);
      assert.equal(results[0].courseCode, 'EC351');
    });

    it('getById returns entry when found and throws 404 when missing', async () => {
      timetableRepo.findById = async (id) => mockTimetableData.find((t) => t.timetableId === Number(id)) || null;

      const item = await timetableService.getById(1);
      assert.equal(item.timetableId, 1);
      assert.equal(item.courseCode, 'CS301');

      await assert.rejects(
        async () => {
          await timetableService.getById(999);
        },
        (err) => err.statusCode === 404
      );
    });
  });
});
