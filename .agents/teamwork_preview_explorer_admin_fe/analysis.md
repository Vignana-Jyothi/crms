# CRMS Admin Frontend (`crms-admin-frontend`) & Unified Admin Dashboards Audit Report

**Date**: 2026-08-17  
**Auditor**: Explorer 2 (Teamwork Explorer — CRMS Admin Frontend Specialist)  
**Target Application**: `crms-admin-frontend` (React 19 + Vite 8 + Tailwind CSS 4)  
**Backend Reference**: `crms-backend` (Express.js + Prisma ORM)

---

## 1. Executive Summary

A comprehensive, end-to-end exploratory testing and code auditing of the CRMS Admin Frontend (`crms-admin-frontend`) and its unified admin dashboards and workflows was conducted. 

### Key Architectural Strengths:
1. **Role-Gated Security & Route Guards**: Robust multi-tier authorization using `ProtectedRoute` and `RequireRole` components, preventing unauthorized access by Requesters, Department Admins, and Institute Admins to Super Admin screens (`/resources`, `/users`, `/audit-logs`).
2. **Resilient Token Management**: Clean silent token refresh interceptor in `src/api/client.js` with in-flight deduping (`refreshInFlight`) and automatic session recovery.
3. **Defensive Data Formatting**: `src/utils/formatters.js` contains safe parsing for Postgres `TIME`, ISO datetime strings, and dates without crashing on invalid or null values.
4. **Live Campus Status Dashboard**: `LiveStatus.jsx` provides grouped real-time visualization of room occupancy across departments with 60-second auto-refresh and occupant contact details.

### Critical Gaps & Bugs Identified:
1. **Approval Workflow Rejection Remarks Modal**: Rejection is currently handled by an optional inline text input rather than a mandatory remarks modal dialog. Admins can reject bookings with no reason specified.
2. **Missing Multi-Dimensional Bookings Filtering & Admin Cancellation**: `Bookings.jsx` only filters by `status`. It lacks department, resource, date range, and text search filters. Furthermore, admin booking cancellation (`POST /api/v1/bookings/:bookingId/cancel`) is not implemented in the UI or API client.
3. **Missing Resource Edit Modal**: `Resources.jsx` allows adding resources and toggling status, but has no UI to edit existing resource details (capacity, name, block, floor, type, department).
4. **Incomplete User Management Capabilities**: No UI for reassigning user departments or performing admin password resets for existing users (`POST /api/v1/auth/set-password`).
5. **Unfiltered Audit Logs**: `AuditLogs.jsx` displays the raw top 200 logs without action, entity, or search filter controls.

---

## 2. Detailed Audit by Focus Area

---

### Area 1: Admin Authentication & Role-Based Access

#### Observations:
- **`src/context/AuthContext.jsx` (Lines 6-58)**:
  - Seeds roles: `ROLES = { SUPER_ADMIN: 1, INSTITUTE_ADMIN: 2, DEPARTMENT_ADMIN: 3, REQUESTER: 4 }`.
  - `login(email, password)` verifies role post-login and throws an explicit error if a user with role `Requester` attempts to authenticate:
    ```javascript
    if (loggedInUser.role === 'Requester') {
      authApi.logout();
      throw new Error('This account does not have admin access. Use the main booking site instead.');
    }
    ```
- **`src/components/RequireRole.jsx` (Lines 8-14)**:
  - Intercepts unauthorized navigation and redirects to `/`:
    ```javascript
    if (!roles.includes(user?.roleId)) {
      return <Navigate to="/" replace />;
    }
    ```
- **`src/App.jsx` (Lines 31-62)**:
  - Super Admin routes (`/resources`, `/users`, `/audit-logs`) are strictly wrapped in `<RequireRole roles={[ROLES.SUPER_ADMIN]}>`.
- **`src/components/Sidebar.jsx` (Lines 7-34)**:
  - Navigation links are filtered via `NAV.filter((l) => !l.roles || l.roles.includes(user?.roleId))`.
  - Pending approval badge count polls `/approvals/pending` every 30 seconds.
- **`src/api/client.js` (Lines 22-60)**:
  - Attaches Bearer JWT to outgoing requests.
  - On HTTP 401, re-authenticates via `/auth/refresh` using `refreshInFlight` singleton promise to avoid multiple simultaneous refresh requests.

#### Assessment:
- Role isolation, route gating, and token refresh are cleanly implemented with no security bypass vulnerabilities.

---

### Area 2: Approval Workflow Queue (`src/pages/Approvals.jsx`)

