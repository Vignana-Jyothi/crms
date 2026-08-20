# CRMS Backend Deep Technical Analysis

## 1. Executive Summary & Architecture Overview

The `crms-backend` subsystem is an Express.js modular monolith designed for the VNRVJIET Campus Resource Management System (CRMS). It interacts with a PostgreSQL database via Prisma ORM (`@prisma/client` v5.19.0).

### Key Architectural Characteristics
- **Layered Monolith**: Strict separation into `routes -> middleware -> controller -> service -> repository -> Prisma -> PostgreSQL`.
- **Stateless Authentication**: Dual-token architecture using short-lived JWT Access Tokens (15m) and persistent Refresh Tokens (7d) stored in the database. Role IDs and Department IDs are embedded directly in the JWT access token payload to avoid database lookups during authorization.
- **Role-Based Access Control (RBAC)**: 4-tier hierarchical/functional RBAC model (Super Admin = 1, Institute Admin = 2, Department Admin = 3, Requester = 4) with department scoping.
- **Booking Concurrency & Conflict Engine**: Wrapped in PostgreSQL `Serializable` isolation level transactions. Combines timetable recurring schedule collision checks with active booking (`Pending` / `Approved`) interval overlap checks (`startTime < req.endTime AND endTime > req.startTime`).
- **Dynamic Approver Resolution (Section 56 compliant)**: Resource ownership is data-driven. Institute-owned resource types (Seminar Hall, Auditorium) route to Institute Admins (`roleId: 2`), while department-owned resources route to the corresponding Department Admin (`roleId: 3`, `departmentId = resource.departmentId`), with a graceful fallback to Super Admin (`roleId: 1`).

---

## 2. Configuration & Runtime Environment

### 2.1 `package.json` Inspection
- **File Path**: `crms-backend/package.json`
- **Type**: `commonjs`
- **Main**: `src/server.js`
- **Scripts**:
  - `dev`: `nodemon src/server.js`
  - `start`: `node src/server.js`
  - `prisma:generate`: `prisma generate`
  - `prisma:pull`: `prisma db pull`
  - `prisma:studio`: `prisma studio`
- **Dependencies**:
  - `@prisma/client`: `^5.19.0` — Database client ORM
  - `bcrypt`: `^5.1.1` — Password hashing with 12 salt rounds
  - `cors`: `^2.8.5` — Cross-Origin Resource Sharing
  - `dotenv`: `^16.4.5` — Environment variable loader
  - `express`: `^4.19.2` — HTTP web framework
  - `express-rate-limit`: `^7.4.0` — IP-based rate limiting
  - `helmet`: `^7.1.0` — HTTP security headers
  - `jsonwebtoken`: `^9.0.2` — JWT sign and verification
  - `morgan`: `^1.10.0` — HTTP request logger
  - `zod`: `^3.23.8` — Request schema validation
- **DevDependencies**:
  - `nodemon`: `^3.1.4`
  - `prisma`: `^5.19.0`
- **Identified Deficiencies**:
  - No automated testing framework installed (e.g. `jest`, `vitest`, `supertest`, or `node:test` scripts).
  - No linter (`eslint`) or formatter (`prettier`) configured in scripts.

### 2.2 Environment Variables & Critical Startup Bug
- **Configuration Loader**: `src/config/env.js` (lines 3–9) implements a strict `required(name)` function:
  ```javascript
  function required(name) {
    const val = process.env[name];
    if (!val) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return val;
  }
  ```
- **Required Variables**:
  - `DATABASE_URL`: required
  - `JWT_ACCESS_SECRET`: required (line 16)
  - `JWT_REFRESH_SECRET`: required (line 17)
- **Current File State**:
  - `.env.example`: Contains placeholders for `DATABASE_URL`, `PORT`, `NODE_ENV`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `CORS_ORIGIN`.
  - `.env`: **Only contains `DATABASE_URL`!**
  - **CRITICAL FINDING**: Starting `crms-backend` immediately throws:
    `Error: Missing required environment variable: JWT_ACCESS_SECRET`
    before the server can bind to its port.
