const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const departmentId = 9; // AIDS
const studentYear = '4';
const section = 'A';

const times = {
  1: { start: '10:00:00', end: '11:00:00' },
  2: { start: '11:00:00', end: '12:00:00' },
  3: { start: '12:00:00', end: '13:00:00' },
  4: { start: '13:40:00', end: '14:40:00' },
  5: { start: '14:40:00', end: '15:40:00' },
  6: { start: '15:40:00', end: '16:40:00' },
};

function getStart(slot) { return new Date(`1970-01-01T${times[slot].start}Z`); }
function getEnd(slot) { return new Date(`1970-01-01T${times[slot].end}Z`); }

const schedule = [
  // MONDAY
  { day: 'Monday', slot: 1, courseCode: '22PC2DS402', name: 'Deep Learning applications (DLA) Lab', room: 'E 402', faculty: 'Dr.Putti Jyothi / Dr.K.Srinivas' },
  { day: 'Monday', slot: 2, courseCode: '22PC2DS402', name: 'Deep Learning applications (DLA) Lab', room: 'E 402', faculty: 'Dr.Putti Jyothi / Dr.K.Srinivas' },
  { day: 'Monday', slot: 3, courseCode: '22PC2DS402', name: 'Deep Learning applications (DLA) Lab', room: 'E 402', faculty: 'Dr.Putti Jyothi / Dr.K.Srinivas' },
  { day: 'Monday', slot: 1, courseCode: '22PC2DS401', name: 'Data Science for BFSI (BFSI) lab', room: 'E 417', faculty: 'Mrs.G.Shravani / Mr.B.Sangameshwar' },
  { day: 'Monday', slot: 2, courseCode: '22PC2DS401', name: 'Data Science for BFSI (BFSI) lab', room: 'E 417', faculty: 'Mrs.G.Shravani / Mr.B.Sangameshwar' },
  { day: 'Monday', slot: 3, courseCode: '22PC2DS401', name: 'Data Science for BFSI (BFSI) lab', room: 'E 417', faculty: 'Mrs.G.Shravani / Mr.B.Sangameshwar' },
  { day: 'Monday', slot: 4, courseCode: '22PC1DS401', name: 'Data Science for BFSI (BFSI)', room: 'D 518', faculty: 'Mrs.G.Shravani' },
  { day: 'Monday', slot: 5, courseCode: 'MOOCS', name: 'MOOCS', room: 'D 518', faculty: null },
  { day: 'Monday', slot: 6, courseCode: 'MOOCS', name: 'MOOCS', room: 'E 415', faculty: null },

  // TUESDAY
  { day: 'Tuesday', slot: 1, courseCode: 'OE-III', name: 'Open Elective-III', room: null, faculty: null },
  { day: 'Tuesday', slot: 2, courseCode: '22PE1DS401', name: 'Natural Language Processing and Text Analytics (NLP&TA)', room: 'E 416', faculty: 'Dr.Chevella Anil Kumar' },
  { day: 'Tuesday', slot: 3, courseCode: '22PC1DS402', name: 'Deep Learning applications (DLA)', room: 'E 416', faculty: 'Dr.Putti Jyothi' },
  { day: 'Tuesday', slot: 4, courseCode: '22PW4DS401', name: 'Major Project Phase - I', room: null, faculty: 'Dr. N. Pushpalatha' },
  { day: 'Tuesday', slot: 5, courseCode: '22PW4DS401', name: 'Major Project Phase - I', room: null, faculty: 'Dr. N. Pushpalatha' },
  { day: 'Tuesday', slot: 6, courseCode: '22PW4DS401', name: 'Major Project Phase - I', room: null, faculty: 'Dr. N. Pushpalatha' },

  // WEDNESDAY
  { day: 'Wednesday', slot: 1, courseCode: '22PE1DS401', name: 'Natural Language Processing and Text Analytics (NLP&TA)', room: 'E 416', faculty: 'Dr.Chevella Anil Kumar' },
  { day: 'Wednesday', slot: 2, courseCode: '22PC1DS401', name: 'Data Science for BFSI (BFSI)', room: 'E 416', faculty: 'Mrs.G.Shravani' },
  { day: 'Wednesday', slot: 3, courseCode: 'MTP', name: 'Mentoring Training and Placements', room: 'D 518', faculty: null },
  { day: 'Wednesday', slot: 4, courseCode: 'ECA', name: 'Extra-Curricular Activities (ECA)', room: 'D 518', faculty: null },
  { day: 'Wednesday', slot: 5, courseCode: 'CCA', name: 'Co-Curricular Activities (CCA)', room: 'D 518', faculty: null },
  { day: 'Wednesday', slot: 6, courseCode: 'MOOCS', name: 'MOOCS', room: 'D 518', faculty: null },

  // THURSDAY
  { day: 'Thursday', slot: 1, courseCode: '22PC2DS401', name: 'Data Science for BFSI (BFSI) lab', room: 'E 416', faculty: 'Mrs.G.Shravani / Mr.B.Sangameshwar' },
  { day: 'Thursday', slot: 2, courseCode: '22PC2DS401', name: 'Data Science for BFSI (BFSI) lab', room: 'E 416', faculty: 'Mrs.G.Shravani / Mr.B.Sangameshwar' },
  { day: 'Thursday', slot: 3, courseCode: '22PC2DS401', name: 'Data Science for BFSI (BFSI) lab', room: 'E 416', faculty: 'Mrs.G.Shravani / Mr.B.Sangameshwar' },
  { day: 'Thursday', slot: 1, courseCode: '22PC2DS402', name: 'Deep Learning applications (DLA) Lab', room: 'E 415', faculty: 'Dr.Putti Jyothi / Dr.K.Srinivas' },
  { day: 'Thursday', slot: 2, courseCode: '22PC2DS402', name: 'Deep Learning applications (DLA) Lab', room: 'E 415', faculty: 'Dr.Putti Jyothi / Dr.K.Srinivas' },
  { day: 'Thursday', slot: 3, courseCode: '22PC2DS402', name: 'Deep Learning applications (DLA) Lab', room: 'E 415', faculty: 'Dr.Putti Jyothi / Dr.K.Srinivas' },
  { day: 'Thursday', slot: 4, courseCode: 'OE-III', name: 'Open Elective-III', room: null, faculty: null },
  { day: 'Thursday', slot: 5, courseCode: 'OE-III', name: 'Open Elective-III', room: null, faculty: null },
  { day: 'Thursday', slot: 6, courseCode: '22PC1DS402', name: 'Deep Learning applications (DLA)', room: 'E 416', faculty: 'Dr.Putti Jyothi' },

  // FRIDAY
  { day: 'Friday', slot: 1, courseCode: '22PC1DS402', name: 'Deep Learning applications (DLA)', room: 'E 415', faculty: 'Dr.Putti Jyothi' },
  { day: 'Friday', slot: 2, courseCode: '22PE1DS401', name: 'Natural Language Processing and Text Analytics (NLP&TA)', room: 'E 415', faculty: 'Dr.Chevella Anil Kumar' },
  { day: 'Friday', slot: 3, courseCode: '22PC1DS401', name: 'Data Science for BFSI (BFSI)', room: 'E 415', faculty: 'Mrs.G.Shravani' },
  { day: 'Friday', slot: 4, courseCode: 'MOOCS', name: 'MOOCS', room: 'E 415', faculty: null },
  { day: 'Friday', slot: 5, courseCode: 'library', name: 'Library', room: null, faculty: null },
  { day: 'Friday', slot: 6, courseCode: 'Sports', name: 'Sports', room: null, faculty: null },

  // SATURDAY
  { day: 'Saturday', slot: 1, courseCode: '22PC1DS401', name: 'Data Science for BFSI (BFSI)', room: 'E 332', faculty: 'Mrs.G.Shravani' },
  { day: 'Saturday', slot: 2, courseCode: '22PE1DS401', name: 'Natural Language Processing and Text Analytics (NLP&TA)', room: 'E 332', faculty: 'Dr.Chevella Anil Kumar' },
  { day: 'Saturday', slot: 3, courseCode: '22PC1DS402', name: 'Deep Learning applications (DLA)', room: 'E 332', faculty: 'Dr.Putti Jyothi' },
  { day: 'Saturday', slot: 4, courseCode: '22PW4DS401', name: 'Major Project Phase - I', room: null, faculty: 'Dr. N. Pushpalatha' },
  { day: 'Saturday', slot: 5, courseCode: '22PW4DS401', name: 'Major Project Phase - I', room: null, faculty: 'Dr. N. Pushpalatha' },
  { day: 'Saturday', slot: 6, courseCode: '22PW4DS401', name: 'Major Project Phase - I', room: null, faculty: 'Dr. N. Pushpalatha' },
];

