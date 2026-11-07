<div align="center">

# 🐾 StrayCare

### Rescue. Heal. Protect.

A platform for reporting stray animals in need and coordinating a community response—from the first report to rescue and recovery.

[Features](#-features) · [Get started](#-get-started) · [Testing](#-testing) · [Project structure](#-project-structure)

</div>

---

## 🌟 About

StrayCare connects people who report animals in need with responders and administrators who coordinate care. It includes a web frontend and a Node.js/Express API backed by SQLite.

## ✨ Features

- 📍 **Animal reports** — Submit a report with a typed address, optional GPS coordinates, description, and photo.
- 🚑 **Responder dispatch** — Responders can find open cases, accept work, and update a case as it progresses.
- 🔐 **Role-based access** — Reporter, responder, and administrator permissions are enforced by the backend.
- 🖼️ **Protected report photos** — Photos are served through an authenticated route with report-level access checks.
- 💝 **Donation tracking** — User confirmations create pending claims. Only an administrator who has reviewed external evidence can mark a claim verified.
- 📊 **Analytics and exports** — View database-backed activity and generate supported reports and certificates.
- 🧭 **Honest location handling** — Reports without GPS remain available in the dispatch pool, but are excluded from distance-based nearby results.
- 🧪 **Isolated API smoke tests** — The smoke-test runner uses temporary database and upload paths instead of resetting local app data.

## 🧰 Technology

| Layer | Technologies |
|---|---|
| Frontend | HTML, CSS, vanilla JavaScript |
| Backend | Node.js, Express |
| Database | SQLite |
| Authentication | bcrypt password hashing, JWT sessions |

## 🚀 Get started

### Requirements

Install Node.js and npm before getting started.

### 1. Clone the repository

```bash
git clone https://github.com/divyasushma-cse/StrayCare.git
cd StrayCare
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```
### 3. Configure local environment

Create your local environment file from the example.

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
notepad .env
```

**macOS/Linux:**

```bash
cp .env.example .env
```

The fixed local-development admin login is **`superadmin` / `StrayCareAdmin$2026`**. Development always uses these credentials even if `ADMIN_USERNAME` or `ADMIN_PASSWORD` is set in `.env`; startup updates the local `superadmin` password to this default when needed. These are demo-only credentials.

Review `.env.example` and set your local values in `.env`. Keep `.env` private; never commit it or use example credentials in a deployment. For production, set `NODE_ENV=production` and generate a strong JWT signing secret locally with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Set that value as `JWT_SECRET`, and configure a unique `ADMIN_USERNAME` and an `ADMIN_PASSWORD` of at least 12 characters. Production startup rejects missing, default, placeholder, or too-short credentials. Demo seeding is explicitly disabled in production.

### 4. Seed local demo data and start the app

```bash
npm run seed
npm start
```

Open [http://localhost:5000](http://localhost:5000).

> **Local development only:** Demo seeding is refused in production. Do not run the seed script against production data.

Seeded demo accounts (local development only): `user1/user123` · `vet1/vet123` · `ngo1/ngo123` · `vol1/vol123`; the initial admin uses the fixed local-development credentials above. Seeded sample accounts and reports are marked as **DEMO**. Demo reports stay available in admin and user history for testing, but are excluded from responder dispatch and public landing-page counts; new reports and accounts are treated as real.

## 🧪 Testing

From the `backend` directory, run the complete test suite:

```bash
npm test
```

The suite runs unit tests and an API smoke test. The smoke-test runner uses temporary database and upload paths and cleans them up afterward, leaving the normal local database and uploads untouched.

Focused test commands:

```bash
npm run test:security
npm run test:report-access
npm run test:donations
npm run test:report-coordinates
npm run test:responder-lifecycle
npm run test:demo-data
npm run test:bootstrap
```

The browser E2E flow is separate and requires Playwright plus a dedicated development server with demo data:

```bash
node scripts/e2e.js
```

## ⚙️ Production operations

See [Production operations](docs/OPERATIONS.md) for deployment configuration, health checks, logs, backup scheduling, recovery drills, and accessibility release checks. Create a consistent SQLite database-and-uploads backup with `cd backend && npm run backup`; schedule backups and protect their contents.

## 🔒 Security and data integrity

- **Production credentials:** Configure a strong, unique JWT secret and administrator credentials before deployment. Default and placeholder values are rejected.
- **Report access:** Reporters can access their own reports and photos; administrators can access all reports; responders can access open dispatch cases and cases assigned to them.
- **Donation status:** A user-submitted confirmation is a pending claim, not proof of payment. The app does not process or automatically verify payments.
- **Location:** A typed address is supported when GPS is unavailable. Such reports have unknown coordinates and cannot be included in distance-based nearby filtering.
- **Environment files:** Use `.env.example` as a reference. Never commit `.env` or put secrets in frontend files.

## 🗂️ Project structure

```text
StrayCare/
├── backend/
│   ├── scripts/       # Seed, unit, smoke, and E2E test scripts
│   ├── src/
│   │   ├── config/
│   │   ├── db/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   └── uploads/       # Runtime report photos
├── database/
│   └── schema.sql
├── docs/
├── frontend/
│   ├── css/
│   ├── js/
│   ├── pages/
│   └── index.html
└── README.md
```

## 🤝 Contributing

Issues and improvements are welcome. For changes involving authentication, report access, uploads, or donation verification, please include focused tests where practical.

---

<div align="center">

**Built to help communities care for animals in need. 🐾**

</div>

## What changed vs. the prototype

- Passwords hashed (bcrypt), JWT sessions, server-enforced roles; pending/banned admins can no longer log in.
- Radius expansion runs on the server (survives reloads; timings in `.env`).
- Analytics, hero stats, exports and certificate PDFs are computed from the database (no hard-coded demo numbers).
- Responders can filter to "Nearby only" (haversine distance vs. current radius).
- Open dispatch requests prioritize critical cases, then show the newest reports first; administrators can review the oldest open cases without automatically closing them.
- Admin KPIs count real active and resolved reports as separate states; the urgent queue excludes resolved and demo cases. The report list supports search, status/severity filters, pagination, and keyboard-friendly tabs.
- Sign-in uses one accessible form for role, username, and password, with optional password visibility; it does not expose or autofill shared demo credentials.
- Production operations include a database readiness health check, request-correlated structured error logs, graceful shutdown, and an SQLite backup command.
- Photos are uploaded files (≤5 MB, images only); all user text is HTML-escaped.
