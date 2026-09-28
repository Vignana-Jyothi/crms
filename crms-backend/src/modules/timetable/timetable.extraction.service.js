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
            rows: [{
              "Day": "Monday",
              "Start Time": "00:00",
              "End Time": "00:00",
              "Subject": `PYTHON ERROR: ${errStr}`,
              "Year": "", "Dept": "", "Section": "", "Faculty": "", "Classroom": ""
            }]
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
    let jsonStr = rawOutput;
    
    // The python script might print warnings (e.g. from OpenCV or Tesseract) at the top,
    // and status messages like "[..] filename.pdf" or "[ok] filename.json" at the ends.
    // Since the actual JSON output is a list of objects, we can extract it cleanly:
    
    // 1. Strip everything before the first `[` that is followed by `{`
    jsonStr = jsonStr.replace(/^.*?(\[\s*\{)/s, '$1');
    
    // 2. Strip everything after the last `]` that is preceded by `}`
    // We use match and substring here because replacing from the end with regex can be tricky
    const lastBracketMatch = jsonStr.match(/\}\s*\](?![^]*\}\s*\])/); 
    if (lastBracketMatch) {
      jsonStr = jsonStr.substring(0, lastBracketMatch.index + lastBracketMatch[0].length);
    }

    parsedJson = JSON.parse(jsonStr);
  } catch (err) {
    console.error("Failed to parse Python JSON output:", err);
    console.error("Raw output was:", rawOutput.substring(0, 500));
    return [];
  }

  const finalRecords = [];
  if (!parsedJson || parsedJson.length === 0) return finalRecords;

  for (const page of parsedJson) {
    if (!page.rows || page.rows.length === 0) continue;

    for (const row of page.rows) {
      // 1. Resolve Section
      let metaSection = context.section || '';
      if (!metaSection && row['Section']) {
        metaSection = row['Section'].trim() === 'A' ? '' : `Sec ${row['Section'].trim()}`;
        if (!metaSection && row['Section'].trim() !== 'A') {
            metaSection = `Sec ${row['Section'].trim()}`;
        }
      }

      // 2. Resolve Year
      let metaYear = context.studentYear || '';
      if (!metaYear && row['Year']) {
        metaYear = String(row['Year']).trim();
      }

      // 3. Resolve Department
      let metaDepartmentId = context.departmentId || null;
      if (!metaDepartmentId && row['Dept']) {
        const val = row['Dept'].trim();
        const dept = await prisma.department.findFirst({
          where: {
            OR: [
              { departmentName: { equals: val, mode: 'insensitive' } },
              { branchCode: { equals: val, mode: 'insensitive' } }
            ]
          }
        });
        if (dept) metaDepartmentId = dept.departmentId;
      }

      // 4. Resolve Classroom (Room No)
      let resourceId = null;
      if (row['Classroom']) {
        const val = row['Classroom'].trim();
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
                { resourceName: { equals: val, mode: 'insensitive' } },
                { resourceId: { equals: val, mode: 'insensitive' } }
              ]
            }
          });
          if (res) resourceId = res.resourceId;
        }
      }

      // 5. Clean and Map Faculty Name
      let facultyName = '';
      if (row['Faculty']) {
        const val = row['Faculty'].split('/')[0].trim();
        
        // Fetch the global faculty list dynamically from the repository
        const facultyList = await require('../masterData/masterData.repository').listFaculty();
        const facultyNames = facultyList.map(f => f.name);

        const exactMatch = facultyNames.find(f => f.toLowerCase() === val.toLowerCase());
        if (exactMatch) {
          facultyName = exactMatch;
        } else {
          // Substring match to handle "M. Rakesh" vs "Mr. M. Rakesh"
          const subMatch = facultyNames.find(f => 
             f.toLowerCase().includes(val.toLowerCase()) || 
             val.toLowerCase().includes(f.toLowerCase())
          );
          facultyName = subMatch ? subMatch : val;
        }
      }

      // 6. Convert Time
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
        dayOfWeek: row['Day'],
        startTime: convertTime(row['Start Time']),
        endTime: convertTime(row['End Time']),
        courseName: row['Subject'],
        section: metaSection,
        departmentId: metaDepartmentId,
        studentYear: metaYear,
        facultyName: facultyName,
        resourceId: resourceId
      });
    }
  }

  return finalRecords;
}

module.exports = {
  extractTextFromFile,
  parseTextToTimetable
};
