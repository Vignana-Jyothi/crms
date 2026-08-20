# Project: Enterprise Campus Resource Management System (CRMS)

## Architecture
Modular architecture consisting of:
1. `crms-backend`: Express.js modular monolith backend using Prisma ORM with PostgreSQL.
   - Core modules: `auth`, `rbac`, `users`, `resources`, `timetable`, `bookings` (with conflict engine & serializable transactions), `approvals` (ownership-based routing state machine), `audit_logs`, `masterData`.
2. `crms-main-frontend`: React/Vite/Tailwind SPA for Requesters (Faculty, HODs, Deans).
   - Features: Login, dashboard, resource search & filtering (block, capacity, department, type), real-time availability calendar/timeline, booking request submission with conflict feedback, booking status tracking & cancellation.
3. `crms-admin-frontend`: React/Vite/Tailwind SPA for Administrators (Super Admin, Institute Admin, Department Admin).
   - Features: Login (role-gated), Overview dashboard, Approval queue with phone contact details & remarks, Bookings management (server-scoped), Resource management, User management (with temp passwords), System Reports & Audit Logs.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | M1: Backend Infrastructure & Core Engines | Prisma schema/migrations/seed, Auth/RBAC, Booking conflict engine, Approval workflow, REST endpoints | none | DONE |
| 2 | M2: Main Frontend (Requesters) | React/Vite/Tailwind requester portal: dashboard, resource lookup, availability check, booking form | M1 | DONE |
| 3 | M3: Admin Frontend (Administrators) | React/Vite/Tailwind admin portal: approval queue, booking filters, user/resource management, audit logs | M1 | DONE |
| 4 | M4: End-to-End Integration & Dual-Track E2E Test Suite | E2E test runner (Tiers 1-4), backend API verification, frontend integration verification | M1, M2, M3 | DONE |
| 5 | M5: Adversarial Hardening & Final Forensic Integrity Audit | Tier 5 adversarial tests, edge-case hardening, comprehensive forensic audit & clean verification | M4 | DONE |

## Interface Contracts
### Auth & RBAC
- `POST /api/v1/auth/login`: `{ email, password }` -> `{ accessToken, refreshToken, user: { userId, name, email, role, department } }`
- `POST /api/v1/auth/refresh`: `{ refreshToken }` -> `{ accessToken, refreshToken }`
- `POST /api/v1/auth/set-password`: `{ currentPassword, newPassword }`

### Resources & Timetable
- `GET /api/v1/resources`: filter by `departmentId`, `resourceTypeId`, `blockId`, `minCapacity`, `search`
- `GET /api/v1/resources/:resourceId`: details with timetable and upcoming bookings
- `GET /api/v1/resources/:resourceId/availability?date=YYYY-MM-DD`: slot availability with booked/timetable blocks
- `GET /api/v1/timetable`: timetable schedule by department, resource, day

### Bookings & Conflict Detection
- `POST /api/v1/bookings`: `{ resourceId, bookingDate, startTime, endTime, purpose }` -> Atomic Serializable conflict check -> `{ bookingId, status: "Pending", ... }`
- `GET /api/v1/bookings/my`: requester's booking list
- `GET /api/v1/bookings`: admin booking list (scoped by admin role and department)
- `POST /api/v1/bookings/:bookingId/cancel`: cancel booking (requester or admin)

### Approvals
- `GET /api/v1/approvals/pending`: pending approvals for current approver (campus-wide for Super Admin)
- `POST /api/v1/approvals/:approvalId/approve`: `{ remarks }` -> state machine transition to Approved
- `POST /api/v1/approvals/:approvalId/reject`: `{ remarks }` -> state machine transition to Rejected

### Admin Management
- `GET /api/v1/users`, `POST /api/v1/users`, `PATCH /api/v1/users/:userId/role`, `PATCH /api/v1/users/:userId/status`
- `POST /api/v1/resources`, `PATCH /api/v1/resources/:resourceId`
- `GET /api/v1/audit-logs`
- `GET /api/v1/roles`, `GET /api/v1/departments`, `GET /api/v1/blocks`, `GET /api/v1/resource-types`

## Code Layout
- `crms-backend/`:
  - `src/app.js`: Express app entry, multi-origin CORS, middleware stack
  - `src/server.js`: HTTP server startup
  - `src/config/`: environment, prisma client, constants
  - `src/middleware/`: auth, rbac, rateLimit, errorHandling, validation
  - `src/modules/`: auth, bookings, approvals, resources, timetable, users, audit, masterData
  - `src/utils/`: response helpers, conflict algorithms, time helpers
  - `prisma/`: `schema.prisma`, `migrations/`, `seed.js`
  - `tests/`: 106 automated tests covering unit, integration, adversarial, and E2E scenarios
- `crms-main-frontend/`:
  - `src/api/`: axios client, endpoints
  - `src/context/`: AuthContext
  - `src/components/`: Navbar, Layout, AvailabilityStrip, UI elements
  - `src/pages/`: Login, Dashboard, ResourceDetail, MyBookings
- `crms-admin-frontend/`:
  - `src/api/`: axios client, admin endpoints
  - `src/context/`: AuthContext
  - `src/utils/`: formatters.js (safe date, time, and datetime parsing)
  - `src/components/`: Sidebar, Layout, RequireRole, UI elements
  - `src/pages/`: Login, Overview, Approvals, Bookings, Resources, Users, AuditLogs
