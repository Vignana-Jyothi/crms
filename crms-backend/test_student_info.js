const axios = require('axios');
require('dotenv').config();

const EDUPRIME_BASE_URL = process.env.EDUPRIME_BASE_URL;
const EDUPRIME_RELIC_TOKEN = process.env.EDUPRIME_RELIC_TOKEN;

if (!EDUPRIME_BASE_URL || !EDUPRIME_RELIC_TOKEN) {
  throw new Error('Set EDUPRIME_BASE_URL and EDUPRIME_RELIC_TOKEN before running this helper.');
}

async function testHostelApp() {
  try {
    const response = await axios.post(
      `${EDUPRIME_BASE_URL}/api/HostelApp/StudentInfo`,
      {}, // Empty body for testing
      {
        headers: { 
          'Content-Type': 'application/json',
          'Relic': EDUPRIME_RELIC_TOKEN,
        }
      }
    );
    console.log("SUCCESS:");
    console.log(response.data);
  } catch (err) {
    console.log("ERROR:");
    console.log(err.message);
    if (err.response) {
      console.log(err.response.data);
    }
  }
}

testHostelApp();
