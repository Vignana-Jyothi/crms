-- Adds the academic program (B.Tech / M.Tech / MCA) to timetable entries so that
-- e.g. "1st Year CSE - A" for B.Tech and M.Tech are kept apart.
-- Existing rows are all B.Tech, which the default covers.
ALTER TABLE timetable
  ADD COLUMN IF NOT EXISTS program VARCHAR(10) NOT NULL DEFAULT 'BTECH';

CREATE INDEX IF NOT EXISTS timetable_program_department_id_student_year_section_idx
  ON timetable (program, department_id, student_year, section);
