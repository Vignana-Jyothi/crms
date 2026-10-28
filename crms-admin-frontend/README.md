# CRMS Admin Frontend — Super Admin / Institute Admin / Department Admin

The admin management portal: approvals, resource management, user management,
audit trail.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Runs on `http://localhost:5174` (deliberately a different port than the main
frontend, so you can run both side by side locally). Proxies `/api/*` to your
backend the same way the main frontend does.

## Production build

```bash
docker build --build-arg VITE_API_BASE_URL=https://crms-api.vjstartup.com/api/v1 -t crms-admin-frontend .
docker run -p 8081:80 crms-admin-frontend
```

## What's here

- `src/pages/Login.jsx` — sign in; rejects Requester-role accounts outright
  (they belong in the main app, not here)
- `src/pages/Overview.jsx` — pending/approved/resource counts
- `src/pages/Approvals.jsx` — the core admin loop: approve/reject with
  optional remarks, requester's phone number shown as a `tel:` link since
  that was the explicit requirement (whoever's reviewing a booking can
  actually call the person)
- `src/pages/Bookings.jsx` — full booking list, status-filterable. Server-side
  scoped: a Department Admin only ever sees their own department's bookings —
  this isn't a frontend filter, the backend enforces it
- `src/pages/Resources.jsx` — Super Admin only: create/deactivate resources
- `src/pages/Users.jsx` — Super Admin only: create users (shows a one-time
  temp password to relay to them), change role/department, activate/deactivate
- `src/pages/AuditLogs.jsx` — Super Admin only: read-only audit trail
- `src/components/Sidebar.jsx` — the pending-approvals count badge polls every
  30s; swap this for a real push/websocket update once the notifications
  module exists
- `src/components/RequireRole.jsx` — route-level role gating so Institute/
  Department Admin never even render a Super-Admin-only page

## Role visibility summary

| Screen | Super Admin | Institute Admin | Department Admin |
|---|---|---|---|
| Overview | ✅ | ✅ | ✅ |
| Approvals | ✅ | ✅ (institute-owned resources only, enforced server-side) | ✅ (own department only) |
| Bookings | ✅ (all) | ✅ (all) | ✅ (own department only) |
| Resources | ✅ | ❌ | ❌ |
| Users | ✅ | ❌ | ❌ |
| Audit logs | ✅ | ❌ | ❌ |

## Known gaps

Same as the main frontend — no email/SMS notifications yet (backend module
not built), and no "forgot password" self-service flow.
