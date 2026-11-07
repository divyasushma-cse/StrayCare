<div align="center">

# 🐾 StrayCare

### Rescue. Heal. Protect.

**A community-powered platform for reporting animals in need and coordinating a faster, more accountable rescue response.**

[![Open Live Demo](https://img.shields.io/badge/OPEN%20LIVE%20DEMO-Visit%20StrayCare-138A72?style=for-the-badge)](https://straycare-frontend-omega.vercel.app)

[![Node.js](https://img.shields.io/badge/Node.js-Backend-43853D?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-API-111111?logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-Database-07405E?logo=sqlite&logoColor=white)](https://sqlite.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=222222)](https://developer.mozilla.org/docs/Web/JavaScript)
[![Frontend Hosting](https://img.shields.io/badge/Frontend-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/)
[![Backend Hosting](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render&logoColor=black)](https://render.com/)

**Report an animal · Dispatch responders · Follow every case**

[About](#-about-straycare) ·
[Features](#-features) ·
[Get started](#-get-started) ·
[Demo accounts](#-local-demo-accounts) ·
[Tests](#-run-the-tests) ·
[Deployment](#-deployment) ·
[Operations](#️-production-operations)

</div>

---

## 🌱 About StrayCare

When an animal needs help, every minute matters. StrayCare connects community members who report animals in need with rescuers, veterinarians, NGOs, volunteers, and administrators who coordinate the response.

A community member can submit a report with a description, location, optional GPS coordinates, and a photo. Responders can find open cases, accept assignments, and update rescue progress. Administrators can oversee reports, user access, dispatch, donation claims, and analytics.

The application includes a responsive web interface and a Node.js/Express API backed by SQLite. Reports move through a tracked rescue lifecycle, while role-based access controls protect accounts, cases, and uploaded photos.

### 🔗 Live application

- **Frontend:** [Open StrayCare](https://straycare-frontend-omega.vercel.app)
- **Backend health check:** [Check API status](https://straycare-0d09.onrender.com/api/health)

> [!NOTE]
> The frontend is hosted on Vercel and connects to an API hosted on Render. The current Render deployment uses temporary storage. Reports, accounts, and uploaded photos may be lost when the service restarts or redeploys. Do not rely on this demo deployment to retain real rescue data.

## ✨ Features

| 🐾 Community members | 🚑 Responders | 🛡️ Administrators |
|---|---|---|
| Submit an animal report with a description, typed location, optional GPS, and photo. | Browse open cases, filter by proximity, accept a case, and update its rescue status. | Review reports, manage access, oversee dispatch, and review donation claims. |
| Follow report progress and view case timelines. | See assigned cases and their progress. | Search and filter reports by status or severity, and load results page by page. |
| Earn points for completed rescues and view rewards. | Coordinate response with other rescue teams. | Review analytics and export supported reports. |

### 📊 Clearer case management

- **Operational KPIs** distinguish active cases, resolved cases, and real reports.
- **Urgent case queue** highlights active critical reports; demo and resolved cases are excluded.
- **Report history** labels demo records and includes search, status/severity filters, a real-only option, and pagination.
- **Dispatch ordering** prioritizes critical reports; administrators can also review the oldest open cases.
- **Responder lifecycle recovery** reopens active reports when a responder is banned or deleted, clears their assignment, and records the change in the case timeline.

### 🔒 Safety and accessibility

- Role permissions and report/photo access are enforced by the backend.
- Passwords are hashed; authentication uses JWT sessions.
- Donation submissions are pending claims—not payment processing or automatic verification. An administrator must review external evidence before marking a claim verified.
- Reports can use a typed address when GPS is unavailable; reports without coordinates are excluded from distance-based filtering.
- Keyboard-friendly dashboard tabs and accessible dialogs support focus management, Escape-to-close, and focus restoration.
- Demo records are identified as sample data and excluded from responder dispatch and public landing-page counts.

## 🧰 Built with

| Area | Stack |
|---|---|
| Frontend | HTML, CSS, vanilla JavaScript |
| API | Node.js, Express |
| Data | SQLite |
| Authentication | bcrypt password hashing, JWT |
| Uploads | Multer and local file storage |
| Testing | Node.js test runner and isolated API smoke tests |
| Frontend hosting | Vercel |
| Backend hosting | Render |

## 🚀 Get started

### Requirements

Install [Node.js](https://nodejs.org/) and npm.

### 1. Get the code and install dependencies

```bash
git clone https://github.com/divyasushma-cse/StrayCare.git
cd StrayCare/backend
npm install
```

### 2. Create your local environment file

**Windows PowerShell**

```powershell
Copy-Item .env.example .env
notepad .env
```

**macOS / Linux**

```bash
cp .env.example .env
```

Keep `.env` private and out of version control. The example configuration is for local development only. Production requires unique credentials supplied through the hosting provider’s environment settings.

### 3. Seed demo data and run StrayCare

From the `backend/` directory:

```bash
npm run seed
npm start
```

Open **[http://localhost:5000](http://localhost:5000)**.

> [!IMPORTANT]
> `npm run seed` is for local development only and is refused in production. Do not run it against production data.

## 🔑 Local demo accounts

Choose the matching role on the sign-in page before entering an account:

| Role | Username | Password |
|---|---|---|
| **Administrator** | `superadmin` | `StrayCareAdmin$2026` |
| Community member | `user1` | `user123` |
| Rescue responder | `vet1` | `vet123` |
| NGO responder | `ngo1` | `ngo123` |
| Volunteer responder | `vol1` | `vol123` |

> [!WARNING]
> These are **public demo credentials**, not secure production credentials. In development, StrayCare uses the fixed `superadmin` login and updates the local admin password to that default at startup. Never expose a development instance or use these credentials in a deployment.

Admin registrations submitted through the signup page require administrator approval before access is granted.

Seeded sample reports and accounts are marked **DEMO**. Demo reports remain visible in history but are excluded from responder dispatch and public landing-page counts. New reports are treated as real.

## 🧪 Run the tests

From `backend/`, run the complete unit and API smoke-test suites:

```bash
npm test
```

The smoke tests run against temporary database and upload paths; they do not reset your local application data.

Run a focused suite:

```bash
npm run test:security
npm run test:report-access
npm run test:donations
npm run test:report-coordinates
npm run test:responder-lifecycle
npm run test:demo-data
npm run test:bootstrap
```

The browser end-to-end flow is separate. It requires Playwright and a dedicated development server seeded with demo data:

```bash
node scripts/e2e.js
```

## ☁️ Deployment

### Frontend on Vercel

The live frontend is deployed at **[straycare-frontend-omega.vercel.app](https://straycare-frontend-omega.vercel.app)**.

For a static frontend deployment from this repository, configure Vercel to use:

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | `Other` |
| Build Command | Leave blank |
| Output Directory | `.` |
| Install Command | Leave blank |

The frontend is configured to call the Render API at `https://straycare-0d09.onrender.com/api`.

### Backend on Render

The backend is deployed at **[straycare-0d09.onrender.com](https://straycare-0d09.onrender.com)**.

For browser requests from the Vercel frontend to work, configure this environment variable in the Render service:

```text
CORS_ORIGIN=https://straycare-frontend-omega.vercel.app
```

Use the exact frontend origin, without a trailing slash or `/api`, then redeploy the backend if you change the variable.

> [!WARNING]
> The current Render Free deployment stores SQLite and uploaded photos in temporary storage. Data may be lost when the service restarts or redeploys. For durable use, configure persistent storage for both the SQLite database and uploaded photos, or migrate to managed database and file-storage services.

## ⚙️ Production operations

Before deploying, configure a unique JWT signing secret and strong, unique administrator credentials. Production startup rejects missing, placeholder, default, or too-short credentials. **Production must not use the demo accounts or values from `.env.example`.**

Generate a signing secret locally:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Set `NODE_ENV=production`, `JWT_SECRET`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` in the deployment environment. SQLite and uploaded photos need persistent storage for production use. Restrict the service behind HTTPS and do not run multiple application processes against the same SQLite database.

### Render Blueprint

The repository includes a Render Blueprint in [`render.yaml`](render.yaml). In Render, choose **New → Blueprint**, connect this GitHub repository, and review the service plan before confirming. The Blueprint generates a JWT secret and asks you to provide a unique production administrator username and password. Do not add a `.env` file or seed demo data to the deployment.

The repository Blueprint is configured for Render Free without an attached disk. Its database and uploads are temporary; reports, accounts, and photos may be lost after a restart or redeploy. Do not use this configuration for data that must be retained. For durable production use, configure persistent storage and set `DB_PATH` and `UPLOAD_DIR` to paths on its mount. Keep the service to one instance while using SQLite.

### Backups and recovery

Create a consistent SQLite backup on a host with persistent local storage:

```bash
cd backend
npm run backup
```

Backups should be scheduled, stored securely off-host, and periodically restored in a separate test environment. Monitor `GET /api/health`, application logs, disk space, and backup failures.

On Render Free, both live files and locally written backups are ephemeral; they are not a durable recovery strategy.

For the full deployment, backup/recovery, monitoring, and accessibility checklist, see **[Production operations](docs/OPERATIONS.md)**.

## 🗂️ Project structure

```text
StrayCare/
├── backend/
│   ├── scripts/       # Seeding, backups, tests, and browser E2E
│   └── src/
│       ├── config/    # Environment and security configuration
│       ├── db/        # SQLite setup and migrations
│       ├── middleware/
│       ├── routes/    # API endpoints
│       └── services/  # Bootstrap and application services
├── database/
│   └── schema.sql
├── docs/
│   └── OPERATIONS.md
├── frontend/
│   ├── css/
│   ├── js/
│   └── pages/
└── render.yaml        # Render deployment Blueprint
```

## 🤝 Contributing

Issues and improvements are welcome. For changes to authentication, report access, uploads, responder lifecycle, or donation verification, include focused tests where practical.

---

<div align="center">

**Built with care for the animals who need us most. 🐾**

[🌐 Visit the live StrayCare demo](https://straycare-frontend-omega.vercel.app)

</div>
