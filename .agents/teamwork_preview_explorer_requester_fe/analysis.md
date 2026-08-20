# CRMS Requester Frontend (`crms-main-frontend`) & Requester Workflows — Comprehensive Audit & Analysis Report

**Date**: 2026-08-17  
**Explorer**: Explorer 1 (Requester Frontend & Workflows)  
**Target Application**: `crms-main-frontend` (SPA for Requesters: Faculty, Staff, HODs, Deans)  
**Backend API**: `crms-backend` (`/api/v1`)

---

## 1. Executive Summary

A comprehensive, end-to-end exploratory testing and static code audit was performed on the CRMS Requester Frontend (`crms-main-frontend`), examining the full requester lifecycle: authentication, role-based entry, resource discovery, search/filtering, availability visualization, booking request validation and submission, conflict feedback, booking status tracking ("My Bookings"), and booking cancellation.

The application presents a clean, editorial aesthetic built on React 19, Vite, and Tailwind CSS v4, aligned with the institutional branding of VNRVJIET. Core requester workflows are functional, but several architectural discrepancies, missing UI features (notably viewing rejection remarks), responsive layout vulnerabilities, and uncaught exception hazards were discovered.

---

## 2. Comprehensive Workflow & Component Audit

### 2.1 Authentication, Session Management & Navigation
- **Entry & Login Flow (`src/pages/Login.jsx`)**:
  - Validates email and password inputs with HTML5 `required` constraints.
  - Submits to `POST /api/v1/auth/login`, stores `accessToken` and `refreshToken` via `client.js`.
  - Disables submit button with `"Signing in…"` state.
  - Correctly renders backend error message (`err.response.data.error`).
  - Redirects authenticated users from `/login` to `/`.
- **Token Refresh & Interceptor (`src/api/client.js`)**:
  - Request interceptor attaches `Authorization: Bearer <accessToken>`.
  - Response interceptor intercepts `401 Unauthorized` responses and silently requests a refreshed access token via `POST /api/v1/auth/refresh` using `refreshToken`.
  - Includes concurrency guard (`refreshInFlight` single-promise lock) to prevent duplicate refresh requests when multiple parallel API calls encounter 401.
  - On failure, clears local storage tokens and redirects to `/login`.
- **Session Rehydration (`src/context/AuthContext.jsx`)**:
  - On application mount/reload, fetches current user via `GET /api/v1/users/me`.
  - Provides `useAuth()` hook with `user`, `loading`, `login`, `logout`.
- **Route Protection (`src/components/ProtectedRoute.jsx` & `src/App.jsx`)**:
  - Restricts `/`, `/resources/:resourceId`, and `/bookings` to authenticated sessions.
  - Shows full-screen `"Loading…"` placeholder while checking session.
  - **Issue**: Lacks a catch-all route (`<Route path="*" ... />`), rendering a blank page for unrecognized URLs.
- **Navigation Bar (`src/components/Navbar.jsx`)**:
  - Institutional header (`CRMS · VNRVJIET`).
  - Links: `Search` (`/`) and `My bookings` (`/bookings`).
  - Role-gated badge: Displays `"Admin Dashboard"` button if `user.roleId <= 3` (Super Admin, Institute Admin, Department Admin).
  - Displays user's full name with a `"Sign out"` button.
  - **UX/Responsive Issue**: On mobile screens (< 640px), the nav bar does not collapse into a hamburger menu or wrap, causing elements to crowd and potentially overflow.

---

### 2.2 Resource Search, Filtering & Discovery (`src/pages/Dashboard.jsx`)
- **Master Data Loading**:
  - Fetches `resourceTypes`, `departments`, and `blocks` on mount via `Promise.all`.
- **Multi-parameter Filtering**:
  - **Text Search**: Real-time name search with a 250ms debounce.
  - **Resource Type Dropdown**: Filters by `resourceTypeId` (Classroom, Lab, Seminar Hall, Auditorium).
  - **Department Dropdown**: Filters by `departmentId` (CSE, ECE, EEE, MECH, CIVIL, IT).
  - **Block Dropdown**: Filters by `blockId` (APJ Abdul Kalam, Babbage, C.V. Raman, Dr. B.R. Ambedkar).
  - **Capacity Dropdown**: Filters for 30+, 60+, 100+, 200+, 300+ seats.
- **Filtering Logic**:
  - Server-side filtering applied for `resourceTypeId`, `departmentId`, `blockId`, and `search`.
  - Client-side filtering synchronously applied for `minCapacity` against in-memory `resources`.