#### Observations:
- **`src/pages/Approvals.jsx` (Lines 62-120)**:
  - Displays pending requests routed to the logged-in administrator.
  - Renders resource name, ID, resource type, department, booking date, time slot (`fmtTimeSlot`), purpose, and requester name and phone.
  - Approve and Reject buttons invoke `act(approvalId, 'Approved')` and `act(approvalId, 'Rejected')`.

#### Defects & Gaps:
1. **Defect 2.1 — Absence of Mandatory Rejection Remarks Modal**:
   - *Code Reference*: `src/pages/Approvals.jsx:94-118`
   - *Finding*: Remarks input is rendered as an optional inline text field (`placeholder="Remarks (optional)"`). Admin can click "Reject" without typing any remark.
   - *Impact*: Requesters receiving rejections have no feedback on why their booking was declined.
   - *Fix*: Create a `RejectModal` requiring non-empty remarks (min length 5 chars) before executing the rejection API call.
2. **Defect 2.2 — Omission of Requester Email & Department**:
   - *Code Reference*: `src/pages/Approvals.jsx:80-90`
   - *Finding*: While phone number is displayed with a `tel:` link, requester `email` (`mailto:` link) and department tag are omitted from the approval card.
   - *Fix*: Display requester email and department tag next to phone number.

---

### Area 3: Unified Bookings Management (`src/pages/Bookings.jsx`)

#### Observations:
- **`src/pages/Bookings.jsx` (Lines 12-121)**:
  - Renders a table of bookings with status badges (`Pending`, `Approved`, `Rejected`, `Cancelled`).
  - Scoped server-side for Department Admins (backend `bookings.controller.js:18-20` enforces `departmentId`).

#### Defects & Gaps:
1. **Bug 3.1 — Missing Multi-Dimensional Filters**:
   - *Code Reference*: `src/pages/Bookings.jsx:13-26, 37-47`
   - *Finding*: Only a status dropdown is provided. Missing:
     - Department filter (for Super Admin & Institute Admin).
     - Resource search/selector.
     - Date range filter (from date / to date).
     - Text search (by requester name, purpose, resource name).
   - *Fix*: Introduce search input, department dropdown, resource dropdown, and date picker inputs.
2. **Bug 3.2 — Missing Admin Booking Cancellation Action**:
   - *Code Reference*: `src/api/endpoints.js:39-41` and `src/pages/Bookings.jsx:75-107`
   - *Finding*: Backend supports `POST /api/v1/bookings/:bookingId/cancel` for Super Admin and Institute Admin. Neither `endpoints.js` nor `Bookings.jsx` exposes a cancel button or action.
   - *Fix*: Add `bookingsApi.cancel(bookingId)` and render a "Cancel" button on active bookings (`Pending`/`Approved`) with a confirmation dialog.
3. **Defect 3.3 — Unpaginated Table**:
   - *Finding*: High-volume booking data is rendered without pagination.
   - *Fix*: Add client/server pagination controls.

---

### Area 4: Resource Management (`src/pages/Resources.jsx`)

#### Observations:
- **`src/pages/Resources.jsx` (Lines 15-260)**:
  - Fetches resources, resource types, departments, and blocks via `masterDataApi`.
  - Provides a form to create a new resource with fields: ID, Name, Type, Department, Block, Floor, Capacity.
  - Provides text search filtering on `resourceName`, `resourceId`, `typeName`, `departmentName`.
  - Provides status toggle (`Deactivate` / `Reactivate`) calling `resourcesApi.update(resource.resourceId, { status: nextStatus })`.

#### Defects & Gaps:
1. **Defect 4.1 — Missing Edit Resource Modal**:
   - *Code Reference*: `src/pages/Resources.jsx:241-246`
   - *Finding*: Existing resources can only have their status toggled. There is no UI to edit name, capacity, type, block, floor, or department assignment.
   - *Fix*: Add an "Edit" button opening an `EditResourceModal` pre-populated with current resource data.
2. **Defect 4.2 — Table Omission of Block, Floor, and Capacity Columns**:
   - *Code Reference*: `src/pages/Resources.jsx:220-230`
   - *Finding*: The inventory table only displays ID, Name, Type, Department, Status. Block, Floor, and Capacity attributes are missing from table headers/rows.
   - *Fix*: Include Block, Floor, and Capacity columns in the table.

---

### Area 5: User Management (`src/pages/Users.jsx`)

#### Observations:
- **`src/pages/Users.jsx` (Lines 6-270)**:
  - Lists all users with search filtering across name, email, phone, department, and role.
  - Supports user creation with auto-generated temporary password display banner.
  - Provides status toggle (`Active` / `Inactive`) and role dropdown.

