# CRMS Main Frontend (Requester App) — In-Depth Analysis Report

**Subsystem**: `crms-main-frontend`  
**Target Audience**: Requester / Faculty / Student portal for campus hall and resource reservations  
**Date**: 2026-08-16  
**Investigator**: Explorer 2 (Main Requester Frontend Specialist)

---

## 1. Executive Summary

`crms-main-frontend` is a Single Page Application (SPA) built with **React 19.2.8**, **Vite 8.2.0**, **Tailwind CSS v4.3.3** (using `@tailwindcss/vite`), **React Router DOM 7.18.2**, and **Axios 1.19.0**.

The application fulfills the requester user journey:
1. Sign in with email and password.
2. Search and filter campus resources (classrooms, labs, seminar halls, auditoriums).
3. View real-time resource availability on any chosen date with an interactive graphical availability strip (showing classes and approved/pending bookings).
4. Submit booking requests with instant conflict feedback.
5. Track booking status and cancel pending/approved requests.

The codebase is clean, modern, and directly connects to the backend API (`/api/v1/...`). However, our deep-dive code analysis uncovered **several critical edge cases, date/time timezone bugs, interceptor trapping on failed logins, unhandled error flows, and UX gaps** that must be addressed for rock-solid production readiness.

---

## 2. Project Configuration & Build System Analysis

### 2.1 Dependencies & Package Manifest (`package.json`)
```json
{
  "name": "crms-main-frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "oxlint",
    "preview": "vite preview"
  },
  "dependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "axios": "^1.19.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "react-router-dom": "^7.18.2"
  },
  "devDependencies": {
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.4",
    "autoprefixer": "^10.5.4",
    "oxlint": "^1.75.0",
    "postcss": "^8.5.26",
    "tailwindcss": "^4.3.3",
    "vite": "^8.2.0"
  }
}
```

#### Observations & Findings:
- **Tailwind CSS v4 Integration**: Uses `@tailwindcss/vite` plugin in `vite.config.js` and `@import "tailwindcss";` in `src/index.css`. This is the official Tailwind v4 architecture. `postcss` and `autoprefixer` in `devDependencies` are redundant in Tailwind v4 with the Vite plugin, though harmless.
- **Icons**: No external icon library (`lucide-react`) is included; custom SVG / Unicode icons and typographic accents are used.
- **Linting**: Oxlint is configured via `.oxlintrc.json` with React hooks validation.

### 2.2 Vite & Proxy Configuration (`vite.config.js`)
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
```
- **Proxy Behavior**: Local development forwards `/api` calls to `http://localhost:4000` (or `VITE_API_PROXY_TARGET`).
- **Config Note**: In Vite, `process.env` in `vite.config.js` is not automatically populated from `.env` without `loadEnv(mode, process.cwd(), '')`. If `VITE_API_PROXY_TARGET` is set inside `.env`, Vite won't read it unless `loadEnv` is used. However, the default fallback `'http://localhost:4000'` matches the backend standard port.

### 2.3 Environment Files
- `.env.example` defines:
  ```env
  VITE_API_BASE_URL=/api/v1
  VITE_API_PROXY_TARGET=http://localhost:4000
  ```
- `.env` does not exist by default. Creating `.env` ensures consistent local dev configuration.

### 2.4 Design System & Typography (`src/index.css` & `index.html`)
- Custom design tokens defined in `@theme`:
  - Font families: `Fraunces` (display serif), `Inter` (sans-serif body), `IBM Plex Mono` (monospace codes/dates).
  - Colors: `--color-navy` (`#1e3a5f`), `--color-navy-dark` (`#142943`), `--color-amber` (`#c9822a`), `--color-forest` (`#2f7a4f`), `--color-brick` (`#b3432b`), `--color-paper` (`#f7f7f5`), `--color-line` (`#e3e1db`), `--color-ink` (`#1a1a1a`).
- High aesthetic quality, institutional editorial tone appropriate for academic resource management.

---

## 3. Architecture & API Integration Layer

### 3.1 Backend Endpoint Alignment
Verification against `crms-backend/src/app.js` and module routes confirms 100% route contract alignment:

