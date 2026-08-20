# CRMS Backend Deep Audit & Reliability Handoff Report

**Target**: `crms-backend` (Express.js / Prisma ORM / PostgreSQL)  
**Agent**: Explorer 3 (`teamwork_preview_explorer_backend`)  
**Parent**: Orchestrator (`9d53ded9-156f-4c04-8890-cefb7d12a906`)  
**Date**: 2026-08-17  

---

## 1. Observation

Direct code inspections and behavioral analyses revealed the following specific code instances across `crms-backend`:

### Observation 1.1: Approvals Repository Scoping Query
In `d:\New folder\hall_booking\crms-backend\src\modules\approvals\approvals.repository.js` lines 12–25:
```javascript
function listPendingFor({ approverUserId, roleId, departmentId }) {
  const where = {
    decision: null,
    OR: [
      { approverUserId },
      // Institute/Department admins also see approvals routed to
      // their ROLE generally (e.g. if the specific approver user
      // was deactivated after the request was created).
      {
        approverRoleId: roleId,
        booking: departmentId ? { resource: { departmentId } } : undefined,
      },
    ],
  };

  return prisma.approval.findMany({
    where,
    ...
```
When `roleId === 1` (Super Admin), `where` becomes:
`{ decision: null, OR: [ { approverUserId: 1 }, { approverRoleId: 1 } ] }`.
All departmental (`roleId: 3`) and institute (`roleId: 2`) resource approvals are excluded from the result set.

### Observation 1.2: Approvals Service Decision Authorization Check
In `d:\New folder\hall_booking\crms-backend\src\modules\approvals\approvals.service.js` lines 22–32:
```javascript
function canDecide(approval, auth) {
  if (approval.approverUserId === auth.userId) return true;
  if (approval.approverRoleId === auth.roleId) {
    // Department Admin: only within their own department
    if (auth.roleId === ROLES.DEPARTMENT_ADMIN) {
      return approval.booking.resource.departmentId === auth.departmentId;
    }
    return true; // Super Admin or Institute Admin acting on an assigned approval
  }
  return false;
}
```
Super Admin has `auth.userId = 1` and `auth.roleId = 1`. For any departmental booking (`approverUserId = 3`, `approverRoleId = 3`) or institute booking (`approverUserId = 2`, `approverRoleId = 2`), `canDecide` returns `false`, causing line 41 to throw:
`ApiError.forbidden('You are not the approver for this request')`.

### Observation 1.3: Single Booking Retrieval Authorization (IDOR)
In `d:\New folder\hall_booking\crms-backend\src\modules\bookings\bookings.service.js` lines 166–170:
```javascript
async function getById(bookingId, requester) {
  const booking = await repo.findById(bookingId);
  if (!booking) throw ApiError.notFound(`Booking ${bookingId} not found`);
  return booking;
}
```
And in `d:\New folder\hall_booking\crms-backend\src\modules\bookings\bookings.routes.js` line 13:
```javascript
router.get('/:bookingId', validateRequest(bookingIdParamSchema), controller.getById);
```
No validation checks if `req.auth.userId === booking.requesterUserId` or if `req.auth.roleId` is an admin.

### Observation 1.4: Auto-Approved Booking Status Response
In `d:\New folder\hall_booking\crms-backend\src\modules\bookings\bookings.service.js` lines 86, 101–106, 139:
```javascript
      const booking = await repo.create(tx, {
        ...
        status: 'Pending',
      });
      ...
      if (isAutoApproved) {
        await tx.booking.update({
          where: { bookingId: booking.bookingId },
          data: { status: 'Approved' }
        });
        ...
      }
      ...
      return { ...booking, approverUserId: approver?.userId ?? null };
```
`booking` retains `{ status: 'Pending' }` in memory and is returned directly in the response.

### Observation 1.5: Missing Rejection Remarks Validation
In `d:\New folder\hall_booking\crms-backend\src\modules\approvals\approvals.routes.js` lines 13–14:
```javascript
router.post('/:approvalId/approve', canApprove, controller.approve);
router.post('/:approvalId/reject', canApprove, controller.reject);
```
Neither route nor `approvals.service.js:decide` validates that `remarks` is provided on rejection.

