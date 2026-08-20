# Backend Adversarial Verification & Stress Challenge Report

**Subsystem**: `crms-backend`  
**Agent**: Challenger 1 (Backend Adversarial Verifier)  
**Date**: 2026-08-16  

---

## 1. Observation

### 1.1 Concurrency & Interval Overlap Algebra
- **File**: `crms-backend/src/modules/bookings/bookings.repository.js` (lines 8-20)
  ```js
  function findOverlappingBookings(tx, { resourceId, bookingDate, startTime, endTime, excludeBookingId }) {
    return (tx || prisma).booking.findMany({
      where: {
        resourceId,
        bookingDate: new Date(bookingDate),
        status: { in: ACTIVE_STATUSES },
        ...(excludeBookingId && { bookingId: { not: excludeBookingId } }),
        // classic interval-overlap check: existing.start < new.end AND existing.end > new.start
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
  }
  ```
- **Transaction Isolation**: `crms-backend/src/modules/bookings/bookings.service.js` (line 40, 117):
  ```js
  return prisma.$transaction(
    async (tx) => { ... },
    { isolationLevel: 'Serializable' }
  );
  ```
- **Error Handler**: `crms-backend/src/middleware/errorHandler.js` (lines 15-32):
  Prisma unique violation `P2002` maps to 409 and foreign-key `P2003` maps to 400. However, Prisma transaction serialization conflict code `P2034` is unhandled and falls through to:
  ```js
  const status = err.statusCode || 500;
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
  });
  ```

### 1.2 Timetable Day-of-Week Invariance
- **File**: `crms-backend/src/modules/bookings/bookings.service.js` (lines 16-21):
  ```js
  function dayOfWeekFor(dateStr) {
    const d = new Date(`${dateStr}T00:00:00Z`);
    return DAY_NAMES[d.getUTCDay()];
  }
  ```
- Timetable conflict query in `bookings.repository.js` (lines 22-31) applies `dayOfWeek`, `startTime: { lt: endTime }`, and `endTime: { gt: startTime }`.

### 1.3 Section 56 Approver Resolution
- **File**: `crms-backend/src/modules/resources/resources.service.js` (lines 24-40):
  ```js
  const INSTITUTE_OWNED_TYPES = new Set(['Seminar Hall', 'Auditorium']);

  async function resolveApprover(resource) {
    const isInstituteOwned = INSTITUTE_OWNED_TYPES.has(resource.resourceType.typeName);

    const approver = isInstituteOwned
      ? await prisma.user.findFirst({ where: { roleId: ROLES.INSTITUTE_ADMIN, status: 'Active' } })
      : resource.departmentId
      ? await prisma.user.findFirst({
          where: { roleId: ROLES.DEPARTMENT_ADMIN, departmentId: resource.departmentId, status: 'Active' },
        })
      : null;

    if (approver) return approver;

    return prisma.user.findFirst({ where: { roleId: ROLES.SUPER_ADMIN, status: 'Active' } });
  }
  ```

### 1.4 State Machine & Authorization
- **File**: `crms-backend/src/modules/approvals/approvals.service.js` (lines 22-44):
  - `canDecide()` strictly validates:
    - Super Admin -> unrestricted (`true`)
    - Specifically assigned `approverUserId` -> `true`
    - Department Admin -> restricted to matching `resource.departmentId === auth.departmentId`
    - Requester (Role 4) / Cross-department -> `false` -> throws 403 Forbidden
  - Repeat decision prevention: throws 409 Conflict if `approval.decision` is already populated.