- **CORS Configuration Analysis**:
  - `src/app.js` (line 21): `app.use(cors({ origin: env.corsOrigin, credentials: true }));`
  - `src/config/env.js` (line 21): `corsOrigin: process.env.CORS_ORIGIN || '*'`
  - **CORS Incompatibility Risk**: If `CORS_ORIGIN` is not set or defaults to `'*'`, combining wildcard origin with `credentials: true` violates the CORS specification and browsers will reject API responses containing cookies or authorization headers. Furthermore, since there are two frontends (`crms-main-frontend` on port 5173 and `crms-admin-frontend` on port 5174), `CORS_ORIGIN` should accommodate multiple origins.

---

## 3. Database & Prisma Schema Deep Dive

### 3.1 Schema Definition (`prisma/schema.prisma`)
- **Datasource**: PostgreSQL (`provider = "postgresql"`).
- **Core Entities & Database Mappings**:
  1. `Role` (`@@map("roles")`):
     - `roleId` (Int, PK, autoincrement)
     - `roleName` (VarChar(50), unique): `Super Admin`, `Institute Admin`, `Department Admin`, `Requester`
     - `description` (String?)
  2. `Department` (`@@map("departments")`):
     - `departmentId` (Int, PK, autoincrement)
     - `branchCode` (VarChar(20), unique)
     - `departmentName` (VarChar(150))
     - `groupType` (VarChar(30)?)
  3. `Block` (`@@map("blocks")`):
     - `blockId` (Int, PK, autoincrement)
     - `blockCode` (VarChar(10), unique)
     - `blockName` (VarChar(50)?)
  4. `ResourceType` (`@@map("resource_types")`):
     - `resourceTypeId` (Int, PK, autoincrement)
     - `typeName` (VarChar(50), unique): e.g., `Classroom`, `Seminar Hall`, `Auditorium`, `Lab`
     - `description` (String?)
  5. `Resource` (`@@map("resources")`):
     - `resourceId` (VarChar(20), PK)
     - `resourceName` (VarChar(100))
     - `resourceTypeId` (Int, FK -> `ResourceType`)
     - `departmentId` (Int?, FK -> `Department`)
     - `blockId` (Int?, FK -> `Block`)
     - `floor` (VarChar(10)?)
     - `capacityOrAreaSqm` (Decimal(10, 2)?)
     - `allocationNote` (VarChar(60)?)
     - `status` (VarChar(20), default: "Active")
  6. `User` (`@@map("users")`):
     - `userId` (Int, PK, autoincrement)
     - `name` (VarChar(100))
     - `email` (VarChar(150)?, unique)
     - `phone` (VarChar(20), NOT NULL)
     - `roleId` (Int?, FK -> `Role`)
     - `departmentId` (Int?, FK -> `Department`)
     - `notes` (VarChar(150)?)
     - `roomNo` (VarChar(20)?)
     - `status` (VarChar(20), default: "Active")
     - Auth extension columns (added via migration):
       - `employeeId` (VarChar(30)?, unique)
       - `passwordHash` (VarChar(255)?)
       - `refreshToken` (Text?)
       - `lastLoginAt` (DateTime?)
  7. `Timetable` (`@@map("timetable")`):
     - `timetableId` (Int, PK, autoincrement)
     - `resourceId` (VarChar(20)?, FK -> `Resource`)
     - `departmentId` (Int?, FK -> `Department`)
     - `dayOfWeek` (VarChar(10)?): 'Monday' .. 'Sunday'
     - `startTime` (DateTime?, `@db.Time()`)
     - `endTime` (DateTime?, `@db.Time()`)
     - `courseCode` (VarChar(20)?)
     - `section` (VarChar(20)?)
     - `academicYear` (VarChar(20)?)
     - `uploadedByUserId` (Int?, FK -> `User`)
  8. `Booking` (`@@map("bookings")`):
     - `bookingId` (Int, PK, autoincrement)
     - `resourceId` (VarChar(20)?, FK -> `Resource`)
     - `requesterUserId` (Int?, FK -> `User`)
     - `bookingDate` (DateTime, `@db.Date`)
     - `startTime` (DateTime, `@db.Time()`)
     - `endTime` (DateTime, `@db.Time()`)
     - `purpose` (String?)
     - `status` (VarChar(20), default: "Pending") — Valid: `Pending`, `Approved`, `Rejected`, `Cancelled`
     - `createdAt` (DateTime, default: now)
  9. `Approval` (`@@map("approvals")`):
     - `approvalId` (Int, PK, autoincrement)
     - `bookingId` (Int?, FK -> `Booking`)
     - `approverUserId` (Int?, FK -> `User`)
     - `approverRoleId` (Int?, FK -> `Role`)
     - `decision` (VarChar(20)?) — Valid: `Approved`, `Rejected`
     - `decisionAt` (DateTime?)
     - `remarks` (String?)
  10. `Announcement` (`@@map("announcements")`):
      - `announcementId` (Int, PK, autoincrement)
      - `title` (VarChar(200)), `body` (String?), `departmentId` (Int?), `postedByUserId` (Int?), `postedAt`, `expiresAt`
  11. `AuditLog` (`@@map("audit_logs")`):
      - `auditId` (Int, PK, autoincrement)
      - `userId` (Int?, FK -> `User`)
      - `action` (VarChar(100))
      - `entityType` (VarChar(50))
      - `entityId` (VarChar(50))
      - `details` (String?)
      - `timestamp` (DateTime, default: now)

