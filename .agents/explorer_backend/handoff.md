# Handoff Report — CRMS Backend Deep Inspection

## 1. Observation

### Codebase & Configuration
- **Root Directory**: `d:\New folder\hall_booking\crms-backend`
- **Dependencies (`package.json`)**: Express `4.19.2`, Prisma `@prisma/client` `5.19.0`, Bcrypt `5.1.1`, JsonWebToken `9.0.2`, Zod `3.23.8`, Helmet `7.1.0`, Cors `2.8.5`, RateLimit `7.4.0`. No test runner or linter is declared in `package.json`.
- **Environment Configuration**:
  - `src/config/env.js:15-20`: Throws an error on startup via `required('JWT_ACCESS_SECRET')` and `required('JWT_REFRESH_SECRET')` if those keys are not present in `process.env`.
  - `.env`: Contains only `DATABASE_URL="postgresql://crms_app:crms%40123@localhost:5432/campus_resource_management"`. `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are missing.
  - `src/app.js:21`: Configured with `cors({ origin: env.corsOrigin, credentials: true })`.
- **Prisma Schema (`prisma/schema.prisma`)**:
  - 11 Models defined: `Role`, `Department`, `Block`, `ResourceType`, `Resource`, `User`, `Timetable`, `Booking`, `Approval`, `Announcement`, `AuditLog`.
  - PostgreSQL-specific types used: `@db.Time()`, `@db.Date`, `@db.Decimal(10,2)`.
  - Migration script `prisma/migrations/000_add_auth_columns.sql` adds nullable auth columns (`employee_id`, `password_hash`, `refresh_token`, `last_login_at`) to `users`.

### Core Engines & Middlewares
- **Authentication & RBAC**:
  - `src/utils/jwt.js:11-21`: `signAccessToken` bundles `{ sub: user.userId, roleId: user.roleId, departmentId: user.departmentId }`.
  - `src/middleware/authenticate.js:7-26`: Extracts and verifies access token, sets `req.auth`.
  - `src/middleware/authorizeRole.js:6-25`: Enforces RBAC with `ROLES = { SUPER_ADMIN: 1, INSTITUTE_ADMIN: 2, DEPARTMENT_ADMIN: 3, REQUESTER: 4 }`.
  - `src/modules/auth/auth.service.js:9-49`: Compares bcrypt hash (12 salt rounds), verifies `status === 'Active'`, writes refresh token to DB, logs `LOGIN` audit.
- **Booking Engine (`src/modules/bookings/bookings.service.js`)**:
  - `createBooking` runs inside `prisma.$transaction(..., { isolationLevel: 'Serializable' })` (lines 40–118).
  - Validates active status of resource.
  - Timetable conflict check: `repo.findTimetableConflicts` checks `startTime < endVal AND endTime > startVal` on matching `resourceId` and `dayOfWeek`.
  - Overlapping booking check: `repo.findOverlappingBookings` checks `startTime < endVal AND endTime > startVal` on matching `resourceId`, `bookingDate`, and `status IN ('Pending', 'Approved')`.
  - Creates booking (`Pending`), resolves approver, creates approval record, and writes `CREATE_BOOKING` audit.
- **Approver Resolution (`src/modules/resources/resources.service.js:24-40`)**:
  - `INSTITUTE_OWNED_TYPES = new Set(['Seminar Hall', 'Auditorium'])`.
  - If type in set -> resolves to active `INSTITUTE_ADMIN` (`roleId: 2`).
  - Else -> resolves to active `DEPARTMENT_ADMIN` (`roleId: 3`, `departmentId = resource.departmentId`).
  - Fallback -> resolves to active `SUPER_ADMIN` (`roleId: 1`).
- **Approval Decision State Machine (`src/modules/approvals/approvals.service.js:35-66`)**:
  - Checks if already decided (throws 409 Conflict).
  - Checks `canDecide(approval, auth)`: Super Admin, assigned user, or role/department admin.
  - In transaction: records approval decision (`Approved` / `Rejected`), updates booking status, and logs audit entry.
- **Frontend API Alignment**:
  - Both `crms-admin-frontend/src/api/endpoints.js` and `crms-main-frontend/src/api/endpoints.js` match all implemented routes, request payloads, and URL paths.

---

## 2. Logic Chain

1. **Startup Failure Condition**: `src/config/env.js:6` throws if `process.env['JWT_ACCESS_SECRET']` is falsy. Because `.env` does not contain `JWT_ACCESS_SECRET`, `require('./config/env')` will throw immediately when starting `src/server.js` or `src/app.js`.
2. **CORS Configuration Risk**: With `cors({ origin: env.corsOrigin, credentials: true })`, if `CORS_ORIGIN` is wildcard `'*'` or set only to `http://localhost:5173`, requests with credentials from `crms-admin-frontend` (running on `http://localhost:5174` or other port) will be rejected by CORS policy.
3. **Database Concurrency Guarantee**: The booking engine utilizes `Serializable` isolation level in Prisma transactions, preventing double bookings from concurrent submissions for the same time slot at the database transaction level.
4. **Data-Driven Routing Correctness**: Approver resolution does not use hardcoded resource strings; instead, it checks the resource type's classification and department ID from relational models, falling back safely to Super Admin if a department admin is unassigned.
5. **Architectural Consistency**: 4 modules (`auth`, `resources`, `bookings`, `approvals`) adhere strictly to the 4-layer architecture (`routes -> controller -> service -> repository`). The `users` module currently embeds handler logic in `users.routes.js`.

