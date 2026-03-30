# Rheinzelmänner - Product Requirements Document

## Original Problem Statement
Entwicklung einer Full-Stack-Webanwendung für einen "Schützenzug" (später umbenannt zu "Rheinzelmänner"), um Mitglieder und deren Strafen zu verwalten und ein Ranking basierend auf Strafen zu erstellen.

## User Personas
- **Admin**: Vollzugriff auf alle Funktionen (CRUD für Mitglieder, Strafen, Strafarten, Benutzerverwaltung, Audit-Log)
- **Spiess**: Vollzugriff wie Admin, außer Benutzerverwaltung und Audit-Log
- **Vorstand**: Eingeschränkter Zugriff (Mitglieder CRUD, Statistiken anonymisiert, Strafenarten CRUD)
- **Mitglied**: Nur eigene Daten (Dashboard mit eigenen Strafen, Strafenübersicht nur eigene)

## Core Requirements
- Benutzerverwaltung mit Rollen (admin/spiess/vorstand/mitglied)
- Mitgliederverwaltung (Vorname, Nachname, Status aktiv/passiv/archiviert)
- Strafenverwaltung mit konfigurierbaren Strafarten
- Rückwirkende Strafenerfassung (nur auf Strafenübersicht-Seite)
- Ranking basierend auf Geschäftsjahr (01.08. - 31.07.)
- Mobile-First Design mit Drawer-Navigation
- Statistik-Seite mit Diagrammen und KPIs
- QR-Code System zur Mitglieder-Identifikation
- Persönliches Dashboard für Mitglieder (nur eigene Strafen/Rang)

## Tech Stack
- **Frontend**: React, Tailwind CSS, Shadcn/UI, lucide-react, recharts, html5-qrcode, qrcode.react
- **Backend**: Python FastAPI, slowapi (Rate Limiting)
- **Database**: MongoDB
- **Auth**: JWT mit bcrypt Passwort-Hashing
- **Security**: Rate Limiting (5 Login-Versuche/Minute), Audit Logging, Brute-Force-Schutz
- **Deployment**: Docker, Docker Compose, Nginx (Reverse Proxy), Cloudflare Tunnels

## Login Credentials
- Admin: `admin` / `admin123`

---

## Completed Features

### 2026-03-30 (Performance-Optimierung)
- [x] **MongoDB Aggregation Pipelines**: Statistics und Personal Statistics verwenden jetzt $match/$group/$sort Pipelines statt alle Daten in Python zu laden
- [x] **MongoDB Indexes**: Performance-Indizes für users (username, id, member_id), members (id, status), fines (fiscal_year+member_id, member_id, date, id), fine_types (id), audit_logs (timestamp, action)
- [x] **React.lazy Code Splitting**: Alle Seiten werden lazy geladen (Dashboard, Members, FineTypes, Fines, Statistics, UserManagement, AuditLogs)
- [x] **useMemo Optimierung**: Statistics.js verwendet useMemo für fineTypeStats, monthlyStats, activeMembersRanking, passiveMembersRanking, avgFine
- [x] **Debounced Idle Timer**: AuthContext verwendet 2s Debounce für Activity Tracking (statt bei jedem Event)
- [x] **Bug-Fix**: Fine-Type Update Query hatte Leerzeichen im Key (' id' statt 'id') - behoben
- [x] **Bare except fix**: Spezifische Exception-Types (ValueError, TypeError) statt bare except
- [x] **Dateien bereinigt**: Gelöscht: backend_test.py, update_users.py, scripts/, dump/, tests/__init__.py, test_result.md, yarn.lock (root), App.css

### 2025-02-18
- [x] **Spieß mit Mitglied-Verknüpfung**
- [x] **Rolle "Mitglied" implementiert**
- [x] **README.md überarbeitet**
- [x] **Security Audit & Hardening**: Strikte Passwort-Policy (min 8 Zeichen, 1 Großbuchstabe, 1 Kleinbuchstabe, 1 Zahl), JWT-Expiry auf 8h reduziert, CORS eingeschränkt, Nginx Security Headers, Logout-Endpoint

### 2025-02-17
- [x] **Mobile-First UI Review**
- [x] **HTTPS erzwungen** (Self-Signed SSL)

### 2025-12-14
- [x] **Docker Deployment für Raspberry Pi**
- [x] **Health-Check Endpoint**

### Previous Sessions
- [x] Vollständige Full-Stack-Anwendung
- [x] JWT-Authentifizierung mit 4 Rollen
- [x] CRUD für Mitglieder, Strafen, Strafarten
- [x] Mobile-First Redesign mit Drawer-Navigation
- [x] Geschäftsjahr-Logik (01.08. - 31.07.)
- [x] Statistik-Seite mit recharts Diagrammen
- [x] Benutzerverwaltung (Admin)
- [x] Passwort-Änderung & Reset
- [x] Rückwirkende Strafenerfassung
- [x] QR-Code Scanner & Generator
- [x] Mitglieder-Archivierungssystem
- [x] Audit Logging
- [x] SSL & Cloudflare Tunnel Setup

---

## Backlog

### P2 - Anstehende Aufgaben
- [ ] **Automatisches Datenbank-Backup** - Wöchentliches MongoDB-Backup via Cron-Job im Docker
- [ ] **Daten-Export** (CSV/PDF) - Ranking-/Strafendaten exportieren

### P3 - Zukünftige Verbesserungen
- [ ] **Backend-Refactoring**: `server.py` in FastAPI Router Module aufteilen
- [ ] **Frontend-Refactoring**: Große Komponenten aufteilen (Dashboard.js, Members.js)
- [ ] Offline-Unterstützung / PWA

---

## Key Files
- `/app/backend/server.py` - Backend API (Monolith)
- `/app/frontend/src/App.js` - React Router mit Code Splitting
- `/app/frontend/src/pages/Dashboard.js` - Dashboard
- `/app/frontend/src/pages/Statistics.js` - Statistiken mit useMemo
- `/app/frontend/src/contexts/AuthContext.js` - Auth mit Debounced Timer

## API Endpoints
- `POST /api/auth/login` - Anmeldung (Rate Limited)
- `POST /api/auth/logout` - Abmeldung
- `PUT /api/auth/change-password` - Passwort ändern
- `GET /api/users` - Benutzer (nur Admin)
- `POST /api/users` - Benutzer erstellen (nur Admin)
- `DELETE /api/users/{id}` - Benutzer löschen (nur Admin)
- `PUT /api/users/{id}/reset-password` - Passwort zurücksetzen (nur Admin)
- `GET /api/members` - Mitglieder
- `POST /api/members` - Mitglied erstellen
- `PUT /api/members/{id}` - Mitglied bearbeiten
- `DELETE /api/members/{id}` - Mitglied löschen (nur archivierte)
- `GET /api/fine-types` - Strafarten
- `POST /api/fine-types` - Strafart erstellen
- `PUT /api/fine-types/{id}` - Strafart bearbeiten
- `DELETE /api/fine-types/{id}` - Strafart löschen
- `GET /api/fines` - Strafen (gefiltert nach Rolle)
- `POST /api/fines` - Strafe erstellen
- `PUT /api/fines/{id}` - Strafe bearbeiten
- `DELETE /api/fines/{id}` - Strafe löschen
- `GET /api/statistics?fiscal_year=YYYY/YYYY` - Statistiken (Aggregation Pipeline)
- `GET /api/statistics/personal?fiscal_year=YYYY/YYYY` - Persönliche Statistik
- `GET /api/fiscal-years` - Geschäftsjahre
- `GET /api/audit-logs` - Audit-Logs (nur Admin)