### 3.2 Migrations & Compatibility
- Migration file `prisma/migrations/000_add_auth_columns.sql` provides non-destructive DDL:
  ```sql
  ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id   VARCHAR(30) UNIQUE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
  ```
- Because column additions are nullable, existing seeded records remain valid.

---

## 4. Middlewares & Infrastructure

### 4.1 Authentication (`src/middleware/authenticate.js`)
- Expects `Authorization: Bearer <token>` header.
- Decodes JWT access token with `verifyAccessToken(token)`.
- Attaches normalized context `req.auth = { userId: payload.sub, roleId: payload.roleId, departmentId: payload.departmentId }`.
- Throws `ApiError.unauthorized('Missing or malformed Authorization header')` (401) or `ApiError.unauthorized('Invalid or expired token')`.

### 4.2 Authorization & RBAC (`src/middleware/authorizeRole.js`)
- Maps role constants:
  - `ROLES.SUPER_ADMIN = 1`
  - `ROLES.INSTITUTE_ADMIN = 2`
  - `ROLES.DEPARTMENT_ADMIN = 3`
  - `ROLES.REQUESTER = 4`
- Middleware generator `authorizeRole(...allowedRoleIds)` verifies `allowedRoleIds.includes(req.auth.roleId)`.
- Throws `ApiError.forbidden('You do not have permission to perform this action')` (403).

### 4.3 Validation (`src/middleware/validateRequest.js`)
- Uses Zod schemas `{ body, params, query }`.
- Safely parses and overwrites `req.body`, `req.params`, and `req.query` with coerced/cleaned values.
- Throws `ApiError.badRequest('Validation failed', result.error.flatten())` (400) on validation error.

### 4.4 Global Error Handler (`src/middleware/errorHandler.js`)
- Catches:
  - `ApiError`: returns `err.statusCode` with `{ error: err.message, details: err.details }`.
  - Prisma `P2002` (unique constraint): returns 409 Conflict.
  - Prisma `P2003` (foreign key constraint): returns 400 Bad Request.
  - Unexpected errors: logs to stderr and returns 500 Internal Server Error.

---

## 5. Module-by-Module In-Depth Analysis

### 5.1 Auth Module (`src/modules/auth/`)
- **Endpoints**:
  - `POST /api/v1/auth/login`:
    - Validates email & password presence.
    - Compares bcrypt hash with `SALT_ROUNDS = 12`.
    - Prevents account enumeration by returning generic `401 Invalid email or password` for missing users or mismatched passwords.
    - Checks `user.status === 'Active'`, rejecting inactive accounts with 403.
    - Generates and stores new `refreshToken` in `users.refresh_token` table, updates `lastLoginAt`, and logs audit entry.
    - Returns `{ accessToken, refreshToken, user: { userId, name, email, role, department } }`.
  - `POST /api/v1/auth/refresh`:
    - Verifies refresh token signature.
    - Validates token against database `user.refreshToken`. If token is revoked or rotated, returns 401.
    - Returns new `{ accessToken }`.
  - `POST /api/v1/auth/set-password`:
    - Validates password length (>= 8 chars).
    - Requires authentication. Enforces authorization: user can only change their own password unless they possess `ROLES.SUPER_ADMIN`.
    - Updates `passwordHash` and logs audit entry.

