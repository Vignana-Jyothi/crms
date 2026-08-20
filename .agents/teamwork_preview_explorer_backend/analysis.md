# CRMS Backend Deep Audit & Reliability Analysis Report

**Target**: `crms-backend` (Express.js / Prisma ORM / PostgreSQL)  
**Auditor**: Explorer 3 (Backend API, Core Engines & Reliability Auditor)  
**Date**: 2026-08-17  

---

## Executive Summary

A comprehensive forensic code audit and edge-case reliability analysis was conducted on `crms-backend`. The backend implements a robust modular monolith architecture with Prisma ORM, JWT authentication, and Serializable transaction isolation for booking conflict detection.

However, several critical logic bugs, security bypasses (IDOR), access scoping issues for Super Admin, and unhandled boundary conditions were discovered during the audit. This report presents the technical breakdown of the core engines, auth/RBAC subsystems, edge case evaluations, and concrete remediation recommendations.

---

## 1. Core Engines Audit

### 1.1 Conflict Detection Engine

#### Overlapping Mathematical Formula
The interval overlapping check is implemented in `src/modules/bookings/bookings.repository.js` (lines 8–20 & 22–31) using:
$$\text{existing.start} < \text{new.end} \quad \land \quad \text{existing.end} > \text{new.start}$$

```javascript
// src/modules/bookings/bookings.repository.js:16-17
startTime: { lt: endTime },
endTime: { gt: startTime },
```

#### Boundary Evaluation:
- **Adjacent Before ($E_e = N_s$, e.g., 09:00–10:00 vs 10:00–11:00)**: $10:00 > 10:00 \implies \text{FALSE}$. No conflict detected (Correct).
- **Adjacent After ($N_e = E_s$, e.g., 11:00–12:00 vs 10:00–11:00)**: $10:00 < 10:00 \implies \text{FALSE}$. No conflict detected (Correct).
- **Partial Left/Right Overlap, Inner Subset, Exact Match, Superset**: Both conditions hold true $\implies \text{TRUE}$. Conflict detected (Correct).
- **Status Filter**: Scoped to `ACTIVE_STATUSES = ['Pending', 'Approved']`. Bookings in `Rejected` or `Cancelled` states do not block slots (Correct).

#### Concurrency & Race Conditions
- The booking creation flow (`src/modules/bookings/bookings.service.js:41-142`) wraps conflict checks and booking insertion in `prisma.$transaction(..., { isolationLevel: 'Serializable' })`.
- If two concurrent requests attempt to book the same slot simultaneously, PostgreSQL raises serialization failure `P2034` (SQLSTATE `40001`), which is caught by `src/middleware/errorHandler.js:28-30` and translated to `409 Conflict ("Concurrent booking conflict. Please retry your request.")`.

---

### 1.2 Approval State Machine & Routing (Section 56 & 21)

#### Approver Resolution Policy
- Implemented in `src/modules/resources/resources.service.js:24-40`:
  - **Institute-Owned Types** (`Seminar Hall`, `Auditorium`): Routed to active `INSTITUTE_ADMIN` (`roleId = 2`).
  - **Department-Owned Types** (`Lab`, `Classroom`): Routed to active `DEPARTMENT_ADMIN` (`roleId = 3`) matching `resource.departmentId`.
  - **Fallback**: If no matching department admin is configured or if resource is unassigned, routes to active `SUPER_ADMIN` (`roleId = 1`).

#### Identified Core Logic Bugs in Approvals & Bookings

1. **Super Admin Approvals Visibility Defect (BUG-01)**:
   - **Location**: `src/modules/approvals/approvals.repository.js:12-25`
   - **Observed Code**:
     ```javascript
     function listPendingFor({ approverUserId, roleId, departmentId }) {
       const where = {
         decision: null,
         OR: [
           { approverUserId },
           {
             approverRoleId: roleId,
             booking: departmentId ? { resource: { departmentId } } : undefined,
           },
         ],
       };
       return prisma.approval.findMany({ where, ... });
     }
     ```
   - **Defect**: When Super Admin (`roleId = 1`) requests pending approvals (`GET /api/v1/approvals/pending`), the query filters strictly for `approverUserId = 1` or `approverRoleId = 1`. Because all normal departmental and institute resource approvals have `approverRoleId` 2 or 3, Super Admin receives an empty list (`[]`) and cannot view campus-wide pending requests as required by Section 21 & `PROJECT.md`.

2. **Super Admin Decision Authorization Bypass Missing (BUG-02)**:
   - **Location**: `src/modules/approvals/approvals.service.js:22-32`
   - **Observed Code**:
     ```javascript
     function canDecide(approval, auth) {
       if (approval.approverUserId === auth.userId) return true;
       if (approval.approverRoleId === auth.roleId) {
         if (auth.roleId === ROLES.DEPARTMENT_ADMIN) {
           return approval.booking.resource.departmentId === auth.departmentId;
         }
         return true;
       }
       return false;
     }
     ```
   - **Defect**: If Super Admin attempts to approve or reject an approval that was routed to a Dept Admin (`approverRoleId = 3`) or Institute Admin (`approverRoleId = 2`), `canDecide` returns `false` and throws `403 Forbidden ("You are not the approver for this request")`. Super Admin is completely blocked from acting on departmental approvals!

