# CRMS Main Frontend — Requesters

The public-facing booking site: search resources, check availability, submit
a booking request, track its status.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Runs on `http://localhost:5173`. The Vite dev server proxies `/api/*` to your
backend (`VITE_API_PROXY_TARGET` in `.env`, defaults to `localhost:4000`), so
you won't hit CORS issues locally — make sure the backend is running first.

## Production build

```bash
docker build --build-arg VITE_API_BASE_URL=https://crms-api.vjstartup.com/api/v1 -t crms-main-frontend .
docker run -p 8080:80 crms-main-frontend
```

Same pattern as your other Vite frontends: `VITE_*` variables are baked in at
**build time**, not runtime, so the build-arg has to be right when you build
the image — changing `.env` after the fact does nothing until you rebuild.

## What's here

- `src/pages/Login.jsx` — sign in
- `src/pages/Dashboard.jsx` — search/filter resources by type, department, name
- `src/pages/ResourceDetail.jsx` — availability timeline (timetable + existing
  bookings) and the booking request form, with conflict errors surfaced
  directly from the backend
- `src/pages/MyBookings.jsx` — status tracking + cancel
- `src/api/client.js` — axios instance with automatic silent token refresh on
  401, so a session doesn't die mid-use

## Known gaps

No "forgot password" flow yet — that needs the backend's notification module
(email sending) to exist first. For now, a Super Admin resets passwords via
the Admin app's Users page.
