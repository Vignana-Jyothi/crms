const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;
const DEFAULT_PASSWORD = 'Password@123';

function toTimeValue(hhmm) {
  return new Date(`1970-01-01T${hhmm}:00Z`);
}

async function main() {
  console.log('🌱 Starting CRMS database seeding...');

  // 1. Roles
  const roles = [
    { roleId: 1, roleName: 'Super Admin', description: 'System-wide administrative access' },
    { roleId: 2, roleName: 'Institute Admin', description: 'Campus-level resource & hall approver' },
    { roleId: 3, roleName: 'Department Admin', description: 'Departmental resource manager and approver' },
    { roleId: 4, roleName: 'Requester', description: 'Faculty, staff, or student requester' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { roleId: role.roleId },
      update: { roleName: role.roleName, description: role.description },
      create: role,
    });
  }
  console.log(`✅ Seeded ${roles.length} roles.`);

  // 2. Departments
  const departments = [
    { departmentId: 1, branchCode: 'CSE', departmentName: 'Computer Science and Engineering', groupType: 'Engineering' },
    { departmentId: 2, branchCode: 'ECE', departmentName: 'Electronics and Communication Engineering', groupType: 'Engineering' },
    { departmentId: 3, branchCode: 'EEE', departmentName: 'Electrical and Electronics Engineering', groupType: 'Engineering' },
    { departmentId: 4, branchCode: 'MECH', departmentName: 'Mechanical Engineering', groupType: 'Engineering' },
    { departmentId: 5, branchCode: 'CIVIL', departmentName: 'Civil Engineering', groupType: 'Engineering' },
    { departmentId: 6, branchCode: 'IT', departmentName: 'Information Technology', groupType: 'Engineering' },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { branchCode: dept.branchCode },
      update: { departmentName: dept.departmentName, groupType: dept.groupType },
      create: dept,
    });
  }
  console.log(`✅ Seeded ${departments.length} departments.`);

  // 3. Blocks
  const blocks = [
    { blockId: 1, blockCode: 'A', blockName: 'APJ Abdul Kalam Block' },
    { blockId: 2, blockCode: 'B', blockName: 'Babbage Block' },
    { blockId: 3, blockCode: 'C', blockName: 'C.V. Raman Block' },
    { blockId: 4, blockCode: 'D', blockName: 'Dr. B.R. Ambedkar Block' },
  ];

  for (const block of blocks) {
    await prisma.block.upsert({
      where: { blockCode: block.blockCode },
      update: { blockName: block.blockName },
      create: block,
    });
  }
  console.log(`✅ Seeded ${blocks.length} blocks.`);

  // 4. Resource Types
  const resourceTypes = [
    { resourceTypeId: 1, typeName: 'Classroom', description: 'Standard lecture hall / classroom' },
    { resourceTypeId: 2, typeName: 'Lab', description: 'Computing, electronics, or engineering laboratory' },
    { resourceTypeId: 3, typeName: 'Seminar Hall', description: 'Institute Seminar Hall for presentations and events' },
    { resourceTypeId: 4, typeName: 'Auditorium', description: 'Grand campus auditorium for major institutional events' },
  ];

  for (const rt of resourceTypes) {
    await prisma.resourceType.upsert({
      where: { typeName: rt.typeName },
      update: { description: rt.description },
      create: rt,
    });
  }
  console.log(`✅ Seeded ${resourceTypes.length} resource types.`);

  // 5. Users
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  const users = [
    {
      userId: 1,
      name: 'System Super Admin',
      email: 'admin@vnrvjiet.in',
      phone: '9876543210',
      roleId: 1,
      departmentId: null,
      employeeId: 'EMP001',
      status: 'Active',
      passwordHash,
    },
    {
      userId: 2,
      name: 'Dean Administration',
      email: 'dean@vnrvjiet.in',
      phone: '9876543211',
      roleId: 2,
      departmentId: null,
      employeeId: 'EMP002',
      status: 'Active',
      passwordHash,
    },
    {
      userId: 3,
      name: 'CSE Dept Admin & HOD',
      email: 'deptadmin_cse@vnrvjiet.in',
      phone: '9876543212',
      roleId: 3,
      departmentId: 1,
      employeeId: 'EMP003',
      status: 'Active',
      passwordHash,
    },
    {
      userId: 4,
      name: 'CSE Faculty Member',
      email: 'faculty_cse@vnrvjiet.in',
      phone: '9876543213',
      roleId: 4,
      departmentId: 1,
      employeeId: 'EMP004',
      status: 'Active',
      passwordHash,
    },
    {
      userId: 5,
      name: 'ECE Dept Admin',
      email: 'deptadmin_ece@vnrvjiet.in',
      phone: '9876543214',
      roleId: 3,
      departmentId: 2,
      employeeId: 'EMP005',
      status: 'Active',
      passwordHash,
    },
    {
      userId: 6,
      name: 'ECE Faculty Member',
      email: 'faculty_ece@vnrvjiet.in',
      phone: '9876543215',
      roleId: 4,
      departmentId: 2,
      employeeId: 'EMP006',
      status: 'Active',
      passwordHash,
    },
    {
      userId: 7,
      name: 'Student Council President',
      email: 'student@vnrvjiet.in',
      phone: '9876543216',
      roleId: 4,
      departmentId: 1,
      employeeId: 'STU001',
      status: 'Active',
      passwordHash,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        phone: user.phone,
        roleId: user.roleId,
        departmentId: user.departmentId,
        employeeId: user.employeeId,
        status: user.status,
        passwordHash: user.passwordHash,
      },
      create: user,
    });
  }
  console.log(`✅ Seeded ${users.length} users (Default password: ${DEFAULT_PASSWORD}).`);

  // 6. Resources (both Department-owned and Institute-wide)
  const resources = [
    {
      resourceId: 'CSE-LAB-101',
      resourceName: 'CSE Advanced Computing Lab 1',
      resourceTypeId: 2,
      departmentId: 1,
      blockId: 2,
      floor: '1',
      capacityOrAreaSqm: 60,
      allocationNote: 'High Performance GPUs & Linux Workstations',
      status: 'Active',
    },
    {
      resourceId: 'CSE-CR-201',
      resourceName: 'CSE Smart Classroom 201',
      resourceTypeId: 1,
      departmentId: 1,
      blockId: 2,
      floor: '2',
      capacityOrAreaSqm: 70,
      allocationNote: 'Projector & Smart Interactive Board',
      status: 'Active',
    },
    {
      resourceId: 'CSE-CR-202',
      resourceName: 'CSE Smart Classroom 202',
      resourceTypeId: 1,
      departmentId: 1,
      blockId: 2,
      floor: '2',
      capacityOrAreaSqm: 70,
      allocationNote: 'Projector & Audio System',
      status: 'Active',
    },
    {
      resourceId: 'ECE-LAB-101',
      resourceName: 'ECE Embedded Systems Lab',
      resourceTypeId: 2,
      departmentId: 2,
      blockId: 3,
      floor: '1',
      capacityOrAreaSqm: 50,
      allocationNote: 'FPGA & Microcontroller Kits',
      status: 'Active',
    },
    {
      resourceId: 'ECE-CR-301',
      resourceName: 'ECE Lecture Hall 301',
      resourceTypeId: 1,
      departmentId: 2,
      blockId: 3,
      floor: '3',
      capacityOrAreaSqm: 65,
      allocationNote: 'Smart Classroom Setup',
      status: 'Active',
    },
    {
      resourceId: 'KS-AUDITORIUM',
      resourceName: 'K.S. Auditorium',
      resourceTypeId: 4,
      departmentId: null,
      blockId: 1,
      floor: 'Ground',
      capacityOrAreaSqm: 1200,
      allocationNote: 'Central Institute Auditorium with Stage & Lighting',
      status: 'Active',
    },
    {
      resourceId: 'SEMINAR-HALL-A',
      resourceName: 'PG Seminar Hall Block A',
      resourceTypeId: 3,
      departmentId: null,
      blockId: 1,
      floor: '3',
      capacityOrAreaSqm: 250,
      allocationNote: 'Central AC Seminar Hall',
      status: 'Active',
    },
    {
      resourceId: 'SEMINAR-HALL-D',
      resourceName: 'Ambedkar Memorial Seminar Hall',
      resourceTypeId: 3,
      departmentId: null,
      blockId: 4,
      floor: '2',
      capacityOrAreaSqm: 300,
      allocationNote: 'Equipped with Video Conferencing Setup',
      status: 'Active',
    },
  ];

  for (const res of resources) {
    await prisma.resource.upsert({
      where: { resourceId: res.resourceId },
      update: {
        resourceName: res.resourceName,
        resourceTypeId: res.resourceTypeId,
        departmentId: res.departmentId,
        blockId: res.blockId,
        floor: res.floor,
        capacityOrAreaSqm: res.capacityOrAreaSqm,
        allocationNote: res.allocationNote,
        status: res.status,
      },
      create: res,
    });
  }
  console.log(`✅ Seeded ${resources.length} resources.`);

  // 7. Timetable Records
  const timetableEntries = [
    {
      timetableId: 1,
      resourceId: 'CSE-CR-201',
      departmentId: 1,
      dayOfWeek: 'Monday',
      startTime: toTimeValue('09:00'),
      endTime: toTimeValue('10:00'),
      courseCode: 'CS301',
      section: 'A',
      academicYear: '2025-2026',
      uploadedByUserId: 3,
    },
    {
      timetableId: 2,
      resourceId: 'CSE-CR-201',
      departmentId: 1,
      dayOfWeek: 'Monday',
      startTime: toTimeValue('10:00'),
      endTime: toTimeValue('11:00'),
      courseCode: 'CS302',
      section: 'A',
      academicYear: '2025-2026',
      uploadedByUserId: 3,
    },
    {
      timetableId: 3,
      resourceId: 'CSE-LAB-101',
      departmentId: 1,
      dayOfWeek: 'Tuesday',
      startTime: toTimeValue('13:30'),
      endTime: toTimeValue('16:30'),
      courseCode: 'CS351',
      section: 'B',
      academicYear: '2025-2026',
      uploadedByUserId: 3,
    },
    {
      timetableId: 4,
      resourceId: 'ECE-CR-301',
      departmentId: 2,
      dayOfWeek: 'Wednesday',
      startTime: toTimeValue('09:30'),
      endTime: toTimeValue('10:30'),
      courseCode: 'EC301',
      section: 'A',
      academicYear: '2025-2026',
      uploadedByUserId: 5,
    },
    {
      timetableId: 5,
      resourceId: 'ECE-LAB-101',
      departmentId: 2,
      dayOfWeek: 'Thursday',
      startTime: toTimeValue('14:00'),
      endTime: toTimeValue('17:00'),
      courseCode: 'EC351',
      section: 'A',
      academicYear: '2025-2026',
      uploadedByUserId: 5,
    },
  ];

  for (const tt of timetableEntries) {
    await prisma.timetable.upsert({
      where: { timetableId: tt.timetableId },
      update: {
        resourceId: tt.resourceId,
        departmentId: tt.departmentId,
        dayOfWeek: tt.dayOfWeek,
        startTime: tt.startTime,
        endTime: tt.endTime,
        courseCode: tt.courseCode,
        section: tt.section,
        academicYear: tt.academicYear,
        uploadedByUserId: tt.uploadedByUserId,
      },
      create: tt,
    });
  }
  console.log(`✅ Seeded ${timetableEntries.length} timetable records.`);

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
