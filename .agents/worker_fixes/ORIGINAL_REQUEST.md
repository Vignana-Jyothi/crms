## 2026-08-17T09:35:15Z
You are Worker 1 for the CRMS codebase bug-fixing and enhancement phase.

Working Directory: d:\New folder\hall_booking\.agents\worker_fixes
Project Root: d:\New folder\hall_booking

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Mission:
Implement production-grade, robust fixes for all issues identified during exploratory testing across `crms-backend`, `crms-main-frontend`, and `crms-admin-frontend`.

Tasks to Implement:

1. Backend Fixes (`crms-backend/`):
   - `src/modules/approvals/approvals.repository.js`: Fix `listPendingFor` so Super Admin (`roleId === 1` or `ROLES.SUPER_ADMIN`) sees all pending approvals campus-wide (`where = { decision: null }`).
   - `src/modules/approvals/approvals.service.js`: Fix `canDecide` so Super Admin (`auth.roleId === ROLES.SUPER_ADMIN`) has campus-wide override authority (`return true`). Enforce mandatory non-empty `remarks` when `decision === 'Rejected'`.
   - `src/modules/bookings/bookings.repository.js`: In `list()`, include `approvals` with decision, remarks, decidedAt, and approverUser so booking lists return approval history.
   - `src/modules/bookings/bookings.service.js`:
     - Fix `getById` authorization (IDOR protection): only allow booking requester, Super Admin, Institute Admin, or matching Department Admin to view details.
     - Fix `createBooking`: when `isAutoApproved`, return `status: 'Approved'` in the response payload.
   - `src/middleware/errorHandler.js`: Suppress `stack` in response unless in development (`process.env.NODE_ENV !== 'production'`).

2. Requester Frontend Fixes (`crms-main-frontend/`):
   - `src/pages/MyBookings.jsx`: Render approver rejection remarks for `Rejected` bookings with a clear alert/badge so requesters understand why requests were rejected.
   - `src/pages/ResourceDetail.jsx`: Fix conflict parsing range error by using safe time formatting (e.g. `fmtTime` from utils or safe string slice) so `Invalid Date` exceptions are avoided.
   - `src/pages/Dashboard.jsx`: Update `TYPE_COLORS` to include `'Lab'` alongside `'Laboratory'`.
   - `src/App.jsx`: Add catch-all 404 fallback `<Route path="*" element={<Navigate to="/" replace />} />`.
   - Safe auth access in components: ensure `user?.role?.roleName || user?.role` and `user?.department?.departmentName || user?.department` are safely accessed.

3. Admin Frontend Fixes (`crms-admin-frontend/`):
   - `src/api/endpoints.js`: Add `cancel: (id, data) => client.post(\`/bookings/\${id}/cancel\`, data).then(r => r.data)` to `bookingsApi`, add `update: (id, data) => client.patch(\`/resources/\${id}\`, data).then(r => r.data)` to `resourcesApi`, and add `setPassword: (data) => client.post('/auth/set-password', data).then(r => r.data)` to `authApi`.
   - `src/pages/Approvals.jsx`: Add a Rejection Modal that requires remarks before submitting rejection. Display requester email (`mailto:`) and department name on the approval card.
   - `src/pages/Bookings.jsx`: Add multi-dimensional filter controls (department, resource, date range, search) and an Admin Cancel Booking action with a confirmation dialog.
   - `src/pages/Resources.jsx`: Add an Edit Resource Modal (`PATCH /api/v1/resources/:resourceId`) to edit resource name, capacity, block, floor, type, and department. Add Block, Floor, and Capacity columns to the inventory table.
   - `src/pages/Users.jsx`: Add department selection dropdown when updating user roles, and add a Password Reset Modal.
   - `src/pages/AuditLogs.jsx`: Add Action Type and Entity Type filter dropdowns.

Verification:
- Run `npm test` in `crms-backend/` and verify all tests pass.
- Run `npm run build` in `crms-main-frontend/` and verify clean build with 0 errors.
- Run `npm run build` in `crms-admin-frontend/` and verify clean build with 0 errors.

Deliverables:
- Write `changes.md` and `handoff.md` in `d:\New folder\hall_booking\.agents\worker_fixes\`.
- Report detailed build and test output in your completion message.
