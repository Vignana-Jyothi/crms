# Handoff Report: CRMS Admin Frontend Subsystem

**Author**: Explorer 3 (Admin Frontend Specialist)  
**Target Subsystem**: `crms-admin-frontend`  
**Handoff Type**: Hard (Investigation Complete)  
**Date**: 2026-08-16  

---

## 1. Observation

Direct code inspections of `crms-admin-frontend` and backend contracts revealed the following exact locations and snippets:

1. **Date/Time Unsafe Parsing Hazard**:
   - `crms-admin-frontend/src/pages/Approvals.jsx:4-6`:
     ```javascript
     function fmtTime(iso) {
       return new Date(iso).toISOString().slice(11, 16);
     }
     ```
   - `crms-admin-frontend/src/pages/Approvals.jsx:55`:
     ```javascript
     {new Date(a.booking.bookingDate).toISOString().slice(0, 10)} · {fmtTime(a.booking.startTime)}–{fmtTime(a.booking.endTime)}
     ```
   - `crms-admin-frontend/src/pages/Bookings.jsx:67`:
     ```javascript
     {new Date(b.bookingDate).toISOString().slice(0, 10)}
     ```
   - `crms-admin-frontend/src/pages/AuditLogs.jsx:24`:
     ```javascript
     {new Date(l.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
     ```
   - Calling `.toISOString()` on `new Date(val)` where `val` is invalid time format (e.g. `"09:00:00"`), null, or undefined throws `RangeError: Invalid time value`, crashing the React component tree.

2. **Overview Link Trap for Non-Super-Admins**:
   - `crms-admin-frontend/src/pages/Overview.jsx:32`:
     ```javascript
     <StatCard label="Total resources" value={stats.totalResources ?? '—'} to="/resources" />
     ```
   - `crms-admin-frontend/src/App.jsx:35-41`:
     ```javascript
     <Route
       path="/resources"
       element={
         <ProtectedRoute>
           <RequireRole roles={[ROLES.SUPER_ADMIN]}><Resources /></RequireRole>
         </ProtectedRoute>
       }
     />
     ```
   - `crms-admin-frontend/src/components/RequireRole.jsx:10-12`:
     ```javascript
     if (!roles.includes(user?.roleId)) {
       return <Navigate to="/" replace />;
     }
     ```
   - When Institute Admin or Department Admin clicks "Total resources", they are navigated to `/resources`, which immediately bounces them back to `/`.

3. **Unhandled Promise Rejections in Overview**:
   - `crms-admin-frontend/src/pages/Overview.jsx:18-22`:
     ```javascript
     useEffect(() => {
       approvalsApi.pending().then((list) => setStats((s) => ({ ...s, pending: list.length })));
       resourcesApi.list({}).then((list) => setStats((s) => ({ ...s, totalResources: list.length })));
       bookingsApi.list({ status: 'Approved' }).then((list) => setStats((s) => ({ ...s, activeBookings: list.length })));
     }, []);
     ```
   - None of the three promises have `.catch()` handlers.

4. **Missing Action Feedback on Decision**:
   - `crms-admin-frontend/src/pages/Approvals.jsx:20-29`:
     ```javascript
     async function act(approvalId, decision) {
       setActingId(approvalId);
       try {
         const fn = decision === 'Approved' ? approvalsApi.approve : approvalsApi.reject;
         await fn(approvalId, remarksDraft[approvalId] || undefined);
         refresh();
       } finally {
         setActingId(null);
       }
     }
     ```
   - If `fn` fails (network error, conflict, or 400/500), the error is swallowed into unhandled rejection, and the user receives no error toast or visual feedback.

5. **Sidebar Height and Scroll Issue**:
   - `crms-admin-frontend/src/components/Sidebar.jsx:35`:
     ```javascript
     <aside className="flex h-screen w-60 flex-col border-r border-line bg-navy text-white">
     ```
   - In `AppShell` (`src/App.jsx:18-21`):
     ```javascript
     <div className="flex">
       <Sidebar />
       <main className="min-h-screen flex-1 bg-paper">{children}</main>
     </div>
     ```
   - When main content exceeds 100vh, the sidebar does not stick to the top; scrolling down reveals blank unstyled space beneath the 100vh sidebar.

6. **Missing Time Column in Bookings Table**:
   - `crms-admin-frontend/src/pages/Bookings.jsx:50-56`: Table header contains only Resource, Requester, Date, Purpose, Status. Start and End time slots are omitted despite being returned by `crms-backend/src/modules/bookings/bookings.repository.js`.

7. **Uncontrolled Select in User Table**:
   - `crms-admin-frontend/src/pages/Users.jsx:164-172`:
     ```javascript
     <select
       defaultValue={u.roleId || ''}
       onChange={(e) => changeRole(u.userId, e.target.value, u.departmentId)}
       className="rounded border border-line px-2 py-1 text-xs"
     >
     ```
   - Uses `defaultValue` rather than controlled `value`.

