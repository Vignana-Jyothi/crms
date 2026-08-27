require('dotenv').config({ path: '../../../.env' }); // Load .env from root
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const EDUPRIME_BASE_URL = process.env.EDUPRIME_BASE_URL || 'https://automation.vnrvjiet.ac.in';
const EDUPRIME_RELIC_TOKEN = process.env.EDUPRIME_RELIC_TOKEN || '7F5B9C7D-0C2D-4B36-8E8A-6F7151B2C9A4';

async function extract() {
  const semester = 'B.Tech I Year I Semester'; 
  const branches = ['CSE'];
  const sections = ['A', 'B', 'C'];
  
  let output = '';

  for (const branch of branches) {
    for (const section of sections) {
      try {
        console.log(`Fetching ${semester} ${branch} - ${section}...`);
        const response = await axios.post(
          `${EDUPRIME_BASE_URL}/api/Academics/ClassTimeTable`,
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
  
  console.log('\n=============================================');
  console.log('RESULTS SAVED TO eduprime_1st_year_timetable.txt');
  console.log('=============================================');
  console.log('NOTE: If it says 401 Unauthorized, it means your .env file does not have the authentic API token!');
}

extract();