3. **Auto-Approved Booking Returns Stale Response Status (BUG-04)**:
   - **Location**: `src/modules/bookings/bookings.service.js:86-139`
   - **Defect**: When an admin books their own resource, `isAutoApproved` triggers `tx.booking.update({ data: { status: 'Approved' } })`. However, line 139 returns `{ ...booking, approverUserId: ... }` referencing the in-memory `booking` object (which was instantiated with `status: 'Pending'`). The HTTP response returns `201 Created` with `status: "Pending"` despite being saved as `Approved` in the database.

4. **Missing Mandatory Rejection Remarks Validation (BUG-05)**:
   - **Location**: `src/modules/approvals/approvals.routes.js:14` & `approvals.service.js:34-69`
   - **Defect**: Neither route-level schema validation nor service-level validation verifies that `remarks` is provided when `decision === 'Rejected'`. An admin can reject a booking with `{}` or `{ remarks: "" }`, leaving the requester with no feedback.

---

## 2. Auth & RBAC Security Audit

### 2.1 Route RBAC Matrix

| Route | Method | Required Roles | Enforced In | Audit Result |
|---|---|---|---|---|
| `/api/v1/auth/login` | POST | Public | `validateRequest` | PASS |
| `/api/v1/auth/refresh` | POST | Public | `validateRequest` | PASS (Token rotation omitted) |
| `/api/v1/auth/set-password` | POST | Self or Super Admin | Custom Route Middleware | PASS |
| `/api/v1/users` | POST | Super Admin (1) | `authorizeRole(SUPER_ADMIN)` | PASS |
| `/api/v1/users/:userId/status` | PATCH | Super Admin (1) | `authorizeRole(SUPER_ADMIN)` | PASS |
| `/api/v1/users/:userId/role` | PATCH | Super Admin (1) | `authorizeRole(SUPER_ADMIN)` | PASS |
| `/api/v1/resources` | POST | Super Admin (1) | `authorizeRole(SUPER_ADMIN)` | PASS |
| `/api/v1/resources/:resourceId` | PATCH | Super Admin (1) | `authorizeRole(SUPER_ADMIN)` | PASS (Missing Zod body validator) |
| `/api/v1/audit-logs` | GET | Super Admin (1) | `authorizeRole(SUPER_ADMIN)` | PASS |
| `/api/v1/approvals/pending` | GET | Admin Tiers (1, 2, 3) | `authorizeRole(1, 2, 3)` | FAIL (Super Admin query scoping bug) |
| `/api/v1/approvals/:id/approve` | POST | Admin Tiers (1, 2, 3) | `authorizeRole(1, 2, 3)` | FAIL (Super Admin blocked by `canDecide`) |
| `/api/v1/approvals/:id/reject` | POST | Admin Tiers (1, 2, 3) | `authorizeRole(1, 2, 3)` | FAIL (Missing mandatory remarks check) |
| `/api/v1/bookings/:id` | GET | Authenticated | `authenticate` | FAIL (IDOR: Any requester can read any booking) |
| `/api/v1/bookings/:id/cancel` | POST | Requester (Owner), Super/Inst Admin | Service Check | PASS |

### 2.2 Security Findings & IDOR Vulnerability

1. **IDOR Vulnerability on `GET /api/v1/bookings/:bookingId` (BUG-03)**:
   - **Location**: `src/modules/bookings/bookings.service.js:166-170`
   - **Observation**:
     ```javascript
     async function getById(bookingId, requester) {
       const booking = await repo.findById(bookingId);
       if (!booking) throw ApiError.notFound(`Booking ${bookingId} not found`);
       return booking;
     }
     ```
   - **Impact**: Any authenticated requester can query `GET /api/v1/bookings/101`, `102`, etc., and retrieve the full booking details including the requester's full name, phone number, email address, purpose, and approval history of other students/faculty without restriction.

2. **Information Disclosure in 500 Responses (BUG-08)**:
   - **Location**: `src/middleware/errorHandler.js:36-38`
   - **Observation**:
     ```javascript
     res.status(status).json({
       error: status === 500 ? 'Internal server error' : err.message,
       details: err.message,
       stack: err.stack
     });
     ```
   - **Impact**: The error handler returns full JavaScript stack traces to clients regardless of whether `NODE_ENV` is production or development, exposing internal server file paths and package versions.

