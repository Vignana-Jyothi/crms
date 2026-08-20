# CRMS Backend — VNRVJIET Campus Resource Management System

Express modular monolith, matching the architecture doc: routes -> middleware ->
controller -> service -> repository -> Prisma -> PostgreSQL.

## What's implemented

- **Auth**: JWT access + refresh tokens, bcrypt password hashing, role/department
  embedded in the access token (Section 12-13).
- **RBAC**: `authenticate` (who are you) + `authorizeRole` (what can you do),
  department-scoped where the doc calls for it (e.g. Dept Admin only sees their
  own department's bookings/users).
- **Resources**: CRUD + availability lookup.
- **Bookings**: the actual engine — timetable conflict check, existing-booking
  conflict check, wrapped in a Serializable transaction so two concurrent
  requests for the same slot can't both succeed.
- **Approvals**: ownership-based approver resolution (Section 56's core
  principle — resource type + department decide the approver, never a
  hardcoded name/type string), approve/reject, audit trail.
- **Audit log**: every mutation writes an audit_logs row.

## What's stubbed / not built yet

Timetable **import** (ETL from the Data Engineering team's dataset), notifications
(email/SMS/push), reports, announcements CRUD, and observability (OpenTelemetry/
Prometheus/Loki) aren't implemented. TODO comments mark the integration points
(e.g. `bookings.service.js` where a notification should fire on booking creation).
Building those out is a reasonable "next module" to tackle one at a time.

## First-time setup

1. **Don't run `prisma migrate dev` against your live database** — it already
   has real data and tables (roles, departments, resources, users, etc. — see
   `VNRVJIET_CRMS_schema_and_seed.sql` from earlier). Instead:

   ```bash
   cp .env.example .env
   # fill in DATABASE_URL with the crms_app user/password you already created,
   # and generate real JWT secrets: openssl rand -hex 32
   ```

2. **Add the auth columns** this backend needs (your live `users` table has no
   password column yet):

   ```bash
   sudo -u postgres psql -d campus_resource_management -f prisma/migrations/000_add_auth_columns.sql
   ```

3. **Pull the live schema into Prisma** (safer than trusting `schema.prisma` blindly —
   this confirms it matches reality):

   ```bash
   npm install
   npx prisma db pull
   npx prisma generate
   ```

4. **Set a password for at least your bootstrap Super Admin** so you can log in.
   Quickest way for now — a one-off Node script:

   ```bash
   node -e "
   const bcrypt = require('bcrypt');
   const { PrismaClient } = require('@prisma/client');
   const prisma = new PrismaClient();
   (async () => {
     const hash = await bcrypt.hash('ChangeMe123!', 12);
     await prisma.user.update({ where: { userId: 1 }, data: { passwordHash: hash } });
     console.log('done');
   })();
   "
   ```

   Change that password immediately after your first real login.

5. **Run it:**

   ```bash
   npm run dev
   # or, matching your existing deploy pattern:
   docker compose up -d --build
   ```

6. **Smoke test:**

   ```bash
   curl http://localhost:4000/health

   curl -X POST http://localhost:4000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@vnrvjiet.in","password":"ChangeMe123!"}'
   ```

## API surface so far

```
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/set-password

GET    /api/v1/users
GET    /api/v1/users/me
GET    /api/v1/users/:userId
POST   /api/v1/users                     (Super Admin only — returns a one-time tempPassword)
PATCH  /api/v1/users/:userId/role        (Super Admin only)
PATCH  /api/v1/users/:userId/status      (Super Admin only — Active/Inactive)

GET    /api/v1/audit-logs                (Super Admin only)

GET    /api/v1/roles
GET    /api/v1/departments
GET    /api/v1/blocks
GET    /api/v1/resource-types

GET    /api/v1/resources
GET    /api/v1/resources/:resourceId
GET    /api/v1/resources/:resourceId/availability?date=YYYY-MM-DD
POST   /api/v1/resources                (Super Admin only)
PATCH  /api/v1/resources/:resourceId    (Super Admin only)

POST   /api/v1/bookings
GET    /api/v1/bookings
GET    /api/v1/bookings/:bookingId
POST   /api/v1/bookings/:bookingId/cancel

GET    /api/v1/approvals/pending
POST   /api/v1/approvals/:approvalId/approve
POST   /api/v1/approvals/:approvalId/reject
```

## Deploying alongside your other VJ services

Same pattern as Thrive/VJ Consultancy: this repo's CI job should generate `.env`
from GitHub Secrets at deploy time, then `docker compose up -d --build` on
whichever server (GAMMA is a reasonable choice) via your self-hosted runner.
Nginx on BETA then reverse-proxies `crms-api.vjstartup.com` (or similar) to this
container's port 4000, same as your existing services.
