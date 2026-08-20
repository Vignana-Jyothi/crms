# Forensic Integrity Audit Report — CRMS Subsystems

**Work Product**: CRMS Enterprise Campus Resource Management System (`crms-backend`, `crms-main-frontend`, `crms-admin-frontend`)  
**Profile**: General Project (Forensic Integrity & Security Audit)  
**Audit Date**: 2026-08-16  
**Auditor**: Forensic Auditor (`.agents/auditor`)  
**Verdict**: **CLEAN**  

---

## 1. Observation

Direct code inspections, schema verifications, and architectural security assessments were conducted across all CRMS modules:

### A. Backend Architecture & Genuine Logic (`crms-backend`)
- **Authentication & Password Hashing**:
  - `src/modules/auth/auth.service.js:7`: `const SALT_ROUNDS = 12;`
  - `src/modules/users/users.routes.js:34`: `const passwordHash = await bcrypt.hash(tempPassword, 12);`
  - `prisma/seed.js:6`: `const SALT_ROUNDS = 12; const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);`
  - `src/modules/auth/auth.service.js:14-24`: Implements account-enumeration defense returning identical 401 Unauthorized for both nonexistent email and mismatched password.
  - `src/modules/users/users.repository.js:3-8`: Explicit `SAFE_SELECT` projection is used across all user queries to exclude `passwordHash` and `refreshToken` from serialization.
- **JWT Security & Token Lifecycle**:
  - `src/utils/jwt.js:11-21`: `signAccessToken` signs JWT with `sub: user.userId`, `roleId: user.roleId`, `departmentId: user.departmentId`, `env.jwt.accessSecret`, and `env.jwt.accessExpiresIn`.
  - `src/utils/jwt.js:23-27`: `signRefreshToken` signs JWT with separate `env.jwt.refreshSecret` and `env.jwt.refreshExpiresIn`.
  - `src/modules/auth/auth.service.js:51-67`: `refresh` verifies token validity, compares with persisted `user.refreshToken` in DB, and enforces token rotation/invalidation.
  - `src/config/env.js:23-28`: Secrets `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` are strictly required via environment validation.
- **Conflict Detection & Booking Engine**:
  - `src/modules/bookings/bookings.service.js:35-119`: Executed inside a `prisma.$transaction` with `{ isolationLevel: 'Serializable' }`.
  - `src/modules/bookings/bookings.repository.js:8-20`: Booking conflict query performs interval overlap check:
    `startTime: { lt: endTime }, endTime: { gt: startTime }` against `ACTIVE_STATUSES = ['Pending', 'Approved']`.
  - `src/modules/bookings/bookings.repository.js:22-31`: Timetable conflict query verifies recurring class schedule for `dayOfWeek` with `startTime: { lt: endTime }, endTime: { gt: startTime }`.
  - `src/modules/bookings/bookings.service.js:152-172`: Cancellation flow enforces ownership (`booking.requesterUserId === actingUserId`) and state machine invariants (only `Pending` or `Approved` can be cancelled).
- **Approval Engine & Ownership Routing**:
  - `src/modules/resources/resources.service.js:24-40`: Implements ownership routing: Seminar Halls/Auditoriums route to `INSTITUTE_ADMIN` (Role 2); Department-owned classrooms/labs route to `DEPARTMENT_ADMIN` (Role 3) matching `resource.departmentId`; falls back to `SUPER_ADMIN` (Role 1).
  - `src/modules/approvals/approvals.service.js:22-66`: State machine enforces `canDecide` permission check (Department Admin restricted strictly to their own department), records decision (`Approved`/`Rejected`), updates booking status, and logs audit event atomically.
- **RBAC & Middleware Scoping**:
  - `src/middleware/authenticate.js:7-26`: Validates Bearer token and injects `req.auth = { userId, roleId, departmentId }`.
  - `src/middleware/authorizeRole.js:6-25`: Validates numeric role IDs against allowed roles (`SUPER_ADMIN: 1`, `INSTITUTE_ADMIN: 2`, `DEPARTMENT_ADMIN: 3`, `REQUESTER: 4`).
  - `src/modules/audit/audit.routes.js:13-20`: Audit log retrieval is guarded with `authorizeRole(ROLES.SUPER_ADMIN)`.
- **Database & Parameterization Security**:
  - Zero occurrences of raw, concatenated SQL or `$queryRawUnsafe`. All operations utilize Prisma Client query builders.
  - `src/middleware/errorHandler.js:7-32`: Centralized error handler captures `ApiError`, Prisma code `P2002` (duplicate key), `P2003` (foreign key error), and hides raw server exception internals from clients.
  - `src/middleware/validateRequest.js:5-21`: Zod schema validation runs before controller invocation.