8. **Requester Role Rejection on Login**:
   - `crms-admin-frontend/src/context/AuthContext.jsx:28-35`:
     ```javascript
     if (loggedInUser.role === 'Requester') {
       authApi.logout();
       throw new Error('This account does not have admin access. Use the main booking site instead.');
     }
     ```
   - Correctly intercepts Requester accounts and blocks entry into the admin portal.

---

## 2. Logic Chain

1. **Premise 1 (Time and Date Parsing)**:
   - Backend database stores `startTime` and `endTime` as PostgreSQL `TIME` types (`@db.Time()`), and `bookingDate` as `@db.Date`.
   - Calling `new Date("09:00:00")` in JavaScript creates `Invalid Date`.
   - Any invocation of `d.toISOString()` on `Invalid Date` throws `RangeError`.
   - In React, an uncaught error in JSX rendering unmounts the component subtree.
   - **Inference**: Safe time formatting (`fmtTime`, `fmtDate`, `fmtDateTime`) with defensive regex/string slicing and try/catch is essential to prevent portal crashes.

2. **Premise 2 (Role Scoping and Navigation)**:
   - `RequireRole` correctly redirects non-Super-Admins away from `/resources`, `/users`, and `/audit-logs`.
   - However, `Overview.jsx` renders a card for "Total resources" with a static link `to="/resources"`.
   - An Institute or Department Admin clicking that card experiences an immediate, silent bounce back to `/`.
   - **Inference**: Conditional navigation attributes (`to={user?.roleId === ROLES.SUPER_ADMIN ? '/resources' : undefined}`) ensure intuitive UX without dead navigation loops.

3. **Premise 3 (Action State & Error Visibility)**:
   - Approval decisions, user status changes, and resource creation are critical state mutations.
   - Without error catching in action handlers, network failures or backend conflict errors (e.g. concurrent approval by another admin) fail silently.
   - **Inference**: Action handlers must catch errors and display feedback banners or toast notices.

4. **Premise 4 (Layout & Scrolling)**:
   - A fixed sidebar in an admin dashboard must remain in view while data tables scroll.
   - Setting `sticky top-0 h-screen overflow-y-auto` ensures seamless scrolling on long audit log and booking tables.

---

## 3. Caveats

- **External notifications**: The admin frontend relies on a 30-second polling interval for pending approval count badges (`Sidebar.jsx:28`). This is intentional per architecture documentation until a WebSocket/push notification service is added.
- **Network execution**: Build command execution via terminal timed out waiting for manual permission prompt; all validation was performed via rigorous static code analysis of JSX, dependencies, and Tailwind v4 configurations.

---

## 4. Conclusion

The `crms-admin-frontend` subsystem is well-structured and aligns closely with backend RBAC endpoints and database schemas. The role separation between Super Admin, Institute Admin, Department Admin, and Requester is properly enforced both server-side and client-side.

Remediation requires the following targeted tasks:
1. Implement a safe date/time formatting utility (`src/utils/formatters.js`) and replace raw `.toISOString()` calls across `Approvals.jsx`, `Bookings.jsx`, and `AuditLogs.jsx`.
2. Add error feedback states to `act()` in `Approvals.jsx`, `changeRole()`/`toggleStatus()` in `Users.jsx`, and `toggleStatus()` in `Resources.jsx`.
3. Add `.catch()` handlers to `Overview.jsx` stats fetching and gate the "Total resources" link to Super Admin only.
4. Add "Time Slot" column to `Bookings.jsx` table.
5. Apply `sticky top-0 h-screen overflow-y-auto` to `Sidebar.jsx` and display department context for Department Admins.
6. Convert role select in `Users.jsx` to controlled `value`.

---

## 5. Verification Method

1. **Static Analysis & Inspection**:
   - Inspect `src/utils/formatters.js` to ensure time strings like `"09:00:00"`, `"1970-01-01T09:00:00.000Z"`, and `null` produce `"09:00"` or fallback `"—"` without throwing exceptions.
   - Inspect `src/pages/Approvals.jsx`, `src/pages/Bookings.jsx`, `src/pages/AuditLogs.jsx` to ensure all date/time usages invoke safe formatters.
   - Inspect `src/pages/Overview.jsx` to verify `to` prop on "Total resources" is undefined for non-Super-Admins.
   - Inspect `src/components/Sidebar.jsx` for `sticky top-0 h-screen`.

2. **Functional Test Scenarios (Post-Implementation)**:
   - **Login as Requester**: Expect rejection banner "This account does not have admin access. Use the main booking site instead."
   - **Login as Department Admin**:
     - Verify Sidebar only shows Overview, Approvals, Bookings.
     - Verify Bookings list only displays bookings for their department.
     - Verify Approvals list only displays requests for resources owned by their department.
     - Click "Total resources" card on Overview: verify card is non-clickable.
   - **Login as Super Admin**:
     - Verify all 6 navigation links are visible.
     - Add new user -> verify temporary password banner appears.
     - Add new resource -> verify resource appears in table and can be toggled Active/Inactive.
     - View Audit Logs -> verify all timestamps format cleanly without error.
