# StrayCare — Rescue. Heal. Protect.

Full-stack version of the single-file prototype: **Node/Express + SQLite** backend, modular **vanilla HTML/CSS/JS** frontend (original design preserved).

## Run
```bash
cd backend
npm install
cp .env.example .env        # replace the local placeholders before starting
npm run seed                # local development/demo data only; never run in production
npm start                   # http://localhost:5000  (serves the frontend too)
```
Generate a signing secret locally with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` and set it as `JWT_SECRET`; also set a unique `ADMIN_USERNAME` and an `ADMIN_PASSWORD` of at least 12 characters. Production startup rejects missing, default, placeholder, or too-short credentials. Demo seeding is explicitly disabled in production. Keep `.env` private and never deploy the example values.

Seeded demo accounts (local development only): `user1/user123` · `vet1/vet123` · `ngo1/ngo123` · `vol1/vol123`; the initial admin uses `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env`.

Run the complete test suite with `cd backend && npm test`. Unit tests run without a server; the API smoke test seeds and starts an isolated temporary database/upload directory and cleans it up afterward, leaving `database/straycare.db` and `backend/uploads` untouched. Focused suites: `npm run test:security`, `npm run test:report-access`, `npm run test:donations`, and `npm run test:report-coordinates`. The browser E2E flow (`node scripts/e2e.js`) is separate, requires Playwright and a dedicated development server seeded with demo accounts; it does not run as part of `npm test`.

### Donations
Donation confirmation records a **pending payment claim**, not verified funds. Payments happen outside StrayCare through the selected NGO's UPI destination; the app does not process or automatically verify transfers. An authenticated administrator must explicitly attest that external payment evidence was reviewed before a claim can be marked verified. The app records the admin user reference and verification timestamp. On upgrade, legacy claims marked verified without a recorded verifier are returned to pending review; older verified rows may have no timestamp because it was not previously captured. Donation exports count only admin-marked verified claims as verified funds and report pending claims separately.

Reports accept a typed address even when GPS is unavailable. Such reports store null coordinates, remain visible in the general dispatch pool, and are omitted from the responder Nearby-only filter because their distance cannot be calculated.

## Structure
```
StrayCare/
├── frontend/
│   ├── index.html                  entry (redirects to pages/home.html)
│   ├── pages/                      home, login, signup, user-/responder-/admin-dashboard
│   ├── css/                        style, auth, dashboard, admin, responsive (split from original CSS)
│   ├── js/                         config, api, ui, auth, home, user, responder, admin, charts, export, vendor/chart.js
│   └── assets/{images,icons,fonts}
├── backend/
│   ├── src/ config/ db/ middleware/ routes/ services/ utils/ app.js server.js
│   ├── scripts/                    seed.js, e2e.js
│   ├── uploads/                    report photos
│   └── .env.example
├── database/schema.sql             users, reports, report_events, donations
└── docs/ANALYSIS.md               feature inventory + localStorage → API/DB map + defects found
```

## What changed vs. the prototype
- Passwords hashed (bcrypt), JWT sessions, server-enforced roles; pending/banned admins can no longer log in.
- Radius expansion runs on the server (survives reloads; timings in `.env`).
- Analytics, hero stats, exports and certificate PDFs are computed from the database (no hard-coded demo numbers).
- Responders can filter to "Nearby only" (haversine distance vs. current radius).
- Photos are uploaded files (≤5 MB, images only); all user text is HTML-escaped.