| Frontend Method | Frontend Path | Backend Route | Status | Notes |
|---|---|---|---|---|
| `authApi.login` | `POST /auth/login` | `POST /api/v1/auth/login` | ✅ Aligned | Returns `{ accessToken, refreshToken, user }` |
| `authApi.logout` | Local clear | N/A | ✅ Aligned | Clears localStorage tokens |
| `usersApi.me` | `GET /users/me` | `GET /api/v1/users/me` | ✅ Aligned | Hydrates user profile on session restore |
| `masterDataApi.departments` | `GET /departments` | `GET /api/v1/departments` | ✅ Aligned | Returns department list |
| `masterDataApi.resourceTypes`| `GET /resource-types`| `GET /api/v1/resource-types`| ✅ Aligned | Returns resource types |
| `masterDataApi.blocks` | `GET /blocks` | `GET /api/v1/blocks` | ✅ Aligned | Available for block filtering |
| `resourcesApi.list` | `GET /resources` | `GET /api/v1/resources` | ✅ Aligned | Supports query params (`resourceTypeId`, `departmentId`, `search`) |
| `resourcesApi.get` | `GET /resources/:id` | `GET /api/v1/resources/:resourceId` | ✅ Aligned | Returns resource details |
| `resourcesApi.availability` | `GET /resources/:id/availability` | `GET /api/v1/resources/:resourceId/availability` | ✅ Aligned | Query `?date=YYYY-MM-DD` |
| `bookingsApi.create` | `POST /bookings` | `POST /api/v1/bookings` | ✅ Aligned | Body: `{ resourceId, bookingDate, startTime, endTime, purpose }` |
| `bookingsApi.mine` | `GET /bookings` | `GET /api/v1/bookings` | ✅ Aligned | Requester role automatically scopes to own bookings |
| `bookingsApi.cancel` | `POST /bookings/:id/cancel` | `POST /api/v1/bookings/:bookingId/cancel` | ✅ Aligned | Requesters can cancel own Pending/Approved bookings |

---

## 4. In-Depth Flow-by-Flow Inspection & Bug Identification

### Flow 1: Authentication & Session Lifecycle (`Login.jsx`, `AuthContext.jsx`, `client.js`)

#### 🐛 Bug 1.1: 401 Response Interceptor Trapping Login Failures
- **Location**: `src/api/client.js:33-58`
- **Mechanism**: When a user enters incorrect credentials on `/login`, backend returns `401 Unauthorized` (`Invalid email or password`).
- **Flaw**: If the user had an expired `crms_refresh_token` in `localStorage`, the Axios interceptor catches the 401, attempts to refresh token via `POST /auth/refresh`, fails, clears tokens, and executes `window.location.href = '/login'`. This reloads the page and suppresses the `setError` catch block in `Login.jsx`, preventing the user from seeing why login failed.
- **Fix**: Exclude `/auth/login` and `/auth/refresh` from triggering the token refresh interceptor:
  ```javascript
  const isAuthEndpoint = original.url?.includes('/auth/login') || original.url?.includes('/auth/refresh');
  if (error.response?.status === 401 && !original._retried && !isAuthEndpoint && getRefreshToken()) { ... }
  ```

#### 💡 Enhancement 1.2: Authenticated User Redirect on `/login`
- **Location**: `src/pages/Login.jsx`
- **Issue**: If an already logged-in user navigates to `/login`, they are presented with the login form instead of being redirected to `/`.
- **Fix**: Add `const { user } = useAuth(); if (user) return <Navigate to="/" replace />;`.

---

### Flow 2: Resource Discovery & Filtering (`Dashboard.jsx`)

#### 🐛 Bug 2.1: Asynchronous Debounce Race Condition
- **Location**: `src/pages/Dashboard.jsx:30-44`
- **Mechanism**: Fast changes to search text trigger `setTimeout` (250ms). If consecutive network responses return out-of-order, an older search result can overwrite a newer search result.
- **Fix**: Use an `isCancelled` flag or `AbortController` in the `useEffect` cleanup.

#### 💡 Enhancement 2.2: Missing Block & Capacity Filters
- **Location**: `src/pages/Dashboard.jsx:53-85`
- **Finding**: The backend supports `blockId` filtering (`GET /api/v1/resources?blockId=...`) and `masterDataApi.blocks()` is available in `endpoints.js`. Resource cards display Block and Capacity, but the filter bar only offers `Search`, `Resource Type`, and `Department`. Adding a Block dropdown and Capacity sorting/filtering significantly improves user experience.

---

