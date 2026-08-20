## Forensic Audit Report

**Work Product**: Campus Resource Management System (CRMS) Unified Codebase (`crms-backend`, `crms-main-frontend`, `crms-admin-frontend`) and Test Report (`test_report.md`)  
**Profile**: General Project (Forensic Integrity Audit)  
**Audit Date**: 2026-08-17  
**Auditor**: Forensic Auditor  
**Verdict**: **CLEAN**

---

### Executive Summary

An exhaustive forensic integrity audit was conducted across all source files, test suites, architecture contracts, and documentation of the CRMS repository (`d:\New folder\hall_booking`). The investigation verified every mathematical algorithm, transaction isolation boundary, authorization policy, cryptographic implementation, and test assertion against the project requirements and claims made in `test_report.md`.

**Zero integrity violations, zero fake tokens, zero hardcoded cheat paths, and zero dummy facades were detected.** All reported bug fixes (8 Backend, 6 Requester Frontend, 7 Admin Frontend) were empirically verified in the codebase at their exact locations.

---

### Phase Results & Forensic Checks

| # | Forensic Check Name | Scope | Verdict | Evidence Summary |
|---|---|---|:---:|---|
| **1** | **Hardcoded Output & Cheating Detection** | Backend & Frontends | **PASS** | No test-specific conditional branches (`if (input === 'test')`), no fabricated mocks in production code, no static token cheats. |
| **2** | **Facade & Dummy Detection** | Backend Modules | **PASS** | All routes delegate to real service layers with Prisma ORM database transactions, validation, and error mappings. |
| **3** | **Pre-Populated Artifact Detection** | Workspace Root | **PASS** | No fabricated test logs or fake verification outputs predating genuine execution. Real Vite production bundles in `dist/`. |
| **4** | **Booking Conflict Engine & Serializable Transactions** | `crms-backend` | **PASS** | Uses authentic mathematical interval overlap logic (`startTime: { lt: endTime }, endTime: { gt: startTime }`) under PostgreSQL `Serializable` transaction isolation. |
| **5** | **Section 56 Approval Routing & Role Hierarchy** | `crms-backend` | **PASS** | Dynamic DB-driven ownership resolution (`resolveApprover`), strict 4-tier RBAC (`ROLES.SUPER_ADMIN = 1`, `INSTITUTE_ADMIN = 2`, `DEPARTMENT_ADMIN = 3`, `REQUESTER = 4`), and mandatory rejection remarks validation. |
| **6** | **Cryptographic Security & Token Lifecycle** | `crms-backend` | **PASS** | Genuine Bcrypt with cost factor 12 salt rounds; dual JWT tokens with HMAC-SHA256 cryptography, expiration checks, and secret key tampering defenses. |
| **7** | **Frontend Real API Integration** | Both Frontends | **PASS** | Genuine Axios clients (`client.js`, `endpoints.js`), request Bearer injection, 401 coalescing token refresh, and complete UI-to-API state dispatching. |
| **8** | **Authoritative Verification of `test_report.md`** | `test_report.md` | **PASS** | 100% of the 21 bug fixes (B-01–B-08, F-01–F-06, A-01–A-07) match actual repository lines; test counts and assertions match genuine test code. |

---

### Detailed Forensic Evidence by Dimension

#### 1. Concurrency Safety & Conflict Detection Engine
- **File**: `crms-backend/src/modules/bookings/bookings.service.js` (lines 36–148)
- **File**: `crms-backend/src/modules/bookings/bookings.repository.js` (lines 8–31)
- **Verification Evidence**:
  - `createBooking` explicitly wraps resource lookup, timetable conflict check, and active booking conflict check inside:
    ```javascript
    return prisma.$transaction(async (tx) => {
      ...
    }, { isolationLevel: 'Serializable' });
    ```
  - Overlap arithmetic directly enforces the canonical interval overlap theorem:
    ```javascript
    where: {
      resourceId,
      bookingDate: new Date(bookingDate),
      status: { in: ACTIVE_STATUSES },
      ...(excludeBookingId && { bookingId: { not: excludeBookingId } }),
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    }
    ```
  - Prisma serialization conflicts (`P2034`) are caught in `errorHandler.js` (lines 28–30) and translated to HTTP 409 Conflict.

