const { exec } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function extractTextFromFile(file) {
  if (!file || !file.buffer) {
    throw new Error('No file provided for extraction.');
  }

  const tempDir = os.tmpdir();
  const fileExt = file.originalname ? path.extname(file.originalname) : '.png';
  const tempFilePath = path.join(tempDir, `${crypto.randomUUID()}${fileExt}`);
  
  try {
    await fs.writeFile(tempFilePath, file.buffer);
    
    // Path to the python script
    const scriptPath = path.join(__dirname, 'timetable_ocr.py');
    // If we're inside the docker container, use the venv python
    const pythonPath = process.env.PATH && process.env.PATH.includes('/opt/venv/bin') ? 'python3' : '/opt/venv/bin/python3';
    
    const command = `${pythonPath} "${scriptPath}" "${tempFilePath}" --print`;
    
    const output = await new Promise((resolve, reject) => {
      exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error) {
          console.error("Python script error:", error);
          console.error("stderr:", stderr);
          // Return a mock JSON so the error is visible in the UI grid
          const errStr = (stderr || error.message || "Unknown error").substring(0, 500).replace(/\n/g, ' | ');
          resolve(JSON.stringify([{
            page: 1,
            metadata: { Section: 'Debug' },
            timetables: [{
              columns: [{period: 1, start: "00:00", end: "00:00", is_break: false}],
              days: { "Monday": [{periods: [1], start: "00:00", end: "00:00", subject: `PYTHON ERROR: ${errStr}`}] }
            }],
            course_tables: []
          }]));
        } else {
          resolve(stdout);
        }
      });
    });

    return output;
  } finally {
    try {
      await fs.unlink(tempFilePath);
    } catch (e) {
      // ignore unlink errors
    }
  }
}