### B. Requester Frontend Subsystem (`crms-main-frontend`)
- `src/api/client.js:22-60`: Axios client with automatic Bearer token injection and silent 401 refresh token interceptor with queue locking (`refreshInFlight`).
- `src/api/endpoints.js:1-37`: Real REST API integrations for `/auth/login`, `/departments`, `/resource-types`, `/blocks`, `/resources`, `/resources/:id/availability`, `/bookings`, and `/bookings/:id/cancel`.
- `src/pages/Dashboard.jsx:27-78`: Live search and multi-criteria filtering with debounced API queries.
- `src/pages/ResourceDetail.jsx:14-162`: Real-time availability visualizer, conflict error display with extracted time slots, and form submission with time sequence validation (`endTime > startTime`).
- `src/pages/MyBookings.jsx:15-96`: Real-time booking tracking and requester cancellation dispatch.

### C. Admin Frontend Subsystem (`crms-admin-frontend`)
- `src/context/AuthContext.jsx:26-39`: Enforces role guard rejecting `Requester` roles from administrative console.
- `src/components/Sidebar.jsx:6-30`: Real-time badge polling for pending approvals (30s interval).
- `src/pages/Approvals.jsx:23-118`: Approval decision console with remark capture and instant list refreshment.
- `src/pages/Users.jsx:35-240`: User provisioning with temporary password display, dynamic role assignments, and active/inactive status toggling.
- `src/pages/Resources.jsx:45-232`: Resource management with department/block association and status toggles.
- `src/pages/Bookings.jsx:12-113`: Admin booking overview with status filtering.
- `src/pages/AuditLogs.jsx:1-60`: Immutable audit trail viewer.
- `src/utils/formatters.js:1-105`: Defensive datetime/time-slot parsing preventing format errors.

---

## 2. Logic Chain

1. **Anti-Cheating & Facade Analysis**:
   - Every endpoint across all 8 backend modules (`auth`, `users`, `masterData`, `resources`, `timetable`, `bookings`, `approvals`, `audit`) executes actual database transactions through Prisma.
   - No hardcoded test stubs, mock responses, or bypassed checks were found in any controller or service file.
   - Frontend components make live HTTP calls through configured Axios instances and handle backend responses, validation errors, and state mutations dynamically.

2. **Security & Cryptographic Analysis**:
   - Password security meets industry standards with Bcrypt cost factor 12.
   - JWT tokens use distinct secrets for access and refresh tokens, include strict expiration windows, and embed cryptographic claims for user identification, role ID, and department ID.
   - Refresh token rotation prevents replay attacks.
   - Account enumeration is mitigated by generic credential validation messages.
   - Prisma ORM parameterized queries prevent SQL injection across all query vectors.

3. **Concurrency & Business Logic Invariants**:
   - Booking slot conflict checking queries both confirmed/pending bookings and recurring class timetables.
   - Transaction execution uses `Serializable` isolation level to prevent race conditions during concurrent booking requests.
   - Approver resolution and approval authorization enforce departmental boundaries and hierarchical escalations correctly.

---

## 3. Caveats

- **No Caveats.** All core modules, database schemas, frontend pages, and security configurations are fully present, genuinely implemented, and compliant with the CRMS specification.

---

## 4. Conclusion

- **Audit Verdict**: **CLEAN**
- The CRMS project demonstrates high code authenticity, rigorous architectural design, robust security posture (Bcrypt 12, dual JWT secrets, Prisma parameterization, RBAC middleware, Serializable transactions), and comprehensive frontend integration across both requester and admin portals.

---

## 5. Verification Method

To independently verify all findings and execute the complete test suite:

1. **Backend Automated Test Execution**:
   ```bash
   cd "d:/New folder/hall_booking/crms-backend"
   npm test
   ```
   *Expected result*: All test suites in `tests/auth.test.js`, `tests/bookings.test.js`, `tests/approvals.test.js`, `tests/resources_timetable.test.js`, and `tests/cors_and_server.test.js` pass with 0 failures.

2. **Frontend Builds**:
   ```bash
   cd "d:/New folder/hall_booking/crms-main-frontend"
   npm run build

   cd "d:/New folder/hall_booking/crms-admin-frontend"
   npm run build
   ```
   *Expected result*: Both Vite production builds compile successfully with zero syntax/type errors.

3. **Key Source Files for Forensic Review**:
   - `crms-backend/src/modules/auth/auth.service.js`
   - `crms-backend/src/modules/bookings/bookings.service.js`
   - `crms-backend/src/modules/approvals/approvals.service.js`
   - `crms-backend/src/modules/resources/resources.service.js`
   - `crms-backend/prisma/schema.prisma`
   - `crms-main-frontend/src/pages/ResourceDetail.jsx`
   - `crms-admin-frontend/src/pages/Approvals.jsx`
