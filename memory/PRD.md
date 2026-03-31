# Rheinzelmänner - Product Requirements Document

## Original Problem Statement
Entwicklung einer Full-Stack-Webanwendung für einen "Schützenzug" (Rheinzelmänner), um Mitglieder und deren Strafen zu verwalten und ein Ranking basierend auf Strafen zu erstellen.

## User Personas
- **Admin**: Vollzugriff auf alle Funktionen
- **Spiess**: Wie Admin, ohne Benutzerverwaltung/Audit-Log
- **Vorstand**: Eingeschränkt (Mitglieder CRUD, Statistiken anonymisiert, Strafenarten, Termine)
- **Mitglied**: Nur eigene Daten + Termine mit Zu-/Absage

## Tech Stack
- **Frontend**: React, Tailwind CSS, Shadcn/UI, lucide-react, recharts, html5-qrcode, qrcode.react
- **Backend**: Python FastAPI, slowapi
- **Database**: MongoDB
- **Auth**: JWT + bcrypt (12 Runden), 8h Token-Expiry
- **Deployment**: Docker, Traefik, Cloudflare Tunnels, Raspberry Pi 4

## Login Credentials
- Admin: `admin` / `admin123`

---

## Completed Features

### 2026-03-31 (Kalender-Feature)
- [x] **Kalender-/Terminverwaltung**: CRUD für Termine (Admin/Spieß/Vorstand)
- [x] **Listenansicht**: Chronologische Liste mit anstehenden + vergangenen Terminen
- [x] **Kalenderansicht**: Monats-Grid mit Terminen pro Tag
- [x] **Zu-/Absagefunktion**: RSVP pro Termin, frühestens 1 Monat vorher, bis 24h vorher
- [x] **Erweiterte Übersicht**: Admin/Spieß/Vorstand sehen alle Rückmeldungen + fehlende
- [x] **Automatische Straflogik**: Keine Rückmeldung oder verspätete Absage → automatische Strafe
- [x] **Eigene Strafart pro Termin**: Auto-erstellte FineType mit Event-Referenz
- [x] **Event Detail Dialog**: Vollständige Details, RSVP-Buttons, Rückmeldungsübersicht
- [x] **DB-Indexes**: events (id, date, fines_processed), event_responses (event_id+member_id)

### 2026-03-30 (Performance-Optimierung)
- [x] MongoDB Aggregation Pipelines für Statistiken
- [x] 13 DB-Indexes für alle Collections
- [x] React.lazy Code Splitting (7 Seiten)
- [x] useMemo in Statistics.js
- [x] Debounced Idle Timer
- [x] Dateien bereinigt (9 gelöscht)
- [x] Bug-Fix: Fine-Type Update Query

### 2026-03-30 (Traefik Setup)
- [x] Traefik Reverse Proxy Konfiguration
- [x] docker-compose.yml Traefik-ready
- [x] docker-compose.standalone.yml als Backup
- [x] nginx.traefik.conf
- [x] TRAEFIK_SETUP.md Anleitung
- [x] README.md vollständig aktualisiert

### Vorherige Sessions
- [x] JWT-Auth mit 4 Rollen, Brute-Force-Schutz
- [x] CRUD: Mitglieder, Strafen, Strafenarten
- [x] Mobile-First UI, Drawer-Navigation
- [x] Geschäftsjahr-Logik (01.08-31.07)
- [x] Statistiken mit recharts
- [x] QR-Code Scanner/Generator
- [x] Mitglieder-Archivierung
- [x] Audit Logging
- [x] SSL & Cloudflare Tunnel
- [x] Docker Deployment für Raspberry Pi
- [x] Security Audit & Hardening

---

## Backlog

### P2 - Anstehende Aufgaben
- [ ] Automatisches Datenbank-Backup (wöchentliches MongoDB-Backup via Cron)
- [ ] Daten-Export (CSV/PDF)

### P3 - Zukünftige Verbesserungen
- [ ] Backend-Refactoring: `server.py` in FastAPI Router Module aufteilen
- [ ] Frontend-Refactoring: Große Komponenten aufteilen

---

## Key Files
- `/app/backend/server.py` - Backend API (Monolith)
- `/app/frontend/src/pages/Calendar.js` - Kalender-Seite
- `/app/frontend/src/components/EventDialog.js` - Termin erstellen/bearbeiten
- `/app/frontend/src/components/EventDetailDialog.js` - Termin-Details + RSVP
- `/app/frontend/src/App.js` - React Router
- `/app/frontend/src/components/TopBar.js` - Navigation

## API Endpoints (Kalender)
- `POST /api/events` - Termin erstellen
- `GET /api/events` - Alle Termine laden (+ Auto-Strafenprüfung)
- `PUT /api/events/{id}` - Termin bearbeiten
- `DELETE /api/events/{id}` - Termin löschen (+ Strafart + Antworten)
- `POST /api/events/{id}/respond` - Zu-/Absage
- `POST /api/events/check-fines` - Manuelle Strafenprüfung