- **Pending Approvals Listing Query Blind Spot**: `crms-backend/src/modules/approvals/approvals.repository.js` (lines 12-34):
  ```js
  function listPendingFor({ approverUserId, roleId, departmentId }) {
    return prisma.approval.findMany({
      where: {
        decision: null,
        OR: [
          { approverUserId },
          {
            approverRoleId: roleId,
            booking: departmentId ? { resource: { departmentId } } : undefined,
          },
        ],
      },
      ...
    });
  }
  ```
  When Super Admin (`roleId: 1`, `departmentId: null`) queries pending approvals, this `OR` filter only returns approvals where `approverUserId: 1` or `approverRoleId: 1`. Pending approvals routed to Department Admins (`approverRoleId: 3`) or Institute Admin (`approverRoleId: 2`) are excluded from Super Admin's pending queue.

### 1.5 Booking Cancellation Authorization
- **File**: `crms-backend/src/modules/bookings/bookings.service.js` (lines 152-172):
  ```js
  async function cancel(bookingId, actingUserId) {
    const booking = await repo.findById(bookingId);
    if (!booking) throw ApiError.notFound(`Booking ${bookingId} not found`);

    const isOwner = booking.requesterUserId === actingUserId;
    if (!isOwner) {
      throw ApiError.forbidden('Only the person who made this booking can cancel it');
    }
    if (!['Pending', 'Approved'].includes(booking.status)) {
      throw ApiError.conflict(`Booking is already ${booking.status}, cannot cancel`);
    }

    const updated = await repo.updateStatus(null, bookingId, 'Cancelled');
    ...
  }
  ```
  `cancel()` enforces strict owner identity (`isOwner = booking.requesterUserId === actingUserId`). Admins (Super Admin / Institute Admin) cannot administratively cancel bookings made by other users.

### 1.6 Auth & Token Security
- **File**: `crms-backend/src/middleware/authenticate.js` (lines 7-26) & `jwt.js` (lines 11-37):
  - Verifies signature, expiration, and algorithm.
  - Rejects missing, empty, or non-Bearer headers with 401.
  - Extracts `{ userId: sub, roleId, departmentId }` onto `req.auth`.
- **File**: `crms-backend/src/middleware/authorizeRole.js` (lines 15-25):
  - Rejects missing `req.auth` with 401.
  - Rejects roles not in `allowedRoleIds` with 403.

---

## 2. Logic Chain

1. **Interval Overlap Mathematical Soundness**:
   - For any two open/half-open intervals $[A_1, A_2)$ and $[B_1, B_2)$:
     - $[A_1, A_2) \cap [B_1, B_2) \neq \emptyset \iff A_1 < B_2 \land A_2 > B_1$.
   - **Boundary 1 (Adjacent Predecessor)**: Existing $[09:00, 10:00)$, New $[10:00, 11:00)$.
     - $A_1 < B_2 \implies 09:00 < 11:00$ (true).
     - $A_2 > B_1 \implies 10:00 > 10:00$ (false).
     - Condition evaluates to false $\implies$ NO conflict.
   - **Boundary 2 (Adjacent Successor)**: Existing $[11:00, 12:00)$, New $[10:00, 11:00)$.
     - $A_1 < B_2 \implies 11:00 < 11:00$ (false).
     - Condition evaluates to false $\implies$ NO conflict.
   - **Overlap (Left / Right / Enclosing / Enclosed / Exact)**: Evaluates to true $\implies$ Conflict detected (409 Conflict).
   - Invariant verified algebraically and confirmed in test suite.

2. **Concurrency & Race Condition Handling**:
   - `prisma.$transaction(..., { isolationLevel: 'Serializable' })` guarantees serializable execution in PostgreSQL.
   - Under race conditions, the transaction that commits second encounters serialization failure (`P2034`).
   - Because `errorHandler.js` lacks a handler for `P2034`, it emits HTTP 500 rather than HTTP 409 Conflict with retry guidance.

3. **Section 56 Ownership Resolution**:
   - `INSTITUTE_OWNED_TYPES` (`Seminar Hall`, `Auditorium`) maps directly to `ROLES.INSTITUTE_ADMIN` (Role 2).
   - Resources with `departmentId` map to `ROLES.DEPARTMENT_ADMIN` (Role 3) of that department.
   - Unassigned resources or missing department admins gracefully fallback to `ROLES.SUPER_ADMIN` (Role 1).
   - No hardcoded resource names exist; routing strictly depends on metadata properties (`typeName`, `departmentId`).

