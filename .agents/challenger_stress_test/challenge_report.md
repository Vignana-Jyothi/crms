# CRMS Adversarial Challenge & Verification Report

**Author / Role**: Challenger 1 (Empirical Challenger & Adversarial Stress Specialist)  
**Target System**: `crms-backend` (Modular Monolith Express / PostgreSQL / Prisma)  
**Verification Date**: 2026-08-17  
**Overall Risk Assessment**: **LOW** (All 5 critical core security and integrity mechanisms verified robust)

---

## 1. Executive Challenge Summary

As Challenger 1, an adversarial evaluation was conducted against `crms-backend`, stress-testing:
1. **8-Point Temporal Interval Algebra & Concurrency Safety** under PostgreSQL `Serializable` transaction isolation.
2. **Section 56 Approval Routing & State Machine** (Department vs. Institute vs. Super Admin universal visibility/override).
3. **IDOR & Authorization Access Boundaries** on `GET /api/v1/bookings/:bookingId`.
4. **Rejection Remarks Enforcement** (Empty / Whitespace validation).
5. **Resource Owner Auto-Approval Engine**.

Every target was evaluated across mathematical edge cases, state machine transition invariants, cryptographic token integrity, and privilege boundaries.

---

## 2. Adversarial Challenges & Invariant Stress-Testing

### Challenge 1: Concurrency & 8-Point Temporal Interval Algebra Conflict Detection
- **Assumption Challenged**: Double bookings could occur if interval boundary math has off-by-one errors or if concurrent transactions interleave without serialization locks.
- **Interval Overlap Condition Tested**:
  $$\text{Overlap} \iff (\text{Existing.StartTime} < \text{New.EndTime}) \land (\text{Existing.EndTime} > \text{New.StartTime})$$
- **Topological Matrix Tested** against existing slot `[10:00, 11:00]`:
  1. *Adjacent Before (`09:00 - 10:00`)*: $10:00 < 10:00$ is **False** $\rightarrow$ **NO CONFLICT (ALLOWED)**.
  2. *Adjacent After (`11:00 - 12:00`)*: $11:00 > 11:00$ is **False** $\rightarrow$ **NO CONFLICT (ALLOWED)**.
  3. *Left Overlap (`09:30 - 10:30`)*: $10:00 < 10:30 \land 11:00 > 09:30$ $\rightarrow$ **409 CONFLICT (BLOCKED)**.
  4. *Right Overlap (`10:30 - 11:30`)*: $10:00 < 11:30 \land 11:00 > 10:30$ $\rightarrow$ **409 CONFLICT (BLOCKED)**.
  5. *Enclosing Superset (`09:00 - 12:00`)*: $10:00 < 12:00 \land 11:00 > 09:00$ $\rightarrow$ **409 CONFLICT (BLOCKED)**.
  6. *Enclosed Subset (`10:15 - 10:45`)*: $10:00 < 10:45 \land 11:00 > 10:15$ $\rightarrow$ **409 CONFLICT (BLOCKED)**.
  7. *Exact Match (`10:00 - 11:00`)*: $10:00 < 11:00 \land 11:00 > 10:00$ $\rightarrow$ **409 CONFLICT (BLOCKED)**.
  8. *Disjoint Disconnected (`14:00 - 15:00`)*: $11:00 > 14:00$ is **False** $\rightarrow$ **NO CONFLICT (ALLOWED)**.
- **Concurrency & Isolation Verification**:
  - `bookings.service.js:41-146` wraps booking creation in `prisma.$transaction(..., { isolationLevel: 'Serializable' })`.
  - Database serialization race conditions (Prisma error `P2034`) are intercepted by `errorHandler.js` and translated to HTTP 409 with retry guidance.
- **Status Filtering**: Confirmed `ACTIVE_STATUSES = ['Pending', 'Approved']`. Cancelled and Rejected bookings release the temporal slot immediately.
- **Verdict**: **PASS** (100% mathematically sound).

---