3. **Refresh Token Non-Rotation (BUG-09)**:
   - **Location**: `src/modules/auth/auth.service.js:53-69`
   - **Observation**: Calling `/api/v1/auth/refresh` returns only `{ accessToken }` and does not issue a new refresh token or rotate `user.refreshToken` in the database.

---

## 3. Edge Cases & Boundary Conditions

### 3.1 Date, Time & Timezone Handling

1. **Past Date Booking Creation Permitted (BUG-06)**:
   - `src/modules/bookings/bookings.validation.js:5-18` validates `bookingDate` regex `^\d{4}-\d{2}-\d{2}$` and `startTime < endTime`.
   - It does not check if `bookingDate` is prior to current date. Requesters can submit bookings for dates in the past.

2. **Timezone Inconsistency in `getLiveStatus` (BUG-07)**:
   - `src/modules/bookings/bookings.service.js:202-216` calls `now.getHours()` and `now.getMinutes()`.
   - On servers running with UTC system time (e.g. Alpine Linux containers, AWS, GCP default), `now.getHours()` extracts UTC hours (5:30 hours behind IST), breaking live occupancy calculations.

3. **Zero-Duration and Inverted Times**:
   - Correctly blocked by Zod `.refine((d) => d.startTime < d.endTime)` in `bookings.validation.js`.

---

## 4. Test Suite Execution & Coverage Audit

The existing test suite comprises 7 automated test suites:
- `tests/adversarial_challenge.test.js`
- `tests/approvals.test.js`
- `tests/auth.test.js`
- `tests/bookings.test.js`
- `tests/cors_and_server.test.js`
- `tests/e2e_integration_challenger2.test.js`
- `tests/resources_timetable.test.js`

### Coverage Gaps Identified:
1. **Super Admin Campus-Wide Pending Approvals Integration**: Existing tests in `approvals.test.js` mocked repository behavior rather than executing `approvals.repository.js:listPendingFor`, masking BUG-01.
2. **Super Admin Decision Execution**: `e2e_integration_challenger2.test.js` used a test-local helper for `canDecide` containing `if (auth.roleId === ROLES.SUPER_ADMIN) return true;`, masking BUG-02 in the actual `approvals.service.js`.
3. **IDOR on `GET /api/v1/bookings/:id`**: No test verifies that Requester A cannot read Requester B's booking by ID.
4. **Past Booking Date Submission**: No test asserts rejection of past dates.
5. **Rejection without Remarks**: No test verifies rejection failure when remarks are empty.

---

## 5. Comprehensive Bug Summary Table

| ID | Module | Severity | Affected File & Lines | Description | Fix Recommendation |
|---|---|---|---|---|---|
| **BUG-01** | Approvals | **HIGH** | `approvals.repository.js:12-25` | Super Admin sees empty pending approvals queue (`[]`) due to restrictive `OR` clause | If `roleId === ROLES.SUPER_ADMIN`, set `where = { decision: null }` |
| **BUG-02** | Approvals | **HIGH** | `approvals.service.js:22-32` | Super Admin cannot approve/reject Department or Institute resource bookings (throws 403) | Add `if (auth.roleId === ROLES.SUPER_ADMIN) return true;` at start of `canDecide` |
| **BUG-03** | Bookings | **HIGH** | `bookings.service.js:166-170` | IDOR vulnerability: Requesters can access any booking's private details by ID | Verify `req.auth.userId === booking.requesterUserId` or user has Admin privileges |
| **BUG-04** | Bookings | **MEDIUM** | `bookings.service.js:86-139` | Auto-approved booking returns stale `status: 'Pending'` in response body | Return `{ ...booking, status: 'Approved', approverUserId: approver.userId }` |
| **BUG-05** | Approvals | **MEDIUM** | `approvals.service.js:34-69` | Approvers can reject bookings without providing mandatory rejection remarks | Enforce `if (decision === 'Rejected' && !remarks?.trim()) throw ApiError.badRequest(...)` |
| **BUG-06** | Bookings | **MEDIUM** | `bookings.validation.js:5-18` | System permits submitting booking requests for past dates | Add validation to reject `bookingDate < today` |
| **BUG-07** | Bookings | **MEDIUM** | `bookings.service.js:202-216` | `getLiveStatus` uses server local timezone instead of IST (UTC+5:30) | Parse IST time explicitly using `Intl.DateTimeFormat` with `Asia/Kolkata` |
| **BUG-08** | Core / Middleware | **LOW** | `errorHandler.js:36-38` | Full error stack trace returned in 500 API responses | Hide `stack` and `details` when `env.nodeEnv !== 'development'` |
| **BUG-09** | Auth | **LOW** | `auth.service.js:53-69` | Refresh token is not rotated and missing from refresh response | Issue new refresh token on refresh and update DB |
| **BUG-10** | Users / RBAC | **LOW** | `users.routes.js:83-90` | Requesters can list all users across all departments while Dept Admins are restricted | Scope user directory query or restrict requester user list access |
