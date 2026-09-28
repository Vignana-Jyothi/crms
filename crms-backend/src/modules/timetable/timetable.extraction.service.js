const { exec } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

async function extractTextFromFile(file) {
  if (!file || !file.buffer) {
    throw new Error('No file provided for extraction.');
  }

  const tempDir = os.tmpdir();
  const fileExt = file.originalname ? path.extname(file.originalname) : '.png';
  const tempFilePath = path.join(tempDir, `${uuidv4()}${fileExt}`);
  
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
          reject(new Error(`Extraction failed: ${stderr || error.message}`));
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

function parseTextToTimetable(rawOutput, context) {
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
    let metaSection = context.section || '';
    if (!metaSection && page.metadata) {
       for (const [k, v] of Object.entries(page.metadata)) {
         if (k.toLowerCase().includes('section')) {
           metaSection = v === '--' ? '' : `Sec ${v}`;
           break;
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
              const code = rec['Course Code'] || '';
              const name = rec['Name of the Course'] || rec['Course Name'] || '';
              
              let faculty = '';
              let room = '';
              for (const [k, v] of Object.entries(rec)) {
                if (k.toLowerCase().includes('faculty') || k.toLowerCase().includes('coordinator')) faculty = v;
                if (k.toLowerCase().includes('room')) room = v;
              }
              
              if (name) {
                // If the name has an acronym like (DBMS), use that
                const acronymMatch = name.match(/\(([A-Za-z0-9\-\s]+)\)/);
                if (acronymMatch) {
                  const acronym = acronymMatch[1].trim().toUpperCase();
                  courseMap[acronym] = { courseName: name, facultyName: faculty, roomNo: room };
                }
                courseMap[name.toUpperCase()] = { courseName: name, facultyName: faculty, roomNo: room };
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
            
            // Try to find mapping for faculty/room
            let facultyName = '';
            let resourceIdStr = '';
            
            if (entry.options && entry.options.length > 0) {
              for (const opt of entry.options) {
                if (courseMap[opt.toUpperCase()]) {
                  facultyName = courseMap[opt.toUpperCase()].facultyName;
                  resourceIdStr = courseMap[opt.toUpperCase()].roomNo;
                  break;
                }
              }
            }
            
            if (!facultyName && courseMap[subject.toUpperCase()]) {
               facultyName = courseMap[subject.toUpperCase()].facultyName;
               resourceIdStr = courseMap[subject.toUpperCase()].roomNo;
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
              departmentId: context.departmentId || null,
              studentYear: context.studentYear || '',
              facultyName: facultyName,
              resourceId: resourceIdStr
            });
          }
        }
      }
    }
  }
  
  return finalRecords;
}

module.exports = {
  extractTextFromFile,
  parseTextToTimetable
};
