-- Join table behind User.managedDepartments / Department.managers: the extra
-- departments a Department Admin manages besides their own (e.g. csehead.dscs
-- also manages CSE-DS). Matches what Prisma generates for the implicit
-- many-to-many relation: "A" is the department, "B" the user.
CREATE TABLE IF NOT EXISTS "_ManagedDepartments" (
  "A" INTEGER NOT NULL REFERENCES departments (department_id) ON UPDATE CASCADE ON DELETE CASCADE,
  "B" INTEGER NOT NULL REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "_ManagedDepartments_AB_unique" ON "_ManagedDepartments" ("A", "B");

CREATE INDEX IF NOT EXISTS "_ManagedDepartments_B_index" ON "_ManagedDepartments" ("B");
