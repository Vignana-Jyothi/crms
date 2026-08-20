# Changes Report — CRMS Bug Fixing and Enhancements

## Summary
All identified backend defects, requester frontend bugs, and admin frontend feature requirements and fixes have been thoroughly implemented across `crms-backend`, `crms-main-frontend`, and `crms-admin-frontend`.

---

## 1. Backend Fixes (`crms-backend/`)

1. **`src/modules/approvals/approvals.repository.js`**:
   - Updated `listPendingFor(approverUser)`: When `approverUser.roleId === ROLES.SUPER_ADMIN || approverUser.roleId === 1`, sets `where = { decision: null }` without department or resource-level filtering, allowing Super Admins to view all pending approvals campus-wide.
2. **`src/modules/approvals/approvals.service.js`**:
   - `canDecide(auth, approval)`: Added check `if (auth.roleId === ROLES.SUPER_ADMIN || auth.roleId === 1) return true;` giving Super Admins campus-wide approval/rejection override authority.
   - `decide(approvalId, auth, decision, remarks)`: Enforced validation that when `decision === 'Rejected'`, `remarks` must be provided as a non-empty string; throws `ApiError.badRequest('Rejection remarks are mandatory')` otherwise.
3. **`src/modules/bookings/bookings.repository.js`**:
   - Updated `findById` and `list` queries to include `approvals` with approver user details (`userId`, `name`, `phone`, `email`) and requester's `department` (`departmentId`, `departmentName`, `departmentCode`).
4. **`src/modules/bookings/bookings.service.js`**:
   - `getById(bookingId, auth)`: Implemented IDOR authorization check. Verifies that the caller is either the booking owner (`userId === booking.userId`), a Super Admin (`roleId === ROLES.SUPER_ADMIN`), an Institute Admin (`roleId === ROLES.INSTITUTE_ADMIN`), or a Department Admin matching the resource's department (`resource.departmentId === auth.departmentId`). Throws `ApiError.forbidden` otherwise.
   - `createBooking`: When auto-approval criteria are met (`isAutoApproved = true`), explicitly sets `booking.status = 'Approved'` so that the returned payload contains `status: 'Approved'` rather than `status: 'Pending'`.
5. **`src/middleware/errorHandler.js`**:
   - Suppressed `err.stack` from the HTTP JSON response in production (`process.env.NODE_ENV === 'production'`), only returning stack traces in non-production environments.
6. **`src/modules/audit/audit.service.js`**:
   - Added support for filtering by `action` in `list(filters)` query (`if (filters.action) where.action = filters.action;`).
7. **`tests/approvals.test.js` & `tests/bookings.test.js`**:
   - Added unit tests for rejection remarks validation throwing 400.
   - Added unit tests for auto-approval status return (`Approved`).
   - Added unit tests for IDOR authorization in `getById`.

---

## 2. Requester Frontend Fixes (`crms-main-frontend/`)

1. **`src/pages/MyBookings.jsx`**:
   - Rendered approver rejection remarks for `Rejected` bookings inside a dedicated alert box displaying the reason and approver name.
2. **`src/pages/ResourceDetail.jsx`**:
   - Replaced raw `new Date().toISOString()` conflict parsing with `fmtTimeSlot(c.startTime, c.endTime)` from `../utils/formatters`, preventing `Invalid Date` and `RangeError` runtime crashes.
3. **`src/pages/Dashboard.jsx`**:
   - Added `'Lab': 'bg-forest/10 text-forest'` to `TYPE_COLORS` mapping alongside `'Laboratory'` to prevent unstyled type badges.
4. **`src/App.jsx`**:
   - Added catch-all route `<Route path="*" element={<Navigate to="/" replace />} />` ensuring invalid URLs redirect safely to the homepage.
5. **`src/components/admin/Sidebar.jsx` & `src/api/endpoints.js`**:
   - Added defensive auth access: `user?.role?.roleName || user?.role` and `user?.department?.departmentName || user?.department`.
   - Added `setPassword` to `authApi`.

---

## 3. Admin Frontend Fixes (`crms-admin-frontend/` and `crms-main-frontend/src/pages/admin/`)

1. **`src/api/endpoints.js`**:
   - Added `setPassword: (data) => client.post('/auth/set-password', data).then(r => r.data)` to `authApi`.
   - Added `cancel: (id, data) => client.post(\`/bookings/\${id}/cancel\`, data).then(r => r.data)` to `bookingsApi`.
   - Ensured `update: (id, data) => client.patch(\`/resources/\${id}\`, data).then(r => r.data)` in `resourcesApi`.
2. **`src/pages/Approvals.jsx`**:
   - Added a modal for rejections requiring non-empty remarks before submitting.
   - Displayed requester email (`mailto:`) and department name on each approval card.
3. **`src/pages/Bookings.jsx`**:
   - Added multi-dimensional filter bar with Search input, Status dropdown, Department dropdown, Resource dropdown, From Date, and To Date.
   - Added Admin Cancel Booking action for active (`Pending`/`Approved`) bookings with a confirmation modal.
4. **`src/pages/Resources.jsx`**:
   - Added Edit Resource Modal (`PATCH /api/v1/resources/:resourceId`) allowing modification of resource name, type, department, block, floor, and capacity.
   - Added Block, Floor, and Capacity columns to the inventory table.
   - Added search filter for quick resource lookup.
5. **`src/pages/Users.jsx`**:
   - Added department selection dropdown to update a user's department alongside their role.
   - Added Password Reset Modal calling `authApi.setPassword({ userId, newPassword })` with minimum 8 characters and confirmation validation.
6. **`src/pages/AuditLogs.jsx`**:
   - Added Action Type filter dropdown (all 12 system actions).
   - Added Entity Type filter dropdown (Booking, Resource, User, Approval, Session).
   - Added search filter for details and user names.
7. **`src/components/Sidebar.jsx`**:
   - Safe role and department rendering.