- **UI States**:
  - Loading: `"Loading resources…"`.
  - Empty: `"No resources match those filters. Try widening your search."` (dashed container).
  - Cards: Resource ID, Name, Type badge, Department, Block, Floor, Capacity.
- **Visual Glitch**:
  - `TYPE_COLORS` constant uses `'Laboratory': 'bg-forest/10 text-forest'`, but backend database seeds the type as `'Lab'`. As a result, all Lab badges fall back to default ink/gray styling instead of the green forest badge.

---

### 2.3 Real-Time Availability & Booking Submission (`src/pages/ResourceDetail.jsx` & `src/components/AvailabilityStrip.jsx`)
- **Availability Strip (`AvailabilityStrip.jsx`)**:
  - Displays a visual timeline from 09:00 to 18:00 (campus working hours).
  - Plots:
    - Timetable classes: Dark gray blocks (`bg-ink/25`) with tooltip `Class: <courseCode>`.
    - Pending bookings: Amber blocks (`bg-amber`) with tooltip `Booking (Pending)`.
    - Approved bookings: Brick red blocks (`bg-brick`) with tooltip `Booking (Approved)`.
    - Open slots: Light green background (`bg-forest-light`).
  - Interactive Limitation: The strip is currently purely informational. Requesters cannot click on an open segment to auto-populate the booking time fields.
- **Booking Form Validation**:
  - Date input defaults to today (`todayStr()`), with `min={todayStr()}` preventing past date selection via date picker.
  - Start Time & End Time inputs (`type="time"`).
  - Client-side check: Validates `startTime < endTime` before network dispatch.
  - Purpose input: `<textarea>` with `minLength={3}`.
- **Submission & Conflict Feedback**:
  - Submits payload `{ resourceId, bookingDate, startTime, endTime, purpose }` to `POST /api/v1/bookings`.
  - Handled within a PostgreSQL Serializable transaction on the backend.
  - **Conflict Error Handling & Bug**:
    - Backend returns 409 Conflict with `{ error, details: { conflicts: [...] } }`.
    - Frontend parses `c.startTime` and `c.endTime` using `${new Date(c.startTime).toISOString().slice(11, 16)}`.
    - **Hazard**: If `c.startTime` is returned as a plain Postgres time string (e.g., `"09:00:00"` or `"09:00"`), `new Date("09:00:00")` evaluates to `Invalid Date` in V8/browser JS, and calling `.toISOString()` throws an uncaught `RangeError: Invalid time value`, crashing the error display handler.
  - **Field Errors Handling**: Correctly flattens and formats Zod `fieldErrors` if validation fails.
  - **Success Handling**: Sets green banner, clears form fields, and refetches availability strip for the selected date.

---

### 2.4 "My Bookings" & Management (`src/pages/MyBookings.jsx`)
- **Booking List**:
  - Calls `GET /api/v1/bookings/my` to retrieve all bookings for the authenticated user.
  - Renders resource name, type, department, date (`YYYY-MM-DD`), time range (`HH:mm–HH:mm`), and purpose.
  - Formats date and time defensively.
- **Status Badges**:
  - `Pending`: Amber pill (`bg-amber/15 text-amber`).
  - `Approved`: Green pill (`bg-forest-light text-forest`).
  - `Rejected`: Brick red pill (`bg-brick-light text-brick`).
  - `Cancelled`: Muted gray pill (`bg-ink/10 text-ink/50`).
- **Cancellation Workflow**:
  - Shows `"Cancel"` button only for active statuses (`Pending` and `Approved`).
  - Triggers browser `window.confirm('Are you sure you want to cancel this booking?')`.
  - Disables button and displays `"Cancelling…"` during the request.
  - Calls `POST /api/v1/bookings/:bookingId/cancel`.
  - On completion, refetches the booking list.
- **Critical Defect / Missing Feature: Rejection Remarks**:
  - When an admin rejects a booking with remarks (e.g., `"Scheduled for maintenance"`, `"Priority given to College Annual Day"`), the requester cannot view why the booking was rejected.
  - In backend `bookings.repository.js`, `list()` does not include `approvals` in the Prisma query.
  - In frontend `MyBookings.jsx`, there is no UI component (modal, expandable row, or subtext) to display rejection remarks or approver feedback.

---

## 3. Discovered Bugs, Discrepancies & Recommendations