### Flow 3: Real-Time Availability & Time Visualization (`ResourceDetail.jsx`, `AvailabilityStrip.jsx`)

#### 🐛 Bug 3.1: UTC Date Offset Bug in `todayStr()`
- **Location**: `src/pages/ResourceDetail.jsx:6-8`
- **Code**: `function todayStr() { return new Date().toISOString().slice(0, 10); }`
- **Flaw**: In timezones ahead of UTC (e.g. IST, UTC+5:30), between 00:00 and 05:30 AM local time, `toISOString()` returns the previous calendar day. This defaults the date picker to yesterday and allows selecting an invalid past date.
- **Fix**: Use local date formatting:
  ```javascript
  function todayStr() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  ```

#### 🐛 Bug 3.2: Fragile ISO String Parsing in `AvailabilityStrip.jsx`
- **Location**: `src/components/AvailabilityStrip.jsx:8-13`
- **Code**:
  ```javascript
  function toMinutes(isoTimeStr) {
    const d = new Date(isoTimeStr);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
  ```
- **Flaw**: If backend sends `"09:00"` or `"09:00:00"` (or if mock data/caching formats differently), `new Date("09:00")` evaluates to `Invalid Date`, causing `NaN` positions and breaking the visual strip.
- **Fix**: Defensively parse both ISO strings and standard `HH:MM[:SS]` strings:
  ```javascript
  function toMinutes(timeStr) {
    if (!timeStr) return 0;
    if (typeof timeStr === 'string' && !timeStr.includes('T')) {
      const [h, m] = timeStr.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    }
    const d = new Date(timeStr);
    return isNaN(d.getTime()) ? 0 : d.getUTCHours() * 60 + d.getUTCMinutes();
  }
  ```

#### 💡 Enhancement 3.3: Extended Campus Hours Indication
- **Location**: `src/components/AvailabilityStrip.jsx:5-6`
- **Finding**: Timeline spans 08:00 to 18:00 (8 AM – 6 PM). For evening events (e.g., 6 PM – 9 PM auditorium bookings), blocks are clipped at the 18:00 boundary. Adding an indicator or expanding the range when events exist past 18:00 ensures visibility of evening reservations.

---

### Flow 4: Booking Submission & Conflict Handling (`ResourceDetail.jsx`)

#### 🐛 Bug 4.1: Missing Zod `fieldErrors` Parsing on 400 Bad Request
- **Location**: `src/pages/ResourceDetail.jsx:47-56`
- **Code**:
  ```javascript
  catch (err) {
    const data = err.response?.data;
    if (data?.details?.conflicts) {
      setError(`${data.error}: ${data.details.conflicts.map(...).join(', ')}`);
    } else {
      setError(data?.error || 'Could not create booking.');
    }
  }
  ```
- **Flaw**: When backend Zod validation fails (e.g. `endTime` is before `startTime`, or purpose is too short), backend `validateRequest` returns `{ error: "Validation failed", details: { fieldErrors: { endTime: ["endTime must be after startTime"] } } }`.
  Frontend only displays the generic `"Validation failed"`, hiding the actual actionable error message from the user.
- **Fix**: Extract field errors:
  ```javascript
  let msg = data?.error || 'Could not create booking.';
  if (data?.details?.conflicts) {
    msg = `${data.error}: ${data.details.conflicts.map(c => `${new Date(c.startTime).toISOString().slice(11, 16)}–${new Date(c.endTime).toISOString().slice(11, 16)}`).join(', ')}`;
  } else if (data?.details?.fieldErrors) {
    msg = Object.values(data.details.fieldErrors).flat().join('. ');
  }
  setError(msg);
  ```

#### 💡 Enhancement 4.2: Client-side Time Range Validation
- **Location**: `src/pages/ResourceDetail.jsx:30-46`
- **Finding**: Immediate check `if (form.startTime >= form.endTime) { setError('End time must be after start time'); return; }` before dispatching network request prevents unnecessary API roundtrips.

---

### Flow 5: My Bookings & Cancellation (`MyBookings.jsx`)

#### 🐛 Bug 5.1: Unhandled Promise Rejection on Cancellation Error
- **Location**: `src/pages/MyBookings.jsx:27-35`
- **Code**:
  ```javascript
  async function handleCancel(bookingId) {
    setCancellingId(bookingId);
    try {
      await bookingsApi.cancel(bookingId);
      refresh();
    } finally {
      setCancellingId(null);
    }
  }
  ```
