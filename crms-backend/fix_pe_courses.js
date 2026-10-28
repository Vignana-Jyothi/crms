const fs = require('fs');
const readline = require('readline');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function processFile() {
    const fileStream = fs.createReadStream('./vnrvjiet_timetables_2026_27O.sql');

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let inSections = false;
    let inLegends = false;
    let sectionsData = {};
    let legendData = [];

    for await (const line of rl) {
        if (line.includes('INSERT INTO class_sections')) {
            const valMatch = line.match(/VALUES\s*\((.*)\);/i);
            if (valMatch) {
                const parts = valMatch[1].split(/,\s*(?=(?:(?:[^']*'){2})*[^']*$)/);
                if (parts.length >= 10) {
                    const id = parseInt(parts[0].trim());
                    const dept = parts[2].replace(/^'|'$/g, '').trim();
                    let yearStr = parts[7].replace(/^'|'$/g, '').trim();
                    let year = '1';
                    if (yearStr.includes('II Year') || yearStr.includes('II ')) year = '2';
                    else if (yearStr.includes('III Year') || yearStr.includes('III ')) year = '3';
                    else if (yearStr.includes('IV Year') || yearStr.includes('IV ')) year = '4';
                    
                    const section = parts[9].replace(/^'|'$/g, '').trim();
                    sectionsData[id] = { dept, year, section };
                }
            }
            continue;
        } else if (line.includes('INSERT INTO course_legend')) {
            inLegends = true;
            inSections = false;
            continue;
        } else if (line.includes('INSERT INTO')) {
            inSections = false;
            inLegends = false;
            continue;
        }

        if (inLegends && line.trim().startsWith('(')) {
            const parts = line.split(/,\s*(?=(?:(?:[^']*'){2})*[^']*$)/);
            if (parts.length >= 6) {
                const secId = parseInt(parts[0].replace('(', '').trim());
                const peGroupRaw = parts[1].trim(); 
                const fullNameRaw = parts[3].replace(/^'|'$/g, '').trim();
                const facultyRaw = parts[5].replace(/^'|'$/g, '').trim();
                
                if (peGroupRaw !== 'NULL') {
                    const peGroup = peGroupRaw.replace(/^'|'$/g, '').trim();
                    legendData.push({ secId, peGroup, fullNameRaw, facultyRaw });
                }
            }
        }
    }
    
    console.log(`Parsed ${Object.keys(sectionsData).length} sections and ${legendData.length} PE legend entries.`);

    const updates = [];
    for (const leg of legendData) {
        const sec = sectionsData[leg.secId];
        if (!sec) continue;

        const parenMatch = leg.fullNameRaw.match(/^(.*?)\s*\(([^)]+)\)$/);
        let courseName = parenMatch ? parenMatch[1].trim() : leg.fullNameRaw;

        updates.push({
            dept: sec.dept,
            year: sec.year,
            section: sec.section,
            courseCode: leg.peGroup,
            courseName: courseName,
            facultyName: leg.facultyRaw
        });
    }

    console.log(`Generated ${updates.length} update queries for PE courses.`);
    
    const depts = await prisma.department.findMany();
    const deptMap = {};
    for (const d of depts) {
        deptMap[d.branchCode] = d.departmentId;
    }

    let updated = 0;
    for (const up of updates) {
        const deptId = deptMap[up.dept];
        if (!deptId) continue;
        
        const res = await prisma.$executeRaw`
            UPDATE timetable 
            SET course_name = ${up.courseName}
            WHERE department_id = ${deptId} 
              AND student_year = ${up.year} 
              AND section = ${up.section} 
              AND course_code = ${up.courseCode}
              AND faculty_name = ${up.facultyName}
        `;
        updated += res;
    }
    console.log(`Successfully updated ${updated} PE timetable rows.`);
}

processFile().catch(console.error).finally(() => prisma.$disconnect());
