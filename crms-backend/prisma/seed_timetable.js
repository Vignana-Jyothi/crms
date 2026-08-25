const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const data = {
  "D-113": {
    Monday: ["ESE", "MAC", "EGBM", "EGBM Lab", "EGBM Lab", "SPORTS"],
    Tuesday: ["AP Lab", "AP Lab", "ESE", "MAC", "ECA", "CCA"],
    Wednesday: ["EW", "EW", "AP", "EGBM", "LIBRARY", "LIBRARY"],
    Thursday: ["EGBM", "EEEE", "AP", "ELCS Lab", "ELCS Lab", "CVA-L1"],
    Friday: ["EEEE", "MAC", "AP", "ESE", "LIBRARY", "SPORTS"],
    Saturday: ["AP", "MAC", "EEEE", "EGBM", "MTP", "MTP"]
  },
  "D-114": {
    Monday: ["AP Lab", "AP Lab", "EGBM", "EEEE", "ECA", "CCA"],
    Tuesday: ["EW", "EW", "EGBM", "EGBM Lab", "EGBM Lab", "SPORTS"],
    Wednesday: ["ESE", "MAC", "AP", "ELCS Lab", "ELCS Lab", "LIBRARY"],
    Thursday: ["EGBM", "ESE", "AP", "MAC", "CVA-L1", "SPORTS"],
    Friday: ["MAC", "ESE", "EEEE", "AP", "LIBRARY", "LIBRARY"],
    Saturday: ["AP", "EEEE", "MAC", "EGBM", "MTP", "MTP"]
  },
  "B-306": {
    Monday: ["ESE", "AEP", "PPS", "MAC", "LIBRARY", "LIBRARY"],
    Tuesday: ["EC-I", "MAC", "PPS", "EW", "EW", "CVA-L1"],
    Wednesday: ["AEP Lab", "AEP Lab", "ESE", "AEP", "ECA", "CCA"],
    Thursday: ["PPS", "EC-I", "MAC", "PPS Lab", "PPS Lab", "SPORTS"],
    Friday: ["ELCS Lab", "ELCS Lab", "ESE", "AEP", "EC-I", "LIBRARY"],
    Saturday: ["MAC", "EC-I", "AEP", "PPS", "MTP", "MTP"]
  },
  "B-307": {
    Monday: ["EC-I", "MAC", "AEP", "AEP Lab", "AEP Lab", "SPORTS"],
    Tuesday: ["PPS Lab", "PPS Lab", "EC-I", "PPS", "ECA", "CCA"],
    Wednesday: ["ESE", "EC-I", "MAC", "PPS", "LIBRARY", "LIBRARY"],
    Thursday: ["AEP", "ESE", "EC-I", "ELCS Lab", "ELCS Lab", "LIBRARY"],
    Friday: ["MAC", "PPS", "AEP", "EW", "EW", "CVA-L1"],
    Saturday: ["PPS", "AEP", "MAC", "ESE", "MTP", "MTP"]
  },
  "D-302": {
    Monday: ["AP Lab", "AP Lab", "EM", "EW", "EW", "LIBRARY"],
    Tuesday: ["MP", "AP", "MAC", "EM", "ECA", "CCA"],
    Wednesday: ["AP", "MP", "MAC", "ESE", "MP", "LIBRARY"],
    Thursday: ["ELCS Lab", "ELCS Lab", "ESE", "MAC", "EM", "SPORTS"],
    Friday: ["MAC", "AP", "EM", "MP Lab", "MP Lab", "CVA-L1"],
    Saturday: ["MP", "ESE", "AP", "EM", "MTP", "MTP"]
  },
  "D-303": {
    Monday: ["EW", "EW", "MP", "AP", "LIBRARY", "LIBRARY"],
    Tuesday: ["MAC", "MP", "EM", "ELCS Lab", "ELCS Lab", "SPORTS"],
    Wednesday: ["EM", "ESE", "MAC", "MP Lab", "MP Lab", "CVA-L1"],
    Thursday: ["AP Lab", "AP Lab", "ESE", "AP", "EM", "ECA"],
    Friday: ["AP", "MP", "MAC", "EM", "ESE", "SPORTS"],
    Saturday: ["MP", "AP", "EM", "MAC", "MTP", "MTP"]
  },
  "A-201": {
    Monday: ["NA", "AEP", "PPS", "ELCS Lab", "ELCS Lab", "SPORTS"],
    Tuesday: ["PPS Lab", "PPS Lab", "NA", "AEP", "ECA", "CCA"],
    Wednesday: ["ESE", "AEP", "PPS", "MAC", "LIBRARY", "LIBRARY"],
    Thursday: ["MAC", "PPS", "ESE", "AEP Lab", "AEP Lab", "CVA-L1"],
    Friday: ["EW", "EW", "AEP", "NA", "MAC", "LIBRARY"],
    Saturday: ["PPS", "NA", "MAC", "ESE", "MTP", "MTP"]
  },
  "B-209": {
    Monday: ["PPS Lab", "PPS Lab", "MAC", "AEP", "LIBRARY", "LIBRARY"],
    Tuesday: ["ESE", "AEP", "PPS", "NA", "ECA", "CCA"],
    Wednesday: ["MAC", "ESE", "NA", "ELCS Lab", "ELCS Lab", "CVA-L1"],
    Thursday: ["EW", "EW", "ESE", "MAC", "PPS", "SPORTS"],
    Friday: ["PPS", "AEP", "NA", "AEP Lab", "AEP Lab", "LIBRARY"],
    Saturday: ["NA", "MAC", "AEP", "PPS", "MTP", "MTP"]
  },
  "B-212": {
    Monday: ["ELCS Lab", "ELCS Lab", "PPS", "AEP", "ECA", "CCA"],
    Tuesday: ["ESE", "AEP", "MAC", "NA", "LIBRARY", "LIBRARY"],
    Wednesday: ["MAC", "PPS", "NA", "PPS Lab", "PPS Lab", "SPORTS"],
    Thursday: ["AEP Lab", "AEP Lab", "NA", "AEP", "MAC", "LIBRARY"],
    Friday: ["PPS", "MAC", "ESE", "EW", "EW", "CVA-L1"],
    Saturday: ["NA", "PPS", "AEP", "ESE", "MTP", "MTP"]
  },
  "B-213": {
    Monday: ["EW", "EW", "MAC", "NA", "LIBRARY", "LIBRARY"],
    Tuesday: ["NA", "MAC", "PPS", "AEP Lab", "AEP Lab", "CVA-L1"],
    Wednesday: ["PPS Lab", "PPS Lab", "PPS", "AEP", "ECA", "CCA"],
    Thursday: ["PPS", "ESE", "AEP", "NA", "MAC", "SPORTS"],
    Friday: ["ESE", "AEP", "MAC", "ELCS Lab", "ELCS Lab", "LIBRARY"],
    Saturday: ["AEP", "ESE", "NA", "PPS", "MTP", "MTP"]
  },
  "C-203": {
    Monday: ["PPS", "NA", "AEP", "AEP Lab", "AEP Lab", "SPORTS"],
    Tuesday: ["ELCS Lab", "ELCS Lab", "ESE", "PPS", "LIBRARY", "LIBRARY"],
    Wednesday: ["NA", "AEP", "MAC", "ESE", "ECA", "CCA"],
    Thursday: ["MAC", "NA", "PPS", "EW", "EW", "CVA-L1"],
    Friday: ["PPS Lab", "PPS Lab", "NA", "AEP", "MAC", "SPORTS"],
    Saturday: ["ESE", "AEP", "PPS", "MAC", "MTP", "MTP"]
  },
  "E-138": {
    Monday: ["PPS Lab", "PPS Lab", "CFE", "ED", "ED", "ED"],
    Tuesday: ["ED", "ED", "ED", "BEE", "ECA", "CCA"],
    Wednesday: ["CFE", "MAC", "PPS", "EC Lab", "EC Lab", "SPORTS"],
    Thursday: ["MAC", "BEE", "CFE", "PPS", "LIBRARY", "LIBRARY"],
    Friday: ["BEE Lab", "BEE Lab", "PPS", "CFE", "MAC", "CVA-L1"],
    Saturday: ["BEE", "PPS", "MAC", "ITW", "ITW", "MTP"]
  },
  "E-139": {
    Monday: ["ED", "ED", "ED", "PPS", "ECA", "CCA"],
    Tuesday: ["EC Lab", "EC Lab", "CFE", "PPS", "CVA-L1", "MTP"],
    Wednesday: ["PPS Lab", "PPS Lab", "MAC", "ED", "ED", "ED"],
    Thursday: ["MAC", "PPS", "BEE", "CFE", "LIBRARY", "LIBRARY"],
    Friday: ["PPS", "CFE", "MAC", "BEE", "BEE Lab", "BEE Lab"],
    Saturday: ["CFE", "MAC", "BEE", "ITW", "ITW", "SPORTS"]
  },
  "E-140": {
    Monday: ["ED", "ED", "ED", "ITW", "ITW", "SPORTS"],
    Tuesday: ["PPS", "MAC", "CFE", "PPS Lab", "PPS Lab", "CVA-L1"],
    Wednesday: ["MAC", "PPS", "CFE", "ED", "ED", "ED"],
    Thursday: ["EC Lab", "EC Lab", "BEE", "PPS", "LIBRARY", "LIBRARY"],
    Friday: ["BEE", "MAC", "CFE", "PPS Lab", "PPS Lab", "ECA"],
    Saturday: ["CFE", "PPS", "MAC", "BEE", "MTP", "CCA"]
  },
  "E-141": {
    Monday: ["EC Lab", "EC Lab", "CFE", "PPS", "MAC", "CVA-L1"],
    Tuesday: ["ITW", "ITW", "PPS", "BEE Lab", "BEE Lab", "SPORTS"],
    Wednesday: ["ED", "ED", "ED", "MAC", "CFE", "ECA"],
    Thursday: ["BEE", "CFE", "MAC", "ED", "ED", "ED"],
    Friday: ["PPS Lab", "PPS Lab", "BEE", "PPS", "LIBRARY", "LIBRARY"],
    Saturday: ["MAC", "CFE", "PPS", "BEE", "MTP", "MTP"]
  },
  "E-107": {
    Monday: ["BEE", "MAC", "PPS", "EC Lab", "EC Lab", "CVA-L1"],
    Tuesday: ["ITW", "ITW", "CFE", "ED", "ED", "ED"],
    Wednesday: ["PPS Lab", "PPS Lab", "PPS", "CFE", "MAC", "CCA"],
    Thursday: ["ED", "ED", "ED", "PPS", "LIBRARY", "LIBRARY"],
    Friday: ["PPS Lab", "PPS Lab", "CFE", "MAC", "BEE", "ECA"],
    Saturday: ["CFE", "BEE", "MAC", "PPS", "MTP", "SPORTS"]
  },
  "C-201": {
    Monday: ["EC Lab", "EC Lab", "IOT", "ESE", "ECA", "SPORTS"],
    Tuesday: ["PPS", "MAC", "CFE", "EW", "EW", "CVA-L1"],
    Wednesday: ["ESE", "PPS", "IOT", "MAC", "LIBRARY", "CCA"],
    Thursday: ["ELCS Lab", "ELCS Lab", "CFE", "PPS", "IOT", "LIBRARY"],
    Friday: ["MAC", "CFE", "ESE", "PPS Lab", "PPS Lab", "LIBRARY"],
    Saturday: ["CFE", "IOT", "PPS", "MAC", "MTP", "MTP"]
  },
  "C-202": {
    Monday: ["CFE", "IOT", "MAC", "ESE", "EC Lab", "EC Lab"],
    Tuesday: ["MAC", "PPS", "CFE", "IOT", "ECA", "CCA"],
    Wednesday: ["ESE", "PPS", "CFE", "IOT", "LIBRARY", "LIBRARY"],
    Thursday: ["IOT", "MAC", "PPS", "EW", "EW", "CVA-L1"],
    Friday: ["PPS Lab", "PPS Lab", "ESE", "ELCS Lab", "ELCS Lab", "SPORTS"],
    Saturday: ["MAC", "CFE", "PPS", "IOT", "MTP", "MTP"]
  },
  "B-414": {
    Monday: ["ED", "ED", "ED", "BEE", "ECA", "CCA"],
    Tuesday: ["MAC", "BEE", "CFE", "EC Lab", "EC Lab", "CVA-L1"],
    Wednesday: ["PPS Lab", "PPS Lab", "PPS", "MAC", "LIBRARY", "LIBRARY"],
    Thursday: ["CFE", "PPS", "BEE", "BEE Lab", "BEE Lab", "SPORTS"],
    Friday: ["ED", "ED", "ED", "PPS", "CFE", "MAC"],
    Saturday: ["PPS", "MAC", "CFE", "ITW", "ITW", "MTP"]
  },
  "B-415": {
    Monday: ["BEE", "PPS", "MAC", "ED", "ED", "ED"],
    Tuesday: ["PPS Lab", "PPS Lab", "PPS", "CFE", "LIBRARY", "LIBRARY"],
    Wednesday: ["CFE", "BEE", "MAC", "EC Lab", "EC Lab", "SPORTS"],
    Thursday: ["ED", "ED", "ED", "CFE", "PPS", "ECA"],
    Friday: ["MAC", "PPS", "BEE", "BEE Lab", "BEE Lab", "CCA"],
    Saturday: ["ITW", "ITW", "CFE", "MAC", "CVA-L1", "MTP"]
  },
  "B-416": {
    Monday: ["BEE Lab", "BEE Lab", "MAC", "CFE", "ECA", "CCA"],
    Tuesday: ["ED", "ED", "ED", "MAC", "PPS", "CVA-L1"],
    Wednesday: ["BEE", "PPS", "CFE", "PPS Lab", "PPS Lab", "SPORTS"],
    Thursday: ["CFE", "PPS", "BEE", "ED", "ED", "ED"],
    Friday: ["EC Lab", "EC Lab", "CFE", "MAC", "LIBRARY", "LIBRARY"],
    Saturday: ["PPS", "MAC", "BEE", "ITW", "ITW", "MTP"]
  },
  "D-415": {
    Monday: ["ESE", "MT", "MAC", "PC Lab", "PC Lab", "MTP"],
    Tuesday: ["AP Lab", "AP Lab", "ESE", "PC", "MAC", "LIBRARY"],
    Wednesday: ["EW", "EW", "ESE", "MT", "AP", "CVA-L1"],
    Thursday: ["AP", "PC", "MAC", "MT", "ECA", "CCA"],
    Friday: ["ELCS Lab", "ELCS Lab", "AP", "PC", "LIBRARY", "LIBRARY"],
    Saturday: ["MAC", "PC", "MT", "AP", "SPORTS", "SPORTS"]
  },
  "E-204": {
    Monday: ["ED", "ED", "ED", "AEP", "LIBRARY", "SPORTS"],
    Tuesday: ["AEP", "MAC", "MFCS", "AEP Lab", "AEP Lab", "ECA"],
    Wednesday: ["PPS Lab", "PPS Lab", "PPS", "ED", "ED", "ED"],
    Thursday: ["EW", "EW", "MFCS", "PPS", "MAC", "CVA-L1"],
    Friday: ["MFCS", "AEP", "MAC", "PPS", "LIBRARY", "CCA"],
    Saturday: ["PPS", "AEP", "MAC", "ITW", "ITW", "MTP"]
  },
  "E-205": {
    Monday: ["AEP Lab", "AEP Lab", "MFCS", "PPS", "LIBRARY", "LIBRARY"],
    Tuesday: ["ED", "ED", "ED", "AEP", "PPS", "MAC"],
    Wednesday: ["ED", "ED", "ED", "ITW", "ITW", "SPORTS"],
    Thursday: ["MAC", "AEP", "PPS", "PPS Lab", "PPS Lab", "ECA"],
    Friday: ["EW", "EW", "MFCS", "AEP", "MAC", "CCA"],
    Saturday: ["MFCS", "MAC", "AEP", "PPS", "CVA-L1", "MTP"]
  },
  "E-241": {
    Monday: ["ITW", "ITW", "PPS", "AEP", "LIBRARY", "LIBRARY"],
    Tuesday: ["EW", "EW", "AEP", "MAC", "ECA", "CCA"],
    Wednesday: ["MFCS", "PPS", "AEP", "AEP Lab", "AEP Lab", "CVA-L1"],
    Thursday: ["MAC", "PPS", "MFCS", "ED", "ED", "ED"],
    Friday: ["PPS Lab", "PPS Lab", "MAC", "ED", "ED", "ED"],
    Saturday: ["PPS", "AEP", "MFCS", "MAC", "MTP", "SPORTS"]
  },
  "E-240": {
    Monday: ["MAC", "PPS", "AEP", "ELCS Lab", "ELCS Lab", "SPORTS"],
    Tuesday: ["ESE", "AEP", "MAC", "AEP Lab", "AEP Lab", "CVA-L1"],
    Wednesday: ["PPS", "AEP", "IOT", "ESE", "ECA", "CCA"],
    Thursday: ["ITW", "ITW", "ESE", "MAC", "LIBRARY", "LIBRARY"],
    Friday: ["PPS Lab", "PPS Lab", "IOT", "PPS", "LIBRARY", "SPORTS"],
    Saturday: ["IOT", "MAC", "PPS", "AEP", "MTP", "MTP"]
  },
  "E-037": {
    Monday: ["CFE", "MAC", "PPS", "BEEE Lab", "BEEE Lab", "CVA-L1"],
    Tuesday: ["EC Lab", "EC Lab", "CFE", "EG", "EG", "EG"],
    Wednesday: ["MAC", "CFE", "BEEE", "PPS", "LIBRARY", "LIBRARY"],
    Thursday: ["EC Lab", "EC Lab", "BEEE", "PPS", "MAC", "ECA"],
    Friday: ["EG", "EG", "EG", "BSIES Lab", "BSIES Lab", "CCA"],
    Saturday: ["BEEE", "CFE", "MAC", "PPS", "MTP", "SPORTS"]
  },
  "E-437": {
    Monday: ["PPS", "CFE", "BEEE", "ITW", "ITW", "CVA-L1"],
    Tuesday: ["MAC", "CFE", "PPS", "PPS Lab", "PPS Lab", "SPORTS"],
    Wednesday: ["ED", "ED", "ED", "MAC", "BEEE", "ECA"],
    Thursday: ["EC Lab", "EC Lab", "MAC", "CFE", "LIBRARY", "LIBRARY"],
    Friday: ["BEEE Lab", "BEEE Lab", "PPS", "ED", "ED", "ED"],
    Saturday: ["BEEE", "MAC", "CFE", "PPS", "MTP", "CCA"]
  },
  "E-438": {
    Monday: ["BEEE", "CFE", "MAC", "PPS Lab", "PPS Lab", "ECA"],
    Tuesday: ["PPS", "MAC", "BEEE", "ED", "ED", "ED"],
    Wednesday: ["EC Lab", "EC Lab", "PPS", "CFE", "LIBRARY", "LIBRARY"],
    Thursday: ["CFE", "MAC", "BEEE", "BEEE Lab", "BEEE Lab", "CVA-L1"],
    Friday: ["ED", "ED", "ED", "MAC", "PPS", "SPORTS"],
    Saturday: ["ITW", "ITW", "CFE", "MTP", "MTP", "CCA"]
  },
  "E-439": {
    Monday: ["BEEE Lab", "BEEE Lab", "CFE", "ED", "ED", "ED"],
    Tuesday: ["EC Lab", "EC Lab", "MAC", "BEEE", "PPS", "LIBRARY"],
    Wednesday: ["MAC", "CFE", "BEEE", "PPS Lab", "PPS Lab", "SPORTS"],
    Thursday: ["ITW", "ITW", "PPS", "MAC", "ECA", "CCA"],
    Friday: ["PPS", "CFE", "MAC", "ED", "ED", "ED"],
    Saturday: ["PPS", "MAC", "BEEE", "CFE", "MTP", "MTP"]
  },
  "E-522": {
    Monday: ["ITW", "ITW", "PPS", "CFE", "MTP", "MTP"],
    Tuesday: ["ICS", "MAC", "BEEE", "EC Lab", "EC Lab", "SPORTS"],
    Wednesday: ["BEEE Lab", "BEEE Lab", "MAC", "PPS", "LIBRARY", "LIBRARY"],
    Thursday: ["PPS", "MAC", "CFE", "ICS", "CVA-L1", "SPORTS"],
    Friday: ["BEEE", "ICS", "MAC", "CFE", "ECA", "CCA"],
    Saturday: ["CFE", "PPS", "BEEE", "PPS Lab", "PPS Lab", "LIBRARY"]
  },
  "E-523": {
    Monday: ["ICS", "PPS", "MAC", "EC Lab", "EC Lab", "SPORTS"],
    Tuesday: ["CFE", "MAC", "BEEE", "PPS", "MTP", "MTP"],
    Wednesday: ["BEEE Lab", "BEEE Lab", "ICS", "CFE", "LIBRARY", "LIBRARY"],
    Thursday: ["BEEE", "PPS", "MAC", "ITW", "ITW", "LIBRARY"],
    Friday: ["PPS Lab", "PPS Lab", "CFE", "BEEE", "ECA", "CCA"],
    Saturday: ["PPS", "MAC", "CFE", "ICS", "CVA-L1", "SPORTS"]
  },
  "E-524": {
    Monday: ["BEEE Lab", "BEEE Lab", "ICS", "PPS", "ECA", "CCA"],
    Tuesday: ["BEEE", "CFE", "MAC", "ICS", "CVA-L1", "SPORTS"],
    Wednesday: ["PPS", "BEEE", "CFE", "MAC", "LIBRARY", "LIBRARY"],
    Thursday: ["PPS", "CFE", "MAC", "EC Lab", "EC Lab", "SPORTS"],
    Friday: ["ICS", "MAC", "BEEE", "ITW", "ITW", "LIBRARY"],
    Saturday: ["PPS Lab", "PPS Lab", "PPS", "CFE", "MTP", "MTP"]
  },
  "E-440": {
    Monday: ["CFE", "MAC", "IAI&DS", "EC Lab", "EC Lab", "LIBRARY"],
    Tuesday: ["PPS Lab", "PPS Lab", "MAC", "PPS", "ECA", "CCA"],
    Wednesday: ["PPS", "IAI&DS", "BEEE", "MAC", "LIBRARY", "LIBRARY"],
    Thursday: ["MAC", "PPS", "CFE", "BEEE Lab", "BEEE Lab", "SPORTS"],
    Friday: ["ITW", "ITW", "BEEE", "CFE", "CVA-L1", "SPORTS"],
    Saturday: ["IAI&DS", "BEEE", "CFE", "PPS", "MTP", "MTP"]
  }
};

