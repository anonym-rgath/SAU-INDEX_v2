# PRD — SAU-INDEX Vereinsverwaltung

## Problem Statement
Full-stack application for a club to manage and rank members based on fines. JWT-based auth with 4 roles (admin, spiess, vorstand, mitglied). Full CRUD for members, fines, events. Role-dependent charts, permissions, rankings. Docker deployment on Raspberry Pi 4 with Cloudflare Tunnels.

## Tech Stack
- **Frontend**: React, Tailwind CSS, Shadcn/UI, Context API
- **Backend**: Python, FastAPI, Pydantic
- **Database**: MongoDB (4.4.18)
- **Deployment**: Docker, Raspberry Pi 4, Cloudflare Tunnels

## Architecture
```
/app/
├── backend/server.py          # Monolith — all API routes
├── frontend/src/
│   ├── components/
│   │   ├── Layout.js          # Main layout with sidebar + topbar
│   │   ├── DesktopSidebar.js  # NEW: Persistent sidebar for lg+ screens
│   │   ├── TopBar.js          # Header with mobile drawer + notification bell
│   │   ├── NotificationBell.js # NEW: Bell icon + dropdown panel
│   │   ├── QRCodeDialog.js    # QR code display with avatar
│   │   └── QRScanDialog.js    # QR scanner with avatar display
│   ├── contexts/
│   │   ├── AuthContext.js
│   │   ├── BrandingContext.js
│   │   └── ThemeContext.js
│   └── pages/
│       ├── Dashboard.js       # 2-column desktop layout
│       ├── Members.js         # Table with QR toggle
│       ├── Fines.js           # Desktop table headers
│       ├── Calendar.js        # 2-col event grid on desktop
│       ├── StatisticsAdvanced.js
│       ├── ClubSettings.js    # 2-col settings grid
│       ├── Roles.js           # 3-col grid on desktop
│       ├── Profile.js
│       ├── Settings.js
│       ├── FineTypes.js
│       ├── AuditLogs.js
│       └── Login.js
└── docker-compose.yml
```

## Completed Features
- JWT Auth with 4 roles (admin, spiess, vorstand, mitglied)
- Full CRUD: Members, Fines, FineTypes, Events
- Dynamic branding (BrandingContext — club name + logo)
- Vorstand fine permissions (Spieß/Vorstand only, created_by tracking)
- Members table layout with sortable headers
- QR-Code toggle per member (has_qr_code field)
- QR scanner with member avatar display
- Calendar with RSVP and ICS sync
- Audit logging
- Profile management with avatar upload
- Fiscal year management
- **Notification system** (auto-notification on fine creation, bell icon with badge, read/unread, per-user isolation)
- **Desktop-optimized responsive layout** (persistent sidebar, 2-column grids, wider containers, table headers)

## Notification System (NEW)
- Backend: `notifications` collection, auto-created on fine creation
- Endpoints: GET /api/notifications, GET /api/notifications/unread-count, PUT /api/notifications/{id}/read, PUT /api/notifications/read-all
- Frontend: NotificationBell with polling (30s), dropdown panel, mark as read
- Architecture supports future types: fine, system, contribution, approval

## Desktop Layout (NEW)
- DesktopSidebar: persistent left nav on lg+ (1024px+), hidden on mobile
- TopBar: menu button hidden on desktop, drawer for mobile
- Dashboard: 2-column grid (personal + admin)
- Fines: table-style headers on desktop
- Calendar: 2-col event grid on desktop
- ClubSettings: 2-col section grid
- Roles: 3-col grid (roles + matrix)
- All pages: wider containers (max-w-4xl/5xl/6xl on lg+)

## Backlog
- P1: Backend refactoring — split server.py monolith into modular routers
- P2: Data export (CSV/PDF) for rankings/fines
- P2: Default logo placeholder
- P3: Finanzdaten in Dashboard with real backend values
