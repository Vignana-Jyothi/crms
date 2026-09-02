const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  // Fix course codes to be acronyms (for Civil Engineering departmentId = 31)
  const timetables = await prisma.timetable.findMany({
    where: { departmentId: 31 }
  });

  const courseCodeMap = {
    "25BS1MT201": "P&S",
    "25PC1CE201": "SM",
    "25PC1CE202": "CT",
    "25PC1CE203": "FM",
    "25ES1AM101": "CPDS",
    "25BS2MT211": "CMT LAB",
    "25PC2CE201": "SM LAB",
    "25PC2CE202": "CT LAB",
    "25ES2AM101": "CPDS LAB",
    "25SD5CE201": "AS LAB",
    "25MN6HS103": "H&W",
    
    // 3rd year
    "22PC1CE301": "DRCS",
    "22PC1CE302": "WRE",
    "22PC1CE303": "E&C",
    "22PE1CE301": "PE-1",
    "22PC2CE311": "EG LAB",
    "22SD5CE301": "IDACE LAB",
    "22MN6HS301": "AW",
    "22HS2EN301": "AECS LAB",
    
    // 4th year
    "22PC1CE401": "FE",
    "22PC1CE402": "I&E",
    "22PE1CE405": "CTPM",
    "22PC2CE411": "CAD STUDIO LAB",
    "22PC2CE306": "EE LAB",
    "22PW4CE401": "Project-1",
  };

  // Get all resources to map room name to resourceId
  const resources = await prisma.resource.findMany();
  
  // Create a normalized map for matching
  const resourceMap = {};
  for (const r of resources) {
    const cleanName = r.resourceName.replace(/ /g, '').toLowerCase();
    resourceMap[cleanName] = r.resourceId;
    
    // Some are like D104/1 or D-104/1
    const dashName = r.resourceName.replace(/ /g, '-').toLowerCase();
    resourceMap[dashName] = r.resourceId;
  }

  let updatedCount = 0;

  for (const t of timetables) {
    let newCourseCode = t.courseCode;
    let newFacultyName = t.facultyName;
    let newResourceId = t.resourceId;

    // 1. Fix Course Code
    if (courseCodeMap[t.courseCode]) {
      newCourseCode = courseCodeMap[t.courseCode];
    } else if (t.courseCode === "" && t.courseName) {
      newCourseCode = t.courseName.substring(0, 15); // Fallback for things like TRAINING, MENTORING
    }

    // 2. Fix Resource ID & Faculty Name
    // Pattern: "Room: D-102 | Dr. G. Gangadhar"
    const match = t.facultyName?.match(/^Room:\s*(.+?)\s*\|\s*(.+)$/i);
    if (match) {
      const roomStr = match[1];
      const actualFaculty = match[2];
      
      newFacultyName = actualFaculty;
      
      const lookup1 = roomStr.replace(/ /g, '').replace(/-/g, '').toLowerCase(); // d102
      const lookup2 = roomStr.replace(/-/g, '').toLowerCase();
      
      // Find matching resource
      const res = resources.find(r => 
        r.resourceName.replace(/ /g, '').replace(/-/g, '').toLowerCase() === lookup1
      );
      
      if (res) {
        newResourceId = res.resourceId;
      }
    }

    // Update if changed
    if (t.courseCode !== newCourseCode || t.facultyName !== newFacultyName || t.resourceId !== newResourceId) {
      await prisma.timetable.update({
        where: { timetableId: t.timetableId },
        data: {
          courseCode: newCourseCode,
          facultyName: newFacultyName,
          resourceId: newResourceId
        }
      });
      updatedCount++;
    }
  }

  console.log(`Successfully updated ${updatedCount} timetable entries!`);
}

run()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