### 5.2 Users Module (`src/modules/users/`)
- **Endpoints**:
  - `POST /api/v1/users` (Super Admin only):
    - Validates `name`, `phone` (10-digit Indian mobile regex `/^[6-9]\d{9}$/`).
    - Generates 12-character cryptographically secure temporary password: `crypto.randomBytes(9).toString('base64url')`.
    - Hashes temporary password and inserts user with `roleId` (defaults to `ROLES.REQUESTER`).
    - Returns created user object including `tempPassword` (returned once).
  - `PATCH /api/v1/users/:userId/status` (Super Admin only):
    - Sets status to `Active` or `Inactive`.
  - `PATCH /api/v1/users/:userId/role` (Super Admin only):
    - Updates `roleId` and `departmentId`.
  - `GET /api/v1/users/me`:
    - Returns current authenticated user profile using `SAFE_SELECT` (omits passwordHash and refreshToken).
  - `GET /api/v1/users`:
    - Department scoped: If caller is `DEPARTMENT_ADMIN`, forces filtering by `req.auth.departmentId`.
    - If Super Admin / Institute Admin, allows optional `?departmentId=` query param.
  - `GET /api/v1/users/:userId`:
    - Returns specific user by ID.

### 5.3 Master Data Module (`src/modules/masterData/`)
- **Endpoints**:
  - `GET /api/v1/roles` (Authenticated)
  - `GET /api/v1/departments` (Authenticated)
  - `GET /api/v1/blocks` (Authenticated)
  - `GET /api/v1/resource-types` (Authenticated)
- Read-only lookups sorted systematically (by ID or alphabetical name).

### 5.4 Resources Module (`src/modules/resources/`)
- **Endpoints**:
  - `GET /api/v1/resources`:
    - Filters: `resourceTypeId`, `departmentId`, `blockId`, `status`, `search` (case-insensitive substring search on `resourceName`).
    - Includes joined `resourceType`, `department`, `block`.
  - `GET /api/v1/resources/:resourceId`:
    - Returns detailed resource record.
  - `GET /api/v1/resources/:resourceId/availability?date=YYYY-MM-DD`:
    - Calls `bookingsService.getAvailability(resourceId, date)`.
    - Computes day of week and returns:
      - `blockedByTimetable`: Scheduled academic classes.
      - `blockedByBookings`: Bookings with status `Pending` or `Approved`.
  - `POST /api/v1/resources` (Super Admin only):
    - Creates new resource.
  - `PATCH /api/v1/resources/:resourceId` (Super Admin only):
    - Updates resource attributes and logs before/after diff to audit log.

