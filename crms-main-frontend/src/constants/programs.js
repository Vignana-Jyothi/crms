export const PROGRAMS = [
  { value: 'BTECH', label: 'B.Tech', years: 4 },
  { value: 'MTECH', label: 'M.Tech', years: 2 },
  { value: 'MCA', label: 'MCA', years: 2 },
];

export const DEFAULT_PROGRAM = 'BTECH';

// M.Tech timetables use the specialisation code as the section
export const SPECIALISATIONS = {
  AI: 'Artificial Intelligence',
  AIDS: 'Artificial Intelligence and Data Science',
  AMS: 'Advanced Manufacturing Systems',
  CAD: 'CAD/CAM',
  CNIS: 'Computer Networks and Information Security',
  CSE: 'Computer Science and Engineering',
  DS: 'Data Science',
  EI: 'Electronics and Instrumentation',
  ES: 'Embedded Systems',
  EVT: 'Electric Vehicle Technology',
  GTE: 'Geotechnical Engineering',
  HE: 'Highway Engineering',
  PE: 'Power Electronics',
  PS: 'Power Systems',
  SE: 'Software Engineering',
  STR: 'Structural Engineering',
  VLSI: 'VLSI System Design',
};

// "GTE - Geotechnical Engineering" for M.Tech specialisations, plain section otherwise
export const sectionLabel = (section, program) => {
  const fullName = program === 'MTECH' && SPECIALISATIONS[section];
  return fullName ? `${section} - ${fullName}` : section;
};

export const ordinal = (n) => {
  const num = Number(n);
  const suffix = ['st', 'nd', 'rd'][((num + 90) % 100 - 10) % 10 - 1] || 'th';
  return `${n}${suffix}`;
};

export const yearOptionsFor = (program) => {
  const years = PROGRAMS.find(p => p.value === program)?.years || 4;
  return Array.from({ length: years }, (_, i) => ({ value: String(i + 1), label: `${ordinal(i + 1)} Year` }));
};

// "1st Yr" for B.Tech, "M.Tech 1st Yr" / "MCA 1st Yr" for PG programs
export const formatClassYear = (studentYear, program, unit = 'Yr') => {
  if (!studentYear) return '';
  const prefix = program && program !== DEFAULT_PROGRAM
    ? `${PROGRAMS.find(p => p.value === program)?.label || program} `
    : '';
  return `${prefix}${ordinal(studentYear)} ${unit}`;
};