const TIMES = [
  { start: '09:00:00Z', end: '09:59:00Z' },
  { start: '10:00:00Z', end: '10:59:00Z' },
  { start: '11:00:00Z', end: '11:59:00Z' },
  { start: '12:40:00Z', end: '13:39:00Z' },
  { start: '13:40:00Z', end: '14:39:00Z' },
  { start: '14:40:00Z', end: '15:39:00Z' }
];

async function main() {
  const rooms = Object.keys(data);
  let totalInserted = 0;
  
  for (const roomId of rooms) {
    const formattedName = roomId.replace('-', ' ');
    const resource = await prisma.resource.findFirst({
      where: { 
        OR: [
          { resourceName: formattedName },
          { resourceName: roomId }
        ]
      }
    });
    
    if (!resource) {
      console.log(`Resource ${roomId} not found in DB. Skipping.`);
      continue;
    }
    
    // Clear existing
    await prisma.timetable.deleteMany({
      where: { resourceId: roomId, uploadedByUserId: null }
    });
    
    const schedule = data[roomId];
    const dataToInsert = [];
    
    for (const [day, slots] of Object.entries(schedule)) {
      for (let i = 0; i < slots.length; i++) {
        const courseCode = slots[i];
        if (courseCode === "NA" || !courseCode) continue;
        
        dataToInsert.push({
          resourceId: resource.resourceId,
          departmentId: resource.departmentId,
          dayOfWeek: day,
          startTime: new Date(`1970-01-01T${TIMES[i].start}`),
          endTime: new Date(`1970-01-01T${TIMES[i].end}`),
          courseCode: courseCode,
          section: resource.allocatedSection || 'A',
          academicYear: '2026-27'
        });
      }
    }
    
    if (dataToInsert.length > 0) {
      await prisma.timetable.createMany({ data: dataToInsert });
      totalInserted += dataToInsert.length;
      console.log(`Inserted ${dataToInsert.length} slots for ${roomId}`);
    }
  }
  
  console.log(`\nSuccessfully injected ${totalInserted} total class schedules!`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect();
});
