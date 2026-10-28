const fs = require('fs');

const branches = [
    'UG-CSE', 'UG-IT', 'UG-ECE', 'UG-EEE', 'UG-ME', 'UG-CE', 'UG-AE', 'UG-EIE', 
    'UG-AID', 'UG-AIML', 'UG-CSM', 'UG-CSD', 'UG-CSC', 'UG-CSBS', 'UG-IOT', 
    'UG-DS', 'UG-CS', 'UG-AIDS', 'UG-AI'
];

const sections = ['A', 'B', 'C', 'D', 'E', 'F'];
const years = [2023, 2024, 2025, 2026];

const URL = 'https://automation.vnrvjiet.ac.in/api/HostelApp/Timetable';
const HEADERS = {
    'Content-Type': 'application/json',
    'X-App-Key': '7F5B9C7D-0C2D-4B36-8E8A-6F7151B2C9A4'
};

const results = [];

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchTimetable() {
    console.log("Starting data extraction from EduPrime API...");
    for (const year of years) {
        for (const branch of branches) {
            for (const section of sections) {
                const payload = {
                    academicYear: year,
                    branch: branch,
                    section: section
                };

                try {
                    const response = await fetch(URL, {
                        method: 'POST',
                        headers: HEADERS,
                        body: JSON.stringify(payload)
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.Status === 1 && data.Data && data.Data.Entries && data.Data.Entries.length > 0) {
                            console.log(`[SUCCESS] Fetched data for ${year} ${branch} - Section ${section} (${data.Data.Entries.length} entries)`);
                            results.push({
                                year,
                                branch,
                                section,
                                data: data.Data
                            });
                        } else if (data.Status === 1) {
                            console.log(`[EMPTY] No entries for ${year} ${branch} - Section ${section}`);
                        } else {
                            console.log(`[NOT FOUND] ${year} ${branch} - Section ${section}`);
                        }
                    } else {
                        console.error(`[ERROR] HTTP ${response.status} for ${year} ${branch} - Section ${section}`);
                    }
                } catch (e) {
                    console.error(`[ERROR] Failed request for ${year} ${branch} - Section ${section}: ${e.message}`);
                }

                // Small delay to avoid hammering the API
                await delay(100);
            }
        }
    }

    fs.writeFileSync('eduprime_data.json', JSON.stringify(results, null, 2));
    console.log(`\nExtraction complete! Saved ${results.length} valid timetables to eduprime_data.json`);
}

fetchTimetable();
