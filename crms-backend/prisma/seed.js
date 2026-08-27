const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const rawData = require('./seed-data-raw');

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;
const DEFAULT_PASSWORD = 'Password@123';

function parseClassrooms(text, rtMap, deptMap, blockMap, resources) {
  const lines = text.trim().split('\n');
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    // Find the department branch code at the beginning
    const branchMatch = line.match(/^([A-Z&\(\)\/]+)\s+(.*)$/);
    if (!branchMatch) continue;
    
    let branch = branchMatch[1];
    // Normalize branch names
    if (branch === 'CE') branch = 'CIVIL';
    if (branch === 'ME') branch = 'MECH';
    if (branch === 'EVL') branch = 'ECE'; // Assuming EVL is part of ECE
    if (branch === 'CSBS') branch = 'CSE'; // Group under CSE
    
    const rest = branchMatch[2];
    
    // Match room IDs and optional capacities like "D 113(73)" or "E 012 (152)"
    const roomRegex = /([A-Z]\s*[\d\/A-Z\-]+)(?:\s*\(\s*(\d+)\s*\))?/g;
    let match;
    while ((match = roomRegex.exec(rest)) !== null) {
      let roomId = match[1].trim();
      let capacity = match[2] ? parseInt(match[2], 10) : 60;
      
      // Fix spacing for IDs like "D113" -> "D 113" if needed, but let's keep it exactly as is, except normalizing single spaces
      roomId = roomId.replace(/\s+/g, ' ');

      const blockChar = roomId.charAt(0);
      const blockId = blockMap[blockChar] || null;

      resources.push({
        resourceId: roomId,
        resourceName: roomId,
        resourceTypeId: rtMap['Classroom'],
        departmentId: deptMap[branch] || null,
        blockId: blockId,
        floor: roomId.length > 2 ? roomId.charAt(2) : 'Ground',
        capacityOrAreaSqm: capacity,
        allocationNote: 'Official Classroom',
        status: 'Active'
      });
    }
  }
}

function parseLabs(text, rtMap, deptMap, blockMap, resources) {
  const lines = text.trim().split('\n');
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    const branchMatch = line.match(/^([A-Z&\(\)\/a-z]+)\s+(.*)$/);
    if (!branchMatch) continue;
    
    let branch = branchMatch[1];
    if (branch === 'CE') branch = 'CIVIL';
    if (branch === 'ME') branch = 'MECH';
    if (branch === 'Physics' || branch === 'Chemistry' || branch === 'English') branch = null; // Basic Sciences
    
    const rest = branchMatch[2];
    
    // Labs format: "D 002 (AWS) 231.08" or "D 008/1 134.53"
    const labRegex = /([A-Z]\s*[\d\/A-Z\-]+(?:\s*\([^\)]+\))?)\s+(\d+(?:\.\d+)?)/g;
    let match;
    while ((match = labRegex.exec(rest)) !== null) {
      let rawId = match[1].trim();
      let area = parseFloat(match[2]);
      
      // Extract the actual room ID, e.g. "D 002" from "D 002 (AWS)"
      let roomIdMatch = rawId.match(/^([A-Z]\s*[\d\/A-Z\-]+)/);
      let roomId = roomIdMatch ? roomIdMatch[1].trim() : rawId;
      
      // Some special cases
      if (roomId === 'SC 007' || roomId === 'SC 006') roomId = roomId.replace('SC ', 'SC-');

      const blockChar = roomId.charAt(0);
      const blockId = blockMap[blockChar] || null;

      resources.push({
        resourceId: roomId,
        resourceName: rawId !== roomId ? rawId : roomId,
        resourceTypeId: rtMap['Lab'],
        departmentId: deptMap[branch] || null,
        blockId: blockId,
        floor: roomId.length > 2 ? roomId.charAt(2) : 'Ground',
        capacityOrAreaSqm: area,
        allocationNote: 'Official Lab',
        status: 'Active'
      });
    }
  }
}

