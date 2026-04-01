# Rheinzelmänner - Strafen-Management App

## Original Problem Statement
Full-stack application for a "Schützenzug" (marksmen's platoon, "Rheinzelmänner") to manage and rank members based on fines.

## Core Requirements
- JWT-based authentication with four roles: `admin`, `spiess`, `vorstand`, `mitglied`
- Unified member + user management (one page for both)
- Full CRUD for members, fines, fine types, and events
- Role-dependent charts and personal/global rankings based on fiscal year
- Calendar/Event system with RSVP and automatic fine assignment
- ICS calendar sync from external source
- Settings page with language, dark mode, ICS config, and roles overview
- Strict security measures (brute-force protection, audit logging)
- Docker-based deployment on Raspberry Pi 4 with Traefik reverse proxy

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn/UI
- Backend: Python, FastAPI, Pydantic, icalendar
- Database: MongoDB (4.4.18)
- Deployment: Docker, Raspberry Pi 4 (ARM64), Traefik, Cloudflare Tunnels
- Storage: Docker root on 250GB SSD (`/mnt/ssd/docker`)

## Architecture
```
/app/
├── backend/
│   ├── server.py              // Monolith (~1900 lines)
│   └── tests/
├── docker-compose.yml         // Traefik-ready
├── frontend/
│   ├── nginx.traefik.conf
│   └── src/
│       ├── components/        // TopBar.js, EventDialog.js, EventDetailDialog.js
│       ├── contexts/          // AuthContext.js, ThemeContext.js
│       ├── pages/             // Members.js, Calendar.js, Dashboard.js, Settings.js
│       └── lib/api.js
├── traefik/
└── README.md
```

## Completed Features
- [x] JWT Auth with 4 roles (admin, spiess, vorstand, mitglied)
- [x] **Unified Member + User management** (one page, app access toggle) - 2026-04-01
- [x] Fine Types (Strafenarten) CRUD
- [x] Fine assignment with fine type references
- [x] Event fine type dropdown (replaced manual amount)
- [x] Fiscal year-based ranking and statistics
- [x] Spiess/Vorstand member linking (personal dashboards)
- [x] Calendar/Event CRUD with RSVP (Zu-/Absagen)
- [x] Automatic fine assignment for missing/late RSVPs
- [x] ICS Calendar daily pull-sync
- [x] Security hardening (strict passwords, short JWT, CORS, Nginx headers)
- [x] Traefik reverse proxy setup
- [x] SSD migration for Docker storage
- [x] Performance optimizations (MongoDB indexes, aggregation pipelines, React.lazy)
- [x] **Settings page** (Language, Dark Mode, ICS config, Roles overview) - 2026-04-01
- [x] **Sidebar restructure** (Administration group with collapsible items) - 2026-04-01
- [x] Benutzerverwaltung removed (merged into Mitgliederverwaltung) - 2026-04-01

## Backlog (Prioritized)
### P2 - Upcoming
- [ ] Automatic Database Backup (weekly `mongodump` via cron in Docker; 50GB partition at `/mnt/backups` ready)
- [ ] Data Export (CSV/PDF) for rankings and fines
- [ ] Dark Mode: extend to all pages (currently Settings + TopBar support it)

### P2 - Refactoring
- [ ] Backend Refactoring: Split `server.py` monolith into FastAPI APIRouter modules

## Key DB Schema
- **users**: `{ id, username, password_hash, role, member_id? }` — admin has no member_id
- **members**: `{ id, firstName, lastName, status }` — enriched with user_info via API
- **fine_types**: `{ id, label, amount, event_id? }`
- **fines**: `{ memberId, fine_type_id, fine_type_label, amount, date }`
- **events**: `{ title, date, deadline, location, description, fine_enabled, fine_type_id?, fine_amount, source, ics_uid? }`
- **event_responses**: `{ event_id, user_id, status, responded_at }`

## Key API Endpoints
- `POST /api/auth/login` / `POST /api/auth/logout`
- `GET/POST/PUT/DELETE /api/members`
- `POST /api/members/{id}/access` — Enable app access (create user)
- `PUT /api/members/{id}/access` — Update username/role/password
- `DELETE /api/members/{id}/access` — Disable app access (delete user)
- `GET/POST/PUT/DELETE /api/fine-types`
- `GET/POST/PUT/DELETE /api/fines`
- `GET/POST/PUT/DELETE /api/events`
- `PUT /api/events/{id}/fine-toggle`
- `GET/PUT /api/settings/ics`
- `POST /api/settings/ics/sync`

## Credentials
- Admin: `admin` / `admin123`
