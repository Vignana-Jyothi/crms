const fs = require('fs');
const readline = require('readline');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEPT_MAP = {
  'AE': 'AE', 'CE': 'CE', 'CSE': 'CSE', 'DS': 'CSE-DS', 'ECE': 'ECE',
  'EEE': 'EEE', 'EIE': 'EIE', 'IT': 'IT', 'AIML': 'CSE-AIML',
  'BIO': 'BIO', 'ME': 'ME', 'MATHS': 'H&S-MATHS', 'PHY': 'H&S-PHYSICS',
  'CHEM': 'H&S-CHEM', 'ENG': 'H&S-ENGLISH', 'EVL': 'EVL', 'RAI': 'R&AI',
};

const BRANCH_NAME_MAP = {
  'Computer Science and Engineering': 'CSE', 'Computer Science & Engineering': 'CSE',
  'CSE': 'CSE', 'Computer Science and Business Systems': 'CSBS',
  'Computer Science & Business Systems': 'CSBS', 'CSBS': 'CSBS', 'Management': 'CSBS',
  'ECE': 'ECE', 'ME': 'ME', 'CSE-DS': 'CSE-DS', 'Data Science': 'CSE-DS',
  'Data Science Class II Year': 'CSE-DS', 'CSE-CyS': 'CSE-CS', 'CSE-CYS': 'CSE-CS',
  'Cyber Security Cyber Security': 'CSE-CS', 'AI&DS': 'AIDS', 'CSE-AI&DS': 'AIDS',
  'CSE-AIML': 'CSE-AIML', 'CSE - AIML': 'CSE-AIML', 'CSE-IoT': 'CSE-IOT',
  'R&AI': 'R&AI', 'AE': 'AE', 'AI & DS': 'AIDS', 'AIML': 'CSE-AIML',
  'BIO': 'BIO', 'CE': 'CE', 'CYS': 'CSE-CS', 'DS': 'CSE-DS', 'EEE': 'EEE',
  'EIE': 'EIE', 'IOT': 'CSE-IOT', 'IT': 'IT', 'RAI': 'R&AI', 'EVL': 'EVL',
  'Civil Engineering': 'CE', 'Automobile Engineering': 'AE',
  'Electronics and Instrumentation Engineering': 'EIE',
  'Electronics & Instrumentation Engineering': 'EIE',
  'Electronics and Communication Engineering': 'ECE',
  'ELECTRICAL & ELECTRONICS ENGINEERING': 'EEE',
  'Power Electronics': 'EEE', 'Power Systems': 'EEE',
  'Information Technology': 'IT', 'AUTOMOBILE ENGINEERING': 'AE',
};

