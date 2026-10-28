const fs = require('fs');
const readline = require('readline');

function parseSQLValues(valuesStr) {
  const results = [];
  let current = '';
  let inQuote = false;
  let depth = 0;
  for (let i = 0; i < valuesStr.length; i++) {
    const ch = valuesStr[i];
    if (ch === "'" && (i === 0 || valuesStr[i-1] !== "'")) {
      inQuote = !inQuote;
      current += ch;
    } else if (!inQuote && ch === '(') {
      depth++;
      current += ch;
    } else if (!inQuote && ch === ')') {
      depth--;
      if (depth < 0) break;
      current += ch;
    } else if (!inQuote && ch === ',' && depth === 0) {
      results.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) results.push(current.trim());
  return results.map(v => {
    v = v.trim();
    if (v === 'NULL') return null;
    if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
    return v;
  });
}

async function test() {
  const rl = readline.createInterface({ input: fs.createReadStream('./vnrvjiet_timetables_2026_27O.sql'), crlfDelay: Infinity });
  let state = null, parsed = 0, failed = 0, noEntry = 0;
  let failExamples = [];
  for await (const line of rl) {
    const t = line.trim();
    if (!t || t.startsWith('--')) continue;
    if (line.includes('INSERT INTO timetable_grid')) { state = 'grid'; continue; }
    if (line.includes('INSERT INTO course_legend')) { state = null; continue; }
    if (line.includes('INSERT INTO class_sections')) { state = null; continue; }
    if (t.startsWith('INSERT INTO') || t === 'COMMIT;' || t === 'BEGIN;') { state = null; continue; }
    if (state === 'grid' && t.startsWith('(')) {
      const valStr = t.replace(/^\(/, '').replace(/\)\s*[,;]\s*$/, '');
      const parts = parseSQLValues(valStr);
      if (parts.length >= 6 && parts[1] && parts[3] && parts[4] && parts[5]) {
        parsed++;
      } else {
        failed++;
        if (failExamples.length < 5) failExamples.push({ len: parts.length, raw: t.substring(0, 120) });
      }
    }
  }
  console.log('Parsed:', parsed, 'Failed:', failed);
  console.log('Fail examples:', JSON.stringify(failExamples, null, 2));
}
test();