| # | Severity | Category | File & Line | Description | Fix Recommendation |
|---|---|---|---|---|---|
| 1 | **High** | Critical UX Defect | `src/pages/MyBookings.jsx:97-133`<br>`crms-backend/src/modules/bookings/bookings.repository.js:48-75` | **Rejection remarks not visible to requester**: When an approval is rejected, the requester only sees the "Rejected" status badge with no reason or remarks displayed. `list()` in backend does not include `approvals`, and `MyBookings.jsx` does not render remarks. | 1. Include `approvals` relation in backend `bookings.repository.js:list()`.<br>2. Add an expandable remarks accordion or sub-card under rejected bookings in `MyBookings.jsx`. |
| 2 | **Medium** | Uncaught Exception Hazard | `src/pages/ResourceDetail.jsx:61` | **Unsafe Date parsing on conflict response**: `new Date(c.startTime).toISOString()` throws `RangeError: Invalid time value` if `c.startTime` is a standard Postgres time string (`"09:00:00"`). | Replace with safe formatter `fmtTime(c.startTime)` or `fmtTimeSlot(c.startTime, c.endTime)` from `src/utils/formatters.js`. |
| 3 | **Medium** | State / Data Mismatch | `src/context/AuthContext.jsx`<br>`crms-backend/src/modules/auth/auth.service.js:45-48`<br>`src/components/admin/Sidebar.jsx:40-43` | **User object structure disparity**: Login endpoint returns `{ role: 'Super Admin', department: 'CSE' }` (strings), whereas `usersApi.me()` returns `{ role: { roleName: 'Super Admin' }, department: { departmentName: 'CSE' } }` (objects). Accessing `user.role?.roleName` evaluates to `undefined` immediately after login. | Standardize backend login response to return nested objects matching `users.repository.js:SAFE_SELECT`, or make frontend accessors defensive (e.g. `user?.role?.roleName || user?.role`). |
| 4 | **Low** | Visual Styling Glitch | `src/pages/Dashboard.jsx:7` | **Resource type color badge mismatch**: `TYPE_COLORS` has `'Laboratory'` key, but database seeds type name as `'Lab'`. Labs render in plain gray rather than forest green. | Change `'Laboratory'` to `'Lab'` (or add both) in `TYPE_COLORS`. |
| 5 | **Low** | Routing / Navigation | `src/App.jsx:44-61` | **Missing 404 / Catch-all route**: If a user navigates to an undefined route (e.g. `/my-bookings` instead of `/bookings`), the app renders a blank screen without redirecting to `/` or displaying a 404 page. | Add `<Route path="*" element={<Navigate to="/" replace />} />` at the end of `<Routes>`. |
| 6 | **Low** | Responsive Design | `src/components/Navbar.jsx:16-55` | **Navbar overflow on mobile viewports**: Nav links, admin button, user name, and sign-out button are laid out in a single horizontal flex line without collapsing or wrapping on small screens (< 640px). | Add `flex-wrap` or a responsive mobile drawer/menu for screens smaller than `sm`. |
| 7 | **Low** | UX Enhancement | `src/components/AvailabilityStrip.jsx:39-89` | **Non-interactive availability timeline**: Availability strip provides visual awareness but does not allow clicking a slot to set start/end times in the booking form. | Add an `onSelectSlot(startTime, endTime)` callback prop to allow one-click slot filling. |

---

## 4. Build and Code Quality Assessment

1. **Build Tooling & Dependencies**:
   - Project uses React 19 (`^19.2.8`), React DOM 19, React Router 7 (`^7.18.2`), Axios (`^1.19.0`), and Tailwind CSS v4 (`^4.3.3` with `@tailwindcss/vite`).
   - Configuration files: `vite.config.js` properly configures `@vitejs/plugin-react` and `@tailwindcss/vite`, and includes a proxy for `/api` pointing to `http://localhost:4001`.
2. **React Strict Mode & Lifecycle**:
   - `main.jsx` runs in `<StrictMode>`.
   - `useEffect` cleanup handles debounced timeouts and cancellation flags in `Dashboard.jsx`.
   - No missing keys found in mapped lists (`key={l.to}`, `key={r.resourceId}`, `key={b.bookingId}`).
3. **Security & Tokens**:
   - JWT tokens stored in `localStorage` (`crms_access_token`, `crms_refresh_token`).
   - Token refresh loop is protected against infinite recursions and race conditions.

---

## 5. Conclusion & Verification Summary

The Requester Frontend fulfills all primary functional requirements for faculty, HODs, and deans to discover resources, check availability, request bookings, and manage submissions. Addressing the identified rejection remarks visibility, safe time parsing in conflict handlers, and responsive navigation polish will elevate the system to enterprise-grade readiness.
