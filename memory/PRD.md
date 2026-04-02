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
- Docker-based deployment on Raspberry Pi 4 with Traefik reverse proxy

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn/UI, Recharts
- Backend: Python, FastAPI, Pydantic, icalendar
- Database: MongoDB (4.4.18)
- Deployment: Docker, Raspberry Pi 4 (ARM64), Traefik, Cloudflare Tunnels

## Architecture
```
/app/
├── backend/
│   ├── server.py              // Monolith (~2000 lines)
│   └── tests/
├── docker-compose.yml         // Traefik-ready
├── frontend/
│   ├── nginx.traefik.conf
│   └── src/
│       ├── components/        // TopBar.js, EventDialog.js, EventDetailDialog.js
│       ├── contexts/          // AuthContext.js (permissions), ThemeContext.js (dark mode)
│       ├── pages/             // Members.js, Calendar.js, Dashboard.js, Settings.js, Statistics.js, StatisticsAdvanced.js
│       └── lib/api.js
├── traefik/
└── README.md
```

## Role-Based Access Control (RBAC)

| Feature | Admin | Spieß | Vorstand | Mitglied |
|---|---|---|---|---|
| Dashboard | Full | Full | Full | Personal |
| Termine | + Fine info | + Fine info | + Fine info | No fine info |
| Strafenübersicht | All fines | All fines | Own fines | Own fines |
| Statistiken | Personal | Personal | Personal | Personal |
| Statistiken (Erweitert) | Full | Full | Anonymized | No access |
| Benutzerverwaltung | Yes | Yes | Yes | No |
| Strafenarten | Yes | Yes | Yes | No |
| Audit-Log | Yes | No | No | No |
| Einstellungen (ICS) | Yes | No | No | No |
| Einstellungen (other) | Yes | Yes | Yes | Yes |
| Benutzerrollen (view) | Yes | Yes | Yes | Yes |

## Completed Features
- [x] JWT Auth with 4 roles
- [x] Unified Member + User management with app-access toggle
- [x] Auto-disable access on member archival
- [x] Fine Types CRUD + Event fine type dropdown
- [x] Fiscal year-based ranking and statistics
- [x] Calendar/Event CRUD with RSVP
- [x] ICS Calendar daily pull-sync
- [x] Security hardening
- [x] Traefik reverse proxy + SSD migration
- [x] Dark Mode (Settings, TopBar, Dashboard, Fines, Members, Statistics)
- [x] Sidebar: Administration group with collapsible items
- [x] Role-based view restrictions (2026-04-01):
  - Mitglied: no fine info on events, own fines/stats only, no ICS settings
  - Vorstand: personal stats + anonymized advanced stats, own fines
  - Spieß: personal stats + full advanced stats, all fines
- [x] Statistiken (Erweitert) page with charts
- [x] Settings page with Benutzerrollen section

## Backlog
### P2 - Upcoming
- [ ] Automatic Database Backup (weekly `mongodump`)
- [ ] Data Export (CSV/PDF)
- [ ] Dark Mode: extend to Calendar event cards, FineTypes, AuditLogs pages

### P2 - Refactoring
- [ ] Backend: Split `server.py` into APIRouter modules

## Key API Endpoints
- Auth: `POST /api/auth/login`, `POST /api/auth/logout`
- Members: `GET/POST/PUT/DELETE /api/members`
- Member Access: `POST/PUT/DELETE /api/members/{id}/access`
- Fine Types: `GET/POST/PUT/DELETE /api/fine-types`
- Fines: `GET/POST/PUT/DELETE /api/fines` (filtered by role)
- Events: `GET/POST/PUT/DELETE /api/events`
- Event Fine Toggle: `PUT /api/events/{id}/fine-toggle`
- Statistics: `GET /api/statistics` (admin/spiess/vorstand only)
- Personal Stats: `GET /api/statistics/personal` (all roles)
- Settings: `GET/PUT /api/settings/ics` (admin only)

## Changelog
- 2026-04-02: Fixed ReferenceError in Members.js - `isVorstand` was not destructured from `useAuth()`, causing Benutzerverwaltung page crash for all roles.
- 2026-04-02: Removed standalone Statistics page (`/statistics`, admin-only). Merged into single "Statistiken (Erweitert)" menu entry pointing to `/statistics-advanced`.
- 2026-04-02: Created dedicated Benutzerrollen page (`/roles`) with role descriptions and permissions matrix. Removed from Settings page. Accessible for Admin/Spieß/Vorstand.

## Credentials
- Admin: `admin` / `admin123`
- Vorstand (Test): `robin` / `Vorstand123!`
