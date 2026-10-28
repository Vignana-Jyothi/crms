const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const prisma = require('../src/config/prisma');
const bookingsService = require('../src/modules/bookings/bookings.service');
const approvalsRepo = require('../src/modules/approvals/approvals.repository');
const resourcesService = require('../src/modules/resources/resources.service');
const { ROLES, departmentScopeOf } = require('../src/middleware/authorizeRole');
const { signAccessToken } = require('../src/utils/jwt');

// Prisma hands TIME columns back as Dates on 1970-01-01 with the
// campus wall-clock time in the UTC fields.
const t = (hhmm) => new Date(`1970-01-01T${hhmm}:00Z`);

const FUTURE_DATE = '2099-01-05';

function istNow() {
  const ist = new Date(Date.now() + 330 * 60000);
  return { date: ist.toISOString().slice(0, 10), hhmm: ist.toISOString().slice(11, 16) };
}

function mockDay({ classes = [], bookings = [] }) {
  prisma.resource.findMany = async () => [
    { resourceId: 'R1', resourceName: 'A 101', resourceType: { typeName: 'Classroom' }, department: { branchCode: 'CSE' }, block: { blockCode: 'A' } },
  ];
  prisma.timetable.findMany = async () =>
    classes.map(([start, end, courseCode = 'CS101']) => ({
      resourceId: 'R1', startTime: t(start), endTime: t(end), courseCode, section: 'A', studentYear: '2', department: { branchCode: 'CSE' },
    }));
  prisma.booking.findMany = async () =>
    bookings.map(([start, end, status = 'Approved']) => ({
      resourceId: 'R1', startTime: t(start), endTime: t(end), status, purpose: 'Workshop', requester: { name: 'Asha' },
    }));
}

async function statusFor(start, end, date = FUTURE_DATE) {
  const [room] = await bookingsService.getLiveStatus(date, start, end);
  return room;
}

describe('Live room status', () => {
  it('reports a room with no classes or bookings as Free', async () => {
    mockDay({});
    const room = await statusFor('09:00', '16:40');
    assert.equal(room.status, 'Free');
    assert.equal(room.isFree, true);
    assert.deepEqual(room.freeSlots, [{ startTime: '09:00', endTime: '16:40' }]);
  });

  it('counts an afternoon booking stored in campus time (regression: was shifted to UTC and missed)', async () => {
    mockDay({ bookings: [['14:00', '15:00']] });
    const room = await statusFor('09:00', '16:40');
    assert.equal(room.status, 'Partial');
    assert.equal(room.isFree, false);
    assert.deepEqual(room.freeSlots, [
      { startTime: '09:00', endTime: '14:00' },
      { startTime: '15:00', endTime: '16:40' },
    ]);
  });

  it('treats a Pending booking as occupying the slot, since it blocks new requests', async () => {
    mockDay({ bookings: [['10:00', '11:00', 'Pending']] });
    const room = await statusFor('09:00', '16:40');
    assert.equal(room.status, 'Partial');
    assert.equal(room.occupantList[0].status, 'Pending');
  });

  it('is Full when classes and bookings leave no bookable gap', async () => {
    // 5-minute changeovers between periods are not bookable gaps.
    mockDay({ classes: [['09:00', '10:55'], ['11:00', '12:55'], ['13:00', '16:40']] });
    const room = await statusFor('09:00', '16:40');
    assert.equal(room.status, 'Full');
    assert.deepEqual(room.freeSlots, []);
    assert.equal(room.occupantList.length, 3);
    assert.equal(room.occupantList[0].type, 'class');
    assert.match(room.occupantList[0].branchStr, /2nd Year CSE - Sec A/);
  });

  it('only reports what overlaps the requested window', async () => {
    mockDay({ classes: [['09:00', '12:00']], bookings: [['14:00', '15:00']] });
    const afternoon = await statusFor('13:00', '16:40');
    assert.equal(afternoon.status, 'Partial');
    assert.deepEqual(afternoon.occupantList.map((o) => o.type), ['event']);
    const lunch = await statusFor('12:00', '13:00');
    assert.equal(lunch.status, 'Free');
  });

  it('treats equal start and end as a single instant', async () => {
    mockDay({ bookings: [['14:00', '15:00']] });
    assert.equal((await statusFor('14:30', '14:30')).status, 'Full');
    assert.equal((await statusFor('15:00', '15:00')).status, 'Free');
  });

  it('skips malformed timetable rows whose end is not after their start', async () => {
    mockDay({ classes: [['11:00', '00:00']] });
    assert.equal((await statusFor('09:00', '16:40')).status, 'Free');
  });

  it('flags a room in use right now, but never for a Pending request', async () => {
    const now = istNow();
    mockDay({ bookings: [['00:00', '23:59']] });
    const live = await statusFor('00:00', '23:59', now.date);
    assert.equal(live.inUseNow, true);
    assert.equal(live.currentOccupant.purpose, 'Workshop');

    mockDay({ bookings: [['00:00', '23:59', 'Pending']] });
    const pending = await statusFor('00:00', '23:59', now.date);
    assert.equal(pending.inUseNow, false);
  });

  it('never offers free time that is already in the past today', async () => {
    const now = istNow();
    mockDay({});
    const room = await statusFor('00:00', '23:59', now.date);
    assert.ok(room.freeSlots.every((s) => s.startTime >= now.hhmm), JSON.stringify(room.freeSlots));
  });
});