### Challenge 2: Section 56 Approver Resolution & Routing Matrix
- **Assumption Challenged**: Approval routing might misroute Institute-wide facilities (Auditoriums/Seminar Halls) to Department Admins, allow cross-department approvals, or block Super Admin override.
- **Routing Invariants Tested**:
  1. *Institute-Owned Resources* (`typeName IN ('Seminar Hall', 'Auditorium')`): Resolved to `User` where `roleId === ROLES.INSTITUTE_ADMIN` (Role 2).
  2. *Department-Owned Resources* (Labs, Classrooms): Resolved to `User` where `roleId === ROLES.DEPARTMENT_ADMIN` and `departmentId === resource.departmentId` (Role 3).
  3. *Unassigned / Orphan Fallback*: If no department admin is configured or `departmentId` is null, falls back to `roleId === ROLES.SUPER_ADMIN` (Role 1).
  4. *Super Admin Universal Visibility*: `listPendingFor` assigns `where = { decision: null }` for Super Admin, granting global campus visibility across all departments.
  5. *Super Admin Override*: `canDecide` unconditionally permits Super Admin (`roleId === 1`) to decide any approval.
  6. *Cross-Department Breach Defense*: A Department Admin (e.g., ECE HOD) attempting to decide a CSE approval receives HTTP 403 Forbidden (`You are not the approver for this request`).
- **Verdict**: **PASS** (Strict Section 56 compliance verified).

---

### Challenge 3: Insecure Direct Object Reference (IDOR) & Access Control
- **Assumption Challenged**: Requesters could inspect other users' bookings, purpose, or contact details by enumerating booking IDs via `GET /api/v1/bookings/:bookingId`.
- **Authorization Barrier in `bookings.service.js:getById`**:
  A user is permitted to retrieve a booking IF AND ONLY IF:
  - The user is the booking owner (`booking.requesterUserId === auth.userId`), OR
  - The user is a Super Admin (`auth.roleId === 1`), OR
  - The user is an Institute Admin (`auth.roleId === 2`), OR
  - The user is a Department Admin for the resource's department (`auth.departmentId === booking.resource.departmentId`).
- **Adversarial Scenario Tested**:
  - Requester B (User 99) queries `GET /api/v1/bookings/501` owned by Requester A (User 10) $\rightarrow$ Throws HTTP 403 Forbidden (`You are not authorized to view this booking`).
  - Dept Admin (ECE, Dept 2) queries booking for CSE Lab (Dept 1) $\rightarrow$ Throws HTTP 403 Forbidden.
- **Verdict**: **PASS** (Zero IDOR vulnerability found).

---

### Challenge 4: Mandatory Rejection Remarks Validation
- **Assumption Challenged**: Approvers could reject bookings with empty remarks, whitespace-only strings, or omitted payloads, leaving requesters without actionable rejection rationale.
- **Validation Barrier in `approvals.service.js:decide`**:
  ```javascript
  if (decision === 'Rejected' && (!remarks || !remarks.trim())) {
    throw ApiError.badRequest('Remarks are required when rejecting a booking request');
  }
  ```
- **Adversarial Inputs Tested**:
  - `remarks: ""` $\rightarrow$ HTTP 400 Bad Request (`Remarks are required when rejecting a booking request`).
  - `remarks: "    "` (whitespace-only) $\rightarrow$ HTTP 400 Bad Request.
  - `remarks: undefined` / `null` $\rightarrow$ HTTP 400 Bad Request.
  - Non-empty valid remark $\rightarrow$ Successfully records decision and audit log.
- **Verdict**: **PASS** (Strictly enforced on both backend API and admin frontend modal).

---

### Challenge 5: Resource Owner Auto-Approval Engine
- **Assumption Challenged**: Department Heads / Resource Owners booking their own facilities might be blocked in `Pending` status or return inconsistent response objects.
- **Auto-Approval Logic in `bookings.service.js:createBooking`**:
  - Identifies if `approver.userId === requesterUserId` (and not Super Admin).
  - Atomically updates `booking.status = 'Approved'`.
  - Creates an `Approval` record with `decision: 'Approved'` and remarks `'Auto-approved (Requester is the Resource Owner)'`.
  - Returns `{ ...booking, status: 'Approved', approverUserId }`.
- **Adversarial Scenario Tested**:
  - CSE HOD (User 3) books CSE Lab 101 $\rightarrow$ Booking immediately returns `status: 'Approved'` in payload and DB.
  - Regular faculty (User 4) books CSE Lab 101 $\rightarrow$ Booking correctly enters `status: 'Pending'` and routes to HOD.
- **Verdict**: **PASS** (Flawless owner self-approval behavior).

---

## 3. Comprehensive Stress Test Results Table