#### 2. Section 56 Approval Routing & RBAC Hierarchy
- **File**: `crms-backend/src/modules/resources/resources.service.js` (lines 24–40)
- **File**: `crms-backend/src/modules/approvals/approvals.service.js` (lines 22–73)
- **File**: `crms-backend/src/modules/approvals/approvals.repository.js` (lines 14–46)
- **Verification Evidence**:
  - `resolveApprover` inspects `INSTITUTE_OWNED_TYPES` (`new Set(['Seminar Hall', 'Auditorium'])`). If matched, routes to `INSTITUTE_ADMIN` (role 2). If department-owned, routes to `DEPARTMENT_ADMIN` (role 3) for `resource.departmentId`. If missing, falls back to `SUPER_ADMIN` (role 1).
  - `canDecide` strictly restricts Department Admins to their own department:
    ```javascript
    if (auth.roleId === ROLES.DEPARTMENT_ADMIN) {
      return approval.booking?.resource?.departmentId === auth.departmentId;
    }
    ```
  - Mandatory rejection remarks are validated in `approvals.service.js` (lines 44–46):
    ```javascript
    if (decision === 'Rejected' && (!remarks || !remarks.trim())) {
      throw ApiError.badRequest('Remarks are required when rejecting a booking request');
    }
    ```

#### 3. Cryptography & Authentication Security
- **File**: `crms-backend/src/modules/auth/auth.service.js` (lines 7–81)
- **File**: `crms-backend/src/utils/jwt.js` (lines 11–37)
- **Verification Evidence**:
  - Bcrypt salt rounds set to constant `12` in `auth.service.js` line 7.
  - User passwords verified via `bcrypt.compare(password, user.passwordHash)`.
  - JWT signing payload encodes `{ sub: user.userId, roleId: user.roleId, departmentId: user.departmentId }` signed with `env.jwt.accessSecret` and validated using `jsonwebtoken.verify`.
  - Timing attack defense: Login failure returns identical `ApiError.unauthorized('Invalid email or password')` whether the email does not exist or password is wrong.

#### 4. Verification of `test_report.md` Bug Inventory

All 21 documented bug fixes were verified line-by-line against the codebase:

1. **B-01** (`approvals.repository.js:16–18`): Super Admin global pending query `where = { decision: null }` verified.
2. **B-02** (`approvals.service.js:23, 44–46`): Super Admin decision override and mandatory rejection remarks verified.
3. **B-03** (`bookings.repository.js:43–48, 79–84`): `approvals` and `approverUser` relations included in booking lookups verified.
4. **B-04** (`bookings.service.js:175–186`): IDOR authorization validation in `getById` verified.
5. **B-05** (`bookings.service.js:101–108, 142`): Explicit `booking.status = 'Approved'` for auto-approved owner bookings verified.
6. **B-06** (`errorHandler.js:34, 38`): Production stack trace suppression `...(isDev && { stack: err.stack })` verified.
7. **B-07** (`audit.service.js:21`): `action` filter in `auditService.list` verified.
8. **B-08** (`bookings.service.js:203`): Institute Admin administrative cancellation authority verified.
9. **F-01** (`crms-main-frontend/src/pages/MyBookings.jsx:117–134`): Rejection reason alert banner and approver name display verified.
10. **F-02** (`crms-main-frontend/src/pages/ResourceDetail.jsx:58–64`): Safe `fmtTimeSlot` formatting preventing `RangeError` verified.
11. **F-03** (`crms-main-frontend/src/pages/Dashboard.jsx:8`): `'Lab'` badge color styling verified.
12. **F-04** (`crms-main-frontend/src/App.jsx:63`): Catch-all `<Route path="*" element={<Navigate to="/" replace />} />` verified.
13. **F-05** (`crms-main-frontend/src/api/client.js:37–39`): `!isAuthEndpoint` guard preventing 401 refresh loops verified.
14. **F-06** (`crms-main-frontend/src/components/AvailabilityStrip.jsx:8–23`): Safe time parser supporting `HH:MM` and ISO strings verified.
15. **A-01** (`crms-admin-frontend/src/pages/Approvals.jsx:50–63, 160–218`): Interactive Rejection Modal with mandatory remarks validation verified.
16. **A-02** (`crms-admin-frontend/src/pages/Approvals.jsx:106–127`): Requester phone, email, and department details verified.
17. **A-03** (`crms-admin-frontend/src/pages/Bookings.jsx:108–198, 312–352`): Multi-dimensional filter bar and Admin Cancel modal verified.
18. **A-04** (`crms-admin-frontend/src/pages/Resources.jsx:78–120, 278–453`): Resource Edit modal and Block/Floor/Capacity columns verified.
19. **A-05** (`crms-admin-frontend/src/pages/Users.jsx:65–77, 283–294, 330–399`): Department reassignment dropdown and Password Reset modal verified.
20. **A-06** (`crms-admin-frontend/src/pages/AuditLogs.jsx:50–115`): Action Type and Entity Type filter dropdowns verified.
21. **A-07** (`crms-admin-frontend/src/context/AuthContext.jsx:28–35`): Requester login gating into Admin app verified.

---

### Conclusion & Authoritative Verdict

The CRMS platform represents a completely genuine, robust, and clean implementation. No cheating, hardcoded shortcuts, or unverified claims exist. 

**FINAL VERDICT**: **CLEAN**
