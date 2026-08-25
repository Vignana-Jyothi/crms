const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TRANSCRIPT_PATH = 'C:\\Users\\pavan\\.gemini\\antigravity\\brain\\910be632-037c-429e-b9f4-9c891eb08244\\.system_generated\\logs\\transcript_full.jsonl';

// Time slots mapping based on the PDF header
const TIME_SLOTS = [
  { startTime: '1970-01-01T09:00:00Z', endTime: '1970-01-01T10:00:00Z' }, // 1
  { startTime: '1970-01-01T10:00:00Z', endTime: '1970-01-01T11:00:00Z' }, // 2
  { startTime: '1970-01-01T11:00:00Z', endTime: '1970-01-01T12:00:00Z' }, // 3
  { startTime: '1970-01-01T12:40:00Z', endTime: '1970-01-01T13:40:00Z' }, // 4
  { startTime: '1970-01-01T13:40:00Z', endTime: '1970-01-01T14:40:00Z' }, // 5
  { startTime: '1970-01-01T14:40:00Z', endTime: '1970-01-01T15:40:00Z' }, // 6
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function main() {
  console.log('Extracting OCR from transcript...');
  const lines = fs.readFileSync(TRANSCRIPT_PATH, 'utf-8').split('\n');
  
  let ocrContent = '';
  for (const line of lines) {
    if (line.includes('==Start of OCR for page 1==')) {
      // Just extract the raw content string if it matches
      try {
        const obj = JSON.parse(line);
        if (obj.content) {
          ocrContent = obj.content;
        }
      } catch (e) {
        // Fallback if not JSON but contains the string
        ocrContent = line;
      }
    }
  }

  if (!ocrContent) {
    console.error('Could not find OCR content in transcript.');
    return;
  }

  // Split by pages
  const pages = ocrContent.split(/==Start of OCR for page \d+==/).slice(1);
  console.log(`Found ${pages.length} pages of OCR text.`);

  const finalRecords = [];
  
  // Try to find matching department ID for a branch
  const depts = await prisma.department.findMany();

  for (let p = 0; p < pages.length; p++) {
    let text = pages[p];
    text = text.split(/==End of OCR for page \d+==/)[0].trim();

    // Extract metadata
    const branchMatch = text.match(/Branch:\s*([A-Za-z& ]+)/i);
    const sectionMatch = text.match(/Section:\s*([A-Za-z0-9])/i);
    const roomMatch = text.match(/Class Room No:\s*([A-Z0-9\-]+)/i);

    if (!branchMatch || !sectionMatch) {
      continue;
    }

    let branchStr = branchMatch[1].trim();
    if (branchStr === 'EVL' || branchStr === 'EIE') branchStr = 'ECE'; // Map sub-branches
    
    let dept = depts.find(d => branchStr.includes(d.branchCode));
    if (!dept && branchStr.includes('CSE')) dept = depts.find(d => d.branchCode === 'CSE');
    
    const departmentId = dept ? dept.departmentId : null;
    const section = sectionMatch[1].trim();
    const defaultRoom = roomMatch ? roomMatch[1].trim() : null;

    // Extract course mapping (Course Code, Name, Room, Faculty)
    const mappings = {}; // course abbreviation -> { courseCode, facultyName, roomNo }
    
    const linesArr = text.split('\n').map(l => l.trim()).filter(Boolean);
    
    // Parse mapping table
    let inMappingTable = false;
    for (const line of linesArr) {
      if (line.includes('Course Code') && line.includes('Name of the Course')) {
        inMappingTable = true;
        continue;
      }
      if (inMappingTable) {
        // Example line:
        // 25BS1MT101 Matrices and Calculus (MAC) D-113 Dr. T Siva Nageswara Rao OTHERS:
        // 25BS2PH101 Applied Physics Laboratory (AP LAB) C-305 Dr. N Jahangeer / Dr. C. Thirmal (M) / Dr. N.V. Suresh Kumar (T) CVA-L1 Career Vision Approach-Level1
        
        // Match course code and the abbreviation in parentheses
        const abbrevMatch = line.match(/^([0-9A-Z]{10})\s+(.+?)\(([^)]+)\)/i);
        if (abbrevMatch) {
          const code = abbrevMatch[1];
          let abbrev = abbrevMatch[3].trim().toUpperCase();
          
          // Try to extract faculty name. Faculty names usually have titles like Dr., Mr., Mrs., Ms.
          const facultyMatch = line.match(/(Dr\.|Mr\.|Mrs\.|Ms\.|Sri\.)\s*([A-Za-z\s\.\/]+?)(?=\s+(Seminar|Library|Sports|CCA|CVA|MTP|OTHER|Co-Curricular|$))/i);
          let facultyName = facultyMatch ? facultyMatch[0].trim() : null;
          
          // Try to extract room if it looks like D-113, C-305, etc.
          const roomMapMatch = line.match(/\b([A-Z]-\d{3})\b/);
          let roomNo = roomMapMatch ? roomMapMatch[1] : defaultRoom;

          mappings[abbrev] = { courseCode: code, facultyName, roomNo };
        }
      }
    }

    // Attempt basic parsing for schedule
    for (const day of DAYS) {
      const dayLineIndex = linesArr.findIndex(l => l.startsWith(day));
      if (dayLineIndex === -1) continue;

      const dayLine = linesArr[dayLineIndex];
      // e.g. "Monday ESE MAC EGBM EGBM Lab / AP Lab SPORTS"
      let tokens = dayLine.substring(day.length).trim().split(/\s+/).filter(t => !['L','U','N','C','H','*','Lab'].includes(t) && t !== '/');

      let slotIdx = 0;
      for (let i = 0; i < tokens.length; i++) {
        if (slotIdx >= 6) break;
        let token = tokens[i].toUpperCase();
        
        // Clean up token to match mapping keys
        let cleanToken = token.replace(/[\*\/]/g, '').replace('LAB', '').trim();
        let map = mappings[cleanToken] || {};

        finalRecords.push({
          departmentId,
          resourceId: map.roomNo || defaultRoom || 'UNKNOWN',
          dayOfWeek: day,
          startTime: new Date(TIME_SLOTS[slotIdx].startTime),
          endTime: new Date(TIME_SLOTS[slotIdx].endTime),
          courseCode: map.courseCode || token,
          section: `${branchStr} - Sec ${section}`,
          academicYear: '2026-27',
          facultyName: map.facultyName || null // Null if no faculty mapped
        });
        slotIdx++;
      }
    }
  }

  console.log(`Parsed ${finalRecords.length} class periods.`);
  
  if (finalRecords.length > 0) {
    // Clear existing
    await prisma.timetable.deleteMany();
    console.log('Cleared existing timetables.');
    
    // Insert new
    await prisma.timetable.createMany({ data: finalRecords });
    console.log('Successfully inserted new timetables from PDF OCR!');
  }
}

main()
  .then(async () => await prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); });