async function parseTextToTimetable(rawOutput, context) {
  let parsedJson;
  try {
    parsedJson = JSON.parse(rawOutput);
  } catch (err) {
    console.error("Failed to parse Python JSON output:", err);
    return [];
  }

  const finalRecords = [];
  if (!parsedJson || parsedJson.length === 0) return finalRecords;

  for (const page of parsedJson) {
    // 1. Resolve Global Section
    let metaSection = context.section || '';
    if (!metaSection && page.metadata) {
       for (const [k, v] of Object.entries(page.metadata)) {
         if (k.toLowerCase().includes('section')) {
           // User preference: if blank, treat as one section
           metaSection = v.trim() ? `Sec ${v.trim()}` : '';
           break;
         }
       }
    }

    // 2. Resolve Global Year
    let metaYear = context.studentYear || '';
    if (!metaYear && page.metadata) {
      for (const [k, v] of Object.entries(page.metadata)) {
        if (k.toLowerCase().includes('class') || k.toLowerCase().includes('year')) {
          const valLower = v.toLowerCase();
          if (valLower.includes('i ') || valLower.includes('1st') || valLower.includes('it')) metaYear = '1';
          if (valLower.includes('ii ') || valLower.includes('2nd')) metaYear = '2';
          if (valLower.includes('iii') || valLower.includes('3rd')) metaYear = '3';
          if (valLower.includes('iv') || valLower.includes('4th')) metaYear = '4';
        }
      }
    }

    // 3. Resolve Global Department
    let metaDepartmentId = context.departmentId || null;
    if (!metaDepartmentId && page.metadata) {
      for (const [k, v] of Object.entries(page.metadata)) {
        if (k.toLowerCase().includes('branch') || k.toLowerCase().includes('department')) {
          const val = v.trim();
          if (val) {
            // Find by exact name, or partial match
            const dept = await prisma.department.findFirst({
              where: {
                OR: [
                  { departmentName: { equals: val, mode: 'insensitive' } },
                  { branchCode: { equals: val, mode: 'insensitive' } }
                ]
              }
            });
            if (dept) metaDepartmentId = dept.departmentId;
            else {
              // Fuzzy match fallback (e.g. "Computer Science and Business Systems" -> "CSBS")
              const words = val.split(/\s+/);
              const initials = words.map(w => w[0]).join('').toUpperCase();
              const deptInitials = await prisma.department.findFirst({
                where: { branchCode: { equals: initials, mode: 'insensitive' } }
              });
              if (deptInitials) metaDepartmentId = deptInitials.departmentId;
            }
          }
        }
      }
    }

    // 4. Resolve Global Classroom (Room No)
    let globalRoomId = null;
    if (page.metadata) {
      for (const [k, v] of Object.entries(page.metadata)) {
        if (k.toLowerCase().includes('room') || k.toLowerCase().includes('roon')) {
          const val = v.trim();
          if (val) {
            let formattedRoom = val;
            let m = formattedRoom.match(/^([a-zA-Z])\s*(\d+.*)$/);
            if (m) formattedRoom = `${m[1].toUpperCase()} ${m[2]}`;

            const res = await prisma.resource.findFirst({
              where: { 
                resourceType: { typeName: 'CLASSROOM' },
                OR: [
                  { resourceName: { equals: formattedRoom, mode: 'insensitive' } },
                  { resourceId: { equals: formattedRoom, mode: 'insensitive' } },
                  { resourceName: { equals: val, mode: 'insensitive' } }
                ]
              }
            });
            if (res) globalRoomId = res.resourceId;
          }
        }
      }
    }
    
    // Map course tables (acronyms to faculty/resource)
    const courseMap = {};
    if (page.course_tables) {
      for (const ct of page.course_tables) {
        if (ct.tables) {
          for (const tbl of ct.tables) {
            for (const rec of tbl) {
              let name = '';
              let code = '';
              let faculty = '';
              let roomName = '';
              for (const [k, v] of Object.entries(rec)) {
                const kLower = k.toLowerCase();
                
                // Faculty matching
                if (kLower.includes('faculty') || kLower.includes('coordinator') || (kLower.includes('name of the') && !kLower.includes('course') && !kLower.includes('subject'))) {
                  faculty = v;
                }
                // Room matching
                else if (kLower.includes('room') || kLower.includes('class')) {
                  roomName = v;
                }
                // Course Code matching
                else if (kLower.includes('code')) {
                  code = v;
                }
                // Course Name matching
                else if (kLower.includes('name') || kLower.includes('title') || kLower.includes('subject') || kLower.includes('course')) {
                  name = v;
                }
              }

              // Compute initials of the course name for fallback matching
              let clean = name.replace(/\([^)]*\)/g, '').trim();
              let initials = clean.split(/[\s\-_]+/).map(w => w[0]).join('').toUpperCase();
              
              // Resolve room ID for this specific course if present
              let mappedRoomId = globalRoomId;
              if (roomName && roomName.trim()) {
                let formattedRoom = roomName.trim();
                let m = formattedRoom.match(/^([a-zA-Z])\s*(\d+.*)$/);
                if (m) formattedRoom = `${m[1].toUpperCase()} ${m[2]}`;

                const res = await prisma.resource.findFirst({
                  where: { 
                    resourceType: { typeName: 'CLASSROOM' },
                    OR: [
                      { resourceName: { equals: formattedRoom, mode: 'insensitive' } },
                      { resourceId: { equals: formattedRoom, mode: 'insensitive' } },
                      { resourceName: { equals: roomName.trim(), mode: 'insensitive' } }
                    ]
                  }
                });
                if (res) mappedRoomId = res.resourceId;
              }
              
              if (name) {
                // If the name has an acronym like (DBMS), use that
                const acronymMatch = name.match(/\(([A-Za-z0-9\-\s]+)\)/);
                if (acronymMatch) {
                  const acronym = acronymMatch[1].trim().toUpperCase();
                  courseMap[acronym] = { courseName: name, facultyName: faculty, roomId: mappedRoomId };
                }
                courseMap[name.toUpperCase()] = { courseName: name, facultyName: faculty, roomId: mappedRoomId };
                if (initials && initials.length > 1) {
                  courseMap[initials] = { courseName: name, facultyName: faculty, roomId: mappedRoomId };
                }
              }
            }
          }
        }
      }
    }
    
    if (page.timetables) {
      for (const tt of page.timetables) {
        const days = tt.days || {};
        for (const [day, entries] of Object.entries(days)) {
          for (const entry of entries) {
            const subject = entry.subject;
            if (subject.toLowerCase() === 'lunch') continue; // Skip lunch breaks
            
            // Try to find mapping for faculty/room
            let facultyName = '';
            let resourceId = globalRoomId; // default to global room
            
            // Attempt to match the exact acronym or subject from the course map
            if (entry.options && entry.options.length > 0) {
              for (const opt of entry.options) {
                if (courseMap[opt.toUpperCase()]) {
                  facultyName = courseMap[opt.toUpperCase()].facultyName || facultyName;
                  if (courseMap[opt.toUpperCase()].roomId) resourceId = courseMap[opt.toUpperCase()].roomId;
                  break;
                }
              }
            }
            
            if (!facultyName && courseMap[subject.toUpperCase()]) {
               facultyName = courseMap[subject.toUpperCase()].facultyName || facultyName;
               if (courseMap[subject.toUpperCase()].roomId) resourceId = courseMap[subject.toUpperCase()].roomId;
            }

            // Clean up faculty name (remove "Mr.", "Mrs.", "Dr." prefixes to help frontend match)
            if (facultyName) {
               // Many times frontend might match exact name without prefixes, or vice-versa
               // We will pass it as-is for now, but ensure no trailing slashes.
               facultyName = facultyName.split('/')[0].trim();
            }

            // Convert 12-hour "09:00 AM" to 24-hour "09:00" for input type="time"
            let startTime = entry.start;
            let endTime = entry.end;
            
            const convertTime = (timeStr) => {
              if (!timeStr) return '';
              const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
              if (match) {
                let h = parseInt(match[1], 10);
                const m = match[2];
                const ampm = match[3].toUpperCase();
                if (ampm === 'PM' && h < 12) h += 12;
                if (ampm === 'AM' && h === 12) h = 0;
                return `${h.toString().padStart(2, '0')}:${m}`;
              }
              return timeStr;
            };

            finalRecords.push({
              id: `extracted-${Date.now()}-${Math.random()}`,
              dayOfWeek: day,
              startTime: convertTime(startTime),
              endTime: convertTime(endTime),
              courseName: subject,
              section: metaSection,
              departmentId: metaDepartmentId,
              studentYear: metaYear,
              facultyName: facultyName,
              resourceId: resourceId
            });
          }
        }
      }
    }
    
    // Add a debug row to see what python parsed for the metadata and course table
    finalRecords.push({
      id: `debug-${Date.now()}`,
      dayOfWeek: 'Debug',
      startTime: '00:00',
      endTime: '00:00',
      courseName: `Meta: ${JSON.stringify(page.metadata || {})}`,
      facultyName: `Courses: ${JSON.stringify(page.course_tables || [])}`.substring(0, 150),
      section: '',
      departmentId: null,
      studentYear: '',
      resourceId: ''
    });
  }
  
  return finalRecords;
}

module.exports = {
  extractTextFromFile,
  parseTextToTimetable
};
