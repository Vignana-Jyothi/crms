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

    // We will extract sections and legends
    // class_sections: INSERT INTO class_sections (section_id, program, branch, department, student_year, section, room_no) VALUES ...
    // course_legend: INSERT INTO course_legend (section_id, course_code, course_name, room_no, faculty_name) VALUES ...

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
            // (989, NULL, '22PC1MG402', 'Engineering Economics and Accountancy (EEA)',
            // OR (989, 'PE-III', '22PE1EC403', 'Languages for Embedded Software (LES)',
            const parts = line.split(/,\s*(?=(?:(?:[^']*'){2})*[^']*$)/); // split by comma outside quotes
            if (parts.length >= 4) {
                const secId = parseInt(parts[0].replace('(', '').trim());
                const fullNameRaw = parts[3].replace(/^'|'$/g, '').trim(); // course_name is 4th element
                legendData.push({ secId, fullNameRaw });
            }
        }
    }
    
    console.log(`Parsed ${Object.keys(sectionsData).length} sections and ${legendData.length} legend entries.`);

    // Build the mapping
    const updates = [];
    for (const leg of legendData) {
        const sec = sectionsData[leg.secId];
        if (!sec) continue;

        // Parse fullNameRaw: "Matrix Algebra and Calculus (MAC)"
        // Or "Metallurgy and Mechanics of Materials Laboratory (M&MoM Lab)"
        const parenMatch = leg.fullNameRaw.match(/^(.*?)\s*\(([^)]+)\)$/);
        if (parenMatch) {
            const courseName = parenMatch[1].trim();
            const courseCode = parenMatch[2].trim();
            updates.push({
                dept: sec.dept,
                year: sec.year,
                section: sec.section,
                courseCode,
                courseName
            });
        }
    }

    console.log(`Generated ${updates.length} update queries.`);
    
    // Now get departments from DB
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
        `;
        updated += res;
    }
    console.log(`Successfully updated ${updated} timetable rows.`);
}

processFile().catch(console.error).finally(() => prisma.$disconnect());