// Parse SQL string values from a VALUES(...) clause, handling nested parens and quotes
function parseSQLValues(valuesStr) {
  const results = [];
  let current = '';
  let inQuote = false;
  let depth = 0;
  
  for (let i = 0; i < valuesStr.length; i++) {
    const ch = valuesStr[i];
    if (ch === "'" && (i === 0 || valuesStr[i-1] !== "'")) {
      inQuote = !inQuote;
      current += ch;
    } else if (!inQuote && ch === '(') {
      depth++;
      current += ch;
    } else if (!inQuote && ch === ')') {
      depth--;
      if (depth < 0) break; // end of VALUES
      current += ch;
    } else if (!inQuote && ch === ',' && depth === 0) {
      results.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) results.push(current.trim());
  return results.map(v => {
    v = v.trim();
    if (v === 'NULL') return null;
    if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
    if (v.startsWith("DATE '")) return v.replace(/^DATE '|'$/g, '');
    return v;
  });
}

const parseTime = (timeStr) => {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/(\d{1,2})[.:](\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  // Use Jan 2 1970 to avoid Prisma serialization bug where 1970-01-01T12:00Z
  // gets stored as 00:00:00 in a time-without-timezone column
  return new Date(Date.UTC(1970, 0, 2, h, m, 0, 0));
};

const parseYear = (yearStr) => {
  if (!yearStr) return null;
  if (yearStr.includes('IV') || yearStr === '4') return '4';
  if (yearStr.includes('III') || yearStr === '3') return '3';
  if (yearStr.includes('II') || yearStr === '2') return '2';
  if (yearStr.includes('I') || yearStr === '1') return '1';
  return null;
};

async function main() {
  console.log('=== FULL TIMETABLE IMPORT v2 ===');
  
  const departments = await prisma.department.findMany();
  const deptByCode = {};
  for (const d of departments) deptByCode[d.branchCode] = d.departmentId;
  console.log(`Loaded ${departments.length} departments from DB.`);
  
  const resources = await prisma.resource.findMany();
  const resourceMap = {};
  for (const r of resources) {
    const key = r.resourceName.toLowerCase().replace(/[\s\-\/()]/g, '');
    resourceMap[key] = r.resourceId;
    // Also store without the (XX) suffix for partial matching
    const baseKey = r.resourceName.replace(/\s*\([^)]*\)\s*$/, '').toLowerCase().replace(/[\s\-\/]/g, '');
    if (baseKey !== key) resourceMap[baseKey] = r.resourceId;
  }
  console.log(`Loaded ${resources.length} resources from DB.`);
  
  // Explicit aliases for rooms that can't be matched by normalization
  const ROOM_ALIASES = {
    'KS Audi': 'RM-KS', 'KS-Audi': 'RM-KS', 'KS Auditorium': 'RM-KS', 'KS AUDI': 'RM-KS',
    'APJ Abdul Kalam Audi': 'RM-APJ', 'APJ-Abdul kalam-Audi': 'RM-APJ', 'APJ': 'RM-APJ',
    'D-412': 'RM-0185', 'D412': 'RM-0185',
    'D-404': 'RM-0042',
    'D-104': 'RM-0007', 'D-313': 'RM-0171', 'D-304': 'RM-0026',
    'D -215': 'RM-0155', 'D - 215': 'RM-0155', 'D-215': 'RM-0155',
    'D-203': 'RM-0087',
    'C-208': 'RM-0224', 'C - 208': 'RM-0224',
    'C-007': 'RM-0174', 'C-212': null,
    'A-306': 'RM-0201', 'A-007': 'RM-0173',
    'E507': null, 'E-507': null, 'E233': null, 'E-A013': null,
  };
  
  const getResourceId = (roomNo) => {
    if (!roomNo) return null;
    let clean = roomNo.trim()
      .replace(/\s*w\.?e\.?f\.?\s*:?\s*[\d./-]+$/i, '')
      .replace(/\s*`$/g, '').replace(/\s*'$/g, '').trim();
    if (!clean || clean === '-') return null;
    if (clean.startsWith('Professional Elective')) return null; // Not a room
    
    // Check explicit aliases first
    if (ROOM_ALIASES[clean]) return ROOM_ALIASES[clean];
    
    const key = clean.toLowerCase().replace(/[\s\-\/()]/g, '');
    if (resourceMap[key]) return resourceMap[key];
    
    const baseClean = clean.replace(/\s*\([^)]*\)\s*$/, '').toLowerCase().replace(/[\s\-\/]/g, '');
    if (resourceMap[baseClean]) return resourceMap[baseClean];
    
    return null;
  };
  
  // Parse the SQL file
  const fileStream = fs.createReadStream('./vnrvjiet_timetables_2026_27O.sql');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  
  const sections = {};
  const legends = {};
  const grids = [];
  
  let currentInsertType = null; // 'grid' or 'legend'
  let accumulatedLine = '';
  
  for await (const rawLine of rl) {
    const line = rawLine.trim();
    
    // Skip blank lines and comments - don't reset state
    if (!line || line.startsWith('--')) continue;
    
    // Detect INSERT statements
    if (rawLine.includes('INSERT INTO class_sections')) {
      currentInsertType = null;
      const valMatch = rawLine.match(/VALUES\s*\((.+)\);$/i);
      if (valMatch) {
        const parts = parseSQLValues(valMatch[1]);
        if (parts.length >= 16) {
          const id = parseInt(parts[0]);
          sections[id] = {
            dept: parts[2], branchName: parts[3],
            year: parseYear(parts[7]), section: parts[9],
            roomNo: parts[10], tableKind: parts[15]
          };
        }
      }
      continue;
    }
    
    if (rawLine.includes('INSERT INTO timetable_grid')) {
      currentInsertType = 'grid';
      continue;
    }
    
    if (rawLine.includes('INSERT INTO course_legend')) {
      currentInsertType = 'legend';
      continue;
    }
    
    // Any other INSERT or COMMIT/BEGIN resets state
    if (line.startsWith('INSERT INTO') || line === 'COMMIT;' || line === 'BEGIN;') {
      currentInsertType = null;
      continue;
    }
    
    // Parse data rows
    if (!currentInsertType) continue;
    if (!line.startsWith('(')) continue;
    
    // Accumulate multi-line entries
    if (accumulatedLine) {
      accumulatedLine += ' ' + line;
    } else {
      accumulatedLine = line;
    }
    
    // Check if entry is complete (ends with ), or );)
    if (!accumulatedLine.endsWith('),') && !accumulatedLine.endsWith(');')) {
      continue; // Need more lines
    }
    
    // Parse the complete entry
    const fullLine = accumulatedLine;
    accumulatedLine = '';
    
    const valStr = fullLine.replace(/^\(/, '').replace(/\)\s*[,;]\s*$/, '');
    const parts = parseSQLValues(valStr);
    
    if (currentInsertType === 'grid') {
      if (parts.length >= 6) {
        const sectionId = parseInt(parts[0]);
        const dayOfWeek = parts[1];
        const startTime = parts[3];
        const endTime = parts[4];
        const entryText = parts[5];
        if (dayOfWeek && startTime && endTime && entryText) {
          grids.push({ sectionId, dayOfWeek, startTime, endTime, entryText });
        }
      }
    } else if (currentInsertType === 'legend') {
      if (parts.length >= 6) {
        const secId = parseInt(parts[0]);
        const peGroup = parts[1];
        const courseCode = parts[2];
        const courseName = parts[3];
        const roomNo = parts[4];
        const facultyName = parts[5];
        if (courseCode && courseName) {
          if (!legends[secId]) legends[secId] = [];
          legends[secId].push({ peGroup, courseCode, courseName, roomNo, facultyName });
        }
      }
    }
  }
  
  console.log(`Parsed ${Object.keys(sections).length} sections, ${grids.length} grid entries, ${Object.keys(legends).length} sections with legends.`);
  
  // Count by table_kind
  const kindCounts = {};
  for (const s of Object.values(sections)) {
    kindCounts[s.tableKind] = (kindCounts[s.tableKind] || 0) + 1;
  }
  console.log('Section types:', kindCounts);
  
  // Filter to 'class' type
  // IMPORTING ALL TYPES: class, faculty, lab, room
  console.log(`Using ALL ${Object.keys(sections).length} sections (class + faculty + lab + room).`);
  
  const resolveDeptId = (section) => {
    const { dept, branchName } = section;
    if (dept === 'I-YEAR') {
      const mapped = BRANCH_NAME_MAP[branchName];
      if (mapped && deptByCode[mapped]) return deptByCode[mapped];
      if (deptByCode[branchName]) return deptByCode[branchName];
      return null;
    }
    
    const refined = BRANCH_NAME_MAP[branchName];
    if (refined && deptByCode[refined]) return deptByCode[refined];
    if (deptByCode[branchName]) return deptByCode[branchName];
    
    const mapped = DEPT_MAP[dept];
    if (mapped && deptByCode[mapped]) return deptByCode[mapped];
    if (deptByCode[dept]) return deptByCode[dept];
    return null;
  };
  
  // Build timetable entries
  const insertData = [];
  const unmappedDepts = new Set();
  const unmappedRooms = new Set();
  let stats = { total: 0, skippedNoSection: 0, skippedLunch: 0, skippedNoDept: 0 };
  
  for (const grid of grids) {
    stats.total++;
    const section = sections[grid.sectionId];
    if (!section) { stats.skippedNoSection++; continue; }
    
    const entryLower = grid.entryText.toLowerCase().trim();
    if (entryLower === 'lunch' || entryLower === 'break' || entryLower === 'null' || !grid.entryText.trim()) {
      stats.skippedLunch++;
      continue;
    }
    
    const departmentId = resolveDeptId(section);
    if (!departmentId) {
      unmappedDepts.add(`${section.dept} | ${section.branchName}`);
      stats.skippedNoDept++;
      continue;
    }
    
    const startTime = parseTime(grid.startTime);
    const endTime = parseTime(grid.endTime);
    if (!startTime || !endTime) continue;
    
    const courseCode = grid.entryText.trim();
    const sectionLegends = legends[grid.sectionId] || [];
    
    let facultyName = null;
    let courseName = null;
    let resourceId = null;
    
    // Find matching legend
    // Better matching logic: Avoid false positives where "AEE Lab" substring-matches "AEE"
    const gridCodes = courseCode.split('/').map(c => c.trim()).filter(Boolean);
    const legend = sectionLegends.find(l => {
      if (!l.courseName) return false;
      const shortMatch = l.courseName.match(/\(([^)]+)\)$/);
      const shortCode = shortMatch ? shortMatch[1].trim() : null;
      
      return gridCodes.some(gc => {
        if (l.courseCode === gc) return true;
        if (shortCode && shortCode === gc) return true;
        // Exact word match to avoid "AEE Lab" matching "AEE"
        const gcWords = gc.split(/\s+/);
        if (gcWords.includes(l.courseCode)) return true;
        if (shortCode && gcWords.includes(shortCode)) return true;
        return false;
      });
    });
    
    if (legend) {
      facultyName = legend.facultyName;
      const nameMatch = legend.courseName.match(/^(.*?)\s*\([^)]+\)$/);
      courseName = nameMatch ? nameMatch[1].trim() : legend.courseName;
      
      if (legend.roomNo) {
        const rooms = legend.roomNo.split(/[&\/]/).map(r => r.trim()).filter(Boolean);
        if (rooms.length > 1) {
          const roomIds = [...new Set(rooms.map(r => getResourceId(r)).filter(Boolean))];
          for (const rid of roomIds) {
            insertData.push({
              resourceId: rid, departmentId, dayOfWeek: grid.dayOfWeek,
              startTime, endTime, courseCode, courseName,
              section: section.section, academicYear: '2026-27',
              facultyName, studentYear: section.year, uploadedByUserId: 1
            });
          }
          if (roomIds.length > 0) continue;
          // If no rooms matched, fall through to default room
        }
        
        const rid = getResourceId(rooms[0]);
        if (rid) resourceId = rid;
        else unmappedRooms.add(rooms[0]);
      }
    }
    
    if (!resourceId && section.roomNo) {
      resourceId = getResourceId(section.roomNo);
      if (!resourceId) unmappedRooms.add(section.roomNo);
    }
    
    insertData.push({
      resourceId, departmentId, dayOfWeek: grid.dayOfWeek,
      startTime, endTime, courseCode, courseName,
      section: section.section, academicYear: '2026-27',
      facultyName, studentYear: section.year, uploadedByUserId: 1
    });
  }
  
  console.log(`\n=== IMPORT SUMMARY ===`);
  console.log(`Total grid entries: ${stats.total}`);
  console.log(`Skipped (no section match): ${stats.skippedNoSection}`);
  console.log(`Skipped (lunch/break/null): ${stats.skippedLunch}`);
  console.log(`Skipped (unmapped dept): ${stats.skippedNoDept}`);
  console.log(`Ready to insert: ${insertData.length} rows`);
  if (unmappedDepts.size > 0) { console.log(`\nUnmapped depts:`); for (const d of unmappedDepts) console.log(`  - ${d}`); }
  if (unmappedRooms.size > 0) { console.log(`\nUnmapped rooms (${unmappedRooms.size}):`); for (const r of unmappedRooms) console.log(`  - ${r}`); }
  
  // First clear existing timetable
  console.log('\nClearing existing timetable...');
  await prisma.timetable.deleteMany({});
  
  // Insert in batches
  const BATCH_SIZE = 500;
  let inserted = 0;
  for (let i = 0; i < insertData.length; i += BATCH_SIZE) {
    const batch = insertData.slice(i, i + BATCH_SIZE);
    for (const row of batch) {
      try {
        await prisma.timetable.create({ data: row });
      } catch (e) {
        console.log('FAILED ROW:', JSON.stringify(row));
        process.exit(1);
      }
    }
    inserted += batch.length;
    if ((i / BATCH_SIZE) % 5 === 0) console.log(`  Inserted: ${inserted}/${insertData.length}`);
  }
  
  console.log(`\n=== DONE: Inserted ${inserted} timetable rows ===`);
  
  // Verify
  const total = await prisma.timetable.count();
  const nullRes = await prisma.timetable.count({ where: { resourceId: null } });
  const withName = await prisma.timetable.count({ where: { courseName: { not: null } } });
  console.log(`Total rows: ${total}`);
  console.log(`Rows with NULL resource: ${nullRes}`);
  console.log(`Rows with course_name: ${withName}`);
  
  const byYear = await prisma.$queryRaw`SELECT student_year, COUNT(*)::int as c FROM timetable GROUP BY student_year ORDER BY student_year`;
  console.log('\nBy year:', JSON.stringify(byYear));
  
  const byDept = await prisma.$queryRaw`SELECT d.branch_code, COUNT(t.timetable_id)::int as c FROM departments d LEFT JOIN timetable t ON d.department_id = t.department_id GROUP BY d.branch_code HAVING COUNT(t.timetable_id) > 0 ORDER BY c DESC`;
  console.log('\nBy department:', JSON.stringify(byDept));
  
  // Verify bookings and resources are untouched
  const resCount = await prisma.resource.count();
  const bookCount = await prisma.booking.count();
  console.log(`\nResources (should be 323): ${resCount}`);
  console.log(`Bookings (should be unchanged): ${bookCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
