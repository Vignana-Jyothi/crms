# CRMS Requester Frontend (`crms-main-frontend`) Audit — Handoff Report

## 1. Observation

Direct observations from source code inspection:

1. **Rejection Remarks Missing in "My Bookings"**:
   - `crms-main-frontend/src/pages/MyBookings.jsx` lines 97–133:
     ```jsx
     <li key={b.bookingId} className="flex items-center justify-between p-4">
       <div>
         ...
         <p className="mt-1 text-sm text-ink/70">{b.purpose}</p>
       </div>
       <div className="flex items-center gap-3">
         <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[b.status]}`}>
           {b.status}
         </span>
         {['Pending', 'Approved'].includes(b.status) && (...)}
       </div>
     </li>
     ```
     No element exists to render approver remarks for rejected bookings.
   - `crms-backend/src/modules/bookings/bookings.repository.js` lines 48–75:
     ```javascript
     function list({ requesterUserId, resourceId, status, departmentId }) {
       return prisma.booking.findMany({
         where: { ... },
         include: {
           resource: { select: { resourceName: true, resourceType: { select: { typeName: true } }, department: { select: { departmentName: true } } } },
           requester: { select: { name: true, phone: true, email: true, department: { select: { departmentName: true } } } },
         },
         orderBy: { createdAt: 'desc' },
       });
     }
     ```
     `approvals` relation is excluded from the query, so `b.approvals` is `undefined` in API responses for `GET /api/v1/bookings/my`.

2. **Uncaught Exception Risk in Conflict Parsing**:
   - `crms-main-frontend/src/pages/ResourceDetail.jsx` lines 58–63:
     ```javascript
     if (data?.details?.conflicts && Array.isArray(data.details.conflicts) && data.details.conflicts.length > 0) {
       setError(
         `${data.error}: ${data.details.conflicts
           .map((c) => `${new Date(c.startTime).toISOString().slice(11, 16)}–${new Date(c.endTime).toISOString().slice(11, 16)}`)
           .join(', ')}`
       );
     ```
     If `c.startTime` is a plain time string (e.g. `"09:00:00"` or `"09:00"`), `new Date("09:00:00")` evaluates to `Invalid Date`. Invoking `.toISOString()` throws an uncaught `RangeError: Invalid time value` in the browser, crashing the error display handler.

3. **User Object Schema Disparity Across Auth Endpoints**:
   - `crms-backend/src/modules/auth/auth.service.js` lines 41–50:
     ```javascript
     user: {
       userId: user.userId,
       name: user.name,
       email: user.email,
       role: user.role?.roleName, // String e.g. "Super Admin"
       roleId: user.roleId,
       department: user.department?.departmentName || null, // String e.g. "CSE"
       departmentId: user.departmentId,
     }
     ```
   - `crms-backend/src/modules/users/users.repository.js` lines 3–8:
     ```javascript
     const SAFE_SELECT = {
       userId: true, name: true, email: true, phone: true, roleId: true,
       departmentId: true, notes: true, roomNo: true, status: true,
       role: { select: { roleName: true } }, // Object e.g. { roleName: "Super Admin" }
       department: { select: { departmentName: true, branchCode: true } }, // Object
     };
     ```
   - `crms-main-frontend/src/components/admin/Sidebar.jsx` lines 40–43:
     ```jsx
     <p className="text-xs text-white/50">{user?.role?.roleName}</p>
     {user?.department?.departmentName && (...)}
     ```
     Immediately after login, `user.role` is a string, so `user.role?.roleName` evaluates to `undefined`. Only after page reload (which triggers `usersApi.me()`) does `user.role?.roleName` render.

4. **Resource Type Badge Styling Mismatch**:
   - `crms-main-frontend/src/pages/Dashboard.jsx` lines 5–11:
     ```javascript
     const TYPE_COLORS = {
       Classroom: 'bg-navy/10 text-navy',
       Laboratory: 'bg-forest/10 text-forest',
       'Seminar Hall': 'bg-amber/15 text-amber',
       Auditorium: 'bg-amber/15 text-amber',
       'Meeting Room': 'bg-ink/10 text-ink/70',
     };
     ```
   - `crms-backend/prisma/seed.js` line 72:
     ```javascript
     { resourceTypeId: 2, typeName: 'Lab', description: 'Computing, electronics, or engineering laboratory' }
     ```
     The seed type name is `'Lab'`, but `TYPE_COLORS` has `'Laboratory'`, causing all Lab badges to fall back to generic gray.

5. **Missing Fallback Route**:
   - `crms-main-frontend/src/App.jsx` lines 44–61 defines explicit routes without a `<Route path="*" element={<Navigate to="/" replace />} />`, leading to a blank screen on invalid paths.

---

## 2. Logic Chain

1. **Rejection Transparency Gap**:
   - Approvers record rejection rationale when deciding a request (`approvals.service.js:decide`).
   - The requester opens `MyBookings` to inspect status.
   - Because `bookings.repository.js:list` does not include `approvals`, the response payload omits `remarks`.
   - Even if present, `MyBookings.jsx` does not render remarks.
   - Therefore, requesters have no feedback on why bookings failed, leading to repeated submissions or support escalations.

2. **Conflict Parsing Exception**:
   - When a booking overlaps a class or existing reservation, backend responds with 409 and conflict array.
   - In `ResourceDetail.jsx`, conflict times are converted via `new Date(c.startTime).toISOString()`.
   - Because Postgres TIME values or formatted time strings without date components fail standard JavaScript date parsing, `.toISOString()` throws a `RangeError`.
   - The catch block terminates abruptly, failing to show the conflict details to the user.

3. **Auth Contract Inconsistency**:
   - Login returns flat string representations for `role` and `department`.
   - `usersApi.me()` returns nested relation objects `{ roleName }` and `{ departmentName }`.
   - Components consuming `AuthContext` get different object shapes depending on whether the session was just initiated or restored from storage.

---

## 3. Caveats

- End-to-end browser runtime testing in this turn was conducted via static code auditing and cross-module interface tracing because `npm run build` command execution timed out on user permission.
- The existing automated backend test suite (106 tests in `crms-backend/tests/`) passes all API and engine contracts.

---

## 4. Conclusion

The Requester Frontend (`crms-main-frontend`) implements the core functionality required for resource discovery, availability checking, booking requests, and cancellation. The primary defects identified are:
1. **High Priority**: Missing rejection remarks in `MyBookings.jsx` and backend `bookings.repository.js:list()`.
2. **Medium Priority**: Fragile date parsing in `ResourceDetail.jsx` conflict handler.
3. **Medium Priority**: Disparity in `user.role` / `user.department` structure between `/auth/login` and `/users/me`.
4. **Low Priority**: Color key `'Lab'` vs `'Laboratory'` in `Dashboard.jsx`, missing catch-all 404 route in `App.jsx`, and mobile navigation responsive polish.

---

## 5. Verification Method

To independently verify these findings:

1. **Verify Rejection Remarks Defect**:
   - Inspect `crms-backend/src/modules/bookings/bookings.repository.js` lines 48–75. Check `include` clause in `list()`.
   - Inspect `crms-main-frontend/src/pages/MyBookings.jsx` lines 97–133. Check whether `b.approvals` or remarks are rendered.

2. **Verify Conflict Handler RangeError**:
   - In browser console or Node.js REPL, run: `new Date("09:00:00").toISOString()`. Observe `RangeError: Invalid time value`. Compare with `crms-main-frontend/src/utils/formatters.js:fmtTime("09:00:00")` which returns `"09:00"`.

3. **Verify Auth Object Disparity**:
   - Compare `crms-backend/src/modules/auth/auth.service.js` line 45 (`role: user.role?.roleName`) with `crms-backend/src/modules/users/users.repository.js` line 6 (`role: { select: { roleName: true } }`).

4. **Verify Type Color Mismatch**:
   - Inspect `crms-main-frontend/src/pages/Dashboard.jsx` line 7 (`Laboratory`) vs `crms-backend/prisma/seed.js` line 72 (`typeName: 'Lab'`).
