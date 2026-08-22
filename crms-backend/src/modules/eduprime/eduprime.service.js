const axios = require('axios');

const EDUPRIME_BASE_URL = process.env.EDUPRIME_BASE_URL;
const EDUPRIME_RELIC_TOKEN = process.env.EDUPRIME_RELIC_TOKEN;

/**
 * Fetches the academic timetable for a specific section from the EduPrime API.
 * @param {string} semester - e.g. 'BT25290203'
 * @param {string} branch - e.g. 'CSE'
 * @param {string} section - e.g. 'A'
 * @returns {Promise<Array>} Array of timetable entries
 */
async function getClassTimeTable(semester, branch, section) {
  if (!EDUPRIME_BASE_URL || !EDUPRIME_RELIC_TOKEN) {
    console.warn('EduPrime integration is not fully configured. Missing URL or Token.');
    return [];
  }

  try {
    const response = await axios.post(
      `${EDUPRIME_BASE_URL}/api/Academics/ClassTimeTable`,
      {
        Semester: semester,
        Branch: branch,
        Section: section,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Relic': EDUPRIME_RELIC_TOKEN,
        },
      }
    );

    const result = response.data;
    
    if (result && result.Status === 1) {
      if (result.Data && Array.isArray(result.Data.Entries)) {
        return result.Data.Entries;
      }
      return []; // Success, but no entries
    }
    
    // If not successful, EduPrime puts the error message in the Data field
    const errMsg = result && typeof result.Data === 'string' ? result.Data : 'Unknown EduPrime Error';
    throw new Error(`EduPrime API Error: ${errMsg} (Status: ${result?.Status})`);
  } catch (error) {
    const errorMsg = error.response?.data?.Message || error.message;
    console.error(`Failed to fetch EduPrime ClassTimeTable for ${semester} ${branch} ${section}:`, errorMsg);
    throw new Error(`EduPrime API Error: ${errorMsg}`);
  }
}

/**
 * Helper to check if a specific time slot overlaps with any class in the timetable.
 * The EduPrime API returns times like "09:30 AM" string.
 */
function isTimeSlotOccupiedByClass(timetableEntries, requestedDate, requestedStartTime, requestedEndTime) {
  // requestedDate is a string or Date object. We need to find the day of the week (1=Monday, 7=Sunday)
  // Wait, .NET DayOfWeek has 0=Sunday, 1=Monday... let's check JS. JS getDay() is 0=Sunday, 1=Monday...
  const dateObj = new Date(requestedDate);
  const dayOfWeek = dateObj.getDay(); 
  // Map JS day to EduPrime day. Usually 1=Monday, 2=Tuesday... 7=Sunday? Wait, in JS 0=Sunday.
  // In EduPrime PDF: 1=Monday, ... The PDF sample: "Day": 1, "DayName": "Monday".
  // So EduPrime matches JS, except Sunday might be 7 instead of 0 in EduPrime.
  const eduPrimeDay = dayOfWeek === 0 ? 7 : dayOfWeek;

  // Filter entries for the specific day
  const dayEntries = timetableEntries.filter(entry => entry.Day === eduPrimeDay);

  if (dayEntries.length === 0) return null;

  // Parse requested times into minutes from midnight for easy comparison
  const reqStart = parseTimeStringToMinutes(requestedStartTime);
  const reqEnd = parseTimeStringToMinutes(requestedEndTime);

  // Check for overlaps
  for (const entry of dayEntries) {
    if (!entry.StartTime || !entry.EndTime) continue; // Skip missing class-schedule mapping

    const classStart = parseEduPrimeTimeStringToMinutes(entry.StartTime);
    const classEnd = parseEduPrimeTimeStringToMinutes(entry.EndTime);

    // Overlap condition: Request starts before class ends AND request ends after class starts
    if (reqStart < classEnd && reqEnd > classStart) {
      return entry; // Return the conflicting class entry
    }
  }

  return null;
}

/**
 * Parses "HH:mm" (24h) to minutes from midnight.
 */
function parseTimeStringToMinutes(timeStr) {
  if (!timeStr) return 0;
  // If timeStr is already a Date object (like from DB)
  if (timeStr instanceof Date) {
    return timeStr.getHours() * 60 + timeStr.getMinutes();
  }
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours * 60) + (minutes || 0);
}

/**
 * Parses "09:30 AM" to minutes from midnight.
 */
function parseEduPrimeTimeStringToMinutes(timeStr) {
  if (!timeStr) return 0;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

module.exports = {
  getClassTimeTable,
  isTimeSlotOccupiedByClass,
};