describe('Approvals listing', () => {
  let args;
  beforeEach(() => {
    prisma.approval.findMany = async (a) => {
      args = a;
      return [];
    };
  });

  it('lists newest requests first', async () => {
    await approvalsRepo.listPendingFor({ approverUserId: 1, roleId: ROLES.SUPER_ADMIN });
    assert.deepEqual(args.orderBy, { approvalId: 'desc' });
  });

  it('scopes a Department Admin to every department they manage', async () => {
    await approvalsRepo.listPendingFor({ approverUserId: 9, roleId: ROLES.DEPARTMENT_ADMIN, departmentIds: [5, 9, 10] });
    const byRole = args.where.OR.find((c) => c.approverRoleId === ROLES.DEPARTMENT_ADMIN);
    assert.deepEqual(byRole.booking, { resource: { departmentId: { in: [5, 9, 10] } } });
  });

  it('departmentScopeOf merges primary and managed departments without duplicates', () => {
    assert.deepEqual(departmentScopeOf({ departmentId: 5, managedDepartmentIds: [9, 5, 10] }), [5, 9, 10]);
    assert.deepEqual(departmentScopeOf({ departmentId: null, managedDepartmentIds: [] }), []);
  });
});

describe('Approver routing', () => {
  it("routes a department room to that department's admin, picking a stable one", async () => {
    let query;
    prisma.user.findFirst = async (q) => {
      query = q;
      return q.where.departmentId === 24 && q.where.roleId === ROLES.DEPARTMENT_ADMIN
        ? { userId: 262, roleId: ROLES.DEPARTMENT_ADMIN }
        : null;
    };
    const approver = await resourcesService.resolveApprover({ departmentId: 24, resourceType: { typeName: 'Classroom' } });
    assert.equal(approver.userId, 262);
    assert.deepEqual(query.orderBy, { userId: 'asc' });
  });
});

describe('Response caching scope', () => {
  let server;
  let base;
  let bookingQueries = 0;
  let headers;

  before(async () => {
    headers = { Authorization: `Bearer ${signAccessToken({ userId: 1, roleId: ROLES.SUPER_ADMIN, departmentId: null })}` };
    prisma.booking.findMany = async () => {
      bookingQueries++;
      return [];
    };
    prisma.block.findMany = async () => [{ blockId: 1, blockCode: 'A' }];
    const app = require('../src/app');
    server = app.listen(0);
    base = `http://127.0.0.1:${server.address().port}/api/v1`;
  });

  after(() => server.close());

  it('does not serve booking lists from the master-data cache (regression)', async () => {
    const first = await fetch(`${base}/bookings`, { headers });
    const second = await fetch(`${base}/bookings`, { headers });
    assert.equal(first.status, 200);
    assert.equal(second.headers.get('x-cache'), null);
    assert.equal(bookingQueries, 2);
  });

  it('still caches master data', async () => {
    await fetch(`${base}/blocks`, { headers });
    const second = await fetch(`${base}/blocks`, { headers });
    assert.equal(second.headers.get('x-cache'), 'HIT');
  });
});
