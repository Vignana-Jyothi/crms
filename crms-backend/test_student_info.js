const axios = require('axios');

async function testHostelApp() {
  try {
    const response = await axios.post(
      'https://automation.vnrvjiet.ac.in/api/HostelApp/StudentInfo',
      {}, // Empty body for testing
      {
        headers: { 
          'Content-Type': 'application/json',
          'Relic': '7F5B9C7D-0C2D-4B36-8E8A-6F7151B2C9A4' // The dummy token we have
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
