export const PROGRAMS = [
  { value: 'BTECH', label: 'B.Tech', years: 4 },
  { value: 'MTECH', label: 'M.Tech', years: 2 },
  { value: 'MCA', label: 'MCA', years: 2 },
];

export const DEFAULT_PROGRAM = 'BTECH';

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
