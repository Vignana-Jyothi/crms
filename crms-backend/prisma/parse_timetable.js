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
    if (branchStr === 'EVL' || branchStr === 'EIE') branchStr = 'ECE'; // Map sub-branches to main if needed, or leave as string
    
    // Find department id based on branchCode
    let dept = depts.find(d => branchStr.includes(d.branchCode));
    if (!dept && branchStr.includes('CSE')) dept = depts.find(d => d.branchCode === 'CSE');
    
    const departmentId = dept ? dept.departmentId : null;

    const section = sectionMatch[1].trim();
    const defaultRoom = roomMatch ? roomMatch[1].trim() : null;

    const linesArr = text.split('\n').map(l => l.trim()).filter(Boolean);
    
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
        let token = tokens[i];

        finalRecords.push({
          departmentId,
          resourceId: defaultRoom || 'UNKNOWN',
          dayOfWeek: day,
          startTime: new Date(TIME_SLOTS[slotIdx].startTime),
          endTime: new Date(TIME_SLOTS[slotIdx].endTime),
          courseCode: token,
          section: `${branchStr} - Sec ${section}`, // Combining branch and section
          academicYear: '2026-27',
          facultyName: 'Assigned Faculty' // Placeholder, extracting perfect faculty mapping from OCR is too fragile
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
