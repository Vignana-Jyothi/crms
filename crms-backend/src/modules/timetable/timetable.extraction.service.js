const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');

/**
 * Extracts text from an uploaded file (Image or PDF).
 * @param {Object} file - The file object from multer (req.file)
 * @returns {Promise<string>} The extracted raw text
 */
async function extractTextFromFile(file) {
  if (!file || !file.buffer) {
    throw new Error('No file provided for extraction.');
  }

  const mimeType = file.mimetype;

  try {
    if (mimeType === 'application/pdf') {
      // PDF processing
      const data = await pdfParse(file.buffer);
      return data.text;
    } else if (mimeType.startsWith('image/')) {
      // Image processing with Tesseract
      const { data: { text } } = await Tesseract.recognize(
        file.buffer,
        'eng',
        { logger: m => console.log(m) }
      );
      return text;
    } else {
      throw new Error('Unsupported file type. Please upload a PDF or Image.');
    }
  } catch (error) {
    console.error('Extraction error:', error);
    throw new Error(`Failed to extract text from file: ${error.message}`);
  }
}

/**
 * Parses raw text into a structured JSON format representing timetable slots.
 * NOTE: Since open-source OCR text is unstructured, this heuristic attempts to find
 * valid days, times, and block assignments. It is expected to not be 100% accurate.
 * @param {string} rawText
 * @param {Object} context - Optional context (departmentId, studentYear)
 * @returns {Array} Array of structured timetable entries
 */
function parseTextToTimetable(rawText, context = {}) {
  const linesArr = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  
  const TIME_SLOTS = [
    { startTime: '09:00', endTime: '10:00' }, // 1
    { startTime: '10:00', endTime: '11:00' }, // 2
    { startTime: '11:00', endTime: '12:00' }, // 3
    { startTime: '12:40', endTime: '13:40' }, // 4
    { startTime: '13:40', endTime: '14:40' }, // 5
    { startTime: '14:40', endTime: '15:40' }, // 6
  ];

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Check if it matches the VNR specific format
  const isVnrFormat = rawText.match(/Branch:/i) || rawText.match(/Section:/i) || rawText.match(/Course Code/i);

  if (isVnrFormat) {
    const finalRecords = [];
    const sectionMatch = rawText.match(/Section:\s*([A-Za-z0-9])/i);
    const roomMatch = rawText.match(/Class Room No:\s*([A-Z0-9\-]+)/i);
    const defaultRoom = roomMatch ? roomMatch[1].trim() : null;

    // Extract course mapping
    const mappings = {};
    let inMappingTable = false;
    for (const line of linesArr) {
      if (line.includes('Course Code') && line.includes('Name of the Course')) {
        inMappingTable = true;
        continue;
      }
      if (inMappingTable) {
        const abbrevMatch = line.match(/^([0-9A-Z]{10})\s+(.+?)\(([^)]+)\)/i);
        if (abbrevMatch) {
          const code = abbrevMatch[1];
          let abbrev = abbrevMatch[3].trim().toUpperCase();
          const facultyMatch = line.match(/(Dr\.|Mr\.|Mrs\.|Ms\.|Sri\.)\s*([A-Za-z\s\.\/]+?)(?=\s+(Seminar|Library|Sports|CCA|CVA|MTP|OTHER|Co-Curricular|$))/i);
          let facultyName = facultyMatch ? facultyMatch[0].trim() : null;
          const roomMapMatch = line.match(/\b([A-Z]-\d{3})\b/);
          let roomNo = roomMapMatch ? roomMapMatch[1] : defaultRoom;
          mappings[abbrev] = { courseCode: code, facultyName, roomNo };
        }
      }
    }

    for (const day of DAYS) {
      const dayLineIndex = linesArr.findIndex(l => l.startsWith(day));
      if (dayLineIndex === -1) continue;

      const dayLine = linesArr[dayLineIndex];
      let tokens = dayLine.substring(day.length).trim().split(/\s+/).filter(t => !['L','U','N','C','H','*','Lab'].includes(t) && t !== '/');

      let slotIdx = 0;
      for (let i = 0; i < tokens.length; i++) {
        if (slotIdx >= 6) break;
        let token = tokens[i].toUpperCase();
        let cleanToken = token.replace(/[\*\/]/g, '').replace('LAB', '').trim();
        let map = mappings[cleanToken] || {};

        let resId = map.roomNo || defaultRoom || '';
        if (resId && resId !== 'UNKNOWN') {
          resId = resId.replace('-', ' ');
        }

        finalRecords.push({
          id: `extracted-${Date.now()}-${Math.random()}`,
          dayOfWeek: day,
          startTime: TIME_SLOTS[slotIdx].startTime,
          endTime: TIME_SLOTS[slotIdx].endTime,
          courseName: map.courseCode || token,
          section: sectionMatch ? context.section || `Sec ${sectionMatch[1].trim()}` : context.section || '',
          departmentId: context.departmentId || null,
          studentYear: context.studentYear || '',
          facultyName: map.facultyName || '',
          resourceId: resId || ''
        });
        slotIdx++;
      }
    }
    if (finalRecords.length > 0) return finalRecords;
  }

  // Basic heuristic fallback
  const extractedSlots = [];
  const timeRegex = /(\d{1,2}:\d{2})\s*(?:-|to)\s*(\d{1,2}:\d{2})/i;
  let currentDay = 'Monday';
  
  for (let i = 0; i < linesArr.length; i++) {
    const line = linesArr[i];
    const foundDay = DAYS.find(d => line.toLowerCase().includes(d.toLowerCase()));
    if (foundDay) currentDay = foundDay;
    
    const timeMatch = line.match(timeRegex);
    if (timeMatch) {
      const startTime = timeMatch[1];
      const endTime = timeMatch[2];
      let courseName = line.replace(timeMatch[0], '').replace(currentDay, '').trim();
      courseName = courseName.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
      
      if (courseName.length < 3 && i + 1 < linesArr.length) {
         const nextLine = linesArr[i+1].trim();
         if (!nextLine.match(timeRegex) && !DAYS.find(d => nextLine.toLowerCase().includes(d.toLowerCase()))) {
            courseName = nextLine.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
         }
      }

      if (courseName) {
        extractedSlots.push({
          id: `temp-${Date.now()}-${Math.random()}`,
          dayOfWeek: currentDay,
          startTime,
          endTime,
          courseName,
          departmentId: context.departmentId || null,
          studentYear: context.studentYear || '',
          section: context.section || '',
          facultyName: '',
          resourceId: ''
        });
      }
    }
  }

  return extractedSlots;
}

module.exports = {
  extractTextFromFile,
  parseTextToTimetable
};