- **Flaw**: Missing `catch` block. If the cancel API fails (e.g. 403 Forbidden, 409 Conflict if already processed, or network failure), the error throws unhandled and no user feedback is presented.
- **Fix**: Add `const [error, setError] = useState('')` and `catch (err) { setError(err.response?.data?.error || 'Failed to cancel booking'); }`.

#### 💡 Enhancement 5.2: Cancellation Confirmation Prompt
- **Location**: `src/pages/MyBookings.jsx:63-70`
- **Finding**: Single-click cancellation without confirmation can lead to accidental booking cancellations. Adding `if (!window.confirm('Are you sure you want to cancel this booking?')) return;` provides essential safety.

#### 💡 Enhancement 5.3: Status Filter for Bookings
- **Location**: `src/pages/MyBookings.jsx`
- **Finding**: Requesters with multiple past and upcoming bookings benefit from filtering tabs: `All`, `Pending`, `Approved`, `Past/Cancelled`.

---

## 5. Comprehensive Bug & Quality Matrix

| ID | Module | Severity | Issue Description | Proposed Solution |
|---|---|---|---|---|
| **BUG-01** | `client.js` | 🔴 **High** | 401 interceptor attempts token refresh on failed `/auth/login` requests, swallowing error message. | Add `!original.url?.includes('/auth/login')` condition to 401 interceptor. |
| **BUG-02** | `ResourceDetail.jsx` | 🟠 **Medium** | `todayStr()` uses UTC `toISOString()` leading to incorrect dates between 00:00–05:30 IST. | Use local year, month, date string constructor. |
| **BUG-03** | `ResourceDetail.jsx` | 🟠 **Medium** | Backend Zod validation errors (`fieldErrors`) are masked as generic `"Validation failed"`. | Unpack `data.details.fieldErrors` in catch handler. |
| **BUG-04** | `MyBookings.jsx` | 🟠 **Medium** | `handleCancel` has no `catch` handler, causing unhandled promise rejection on error. | Add error state and try/catch block. |
| **BUG-05** | `AvailabilityStrip.jsx`| 🟡 **Low** | `toMinutes` assumes ISO format with `T`, failing on plain `HH:MM` strings. | Defensively support both ISO and `HH:MM` time strings. |
| **BUG-06** | `Dashboard.jsx` | 🟡 **Low** | Search debounce has no cancellation, leading to potential out-of-order race conditions. | Add cleanup flag to prevent stale state updates. |
| **ENH-01** | `Dashboard.jsx` | 🟢 **Polish** | Missing Block filter and Capacity filter/sort. | Integrate `masterDataApi.blocks()` and add Block dropdown. |
| **ENH-02** | `Login.jsx` | 🟢 **Polish** | Authenticated users navigating to `/login` are not redirected. | Add `if (user) return <Navigate to="/" replace />`. |
| **ENH-03** | `MyBookings.jsx` | 🟢 **Polish** | Cancellation happens on single click with no confirmation. | Add confirmation prompt before API call. |

---

## 6. Verification & Test Plan

1. **Static Syntax & Type Verification**:
   - Verify React 19 JSX compliance across all 4 pages and 3 components.
   - Verify proper prop passing and hook dependencies (`useEffect`, `useState`, `useAuth`, `useParams`, `useNavigate`).
2. **Build Verification**:
   - Run `npm run build` once dependencies are installed.
   - Verify zero JSX syntax errors, zero CSS bundling errors, and clean asset outputs in `/dist`.
3. **End-to-End Flow Verification**:
   - **Login**: Enter valid credentials -> store tokens -> redirect to `/`. Enter invalid credentials -> show error banner.
   - **Dashboard**: Search by text, filter by department and type -> verify list matches filter.
   - **Resource Detail**: Select dates -> availability strip renders open and blocked blocks.
   - **Booking Request**: Submit slot -> verify success banner and strip refetch. Submit conflicting slot -> verify detailed conflict error banner.
   - **My Bookings**: Verify status badges and cancel action with feedback.

---

## 7. Conclusion

The `crms-main-frontend` application is well-structured, adheres strictly to project design guidelines and backend API contracts, and implements the requester booking workflow. Implementing the 6 identified bug fixes and UX improvements will bring the frontend to full production-grade reliability.
