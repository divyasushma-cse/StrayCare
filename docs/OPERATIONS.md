# Production operations checklist

StrayCare is a single Node.js process backed by SQLite and a local uploads directory. Treat both the database and uploaded photos as sensitive user data.

## Before deployment

- Set `NODE_ENV=production`, a unique `JWT_SECRET`, a unique administrator username and a strong administrator password. Production startup rejects missing or placeholder credentials; never use values from `.env.example`.
- For Render Free, use the repository's `render.yaml` Blueprint. It generates `JWT_SECRET`, prompts for `ADMIN_USERNAME` and `ADMIN_PASSWORD`, and stores SQLite and uploads under `/tmp/straycare` without an attached disk. This storage is ephemeral: reports and uploaded photos can be lost when the service restarts or redeploys. Do not use this setup for real rescue reports or data that must be retained. For durable production use, configure a persistent disk and point `DB_PATH` and `UPLOAD_DIR` to its mount; review the current service/disk cost before confirming deployment. Do not add a `.env` file or seed demo data.
- Set `CORS_ORIGIN` to the exact trusted frontend origin(s). Terminate HTTPS at a trusted reverse proxy and do not expose the Node port directly to the public internet.
- Use persistent storage for `DB_PATH` and `UPLOAD_DIR` when retaining data is required. Run one application process per database because report-radius scheduling is process-local.
- Do not run `npm run seed` in production. Keep `.env`, the database, backups, and uploads out of source control.
- Restrict filesystem and backup access to the service operator. Use encrypted, off-host storage for retained backups.

## Backups and recovery

On a host with persistent local storage, run a consistent SQLite backup with:

```bash
cd backend
npm run backup
```

By default, each run creates a timestamped backup set under `database/backups/`, which is git-ignored. The set contains a consistent SQLite copy (`straycare.db`) and a copy of `UPLOAD_DIR` (`uploads/`). Set `STRAYCARE_BACKUP_DIR` to choose another destination. Schedule this command with the host's scheduler, copy complete backup sets off-host, and alert on a non-zero exit code. Choose retention and encryption policies appropriate for the personal information in the database and photos. On Render Free, both the live data and locally written backups are ephemeral; they are not a recovery strategy and may disappear on restart or redeploy.

Periodically restore a backup set to a separate test location, start StrayCare against that database and uploads copy, and verify reports, users, timelines, donations, and uploaded photos. A backup that has not been restore-tested is not a verified recovery plan.

## Health, logs, and incident response

- Monitor `GET /api/health` over HTTPS. It performs a database query and returns success only when the database is reachable.
- The process handles `SIGINT` and `SIGTERM` by stopping the scheduler and gracefully closing HTTP connections and SQLite.
- Errors are emitted as structured JSON on stderr with a request ID, method, path, status, message, and stack. The response includes the request ID for server errors. Collect stdout/stderr with the host's log service, restrict access, and configure alerts for repeated 5xx responses and process restarts.
- The health endpoint is a liveness/readiness signal, not a complete uptime or dependency monitor. Add host-level CPU, memory, disk-space, and backup-failure monitoring; configure an external error-tracking service only after reviewing its privacy and data-retention terms.

## Accessibility release check

Before release, test the login and dashboards at narrow mobile widths and with keyboard-only navigation. Dialogs keep keyboard focus inside while open, close with Escape, and return focus to the opener; verify these behaviors along with visible focus, logical focus order, role selection and login submission without a mouse, tab navigation with arrow keys, readable form errors, and usable screen-reader names for controls. Also test browser zoom and a reduced-motion preference. Automated syntax or smoke tests do not replace testing with assistive technology.