### 5.5 Booking Engine (`src/modules/bookings/`)
- **Endpoints**:
  - `POST /api/v1/bookings`:
    - Validation: `resourceId`, `bookingDate` (YYYY-MM-DD), `startTime` (HH:MM), `endTime` (HH:MM), `purpose` (3-500 chars), with Zod refinement ensuring `startTime < endTime`.
    - Execution in `prisma.$transaction(..., { isolationLevel: 'Serializable' })`:
      1. Verifies resource exists and `status === 'Active'`.
      2. Checks Timetable Collisions:
         - Converts `startTime` and `endTime` to time values (`1970-01-01T{HH:MM}:00Z`).
         - Queries `timetable` table for matching `resourceId`, `dayOfWeek`, and interval overlap `startTime < req.endTime AND endTime > req.startTime`.
         - If conflicts found, throws 409 Conflict with collision details.
      3. Checks Existing Booking Collisions:
         - Queries `bookings` table for `resourceId`, `bookingDate`, `status IN ('Pending', 'Approved')`, and interval overlap `startTime < req.endTime AND endTime > req.startTime`.
         - If conflicts found, throws 409 Conflict with conflicting booking IDs and time slots.
      4. Inserts `booking` row with `status: 'Pending'`.
      5. Invokes `resourcesService.resolveApprover(resource)` and creates corresponding `approval` record.
      6. Writes `CREATE_BOOKING` audit log entry.
  - `GET /api/v1/bookings`:
    - Scope rules:
      - Requesters (`roleId: 4`): constrained to `requesterUserId: req.auth.userId`.
      - Department Admins (`roleId: 3`): constrained to `resource.departmentId: req.auth.departmentId`.
      - Institute Admins (`roleId: 2`) & Super Admins (`roleId: 1`): unrestricted list access with optional query filtering (`status`, `resourceId`).
  - `GET /api/v1/bookings/:bookingId`:
    - Fetches booking with resource, requester, and approval records.
  - `POST /api/v1/bookings/:bookingId/cancel`:
    - Checks that caller is the original requester (`booking.requesterUserId === req.auth.userId`).
    - Verifies booking status is cancellable (`Pending` or `Approved`).
    - Updates status to `Cancelled` and logs audit entry.

### 5.6 Approval Engine (`src/modules/approvals/`)
- **Ownership Routing & Approver Resolution Logic (`resources.service.js:resolveApprover`)**:
  - Institute-Owned: `INSTITUTE_OWNED_TYPES = new Set(['Seminar Hall', 'Auditorium'])`.
    - If `resource.resourceType.typeName` is in set -> routes to first active `User` with `roleId = ROLES.INSTITUTE_ADMIN` (role 2).
  - Department-Owned:
    - If `resource.departmentId` is present -> routes to active `User` with `roleId = ROLES.DEPARTMENT_ADMIN` (role 3) and `departmentId = resource.departmentId`.
  - Fallback:
    - If no department admin is found, routes to active `User` with `roleId = ROLES.SUPER_ADMIN` (role 1) so requests are never dropped.
- **Endpoints**:
  - `GET /api/v1/approvals/pending`:
    - Authorized for `SUPER_ADMIN`, `INSTITUTE_ADMIN`, `DEPARTMENT_ADMIN`.
    - Queries approvals where `decision: null` and matches either `approverUserId === auth.userId` OR matches `approverRoleId` (filtered by department for Department Admins).
  - `POST /api/v1/approvals/:approvalId/approve`:
    - Checks if already decided (409 Conflict if so).
    - Checks `canDecide(approval, auth)`:
      - Super Admin: always permitted.
      - Assigned Approver: permitted.
      - Role-based fallback: Institute Admin permitted for institute-level approvals; Department Admin permitted only if `approval.booking.resource.departmentId === auth.departmentId`.
    - In transaction: updates `approval.decision = 'Approved'`, `approval.remarks`, `approval.decisionAt`, updates `booking.status = 'Approved'`, and writes audit log.
  - `POST /api/v1/approvals/:approvalId/reject`:
    - Same checks as approve, sets `approval.decision = 'Rejected'`, updates `booking.status = 'Rejected'`, and writes audit log.

### 5.7 Audit Engine (`src/modules/audit/`)
- **Functionality**:
  - `log({ userId, action, entityType, entityId, details })`: Writes non-blocking audit records (swallows logging errors to avoid disrupting operations).
  - `GET /api/v1/audit-logs`: Super Admin only endpoint. Supports filters for `entityType`, `entityId`, `userId`, `limit` (max 500), sorted descending by timestamp.

---

## 6. Frontend API Contract & Compatibility Matrix