#### Defects & Gaps:
1. **Defect 5.1 — Cannot Update User Department**:
   - *Code Reference*: `src/pages/Users.jsx:58-70, 237-246`
   - *Finding*: `changeRole` only updates `roleId` and retains `u.departmentId`. There is no dropdown or modal to assign/reassign a department.
   - *Fix*: Provide a department selector when editing user roles or introduce an Edit User modal.
2. **Defect 5.2 — Missing Password Reset for Existing Users**:
   - *Code Reference*: `src/api/endpoints.js` and `src/pages/Users.jsx`
   - *Finding*: Backend `POST /api/v1/auth/set-password` allows Super Admin to reset passwords, but no UI or API endpoint is wired for this.
   - *Fix*: Add `authApi.setPassword(userId, newPassword)` and a "Reset Password" action modal in `Users.jsx`.
3. **Defect 5.3 — Missing Client Phone Number Validation**:
   - *Code Reference*: `src/pages/Users.jsx:176-181`
   - *Finding*: Phone input lacks pattern validation matching Indian 10-digit format (`^[6-9]\d{9}$`).

---

### Area 6: System Reports & Audit Logs (`src/pages/AuditLogs.jsx`)

#### Observations:
- **`src/pages/AuditLogs.jsx` (Lines 1-65)**:
  - Fetches top 200 audit logs via `auditApi.list({ limit: 200 })`.
  - Renders formatted timestamp (`fmtDateTime`), actor name/department, action badge, and entity details.

#### Defects & Gaps:
1. **Defect 6.1 — Missing Filter Controls**:
   - *Code Reference*: `src/pages/AuditLogs.jsx:10-18`
   - *Finding*: No UI controls for filtering by action (e.g. `LOGIN`, `CREATE_BOOKING`, `CHANGE_USER_ROLE`), entity type (`user`, `resource`, `booking`), or user search.
   - *Fix*: Add action dropdown, entity type dropdown, and search input.

---

### Area 7: UI/UX, Visual Consistency & Polish

#### Observations & Findings:
1. **Accessibility**: `LiveStatus.jsx` room detail modal lacks ARIA attributes (`role="dialog"`, `aria-modal="true"`) and ESC key listener.
2. **Action Feedback Consistency**: `Resources.jsx` and `Users.jsx` show dismissible alert banners, whereas `Approvals.jsx` gives no positive feedback when an approval succeeds.
3. **Responsive Navigation**: Sidebar is fixed `w-60` without a mobile collapse drawer for smaller screens.

---

## 3. Summary of Bug Matrix & Fix Prioritization

| # | Focus Area | Bug / Defect Description | Severity | Affected Files & Lines | Fix Recommendation |
|---|---|---|---|---|---|
| 1 | Approvals | Missing mandatory rejection remarks modal | High | `src/pages/Approvals.jsx:94-118` | Implement `RejectModal` enforcing non-empty remarks before rejection |
| 2 | Approvals | Omission of requester email and department | Medium | `src/pages/Approvals.jsx:80-90` | Add `mailto:` email link and department badge to approval card |
| 3 | Bookings | Missing filters for department, resource, date range, and search | High | `src/pages/Bookings.jsx:13-48` | Add department, resource, date range, and search filter controls |
| 4 | Bookings | Missing admin booking cancellation capability | High | `src/api/endpoints.js:39-41`, `src/pages/Bookings.jsx:75-107` | Expose `bookingsApi.cancel` and render a Cancel action button with confirmation |
| 5 | Resources | Missing Edit Resource modal/form | High | `src/pages/Resources.jsx:241-246` | Add Edit button & modal to update resource name, capacity, type, block, department |
| 6 | Resources | Missing Block, Floor, Capacity columns in inventory table | Medium | `src/pages/Resources.jsx:220-230` | Add columns to resource table |
| 7 | Users | Inability to change user department | Medium | `src/pages/Users.jsx:58-70, 237-246` | Provide department selection UI alongside role update |
| 8 | Users | Missing manual password reset for existing users | Medium | `src/api/endpoints.js`, `src/pages/Users.jsx` | Add `authApi.setPassword` and Reset Password modal |
| 9 | Users | Lack of client-side phone number validation | Low | `src/pages/Users.jsx:176-181` | Add regex `/^[6-9]\d{9}$/` input validation |
| 10 | Audit Logs | Missing action, entity type, and search filters | Medium | `src/pages/AuditLogs.jsx:10-18` | Add action and entity filter dropdowns and search bar |
| 11 | Polish | Missing modal accessibility and table pagination | Low | `src/pages/LiveStatus.jsx:184-258`, `Bookings.jsx`, `Resources.jsx`, `Users.jsx` | Add ESC key handler, ARIA attributes, and pagination controls |
