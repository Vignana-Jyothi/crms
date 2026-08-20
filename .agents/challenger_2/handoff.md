# End-to-End Workflow & Integration Challenge Report (Challenger 2)

**Timestamp**: 2026-08-16T15:51:00Z  
**Agent**: Challenger 2 (E2E Workflow & Integration Challenger)  
**Target Subsystems**: `crms-backend`, `crms-main-frontend`, `crms-admin-frontend`  
**Overall Verdict**: **PASS WITH ADVERSARIAL FINDINGS** (Core E2E workflows A, B, C, D are structurally sound and verified; 2 client-side edge-case bugs identified for remediation).

---

## 1. Observations

### 1.1 Scenario A: Seminar Hall (Institute-Owned) Lifecycle
- **Resource Ownership Definition**:
  In `crms-backend/src/modules/resources/resources.service.js` (lines 24-40):
  ```javascript
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
- **Booking Creation & Approval Dispatch**:
  In `crms-backend/src/modules/bookings/bookings.service.js` (lines 85-116):
  `createBooking` initiates a `Serializable` transaction creating a booking with `status: 'Pending'`, calls `resolveApprover(resource)` which matches `INSTITUTE_ADMIN`, and persists an `Approval` record with `approverUserId: approver.userId`, `approverRoleId: 2`.
- **Approval Decision & Requester Visibility**:
  In `crms-backend/src/modules/approvals/approvals.service.js` (lines 35-66):
  `decide(approvalId, 'Approved', remarks, auth)` updates the approval record with `decision: 'Approved'` and `decisionAt`, and updates the booking status to `Approved`.
  In `crms-main-frontend/src/pages/MyBookings.jsx` (lines 6-9, 77-79):
  `STATUS_STYLE['Approved']` formats the status as a green badge (`'bg-forest-light text-forest'`).

### 1.2 Scenario B: Department Classroom Lifecycle
- **Department Routing**:
  When `resource.resourceType.typeName` is `'Classroom'` and `resource.departmentId` is `1` (CSE), `resolveApprover` checks `INSTITUTE_OWNED_TYPES.has('Classroom')` (`false`) and queries `prisma.user.findFirst({ where: { roleId: ROLES.DEPARTMENT_ADMIN, departmentId: 1, status: 'Active' } })`, successfully resolving to the CSE Department Admin.
- **Rejection with Remarks**:
  When the Department Admin invokes `approvalsApi.reject(approvalId, remarks)`, `approvals.service.js` line 52 updates booking status to `'Rejected'` and writes an audit log (`REJECTED_BOOKING`).
- **Status Display & Cancellation Gating**:
  In `crms-main-frontend/src/pages/MyBookings.jsx` (lines 80-89), the cancellation action is restricted to `['Pending', 'Approved'].includes(b.status)`. When status is `Rejected`, the cancel button is hidden, and attempts to cancel a rejected booking at the backend endpoint `POST /bookings/:id/cancel` are rejected with HTTP 409 Conflict (`bookings.service.js` line 161).

### 1.3 Scenario C: Conflicting Booking & Overlap Prevention
- **Interval Overlap Arithmetic**:
  In `crms-backend/src/modules/bookings/bookings.repository.js` (lines 8-20):
  ```javascript
  function findOverlappingBookings(tx, { resourceId, bookingDate, startTime, endTime, excludeBookingId }) {
    return (tx || prisma).booking.findMany({
      where: {
        resourceId,
        bookingDate: new Date(bookingDate),
        status: { in: ACTIVE_STATUSES },
        ...(excludeBookingId && { bookingId: { not: excludeBookingId } }),
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
  }
  ```
- **Conflict Response Payload**:
  In `crms-backend/src/modules/bookings/bookings.service.js` (lines 68-83):
  Throws `ApiError.conflict('This slot overlaps an existing booking', { conflicts: [{ bookingId, startTime, endTime, status }] })` with HTTP status 409.
- **Frontend Conflict Formatting**:
  In `crms-main-frontend/src/pages/ResourceDetail.jsx` (lines 58-63):
  ```javascript
  if (data?.details?.conflicts && Array.isArray(data.details.conflicts) && data.details.conflicts.length > 0) {
    setError(
      `${data.error}: ${data.details.conflicts
        .map((c) => `${new Date(c.startTime).toISOString().slice(11, 16)}–${new Date(c.endTime).toISOString().slice(11, 16)}`)
        .join(', ')}`
    );
  }
  ```
  Formats conflicting slots accurately (e.g., `"This slot overlaps an existing booking: 14:00–16:00"`).

### 1.4 Scenario D: Admin Portal Role Gating & RBAC Isolation
- **Requester Rejection in Admin Frontend**:
  In `crms-admin-frontend/src/context/AuthContext.jsx` (lines 28-35):
  ```javascript
  if (loggedInUser.role === 'Requester') {
    authApi.logout();
    throw new Error('This account does not have admin access. Use the main booking site instead.');
  }
  ```
  Caught in `crms-admin-frontend/src/pages/Login.jsx` (line 21) and displayed as an error banner.
- **Department Admin Scope Enforcement**:
  - `crms-admin-frontend/src/components/Sidebar.jsx` (lines 6-13, 32): Nav items `Resources`, `Users`, and `Audit logs` are restricted to `roles: [ROLES.SUPER_ADMIN]`.
  - `crms-admin-frontend/src/App.jsx` (lines 35-58): Routes are wrapped with `<RequireRole roles={[ROLES.SUPER_ADMIN]}>` which redirects non-Super-Admins to `/`.
  - `crms-backend/src/modules/approvals/approvals.service.js` (lines 22-33): `canDecide` enforces `approval.booking.resource.departmentId === auth.departmentId` for Department Admins.
  - `crms-backend/src/modules/bookings/bookings.controller.js` (lines 18-20): `filters.departmentId = req.auth.departmentId` is enforced server-side.
  - `crms-backend/src/modules/users/users.routes.js` (lines 86-88): `users` list is scoped server-side to `req.auth.departmentId`.
- **Super Admin Global Authority**:
  Super Admin has unrestricted permissions across all approval decisions, booking listings, user provisioning, and audit logs.

### 1.5 Frontend API Clients & Formatting (Defects Identified)
- **Defect 1 (`crms-admin-frontend/src/api/client.js` lines 33-58)**:
  `crms-admin-frontend`'s response interceptor lacks the `isAuthEndpoint` guard present in `crms-main-frontend`.
  ```javascript
  // crms-admin-frontend/src/api/client.js
  client.interceptors.response.use(
    (res) => res,
    async (error) => {
      const original = error.config;
      if (error.response?.status === 401 && !original._retried && getRefreshToken()) {
        original._retried = true;
        try {
          if (!refreshInFlight) {
            refreshInFlight = axios
              .post(`${baseURL}/auth/refresh`, { refreshToken: getRefreshToken() })
              .finally(() => {
                refreshInFlight = null;
              });
          }
          const { data } = await refreshInFlight;
          setTokens({ accessToken: data.accessToken });
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return client(original);
        } catch {
          clearTokens();
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );
  ```
  If a user has an expired/stale `crms_refresh_token` in `localStorage` and fails to log in with bad credentials on `/auth/login` (401 response), the interceptor intercepts the failed login request, calls `/auth/refresh` with the stale token, fails, calls `clearTokens()`, and executes `window.location.href = '/login'`, causing a redirect reload loop instead of letting `Login.jsx` display `"Invalid email or password"`.
- **Defect 2 (`crms-main-frontend/src/pages/MyBookings.jsx` lines 11-13, 72)**:
  ```javascript
  function fmtTime(iso) {
    return new Date(iso).toISOString().slice(11, 16);
  }
  ```
  If `b.startTime` or `b.endTime` is ever returned as a plain string (`"09:30:00"` or `"09:30"`), `new Date("09:30:00")` evaluates to `Invalid Date`, and `.toISOString()` immediately throws `RangeError: Invalid time value`, crashing the React render tree.

---

## 2. Logic Chain

1. **Routing Accuracy (Scenarios A & B)**:
   - `resolveApprover` checks whether `resource.resourceType.typeName` is in `{'Seminar Hall', 'Auditorium'}`.
   - For Seminar Hall (`SH-AUD-01`), it evaluates to `true` $\rightarrow$ resolves Institute Admin (`roleId: 2`).
   - For Classroom (`CSE-CR-205`), it evaluates to `false` $\rightarrow$ inspects `resource.departmentId` $\rightarrow$ resolves Department Admin (`roleId: 3, departmentId: 1`).
   - When approvals are submitted, `approvals.service.js` updates the booking status to `Approved` or `Rejected` atomically in a database transaction and emits an audit record.
   - Requesters querying `/api/v1/bookings` receive the updated status, reflected with appropriate color-coded UI badges.

2. **Conflict Invariant Preservation (Scenario C)**:
   - The interval query `startTime < newEndTime AND endTime > newStartTime` mathematically detects all four interval overlap geometries (head overlap, tail overlap, subset, superset) while permitting exact-boundary contiguous slots.
   - The transaction executes under `Serializable` isolation, eliminating race conditions under concurrent submissions.
   - Frontend error handlers parse `data.details.conflicts` and display formatted conflicting time spans.

3. **RBAC Isolation & Portal Gating (Scenario D)**:
   - Requester logins to the Admin portal are intercepted at `AuthContext.jsx` before route rendering, purging tokens and displaying a clear rejection banner.
   - Department Admin navigation is pruned in `Sidebar.jsx`, guarded in `RequireRole.jsx`, and strictly scoped server-side on queries for `/bookings`, `/users`, and `/approvals/pending`.
   - Super Admin has full system visibility across all modules.

4. **Client-Side Interceptor Flaw**:
   - In `crms-admin-frontend/src/api/client.js`, because `isAuthEndpoint` is not filtered, any 401 on `/auth/login` triggers silent token refresh if a stale refresh token is present in localStorage, corrupting login error reporting.

---

## 3. Caveats

1. **Multi-Node Distributed Concurrency**: Concurrency guarantees were verified using PostgreSQL `Serializable` transactions; high-throughput clusters may benefit from the documented PostgreSQL `EXCLUDE USING gist` range constraints for zero-overhead hardware-level overlap prevention.
2. **Review-Only Constraint**: In adherence to the empirical challenger role constraints, identified frontend defects were thoroughly documented and verified with test assertions rather than modified directly in production source code.

---

## 4. Conclusion

- **Workflow Verification**: Scenarios A, B, C, and D are **FULLY FUNCTIONAL, INTEGRATED, AND VERIFIED**.
- **Audit Trail**: Every booking lifecycle event (`CREATE_BOOKING`, `APPROVED_BOOKING`, `REJECTED_BOOKING`, `CANCEL_BOOKING`) creates a non-blocking, queryable audit record linked to the acting user.
- **Remediation Recommendations**:
  1. Add `const isAuthEndpoint = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh');` to `crms-admin-frontend/src/api/client.js` to mirror `crms-main-frontend`.
  2. Adopt the safe formatting functions from `crms-admin-frontend/src/utils/formatters.js` in `crms-main-frontend/src/pages/MyBookings.jsx` to prevent `RangeError` crashes on non-ISO time inputs.

---

## 5. Verification Method

To independently execute and verify the end-to-end integration and challenge tests:

1. **Run the Full Test Suite**:
   ```bash
   cd "d:\New folder\hall_booking\crms-backend"
   node --test tests/e2e_integration_challenger2.test.js
   node --test tests/**/*.test.js
   ```
2. **Files to Inspect**:
   - `crms-backend/tests/e2e_integration_challenger2.test.js` (E2E integration test suite covering Scenarios A-D)
   - `crms-backend/src/modules/resources/resources.service.js` (Approver resolution logic)
   - `crms-backend/src/modules/approvals/approvals.service.js` (Approval state machine)
   - `crms-backend/src/modules/bookings/bookings.repository.js` (Conflict interval logic)
   - `crms-admin-frontend/src/api/client.js` (Line 37 interceptor logic)
   - `crms-main-frontend/src/pages/MyBookings.jsx` (Line 11-13 time formatting)
