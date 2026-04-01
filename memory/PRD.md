# Rheinzelmänner - Product Requirements Document

## Original Problem Statement
Entwicklung einer Full-Stack-Webanwendung für einen "Schützenzug" (Rheinzelmänner), um Mitglieder und deren Strafen zu verwalten und ein Ranking basierend auf Strafen zu erstellen.

## Tech Stack
- **Frontend**: React, Tailwind CSS, Shadcn/UI, lucide-react, recharts, html5-qrcode, qrcode.react
- **Backend**: Python FastAPI, slowapi, icalendar, httpx
- **Database**: MongoDB
- **Auth**: JWT + bcrypt (12 Runden), 8h Token-Expiry
- **Deployment**: Docker, Traefik, Cloudflare Tunnels, Raspberry Pi 4 (SSD)

## Login Credentials
- Admin: `admin` / `admin123`

---

## Completed Features

### 2026-04-01 (ICS-Kalender-Synchronisation)
- [x] **ICS Pull-Sync**: Externer Outlook-Kalender per ICS-URL abonniert
- [x] **Admin ICS-Einstellungen**: URL konfigurieren, Sync aktivieren/deaktivieren
- [x] **Tägliche Auto-Sync**: Hintergrund-Task synchronisiert einmal täglich
- [x] **Manueller Sync-Button**: Sofortige Synchronisation per Klick
- [x] **ICS-Badge**: Importierte Termine werden mit "ICS" Badge markiert
- [x] **Straf-Toggle**: Admin/Spieß/Vorstand können pro Termin Straflogik aktivieren
- [x] **Lösch-Sync**: Gelöschte externe Termine werden automatisch entfernt
- [x] **37 Termine** aus Outlook-Kalender importiert
- [x] lodash-Fix: Version 4.17.21 gepinnt (assignWith-Bug)

### 2026-03-31 (Kalender-Feature)
- [x] Kalender-/Terminverwaltung mit CRUD
- [x] Listen- und Kalenderansicht (umschaltbar)
- [x] Zu-/Absagefunktion (1 Monat vorher bis 24h vorher)
- [x] Automatische Straflogik (keine Rückmeldung / verspätete Absage)
- [x] Rückmeldungs-Übersicht für Admin/Spieß/Vorstand

### 2026-03-30 (Performance + Traefik)
- [x] MongoDB Aggregation Pipelines, 13+ DB-Indexes
- [x] React.lazy Code Splitting, useMemo
- [x] Traefik Reverse Proxy (Multi-App fähig)
- [x] Dateibereinigung (9 Dateien gelöscht)

### Vorherige Sessions
- [x] JWT-Auth mit 4 Rollen, Brute-Force-Schutz
- [x] CRUD: Mitglieder, Strafen, Strafenarten
- [x] Mobile-First UI, Drawer-Navigation
- [x] Geschäftsjahr-Logik, Statistiken mit recharts
- [x] QR-Code Scanner/Generator, Audit Logging
- [x] Docker Deployment, SSL, Cloudflare Tunnel, Security Hardening

---

## Backlog

### P2
- [ ] Automatisches Datenbank-Backup (wöchentliches MongoDB-Backup via Cron nach /mnt/backups)
- [ ] Daten-Export (CSV/PDF)

### P3
- [ ] Backend-Refactoring: server.py in FastAPI Router Module aufteilen
- [ ] Frontend-Refactoring

---

## Key API Endpoints (ICS)
- `GET /api/settings/ics` - ICS-Einstellungen (nur Admin)
- `PUT /api/settings/ics` - ICS-URL/Sync konfigurieren (nur Admin)
- `POST /api/settings/ics/sync` - Manuelle Synchronisation (nur Admin)
- `PUT /api/events/{id}/fine-toggle` - Straflogik umschalten

## Key Files
- `/app/backend/server.py` - Backend (ICS-Sync ab Zeile ~1570)
- `/app/frontend/src/pages/Calendar.js` - Kalender mit ICS-Integration
- `/app/frontend/src/components/ICSSettingsDialog.js` - ICS-Einstellungen
- `/app/frontend/src/components/EventDetailDialog.js` - Termin-Details + Straf-Toggle
