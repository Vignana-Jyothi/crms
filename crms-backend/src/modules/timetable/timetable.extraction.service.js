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
  const lines = rawText.split('\n').filter(l => l.trim().length > 0);
  
  const extractedSlots = [];
  
  // Basic heuristic: look for Days of the week and Time patterns (e.g. 10:00-11:00)
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const timeRegex = /(\d{1,2}:\d{2})\s*(?:-|to)\s*(\d{1,2}:\d{2})/i;
  
  let currentDay = 'Monday'; // Default fallback
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if line contains a day
    const foundDay = daysOfWeek.find(d => line.toLowerCase().includes(d.toLowerCase()));
    if (foundDay) {
      currentDay = foundDay;
    }
    
    // Check if line contains a time range
    const timeMatch = line.match(timeRegex);
    if (timeMatch) {
      const startTime = timeMatch[1];
      const endTime = timeMatch[2];
      
      // The course name is likely nearby (heuristic: remainder of line or next line)
      let courseName = line.replace(timeMatch[0], '').replace(currentDay, '').trim();
      
      // Clean up common OCR artifacts
      courseName = courseName.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
      
      if (courseName.length < 3 && i + 1 < lines.length) {
         // Maybe the subject is on the next line
         const nextLine = lines[i+1].trim();
         if (!nextLine.match(timeRegex) && !daysOfWeek.find(d => nextLine.toLowerCase().includes(d.toLowerCase()))) {
            courseName = nextLine.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
         }
      }

      if (courseName) {
        extractedSlots.push({
          id: `temp-${Date.now()}-${Math.random()}`, // Temporary ID for frontend table management
          dayOfWeek: currentDay,
          startTime,
          endTime,
          courseName: courseName,
          // Prefill with context if available
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