| API Endpoint in Backend | Admin Frontend Usage (`crms-admin-frontend`) | Main Frontend Usage (`crms-main-frontend`) | Status |
|---|---|---|---|
| `POST /api/v1/auth/login` | `authApi.login` | `authApi.login` | Compatible |
| `POST /api/v1/auth/refresh` | Axios response interceptor | Axios response interceptor | Compatible |
| `POST /api/v1/auth/set-password` | Supported in backend | Not directly wrapped | Compatible |
| `GET /api/v1/users/me` | `usersApi.me` | `usersApi.me` | Compatible |
| `GET /api/v1/users` | `usersApi.list(deptId)` | N/A | Compatible |
| `POST /api/v1/users` | `usersApi.create(payload)` | N/A | Compatible |
| `PATCH /api/v1/users/:userId/role` | `usersApi.updateRole` | N/A | Compatible |
| `PATCH /api/v1/users/:userId/status` | `usersApi.updateStatus` | N/A | Compatible |
| `GET /api/v1/roles` | `masterDataApi.roles` | N/A | Compatible |
| `GET /api/v1/departments` | `masterDataApi.departments` | `masterDataApi.departments` | Compatible |
| `GET /api/v1/blocks` | `masterDataApi.blocks` | `masterDataApi.blocks` | Compatible |
| `GET /api/v1/resource-types` | `masterDataApi.resourceTypes`| `masterDataApi.resourceTypes`| Compatible |
| `GET /api/v1/resources` | `resourcesApi.list(params)` | `resourcesApi.list(params)` | Compatible |
| `GET /api/v1/resources/:resourceId` | `resourcesApi.get(id)` | `resourcesApi.get(id)` | Compatible |
| `GET /api/v1/resources/:id/availability` | N/A | `resourcesApi.availability` | Compatible |
| `POST /api/v1/resources` | `resourcesApi.create(payload)` | N/A | Compatible |
| `PATCH /api/v1/resources/:resourceId` | `resourcesApi.update(id, p)` | N/A | Compatible |
| `POST /api/v1/bookings` | N/A | `bookingsApi.create(payload)` | Compatible |
| `GET /api/v1/bookings` | `bookingsApi.list(params)` | `bookingsApi.mine()` | Compatible |
| `GET /api/v1/bookings/:bookingId` | N/A | `bookingsApi.get(id)` | Compatible |
| `POST /api/v1/bookings/:id/cancel` | N/A | `bookingsApi.cancel(id)` | Compatible |
| `GET /api/v1/approvals/pending` | `approvalsApi.pending()` | N/A | Compatible |
| `POST /api/v1/approvals/:id/approve`| `approvalsApi.approve(id, rem)`| N/A | Compatible |
| `POST /api/v1/approvals/:id/reject` | `approvalsApi.reject(id, rem)` | N/A | Compatible |
| `GET /api/v1/audit-logs` | `auditApi.list(params)` | N/A | Compatible |

---

## 7. Gaps, Technical Risks & Recommendations

### 7.1 Immediate Fixes
1. **Fix `.env` File**:
   Add missing environment variables:
   ```env
   PORT=4000
   NODE_ENV=development
   JWT_ACCESS_SECRET=crms_dev_access_secret_key_32bytes_hex_long
   JWT_REFRESH_SECRET=crms_dev_refresh_secret_key_32bytes_hex_long
   JWT_ACCESS_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d
   CORS_ORIGIN=http://localhost:5173,http://localhost:5174
   ```
2. **Support Multiple CORS Origins**:
   Update `src/config/env.js` and `src/app.js` to parse comma-separated `CORS_ORIGIN` strings and support array matching with `credentials: true`.

### 7.2 Code Architecture Standardization
- `src/modules/users/users.routes.js` currently embeds controller and business logic directly in the route file. Moving logic to `users.controller.js`, `users.service.js`, and `users.validation.js` will align the module with the 4-layer architecture of the rest of the codebase.

### 7.3 Future Feature Stubs (Documented in README)
- **Timetable Management**: Module for uploading and querying timetable schedules (`/api/v1/timetable`).
- **Announcements Engine**: Module for posting campus/department notices (`/api/v1/announcements`).
- **Notification Subsystem**: Webhook/Email/SMS triggers on booking submissions and approval/rejection events.

### 7.4 Database-Level Exclusion Constraint (Optional Hardening)
- In high-concurrency environments, enabling PostgreSQL `btree_gist` extension and adding the `EXCLUDE USING gist (resource_id WITH =, time_range WITH &&)` constraint on `bookings` provides DB-level guarantees against double bookings.
