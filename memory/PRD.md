# Rheinzelmänner - Strafen-Management App

## Original Problem Statement
Full-stack application for a "Schützenzug" (marksmen's platoon, "Rheinzelmänner") to manage and rank members based on fines.

## Core Requirements
- JWT-based authentication with four roles: `admin`, `spiess`, `vorstand`, `mitglied`
- Unified member + user management with app-access toggle
- Full CRUD for members, fines, fine types, and events
- Role-dependent views and statistics
- Calendar/Event system with RSVP and automatic fine assignment
- ICS calendar sync from external source
- Settings page with language, dark mode, ICS config, and roles overview
- Profile page with avatar upload (Object Storage)
- Automated database backups to SSD
- Docker-based deployment on Raspberry Pi 4 with Traefik reverse proxy
- Complete project documentation

## Tech Stack
- Frontend: React 19, Tailwind CSS (Dark Mode), Shadcn/UI, Recharts
- Backend: Python, FastAPI, Pydantic, icalendar, slowapi
- Database: MongoDB (4.4.18)
- Deployment: Docker, Raspberry Pi 4 (ARM64), Traefik v3.3, Cloudflare Tunnels
- Storage: Emergent Object Storage (Avatars)
- Backups: Cron + mongodump (Daily/Weekly/Monthly → SSD)

## Role-Based Access Control (RBAC)

| Feature | Admin | Spieß | Vorstand | Mitglied |
|---|---|---|---|---|
| Dashboard (Persönlich) | Ja* | Ja* | Ja* | Ja |
| Dashboard (Vereinsübersicht) | Ja | Ja | - | - |
| Termine | CRUD + Strafen | CRUD + Strafen | CRUD + Strafen | Nur Lesen |
| Strafenübersicht | Alle | Alle | Nur eigene | Nur eigene |
| Statistiken (Erweitert) | Voll | Voll | Anonymisiert | - |
| Mitgliederverwaltung | CRUD | CRUD | CRUD | - |
| Strafenarten | CRUD | CRUD | CRUD | - |
| Benutzerverwaltung | Voll | - | - | - |
| Audit-Log | Ja | Ja | Ja | - |
| Benutzerrollen | Ja | Ja | Ja | - |
| Profil | Ja | Ja | Ja | Ja |
| Einstellungen (ICS) | Ja | Ja | Ja | - |
| Dark Mode | Ja | Ja | Ja | Ja |

## Completed Features
- [x] JWT Auth with 4 roles + brute-force protection
- [x] Unified Member + User management with app-access toggle
- [x] Auto-disable access on member archival
- [x] Fine Types CRUD + Event fine type dropdown
- [x] Fiscal year-based ranking and statistics
- [x] Calendar/Event CRUD with RSVP + automatic fine assignment
- [x] ICS Calendar daily pull-sync
- [x] Security hardening (bcrypt 12 rounds, 8h JWT, strict CORS, Nginx headers)
- [x] Traefik reverse proxy + Cloudflare Tunnel setup
- [x] Dark Mode across all pages
- [x] Dashboard split: Personal metrics + Club overview (Top 5 Ranking)
- [x] Profile page with avatar upload (Object Storage)
- [x] Benutzerrollen page with permissions matrix
- [x] Sidebar: Administration group with collapsible items
- [x] Automated DB backups (daily/weekly/monthly → SSD)
- [x] Repository cleanup (removed obsolete files)
- [x] Complete documentation overhaul (README, DOCKER_DEPLOYMENT, HTTPS_SETUP, TRAEFIK_SETUP)

## Backlog
### P2 - Upcoming
- [ ] Data Export (CSV/PDF for rankings/fines)

### P2 - Refactoring
- [ ] Backend: Split `server.py` (~2100 lines) into APIRouter modules

## Key API Endpoints
- Auth: `POST /api/auth/login`, `POST /api/auth/logout`, `PUT /api/auth/change-password`
- Users: `GET/POST/PUT/DELETE /api/users`, `PUT /api/users/{id}/reset-password`
- Members: `GET/POST/PUT/DELETE /api/members`
- Member Access: `POST/PUT/DELETE /api/members/{id}/access`
- Fine Types: `GET/POST/PUT/DELETE /api/fine-types`
- Fines: `GET/POST/PUT/DELETE /api/fines`
- Events: `GET/POST/PUT/DELETE /api/events`
- Event RSVP: `POST /api/events/{id}/respond`
- Event Fine Toggle: `PUT /api/events/{id}/fine-toggle`
- Statistics: `GET /api/statistics`, `GET /api/statistics/personal`
- Profile: `GET/PUT /api/profile`, `POST /api/profile/avatar`
- Settings: `GET/PUT /api/settings/ics`, `POST /api/settings/ics/sync`
- Health: `GET /health`

## Changelog
- 2026-04-02: Fixed ReferenceError in Members.js
- 2026-04-02: Removed standalone Statistics page, merged into StatisticsAdvanced
- 2026-04-02: Created dedicated Benutzerrollen page (/roles)
- 2026-04-02: Dashboard redesigned: Personal + Vereinsübersicht (Top 5)
- 2026-04-02: Created Profile page with avatar upload (Object Storage)
- 2026-04-02: Added automatic DB backup Docker service (sau-index_backup)
- 2026-04-02: Repository cleanup (removed obsolete files)
- 2026-04-03: Complete documentation overhaul (README.md, DOCKER_DEPLOYMENT.md, HTTPS_SETUP.md, TRAEFIK_SETUP.md)

## Credentials
- Admin: `admin` / `admin123`