### Observation 1.6: Server Error Stack Trace Leakage
In `d:\New folder\hall_booking\crms-backend\src\middleware\errorHandler.js` lines 33–38:
```javascript
  const status = err.statusCode || 500;
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
    details: err.message,
    stack: err.stack
  });
```
`stack: err.stack` is unconditionally included in HTTP responses.

---

## 2. Logic Chain

1. **Super Admin Approval Impasse (Observations 1.1 & 1.2)**:
   - System specification (`PROJECT.md` Section 40 & Section 15) grants Super Admin unrestricted campus-wide authority over all resources and bookings.
   - Observation 1.1 shows `listPendingFor` strictly filters by `approverUserId` or `approverRoleId`. Because bookings for department labs/classrooms are assigned `approverRoleId: 3` and institute venues are assigned `approverRoleId: 2`, Super Admin's query with `roleId: 1` matches 0 records.
   - Observation 1.2 shows that even if Super Admin accesses a pending approval by ID, `canDecide` checks equality between `approval.approverRoleId` and `auth.roleId`. Since `3 !== 1` and `2 !== 1`, `canDecide` returns `false` and blocks decision recording with `403 Forbidden`.
   - **Conclusion**: Super Admin is effectively locked out from viewing and deciding departmental/institute approvals unless both `listPendingFor` and `canDecide` are patched.

2. **Insecure Direct Object Reference (Observation 1.3)**:
   - The route `GET /api/v1/bookings/:bookingId` is accessible to all authenticated users.
   - Observation 1.3 shows `getById` performs no role or ownership check before returning `booking` (which includes requester contact info and approval logs).
   - **Conclusion**: Any student or faculty user can enumerate sequential booking IDs and extract private details of other requesters.

3. **Stale Auto-Approval Response (Observation 1.4)**:
   - When a resource owner (e.g. Dept Admin) books their own department lab, `tx.booking.update` updates the database record to `Approved`.
   - However, Javascript object `booking` created prior to the update is returned without updating its `status` property.
   - **Conclusion**: The frontend client receives `status: "Pending"`, causing UI inconsistencies until manual page refresh.

4. **Information Disclosure (Observation 1.6)**:
   - On unhandled server errors, `errorHandler.js` sends `err.stack` in the response payload.
   - **Conclusion**: Production deployments will leak sensitive internal file paths, stack traces, and environment configuration.

---

## 3. Caveats

- **Database Connection**: Live database execution during this turn was limited due to environment constraints. All SQL, transaction isolation, and logic behaviors were verified through code analysis and test suite structures.
- **Notification Queue**: The backend currently notes `TODO(notifications module)` in several controllers; notification dispatch logic is not yet implemented in `crms-backend`.

---

## 4. Conclusion

The conflict detection engine (Serializable transactions + interval overlap formula) is mathematically and architecturally sound. However, there are 4 critical defects requiring implementation fixes:
1. **Super Admin Approval Access**: Fix `approvals.repository.js:listPendingFor` and `approvals.service.js:canDecide` to grant Super Admin full visibility and override authority.
2. **Booking IDOR**: Add ownership verification in `bookings.service.js:getById`.
3. **Auto-Approval Status**: Ensure `createBooking` returns `status: 'Approved'` when auto-approved.
4. **Error Handler & Validation Hardening**: Add mandatory rejection remarks validation, past date rejection, and suppress stack traces in production.

---

## 5. Verification Method

### Code Inspection Checkpoints
1. `src/modules/approvals/approvals.repository.js`: Verify if `roleId === ROLES.SUPER_ADMIN` returns `{ decision: null }`.
2. `src/modules/approvals/approvals.service.js`: Verify `if (auth.roleId === ROLES.SUPER_ADMIN) return true;` is present in `canDecide()`.
3. `src/modules/bookings/bookings.service.js`: Inspect `getById()` for `auth.userId === booking.requesterUserId || [ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN].includes(auth.roleId)`.
4. `src/modules/bookings/bookings.service.js`: Inspect `createBooking()` return statement for auto-approved branch.

### Test Execution Command
From `crms-backend/`:
```bash
npm test
```
All 7 test suites (`adversarial_challenge.test.js`, `approvals.test.js`, `auth.test.js`, `bookings.test.js`, `cors_and_server.test.js`, `e2e_integration_challenger2.test.js`, `resources_timetable.test.js`) must pass cleanly.