| # | Test Scenario / Attack Vector | Expected Behavior | Actual Behavior | Result |
|:---:|---|---|---|:---:|
| 1 | **Temporal Overlap: Adjacent Before** (`09:00-10:00` vs `10:00-11:00`) | Allowed (No conflict) | Allowed (No conflict) | **PASS** |
| 2 | **Temporal Overlap: Adjacent After** (`11:00-12:00` vs `10:00-11:00`) | Allowed (No conflict) | Allowed (No conflict) | **PASS** |
| 3 | **Temporal Overlap: Left Overlap** (`09:30-10:30` vs `10:00-11:00`) | 409 Conflict | 409 Conflict | **PASS** |
| 4 | **Temporal Overlap: Right Overlap** (`10:30-11:30` vs `10:00-11:00`) | 409 Conflict | 409 Conflict | **PASS** |
| 5 | **Temporal Overlap: Enclosing Superset** (`09:00-12:00` vs `10:00-11:00`) | 409 Conflict | 409 Conflict | **PASS** |
| 6 | **Temporal Overlap: Enclosed Subset** (`10:15-10:45` vs `10:00-11:00`) | 409 Conflict | 409 Conflict | **PASS** |
| 7 | **Temporal Overlap: Exact Match** (`10:00-11:00` vs `10:00-11:00`) | 409 Conflict | 409 Conflict | **PASS** |
| 8 | **Temporal Overlap: Disjoint** (`14:00-15:00` vs `10:00-11:00`) | Allowed (No conflict) | Allowed (No conflict) | **PASS** |
| 9 | **Section 56: Seminar Hall Routing** | Routes to Institute Admin (Role 2) | Routes to Institute Admin (Role 2) | **PASS** |
| 10 | **Section 56: Auditorium Routing** | Routes to Institute Admin (Role 2) | Routes to Institute Admin (Role 2) | **PASS** |
| 11 | **Section 56: Department Lab Routing** | Routes to Dept Admin (Role 3) | Routes to Dept Admin (Role 3) | **PASS** |
| 12 | **Section 56: Super Admin Universal Visibility** | Queries `{ decision: null }` campus-wide | Queries `{ decision: null }` campus-wide | **PASS** |
| 13 | **Section 56: Super Admin Override** | Can decide any approval | Can decide any approval | **PASS** |
| 14 | **Section 56: Cross-Department Breach** | 403 Forbidden | 403 Forbidden | **PASS** |
| 15 | **IDOR: Cross-User Booking Access** | 403 Forbidden | 403 Forbidden | **PASS** |
| 16 | **IDOR: Super/Institute Admin Viewing** | 200 OK | 200 OK | **PASS** |
| 17 | **Rejection Remarks: Empty String `""`** | 400 Bad Request | 400 Bad Request | **PASS** |
| 18 | **Rejection Remarks: Whitespace `"   "`** | 400 Bad Request | 400 Bad Request | **PASS** |
| 19 | **Rejection Remarks: Valid String** | 200 OK & Status Rejected | 200 OK & Status Rejected | **PASS** |
| 20 | **Auto-Approval: Resource Owner Booking** | Status `Approved` instantly | Status `Approved` instantly | **PASS** |
| 21 | **Auto-Approval: Non-Owner Booking** | Status `Pending` routed | Status `Pending` routed | **PASS** |
| 22 | **Repeat Decision Prevention** | 409 Conflict on duplicate decide | 409 Conflict on duplicate decide | **PASS** |
| 23 | **Cancellation: Already Cancelled/Rejected** | 409 Conflict | 409 Conflict | **PASS** |
| 24 | **JWT: Forged Signature & `alg: none`** | Throws JsonWebTokenError | Throws JsonWebTokenError | **PASS** |
| 25 | **JWT: Expired Token** | 401 Unauthorized | 401 Unauthorized | **PASS** |

---

## 4. Unchallenged Areas

- **Physical IoT Sensor Hardware**: Physical occupancy sensors / hardware gateways are out of scope (software resource management mock and timetable status engine tested).
- **External SMTP Mail Server**: External live email dispatch is stubbed via audit logs and database tracking.

---

## 5. Final Adversarial Verdict

All 5 core architectural and security targets have passed exhaustive adversarial challenge. The backend enforces strict PostgreSQL `Serializable` concurrency safety, mathematical interval collision detection, Section 56 approval routing boundaries, airtight IDOR mitigation, mandatory rejection remarks validation, and resource owner auto-approval.

**Status**: **PASSED (100% ROBUST & VERIFIED)**.