---

## 3. Caveats

- **Live Database State**: The local inspection did not connect to a running PostgreSQL instance because a local PostgreSQL server on port 5432 was not booted during inspection.
- **Stubbed Modules**: As documented in `README.md`, timetable bulk import/CRUD, notifications (email/SMS), and announcements endpoints are not yet implemented in `src/modules`.
- **Database Dependency**: The schema relies on PostgreSQL native types (`@db.Time()`, `@db.Date`, `@db.Decimal(10, 2)`). Testing with SQLite requires schema abstraction or a PostgreSQL container/mock.

---

## 4. Conclusion

The `crms-backend` subsystem is structurally well-designed, strictly adheres to the core architecture principles (stateless dual-token auth, role & department scoping in JWT, Serializable transaction locking for conflict avoidance, data-driven ownership routing for approvals, and audit logging for all mutations).

To make the backend completely functional and production-ready:
1. Populate `.env` with `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PORT`, `NODE_ENV`, and comma-separated `CORS_ORIGIN`.
2. Adjust CORS middleware to support multiple frontend origins (port 5173 & port 5174).
3. Refactor `users.routes.js` into standard `controller`, `service`, and `validation` layers.
4. Add automated test suites (e.g., using `node:test` or `jest` + `supertest`) covering authentication, conflict detection, approver routing, and decision transitions.

---

## 5. Verification Method

### How to Independently Verify

1. **Inspect Configuration & Env Loading**:
   - Check `crms-backend/src/config/env.js:16-17` and verify required keys.
   - Check `crms-backend/.env` to confirm missing `JWT_ACCESS_SECRET`.
2. **Inspect Booking Engine Conflict Logic**:
   - View `crms-backend/src/modules/bookings/bookings.service.js:40-118`.
   - View `crms-backend/src/modules/bookings/bookings.repository.js:8-30`.
   - Observe interval overlap query condition `startTime: { lt: endTime }, endTime: { gt: startTime }`.
3. **Inspect Approver Routing**:
   - View `crms-backend/src/modules/resources/resources.service.js:24-40`.
   - Observe `INSTITUTE_OWNED_TYPES` set and role fallback.
4. **Inspect Approval Decision & State Machine**:
   - View `crms-backend/src/modules/approvals/approvals.service.js:22-65`.
   - Observe decision conflict check and status synchronization between `Approval` and `Booking`.
5. **Inspect RBAC Middleware**:
   - View `crms-backend/src/middleware/authorizeRole.js:6-25`.
   - View `crms-backend/src/middleware/authenticate.js:7-26`.
