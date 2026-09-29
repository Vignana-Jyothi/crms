const fs = require('fs');
const path = require('path');
const { parseTextToTimetable } = require('./src/modules/timetable/timetable.extraction.service');
const { batchCreate } = require('./src/modules/timetable/timetable.service');

async function run() {
    const files = ['iot_all_years.csv', 'me_all_years.csv', 'csbs_iv_year.csv', 'csbs_iii_year.csv', 'csbs_ii_year.csv'];
    let total = 0;
    
    console.log("Starting direct database injection...");
    
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    for (const file of files) {
        const filePath = path.join(__dirname, file);
        console.log(`Checking path: ${filePath}`);
        if (!fs.existsSync(filePath)) {
            console.log(`Skipping ${file} - file not found.`);
            continue;
        }
        
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length > 0) {
            const headers = lines[0].split(',').map(h => h.trim());
            const rows = lines.slice(1).map(line => {
                const split = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                const rowObj = {};
                headers.forEach((h, i) => { rowObj[h] = split[i] ? split[i].replace(/^"|"$/g, '').trim() : ''; });
                return rowObj;
            });
            
            const rawJson = JSON.stringify([{ page: 1, rows }]);
            
            console.log(`\nParsing ${file}... (${rows.length} rows)`);
            const extractedData = await parseTextToTimetable(rawJson, {});
            
            // Strip out raw UI fields that aren't in the database schema
            const cleanData = extractedData.map(row => {
                delete row.rawClassroom;
                delete row.rawFaculty;
                return row;
            });
            
            console.log(`Saving ${cleanData.length} validated records to the database...`);
            await batchCreate(cleanData);
            
            console.log(`Success: injected ${extractedData.length} records from ${file}`);
            total += extractedData.length;
        }
    }
    
    console.log(`\n========================================`);
    console.log(`Injection Complete! Total records saved: ${total}`);
    console.log(`========================================\n`);
    process.exit(0);
}

run().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
});