async function run() {
  try {
    // 1. Delete all existing for 4th year AIDS sec A
    const deleted = await prisma.timetable.deleteMany({
      where: {
        departmentId,
        studentYear: studentYear,
        section: section
      }
    });
    console.log(`Deleted ${deleted.count} existing entries for 4th Year AIDS Sec A`);

    // 2. Fetch all rooms
    const resources = await prisma.resource.findMany();
    const roomMap = {};
    for (const r of resources) {
      roomMap[r.resourceName] = r.resourceId;
    }

    // 3. Prepare inserts
    const dataToInsert = [];
    for (const item of schedule) {
      let rId = null;
      if (item.room) {
        rId = roomMap[item.room] || null;
        if (!rId) {
          console.warn(`Warning: Could not find resource ID for room ${item.room}. Leaving null.`);
        }
      }

      dataToInsert.push({
        departmentId,
        studentYear,
        section,
        academicYear: '2026-2027',
        dayOfWeek: item.day,
        startTime: getStart(item.slot),
        endTime: getEnd(item.slot),
        courseCode: item.courseCode,
        courseName: item.name,
        courseShortName: item.courseCode,
        facultyName: item.faculty,
        resourceId: rId
      });
    }

    // 4. Insert
    const inserted = await prisma.timetable.createMany({
      data: dataToInsert
    });
    console.log(`Successfully inserted ${inserted.count} new entries for 4th Year AIDS Sec A!`);

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
