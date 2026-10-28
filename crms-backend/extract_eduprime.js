require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const EDUPRIME_BASE_URL = process.env.EDUPRIME_BASE_URL;
const EDUPRIME_RELIC_TOKEN = process.env.EDUPRIME_RELIC_TOKEN;

if (!EDUPRIME_BASE_URL || !EDUPRIME_RELIC_TOKEN) {
  throw new Error('Set EDUPRIME_BASE_URL and EDUPRIME_RELIC_TOKEN before running this extractor.');
}

async function extract() {
  const semester = 'B.Tech I Year I Semester'; // Or 'BT25290203' depending on what the API expects
  const branches = ['CSE'];
  const sections = ['A', 'B', 'C'];
  
  let output = '';

  for (const branch of branches) {
    for (const section of sections) {
      try {
        console.log(`Fetching ${semester} ${branch} - ${section}...`);
        const response = await axios.post(
          `${EDUPRIME_BASE_URL}/api/HostelApp/Timetable`,
          { Semester: semester, Branch: branch, Section: section },
          { headers: { 'Content-Type': 'application/json', 'Relic': EDUPRIME_RELIC_TOKEN } }
        );

        output += `\n--- Timetable for ${branch} Section ${section} ---\n`;
        output += JSON.stringify(response.data, null, 2) + '\n';
      } catch (err) {
        output += `\n--- Timetable for ${branch} Section ${section} ---\n`;
        output += `ERROR: ${err.message}\n`;
        if (err.response) {
          output += `Response: ${JSON.stringify(err.response.data)}\n`;
        }
      }
    }
  }

  const outPath = path.join(__dirname, 'eduprime_1st_year_timetable.txt');
  fs.writeFileSync(outPath, output);
  console.log(`Successfully wrote EduPrime data to ${outPath}`);
}

extract();