4. **Approval State Machine Security**:
   - `canDecide()` prevents Requesters (Role 4) and cross-department Dept Admins from deciding requests (403 Forbidden).
   - Re-deciding an already 'Approved' or 'Rejected' booking throws 409 Conflict.
   - Self-approval observation: An admin who creates a booking for their own department's resource is assigned as the approver and can approve their own request without secondary escalation.

5. **Auth & Token Verification Security**:
   - Tampered tokens, invalid secrets, and expired tokens throw errors caught by `authenticate` middleware and return 401.
   - `authorizeRole` correctly gates Super Admin vs Dept Admin vs Requester endpoints.

---

## 3. Caveats

- **No Caveats on Core Logic**: The algorithmic logic for interval overlap, Section 56 approver routing, JWT signing/verifying, and role checking is mathematically robust and verified.
- **Observed Architectural Weaknesses & Recommendations**:
  1. **Prisma Serialization Error Handling (`P2034`)**: Add `if (err.code === 'P2034') return res.status(409).json({ error: 'Concurrent booking conflict. Please retry.' });` to `crms-backend/src/middleware/errorHandler.js`.
  2. **Super Admin Pending Approvals Visibility**: In `approvals.repository.js` `listPendingFor`, when `roleId === ROLES.SUPER_ADMIN`, the query should return all pending approvals (`where: { decision: null }`) without restricting by `approverUserId`/`approverRoleId`.
  3. **Admin Cancellation Override**: In `bookings.service.js` `cancel()`, support admin overrides:
     `const canCancel = isOwner || [ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN].includes(actingAuth.roleId);`.
  4. **Segregation of Duties (Self-Approval)**: If `booking.requesterUserId === auth.userId` and `auth.roleId !== ROLES.SUPER_ADMIN`, consider requiring secondary or Super Admin approval.
  5. **Past Date Booking Validation**: Add a check in `createBookingSchema` or `bookings.service.js` to reject bookings with `bookingDate < currentDate`.

---

## 4. Conclusion

**Overall Assessment**: **HIGH ROBUSTNESS WITH MINOR OPERATIONAL DEFECTS IDENTIFIED**

- **Conflict Detection & Interval Algebra**: **PASS** (Zero boundary off-by-one errors; adjacent slots fit perfectly; overlapping slots strictly blocked).
- **Timetable Invariance**: **PASS** (UTC date parsing prevents timezone shifting across day boundaries).
- **Section 56 Routing Policy**: **PASS** (Institute vs Department vs Fallback routing adheres precisely to specifications).
- **Approval State Machine**: **PASS** (State transitions are deterministic; repeat decisions are rejected with 409).
- **Auth & JWT Security**: **PASS** (Token forgery, expiration, algorithm manipulation, and role privilege escalation are completely prevented).
- **Operational Findings**: 5 actionable findings documented with exact file locations and remediation steps.

---

## 5. Verification Method

### Test Files Created:
1. `crms-backend/tests/adversarial_challenge.test.js` — 25 exhaustive adversarial unit/integration tests covering:
   - Interval overlap matrix (adjacent before, adjacent after, left overlap, right overlap, enclosing, enclosed, exact match, disjoint)
   - Timetable day-of-week sensitivity
   - Section 56 ownership routing (Institute Admin, Dept Admin, Super Admin fallback)
   - State machine repeat prevention (409 Conflict)
   - Decision authorization & cross-department rejection (403 Forbidden)
   - Cancellation authorization & duplicate cancellation prevention
   - JWT forgery, expiration, malformed headers, and role middleware authorization

### Verification Commands:
Run the complete backend test suite:
```bash
cd crms-backend
npm test
```
Or run the adversarial challenge suite directly:
```bash
node --test tests/adversarial_challenge.test.js
```
