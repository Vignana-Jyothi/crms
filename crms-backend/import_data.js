const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const prisma = new PrismaClient();

const deptMap = {
  'AE': 22,
  'CE': 23,
  'CSE': 5,
  'DS': 9,
  'CYS': 10,
  'AIML': 7,
  'EIE': 12,
  'ECE': 4,
  'EEE': 2,
  'AI&DS': 11,
  'IoT': 8,
  'IT': 13
};

const parseTime = (timeStr) => {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/(\d{1,2})\.(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `1970-01-01T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`;
};

async function main() {
  const sections = {};
  const legends = {};
  const grids = [];

  await new Promise((resolve) => {
    fs.createReadStream('./class_sections.csv')
      .on('error', () => resolve())
      .pipe(csv())
      .on('data', (row) => sections[row.section_id] = row)
      .on('end', resolve);
  });
  
  if (Object.keys(sections).length === 0) {
    console.log("No sections found, ensure CSV is in ./");
  }

  await new Promise((resolve) => {
    fs.createReadStream('./course_legend.csv')
      .on('error', () => resolve())
      .pipe(csv())
      .on('data', (row) => {
        if (!legends[row.section_id]) legends[row.section_id] = [];
        legends[row.section_id].push(row);
      })
      .on('end', resolve);
  });

  await new Promise((resolve) => {
    fs.createReadStream('./timetable_grid.csv')
      .on('error', () => resolve())
      .pipe(csv())
      .on('data', (row) => grids.push(row))
      .on('end', resolve);
  });

  console.log(`Loaded ${Object.keys(sections).length} sections, ${grids.length} grids.`);

  const resources = await prisma.resource.findMany();
  const resourceMap = {};
  resources.forEach(r => {
    resourceMap[r.resourceName.toLowerCase().replace(/\s+/g, '')] = r.resourceId;
  });

  const getResourceId = (roomNo) => {
    if (!roomNo) return null;
    let normalized = roomNo.toLowerCase().replace(/-/g, '').replace(/\s+/g, '');
    return resourceMap[normalized] || null;
  };

  console.log('Deleting old 3rd and 4th year timetables...');
  await prisma.timetable.deleteMany({
    where: { studentYear: { in: ['3', '4'] } }
  });

  const insertData = [];

  for (const grid of grids) {
    const section = sections[grid.section_id];
    if (!section) continue;

    const studentYear = section.class_year === 'IV Year' ? '4' : section.class_year === 'III Year' ? '3' : null;
    const departmentId = deptMap[section.department] || null;

    if (!studentYear || !departmentId) continue;
    if (!grid.start_time || !grid.end_time || grid.day_of_week === 'LUNCH' || grid.period_no === 'BREAK') continue;

    let courseCode = grid.entry_text.trim();
    let facultyName = null;
    let resourceId = getResourceId(section.room_no);

    const sectionLegends = legends[grid.section_id] || [];
    const legend = sectionLegends.find(l => 
      l.course_code === courseCode || 
      courseCode.includes(l.course_code) ||
      (l.course_name && courseCode.includes(l.course_name.split('(')[0].trim())) ||
      (l.course_name && l.course_name.includes(`(${courseCode})`))
    );

    if (legend) {
      facultyName = legend.faculty_name;
      if (legend.room_no) {
        const labRoom = getResourceId(legend.room_no.split('/')[0].trim());
        if (labRoom) resourceId = labRoom;
      }
    }

    insertData.push({
      resourceId,
      departmentId,
      dayOfWeek: grid.day_of_week,
      startTime: parseTime(grid.start_time),
      endTime: parseTime(grid.end_time),
      courseCode,
      section: section.section,
      academicYear: section.academic_year,
      facultyName,
      studentYear,
      uploadedByUserId: 1
    });
  }

  console.log(`Inserting ${insertData.length} new timetables...`);
  if (insertData.length > 0) {
    await prisma.timetable.createMany({
      data: insertData,
      skipDuplicates: true
    });
  }
  console.log('Done!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
