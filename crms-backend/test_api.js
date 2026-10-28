const axios = require('axios');

const EDUPRIME_BASE_URL = "https://automation.vnrvjiet.ac.in";
const EDUPRIME_RELIC_TOKEN = " 7F5B9C7D-0C2D-4B36-8E8A-6F7151B2C9A4";

async function test() {
  try {
    const response = await axios.post(
      `${EDUPRIME_BASE_URL}/api/Academics/ClassTimeTable`,
      {
        Semester: "BT25290203", // Example semester, I should try to get a valid one
        Branch: "CSE",
        Section: "A",
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Relic': EDUPRIME_RELIC_TOKEN,
        },
      }
    );
    console.log(JSON.stringify(response.data, null, 2));
  } catch(e) {
    console.error(e.message);
  }
}
test();