function parseTutorialRooms(text, rtMap, deptMap, blockMap, resources) {
  const lines = text.trim().split('\n');
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    const branchMatch = line.match(/^([A-Z&\(\)\/a-z]+)\s+(.*)$/);
    if (!branchMatch) continue;
    
    let branch = branchMatch[1];
    if (branch === 'CE') branch = 'CIVIL';
    if (branch === 'ME') branch = 'MECH';
    
    const rest = branchMatch[2];
    
    const roomRegex = /([A-Z]\s*\d+)/g;
    let match;
    while ((match = roomRegex.exec(rest)) !== null) {
      let roomId = match[1].trim();

      const blockChar = roomId.charAt(0);
      const blockId = blockMap[blockChar] || null;

      // These might already exist as Classrooms. We will upsert them as Classrooms/Tutorial rooms.
      resources.push({
        resourceId: roomId,
        resourceName: roomId,
        resourceTypeId: rtMap['Classroom'], // Let's keep them as classrooms for general use
        departmentId: deptMap[branch] || null,
        blockId: blockId,
        floor: roomId.length > 2 ? roomId.charAt(2) : 'Ground',
        capacityOrAreaSqm: 60,
        allocationNote: 'Tutorial Room',
        status: 'Active'
      });
    }
  }
}

async function main() {
  console.log('🌱 Starting CRMS database seeding with real data...');

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

  const departmentsData = [
    { branchCode: 'CSE', departmentName: 'Computer Science and Engineering', groupType: 'Engineering' },
    { branchCode: 'ECE', departmentName: 'Electronics and Communication Engineering', groupType: 'Engineering' },
    { branchCode: 'EEE', departmentName: 'Electrical and Electronics Engineering', groupType: 'Engineering' },
    { branchCode: 'MECH', departmentName: 'Mechanical Engineering', groupType: 'Engineering' },
    { branchCode: 'CIVIL', departmentName: 'Civil Engineering', groupType: 'Engineering' },
    { branchCode: 'IT', departmentName: 'Information Technology', groupType: 'Engineering' },
    { branchCode: 'AE', departmentName: 'Automobile Engineering', groupType: 'Engineering' },
    { branchCode: 'EIE', departmentName: 'Electronics and Instrumentation Engg', groupType: 'Engineering' },
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

  const blocksData = [
    { blockCode: 'A', blockName: 'Block A' },
    { blockCode: 'B', blockName: 'Block B' },
    { blockCode: 'C', blockName: 'Block C' },
    { blockCode: 'D', blockName: 'Block D' },
    { blockCode: 'E', blockName: 'Block E' },
    { blockCode: 'P', blockName: 'PG Block' },
    { blockCode: 'SC', blockName: 'Sports Complex / SC Block' },
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

  // ---------------------------------------------------------
  // DELETE DUMMY DATA
  // ---------------------------------------------------------
  console.log('🗑️ Purging dummy data...');
  const dummyIds = ['CSE-LAB-101', 'CSE-CR-201', 'CSE-CR-202', 'ECE-LAB-101', 'ECE-CR-301'];
  
  // Delete timetables for dummy rooms to prevent foreign key errors
  await prisma.timetable.deleteMany({
    where: { resourceId: { in: dummyIds } }
  });
  
  await prisma.resource.deleteMany({
    where: { resourceId: { in: dummyIds } }
  });

  await prisma.timetable.deleteMany({
    where: { resource: { allocationNote: 'EduPrime Sync Enabled Classroom' } }
  });

  await prisma.resource.deleteMany({
    where: { allocationNote: 'EduPrime Sync Enabled Classroom' }
  });

  console.log('✅ Purged dummy data.');

  // ---------------------------------------------------------
  // SEED USERS FROM DEANS PDF
  // ---------------------------------------------------------
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
  
  // Create super admin if not exists (so user doesn't lose login)
  await prisma.user.upsert({
    where: { email: 'admin@vnrvjiet.in' },
    update: {},
    create: {
      name: 'System Super Admin',
      email: 'admin@vnrvjiet.in',
      phone: '9876543210',
      roleId: roleMap['Super Admin'],
      employeeId: 'EMP001',
      status: 'Active',
      passwordHash,
    }
  });

  const lines = rawData.deansText.trim().split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Format is "Designation Name Phone"
    // E.g. "Dean - Academics Dr. Y. Shivraj Narayan 7981818985"
    // Email is usually just name based or generic for now, we'll auto-generate emails
    const parts = line.split('Dr. ');
    if (parts.length < 2) continue; // Skip lines without Dr.
    
    let desig = parts[0].trim();
    let rest = 'Dr. ' + parts[1].trim();
    
    let phoneMatch = rest.match(/(\d{10})/);
    let phone = phoneMatch ? phoneMatch[1] : null;
    let name = phone ? rest.replace(phone, '').trim() : rest;
    
    let email = name.toLowerCase().replace(/[^a-z]/g, '') + '@vnrvjiet.in';
    let role = roleMap['Requester'];
    if (desig.toLowerCase().includes('dean') || desig.toLowerCase().includes('principal')) {
      role = roleMap['Institute Admin'];
    } else if (desig.toUpperCase() === desig && desig.length > 2) {
      // Looks like a branch name, so HOD
      role = roleMap['Department Admin'];
    }

    await prisma.user.upsert({
      where: { email: email },
      update: {
        name: name,
        phone: phone || null,
        roleId: role,
        status: 'Active',
      },
      create: {
        name: name,
        email: email,
        phone: phone || null,
        roleId: role,
        status: 'Active',
        passwordHash,
      }
    });
  }
  console.log(`✅ Seeded official Users (Deans & HODs).`);

  // ---------------------------------------------------------
  // SEED RESOURCES
  // ---------------------------------------------------------
  const resourcesToUpsert = [];

  parseClassrooms(rawData.classroomsText, rtMap, deptMap, blockMap, resourcesToUpsert);
  parseLabs(rawData.labsText, rtMap, deptMap, blockMap, resourcesToUpsert);
  parseTutorialRooms(rawData.tutorialRoomsText, rtMap, deptMap, blockMap, resourcesToUpsert);

  // Add Seminar Halls
  for (const sh of rawData.seminarHalls) {
    let blockId = null;
    if (sh.block) blockId = blockMap[sh.block];
    else if (sh.id.charAt(0) && blockMap[sh.id.charAt(0)]) blockId = blockMap[sh.id.charAt(0)];
    
    resourcesToUpsert.push({
      resourceId: sh.id,
      resourceName: sh.name || `Seminar Hall ${sh.id.replace('SEMINAR-HALL-', '')}`,
      resourceTypeId: rtMap[sh.type || 'Seminar Hall'],
      departmentId: null,
      blockId: blockId,
      floor: sh.floor || '0',
      capacityOrAreaSqm: sh.capacity,
      allocationNote: 'Official Seminar Hall',
      status: 'Active'
    });
  }

  // Map some real classrooms to EduPrime sections for testing the sync!
  const epMaps = [
    { id: 'D 113', sec: 'A' },
    { id: 'D 114', sec: 'B' },
    { id: 'D 102', sec: 'C' }
  ];
  
  for (const map of epMaps) {
    await prisma.resource.updateMany({
      where: { resourceId: map.id },
      data: {
        allocatedSemester: 'B.Tech I Year I Semester',
        allocatedBranch: 'CSE',
        allocatedSection: map.sec,
        allocationNote: 'EduPrime Sync Enabled Classroom'
      }
    });
  }

  let upsertCount = 0;
  for (const res of resourcesToUpsert) {
    // Upsert avoids duplicating rooms that were already created by OCR
    await prisma.resource.upsert({
      where: { resourceId: res.resourceId },
      update: {
        resourceName: res.resourceName,
        resourceTypeId: res.resourceTypeId,
        departmentId: res.departmentId,
        blockId: res.blockId,
        capacityOrAreaSqm: res.capacityOrAreaSqm,
      },
      create: res,
    });
    upsertCount++;
  }
  
  console.log(`✅ Seeded and verified ${upsertCount} official resources.`);
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
