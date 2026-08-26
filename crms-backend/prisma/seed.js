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

  const rolesData = [
    { roleName: 'Super Admin', description: 'System-wide administrative access' },
    { roleName: 'Institute Admin', description: 'Campus-level resource & hall approver' },
    { roleName: 'Department Admin', description: 'Departmental resource manager and approver' },
    { roleName: 'Requester', description: 'Faculty, staff, or student requester' },
  ];
  const roleMap = {};
  for (const r of rolesData) {
    const created = await prisma.role.upsert({
      where: { roleName: r.roleName },
      update: { description: r.description },
      create: r,
    });
    roleMap[r.roleName] = created.roleId;
  }
  console.log(`✅ Seeded ${rolesData.length} roles.`);

  // 2. Departments
  const departmentsData = [
    { branchCode: 'CSE', departmentName: 'Computer Science and Engineering', groupType: 'Engineering' },
    { branchCode: 'ECE', departmentName: 'Electronics and Communication Engineering', groupType: 'Engineering' },
    { branchCode: 'EEE', departmentName: 'Electrical and Electronics Engineering', groupType: 'Engineering' },
    { branchCode: 'MECH', departmentName: 'Mechanical Engineering', groupType: 'Engineering' },
    { branchCode: 'CIVIL', departmentName: 'Civil Engineering', groupType: 'Engineering' },
    { branchCode: 'IT', departmentName: 'Information Technology', groupType: 'Engineering' },
  ];
  const deptMap = {};
  for (const d of departmentsData) {
    const created = await prisma.department.upsert({
      where: { branchCode: d.branchCode },
      update: { departmentName: d.departmentName, groupType: d.groupType },
      create: d,
    });
    deptMap[d.branchCode] = created.departmentId;
  }
  console.log(`✅ Seeded ${departmentsData.length} departments.`);

  // 3. Blocks
  const blocksData = [
    { blockCode: 'A', blockName: 'Block A' },
    { blockCode: 'B', blockName: 'Block B' },
    { blockCode: 'C', blockName: 'Block C' },
    { blockCode: 'D', blockName: 'Block D' },
    { blockCode: 'E', blockName: 'Block E' },
    { blockCode: 'P', blockName: 'Block P' },
    { blockCode: 'SC', blockName: 'Block SC' },
  ];
  const blockMap = {};
  for (const b of blocksData) {
    const created = await prisma.block.upsert({
      where: { blockCode: b.blockCode },
      update: { blockName: b.blockName },
      create: b,
    });
    blockMap[b.blockCode] = created.blockId;
  }
  console.log(`✅ Seeded ${blocksData.length} blocks.`);

  // 4. Resource Types
  const resourceTypesData = [
    { typeName: 'Classroom', description: 'Standard lecture hall / classroom' },
    { typeName: 'Lab', description: 'Computing, electronics, or engineering laboratory' },
    { typeName: 'Seminar Hall', description: 'Institute Seminar Hall for presentations and events' },
    { typeName: 'Auditorium', description: 'Grand campus auditorium for major institutional events' },
  ];
  const rtMap = {};
  for (const rt of resourceTypesData) {
    const created = await prisma.resourceType.upsert({
      where: { typeName: rt.typeName },
      update: { description: rt.description },
      create: rt,
    });
    rtMap[rt.typeName] = created.resourceTypeId;
  }
  console.log(`✅ Seeded ${resourceTypesData.length} resource types.`);

  // 5. Users
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  const usersData = [
    {
      name: 'System Super Admin',
      email: 'admin@vnrvjiet.in',
      phone: '9876543210',
      roleId: roleMap['Super Admin'],
      departmentId: null,
      employeeId: 'EMP001',
      status: 'Active',
      passwordHash,
    },
    {
      name: 'Dean Administration',
      email: 'dean@vnrvjiet.in',
      phone: '9876543211',
      roleId: roleMap['Institute Admin'],
      departmentId: null,
      employeeId: 'EMP002',
      status: 'Active',
      passwordHash,
    },
    {
      name: 'CSE Dept Admin & HOD',
      email: 'deptadmin_cse@vnrvjiet.in',
      phone: '9876543212',
      roleId: roleMap['Department Admin'],
      departmentId: deptMap['CSE'],
      employeeId: 'EMP003',
      status: 'Active',
      passwordHash,
    },
    {
      name: 'CSE Faculty Member',
      email: 'faculty_cse@vnrvjiet.in',
      phone: '9876543213',
      roleId: roleMap['Requester'],
      departmentId: deptMap['CSE'],
      employeeId: 'EMP004',
      status: 'Active',
      passwordHash,
    },
    {
      name: 'ECE Dept Admin',
      email: 'deptadmin_ece@vnrvjiet.in',
      phone: '9876543214',
      roleId: roleMap['Department Admin'],
      departmentId: deptMap['ECE'],
      employeeId: 'EMP005',
      status: 'Active',
      passwordHash,
    },
    {
      name: 'ECE Faculty Member',
      email: 'faculty_ece@vnrvjiet.in',
      phone: '9876543215',
      roleId: roleMap['Requester'],
      departmentId: deptMap['ECE'],
      employeeId: 'EMP006',
      status: 'Active',
      passwordHash,
    },
    {
      name: 'Student Council President',
      email: 'student@vnrvjiet.in',
      phone: '9876543216',
      roleId: roleMap['Requester'],
      departmentId: deptMap['CSE'],
      employeeId: 'STU001',
      status: 'Active',
      passwordHash,
    },
  ];

  for (const user of usersData) {
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
  console.log(`✅ Seeded ${usersData.length} users (Default password: ${DEFAULT_PASSWORD}).`);

  // 6. Resources (both Department-owned and Institute-wide)
  const resources = [
    {
      resourceId: 'CSE-LAB-101',
      resourceName: 'CSE Advanced Computing Lab 1',
      resourceTypeId: rtMap['Lab'],
      departmentId: deptMap['CSE'],
      blockId: blockMap['B'],
      floor: '1',
      capacityOrAreaSqm: 60,
      allocationNote: 'High Performance GPUs & Linux Workstations',
      status: 'Active',
    },
    {
      resourceId: 'CSE-CR-201',
      resourceName: 'CSE Smart Classroom 201',
      resourceTypeId: rtMap['Classroom'],
      departmentId: deptMap['CSE'],
      blockId: blockMap['B'],
      floor: '2',
      capacityOrAreaSqm: 70,
      allocationNote: 'Projector & Smart Interactive Board',
      status: 'Active',
    },
    {
      resourceId: 'CSE-CR-202',
      resourceName: 'CSE Smart Classroom 202',
      resourceTypeId: rtMap['Classroom'],
      departmentId: deptMap['CSE'],
      blockId: blockMap['B'],
      floor: '2',
      capacityOrAreaSqm: 70,
      allocationNote: 'Projector & Audio System',
      status: 'Active',
    },
    {
      resourceId: 'ECE-LAB-101',
      resourceName: 'ECE Embedded Systems Lab',
      resourceTypeId: rtMap['Lab'],
      departmentId: deptMap['ECE'],
      blockId: blockMap['C'],
      floor: '1',
      capacityOrAreaSqm: 50,
      allocationNote: 'FPGA & Microcontroller Kits',
      status: 'Active',
    },
    {
      resourceId: 'ECE-CR-301',
      resourceName: 'ECE Lecture Hall 301',
      resourceTypeId: rtMap['Classroom'],
      departmentId: deptMap['ECE'],
      blockId: blockMap['C'],
      floor: '3',
      capacityOrAreaSqm: 65,
      allocationNote: 'Smart Classroom Setup',
      status: 'Active',
    },
    {
      resourceId: 'KS-AUDITORIUM',
      resourceName: 'K.S. Auditorium',
      resourceTypeId: rtMap['Auditorium'],
      departmentId: null,
      blockId: blockMap['A'],
      floor: 'Ground',
      capacityOrAreaSqm: 1200,
      allocationNote: 'Central Institute Auditorium with Stage & Lighting',
      status: 'Active',
    },
    {
      resourceId: 'SEMINAR-HALL-A',
      resourceName: 'PG Seminar Hall Block A',
      resourceTypeId: rtMap['Seminar Hall'],
      departmentId: null,
      blockId: blockMap['A'],
      floor: '3',
      capacityOrAreaSqm: 250,
      allocationNote: 'Central AC Seminar Hall',
      status: 'Active',
    },
    {
      resourceId: 'SEMINAR-HALL-D',
      resourceName: 'Ambedkar Memorial Seminar Hall',
      resourceTypeId: rtMap['Seminar Hall'],
      departmentId: null,
      blockId: blockMap['D'],
      floor: '2',
      capacityOrAreaSqm: 300,
      allocationNote: 'Equipped with Video Conferencing Setup',
      status: 'Active',
    },
  ];

  // Dynamically generate EduPrime mapped Classrooms for all 4 years
  const branchList = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT'];
  const years = [
    { label: '1st', semName: 'B.Tech I Year I Semester' },
    { label: '2nd', semName: 'B.Tech II Year I Semester' },
    { label: '3rd', semName: 'B.Tech III Year I Semester' },
    { label: '4th', semName: 'B.Tech IV Year I Semester' }
  ];
  const sections = ['A', 'B', 'C'];

  let resourceCounter = 1;

  const blockCounters = { A: 101, B: 101, C: 101, D: 101 };

  for (const branch of branchList) {
    const deptId = deptMap[branch];
    if (!deptId) continue;
    
    // Assign blocks logically based on department
    const blockCode = (branch === 'CSE' || branch === 'CIVIL' || branch === 'IT') ? 'A' :
                      (branch === 'ECE') ? 'B' :
                      (branch === 'EEE') ? 'C' : 'D';
    const blockId = blockMap[blockCode];

    for (const year of years) {
      for (const section of sections) {
        // Generate UNIQUE realistic room number, e.g., "A-101", "A-102"
        const roomNumber = `${blockCode}-${blockCounters[blockCode]++}`;

        resources.push({
          resourceId: roomNumber,
          resourceName: `${year.label} Year ${branch} - Sec ${section}`, // Keep section as Name for the subtitle
          resourceTypeId: rtMap['Classroom'],
          departmentId: deptId,
          blockId: blockId,
          floor: Math.floor(blockCounters[blockCode] / 100).toString(),
          capacityOrAreaSqm: 65,
          allocationNote: 'EduPrime Sync Enabled Classroom',
          status: 'Active',
          allocatedSemester: year.semName,
          allocatedBranch: branch,
          allocatedSection: section
        });
        resourceCounter++;
      }
    }
  }

  // Clean up any previously generated EduPrime rooms to avoid duplicates
  await prisma.resource.deleteMany({
    where: { allocationNote: 'EduPrime Sync Enabled Classroom' }
  });

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
        allocatedSemester: res.allocatedSemester,
        allocatedBranch: res.allocatedBranch,
        allocatedSection: res.allocatedSection
      },
      create: res,
    });
  }
  console.log(`✅ Seeded ${resources.length} resources.`);

  // 7. Timetable Records
  const timetableEntries = [
    {
      resourceId: 'CSE-CR-201',
      departmentId: deptMap['CSE'],
      dayOfWeek: 'Monday',
      startTime: toTimeValue('09:00'),
      endTime: toTimeValue('10:00'),
      courseCode: 'CS301',
      section: 'A',
      academicYear: '2025-2026',
      // We skip uploadedByUserId here for robustness, or we would need to map user IDs dynamically too.
    }
  ];

  for (const tt of timetableEntries) {
    // We create them without forcing Timetable IDs to avoid constraint issues
    await prisma.timetable.create({
      data: {
        resourceId: tt.resourceId,
        departmentId: tt.departmentId,
        dayOfWeek: tt.dayOfWeek,
        startTime: tt.startTime,
        endTime: tt.endTime,
        courseCode: tt.courseCode,
        section: tt.section,
        academicYear: tt.academicYear,
      }
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
