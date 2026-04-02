# Rheinzelmänner Verwaltung

Ein modernes Verwaltungssystem für die Rheinzelmänner zur Erfassung und Verwaltung von Strafen, Mitglieder-Rankings, Terminen und Vereinsstatistiken.

---

## 1. Überblick

Die Rheinzelmänner Verwaltung ist eine Full-Stack-Webanwendung zur Verwaltung von Vereinsmitgliedern und deren Strafen. Das System ermöglicht:

- Erfassung und Verwaltung von Mitgliedern mit Status (Aktiv/Passiv/Archiviert)
- Definition eigener Strafenarten mit festen oder variablen Beträgen
- Zuweisung von Strafen an Mitglieder (auch rückwirkend)
- Automatische Ranking-Berechnung nach Geschäftsjahr
- Kalender mit Termin-Verwaltung, RSVP und automatischer Strafenvergabe
- ICS-Kalender-Synchronisation aus externer Quelle
- QR-Code-basierte Mitglieder-Identifikation
- Persönliches Profil mit Avatar-Upload
- Rollenbasierte Zugriffskontrolle (Admin, Spieß, Vorstand, Mitglied)
- Automatische Datenbank-Backups auf SSD
- Dark Mode

---

## 2. Systemanforderungen

| Komponente | Minimum | Empfohlen |
|------------|---------|-----------|
| Hardware | Raspberry Pi 4 (2GB) | Raspberry Pi 4 (4GB) oder Pi 5 |
| Betriebssystem | Raspberry Pi OS 64-bit | Raspberry Pi OS Bookworm 64-bit |
| Speicher | 16GB SD-Karte | 32GB SD-Karte + SSD für Backups |
| Docker | 20.10+ | Aktuellste Version |
| Netzwerk | LAN oder WLAN | LAN (stabiler) |

> **Hinweis:** Raspberry Pi 3 und ältere 32-bit Modelle werden **nicht unterstützt** (MongoDB benötigt 64-bit ARMv8).

---

## 3. Architektur & Technologie-Stack

### Architektur (Traefik-Modus)

```
                    +------------------+
                    |     Browser      |
                    +--------+---------+
                             |
                   HTTPS (Cloudflare Tunnel)
                             |
              +--------------v--------------+
              |   Traefik Reverse Proxy     |
              |   Port 80 — Routet nach     |
              |   Domain/Host-Header        |
              +--------------+--------------+
                             |
                   traefik-network
                             |
              +--------------v--------------+
              |   Frontend Container        |
              |   (React + Nginx)           |
              |   - Statische Dateien       |
              |   - /api/* -> Backend       |
              +--------------+--------------+
                             |
                      intern Port 8001
                             |
              +--------------v--------------+
              |   Backend Container         |
              |   (FastAPI + Python 3.11)   |
              +--------------+--------------+
                             |
                      intern Port 27017
                             |
              +--------------v--------------+
              |   MongoDB 4.4.18            |
              |   (Datenbank)               |
              +--------------+--------------+
                             |
              +--------------v--------------+
              |   Backup Container          |
              |   (Cron + mongodump)        |
              |   -> SSD /mnt/backups/      |
              +-----------------------------+
```

### Backend

| Technologie | Verwendung |
|-------------|------------|
| FastAPI | Python Web Framework |
| MongoDB 4.4.18 | NoSQL Datenbank (ARM-kompatibel) |
| Motor | Async MongoDB Driver |
| PyJWT | Token-basierte Authentifizierung |
| bcrypt | Passwort-Hashing (12 Runden) |
| slowapi | Rate Limiting |
| icalendar | ICS-Kalender-Parsing |
| httpx | Async HTTP Client (ICS-Fetch) |
| Emergent Object Storage | Profilbild-Speicherung |

### Frontend

| Technologie | Verwendung |
|-------------|------------|
| React 19 | UI Framework |
| Tailwind CSS | Utility-First CSS (inkl. Dark Mode) |
| Shadcn/UI | UI Component Library |
| Recharts | Diagramme & Charts |
| html5-qrcode | QR-Code Scanner |
| qrcode.react | QR-Code Generator |
| Lucide React | Icon Library |
| Sonner | Toast-Benachrichtigungen |

### Deployment

| Technologie | Verwendung |
|-------------|------------|
| Docker | Containerisierung |
| Docker Compose | Multi-Container Orchestrierung |
| Traefik v3.3 | Zentraler Reverse Proxy (Multi-App fähig) |
| Nginx | Interner SPA-Server + API-Proxy |
| Cloudflare Tunnels | Externer HTTPS-Zugriff |
| Cron + mongodump | Automatische Datenbank-Backups |

> **Zwei Betriebsmodi verfügbar:**
> - `docker-compose.yml` – **Traefik-Modus** (Standard, mehrere Apps parallel)
> - `docker-compose.standalone.yml` – Standalone (einzelne App, direkt Port 80/443)
>
> Siehe [TRAEFIK_SETUP.md](TRAEFIK_SETUP.md) für die Multi-App Anleitung.

---

## 4. Sicherheitskonzept

### Authentifizierung
- **JWT-Token** basierte Session-Verwaltung
- Token-Gültigkeit: **8 Stunden** (absolutes Timeout)
- Idle-Timeout: **15 Minuten** Inaktivität
- Logout-Endpoint zum Beenden der Sitzung mit Audit-Log

### Passwort-Sicherheit
- **bcrypt** Hashing mit 12 Runden
- Mindestlänge: 8 Zeichen
- Mindestens 1 Großbuchstabe, 1 Kleinbuchstabe, 1 Zahl
- Passwort-Änderung für alle Benutzer möglich
- Admin kann Passwörter zurücksetzen

### Brute-Force-Schutz
- Max. **5 Login-Versuche** pro Benutzer/IP innerhalb von 30 Minuten
- Sperrzeit: **15 Minuten** nach Überschreitung
- Rate Limiting auf Login-Endpoint (10/Minute)
- Automatische TTL-Indizes für Login-Versuche (1h) und Sperren

### HTTPS & Netzwerk
- Cloudflare Tunnel leitet Anfragen an Traefik (HTTP, Port 80)
- Cloudflare übernimmt TLS-Terminierung
- CORS beschränkt auf `https://rhnzl.sau-index.de`
- Nginx Security Headers:
  - `X-Frame-Options: SAMEORIGIN`
  - `X-Content-Type-Options: nosniff`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### Audit-Logging
- Alle relevanten Aktionen werden protokolliert
- Gespeicherte Daten: Benutzer, Aktion, IP-Adresse, Zeitstempel, Details
- Einsehbar für Admin, Spieß und Vorstand
- Aktionstypen: Login/Logout, CRUD-Operationen, Passwort-Änderungen, Profiländerungen

---

## 5. Rollen & Berechtigungen

Das System kennt vier Rollen mit abgestuften Berechtigungen:

| Funktion | Admin | Spieß | Vorstand | Mitglied |
|----------|:-----:|:-----:|:--------:|:--------:|
| **Dashboard (Persönlich)** | Ja* | Ja* | Ja* | Ja |
| **Dashboard (Vereinsübersicht)** | Ja | Ja | - | - |
| **Termine (Kalender)** | CRUD + Strafen | CRUD + Strafen | CRUD + Strafen | Nur Lesen (ohne Strafinfo) |
| **Strafenübersicht** | Alle Strafen | Alle Strafen | Nur eigene | Nur eigene |
| **Statistiken (Erweitert)** | Vollzugriff | Vollzugriff | Anonymisiert | - |
| **Mitgliederverwaltung** | CRUD | CRUD | CRUD | - |
| **Strafenarten** | CRUD | CRUD | CRUD | - |
| **Benutzerverwaltung** | Vollzugriff | - | - | - |
| **Audit-Log** | Ja | Ja | Ja | - |
| **Benutzerrollen** | Ja | Ja | Ja | - |
| **Profil** | Ja | Ja | Ja | Ja |
| **Einstellungen (ICS)** | Ja | Ja | Ja | - |
| **Einstellungen (Dark Mode)** | Ja | Ja | Ja | Ja |

**Legende:** CRUD = Erstellen, Lesen, Aktualisieren, Löschen

### Besonderheiten

- **Spieß** kann optional einem Mitglied zugeordnet werden → sieht dann "Meine Strafen" und persönliche Statistiken im Dashboard (*)
- **Vorstand** kann optional einem Mitglied zugeordnet werden → sieht nur eigene Strafen; Statistiken werden anonymisiert
- **Mitglied** muss immer einem Mitglied zugeordnet sein → sieht nur eigene Strafen und persönliche Statistiken
- **Admin** hat Vollzugriff auf alle Funktionen
- Nur **Admin** kann neue Benutzer anlegen und Passwörter zurücksetzen
- Der letzte Admin-Benutzer kann nicht gelöscht werden
- Bei Archivierung eines Mitglieds wird der App-Zugang automatisch deaktiviert

---

## 6. Funktionsübersicht

### Dashboard
Zweiteilig aufgebaut:

**Persönlicher Bereich** (alle Rollen mit verknüpftem Mitglied):
- Eigene Strafen im aktuellen Geschäftsjahr
- Strafen nach Art (Kreisdiagramm)
- Monatlicher Verlauf (Liniendiagramm)

**Vereinsübersicht** (nur Admin und Spieß):
- "Sau" (höchster Betrag) und "Lämmchen" (niedrigster Betrag)
- Ranking Top 5 der aktiven Mitglieder
- Geschäftsjahr-Auswahl

### Mitgliederverwaltung
- Mitglieder erstellen mit Vor- und Nachname (Pflichtfelder)
- Status: Aktiv / Passiv / Archiviert
- Archivierte Mitglieder erscheinen nicht in Rankings
- Nur archivierte Mitglieder können gelöscht werden
- QR-Code für jedes Mitglied (Download als PNG)
- Integrierter App-Zugang (Benutzer erstellen/bearbeiten/löschen direkt am Mitglied)

### Profil
- Persönliche Daten einsehen und bearbeiten (Vorname, Nachname, Geburtstag)
- Avatar-Upload (JPG, PNG, WebP; max. 5 MB) via Object Storage
- Initialen-Avatar als Fallback
- Passwort ändern

### Kalender / Termine
- Termine erstellen, bearbeiten, löschen (Admin, Spieß, Vorstand)
- RSVP-System: Zu-/Absage für Mitglieder (1 Monat bis 24h vor Termin)
- Automatische Strafenvergabe bei fehlender/verspäteter Rückmeldung
- Straflogik pro Termin aktivierbar/deaktivierbar (mit Strafenart-Verknüpfung)
- Übersicht der Rückmeldungen (zugesagt/abgesagt/keine Antwort)
- ICS-Kalender-Synchronisation aus externer Quelle (täglicher Auto-Sync)
- Manuelle ICS-Synchronisation auslösbar

### Strafenarten
- Eigene Strafenarten definieren (z.B. "Zu spät", "Fehltermin")
- Feste Beträge oder variable Eingabe ("Sonstiges")

### Strafen-Management
- Strafen für Mitglieder erfassen (Admin, Spieß)
- Rückwirkende Erfassung mit Datumsauswahl
- Automatische Zuordnung zum korrekten Geschäftsjahr
- Optionales Notizfeld
- Bearbeiten und Löschen von Strafen
- Automatische Strafen durch Termin-System

### Statistiken (Erweitert)
- Gesamtsumme, Anzahl Strafen, Durchschnitt pro Strafe
- Balkendiagramm: Top 10 Mitglieder
- Kreisdiagramm: Strafen nach Art
- Liniendiagramm: Monatlicher Verlauf über das Geschäftsjahr
- Ranking: Aktive und passive Mitglieder (Top 5)
- Filterung nach Geschäftsjahr
- Vorstand sieht anonymisierte Mitgliedernamen

### Benutzerrollen
- Übersicht aller Rollen mit Beschreibungen
- Berechtigungsmatrix als Tabelle
- Zugänglich für Admin, Spieß und Vorstand

### Einstellungen
- ICS-Kalender URL konfigurieren und Sync aktivieren/deaktivieren
- Manuellen ICS-Sync auslösen
- Dark Mode umschalten (wird im Browser gespeichert)

### Audit-Log
- Übersicht aller System-Aktivitäten
- Filterung nach Aktionstyp
- Suche nach Benutzer, IP oder Details
- Zugänglich für Admin, Spieß und Vorstand

---

## 7. API-Übersicht

Alle Endpoints sind unter dem Präfix `/api` erreichbar.

### Authentifizierung

| Methode | Endpoint | Berechtigung | Beschreibung |
|---------|----------|--------------|--------------|
| POST | `/api/auth/login` | Öffentlich | Login (Rate Limited: 10/min) |
| POST | `/api/auth/logout` | Alle | Logout mit Audit-Log |
| PUT | `/api/auth/change-password` | Alle | Eigenes Passwort ändern |

### Benutzerverwaltung

| Methode | Endpoint | Berechtigung | Beschreibung |
|---------|----------|--------------|--------------|
| GET | `/api/users` | Admin | Alle Benutzer abrufen |
| POST | `/api/users` | Admin | Benutzer erstellen |
| PUT | `/api/users/{id}` | Admin | Benutzer bearbeiten |
| DELETE | `/api/users/{id}` | Admin | Benutzer löschen |
| PUT | `/api/users/{id}/reset-password` | Admin | Passwort zurücksetzen |

### Mitglieder

| Methode | Endpoint | Berechtigung | Beschreibung |
|---------|----------|--------------|--------------|
| GET | `/api/members` | Alle | Alle Mitglieder (inkl. User-Info) |
| POST | `/api/members` | Admin/Spieß/Vorstand | Neues Mitglied erstellen |
| PUT | `/api/members/{id}` | Admin/Spieß/Vorstand | Mitglied aktualisieren |
| DELETE | `/api/members/{id}` | Admin/Spieß/Vorstand | Mitglied löschen (nur archivierte) |
| POST | `/api/members/{id}/access` | Admin/Spieß/Vorstand | App-Zugang aktivieren |
| PUT | `/api/members/{id}/access` | Admin/Spieß/Vorstand | App-Zugang bearbeiten |
| DELETE | `/api/members/{id}/access` | Admin/Spieß/Vorstand | App-Zugang deaktivieren |

### Strafenarten

| Methode | Endpoint | Berechtigung | Beschreibung |
|---------|----------|--------------|--------------|
| GET | `/api/fine-types` | Alle | Alle Strafenarten |
| POST | `/api/fine-types` | Admin/Spieß/Vorstand | Neue Strafenart |
| PUT | `/api/fine-types/{id}` | Admin/Spieß/Vorstand | Strafenart aktualisieren |
| DELETE | `/api/fine-types/{id}` | Admin/Spieß/Vorstand | Strafenart löschen |

### Strafen

| Methode | Endpoint | Berechtigung | Beschreibung |
|---------|----------|--------------|--------------|
| GET | `/api/fines?fiscal_year=` | Alle* | Strafen abrufen (*Mitglied/Vorstand: nur eigene) |
| POST | `/api/fines` | Admin/Spieß | Neue Strafe (optionales `date`) |
| PUT | `/api/fines/{id}` | Admin/Spieß | Strafe aktualisieren |
| DELETE | `/api/fines/{id}` | Admin/Spieß | Strafe löschen |

### Termine / Kalender

| Methode | Endpoint | Berechtigung | Beschreibung |
|---------|----------|--------------|--------------|
| GET | `/api/events` | Alle | Alle Termine (löst Auto-Strafenprüfung aus) |
| GET | `/api/events/{id}` | Alle | Einzelnen Termin laden |
| POST | `/api/events` | Admin/Spieß/Vorstand | Termin erstellen |
| PUT | `/api/events/{id}` | Admin/Spieß/Vorstand | Termin aktualisieren |
| DELETE | `/api/events/{id}` | Admin/Spieß/Vorstand | Termin löschen |
| POST | `/api/events/{id}/respond` | Alle (mit Mitglied) | Zu-/Absage abgeben |
| PUT | `/api/events/{id}/fine-toggle` | Admin/Spieß/Vorstand | Straflogik an/aus |
| POST | `/api/events/check-fines` | Admin/Spieß | Manuelle Strafenprüfung |

### Statistiken & System

| Methode | Endpoint | Berechtigung | Beschreibung |
|---------|----------|--------------|--------------|
| GET | `/api/statistics?fiscal_year=` | Admin/Spieß/Vorstand | Vereinsstatistiken |
| GET | `/api/statistics/personal?fiscal_year=` | Alle | Persönliche Statistik |
| GET | `/api/fiscal-years` | Alle | Verfügbare Geschäftsjahre |
| GET | `/api/audit-logs?action=&limit=` | Admin/Spieß/Vorstand | Audit-Logs abrufen |

### Profil

| Methode | Endpoint | Berechtigung | Beschreibung |
|---------|----------|--------------|--------------|
| GET | `/api/profile` | Alle | Eigenes Profil abrufen |
| PUT | `/api/profile` | Alle | Profil aktualisieren (Name, Geburtstag) |
| POST | `/api/profile/avatar` | Alle | Avatar hochladen (JPG/PNG/WebP, max 5MB) |
| GET | `/api/profile/avatar/{path}` | Alle | Avatar-Bild abrufen |

### ICS-Einstellungen

| Methode | Endpoint | Berechtigung | Beschreibung |
|---------|----------|--------------|--------------|
| GET | `/api/settings/ics` | Admin/Spieß/Vorstand | ICS-Einstellungen abrufen |
| PUT | `/api/settings/ics` | Admin/Spieß/Vorstand | ICS-URL und Sync konfigurieren |
| POST | `/api/settings/ics/sync` | Admin | Manuelle ICS-Synchronisation |

### Health Check

| Methode | Endpoint | Beschreibung |
|---------|----------|--------------|
| GET | `/health` | Docker Health Check (Datenbank-Ping) |

---

## 8. Geschäftsjahr-Logik

Die Anwendung arbeitet mit Geschäftsjahren, die am **1. August** beginnen und am **31. Juli** enden:

| Geschäftsjahr | Zeitraum |
|---------------|----------|
| 2024/2025 | 01.08.2024 - 31.07.2025 |
| 2025/2026 | 01.08.2025 - 31.07.2026 |
| 2026/2027 | 01.08.2026 - 31.07.2027 |

### Automatische Zuordnung
- Neue Strafen werden automatisch dem aktuellen Geschäftsjahr zugeordnet
- Bei rückwirkender Erfassung wird das Geschäftsjahr anhand des Datums berechnet
- Rankings und Statistiken können nach Geschäftsjahr gefiltert werden
- Beispiel: 15.09.2025 → "2025/2026", 15.06.2026 → "2025/2026", 15.08.2026 → "2026/2027"

---

## 9. Datenbank-Schema

### Collections

| Collection | Beschreibung |
|-----------|--------------|
| `users` | Benutzer-Accounts mit Rollen |
| `members` | Vereinsmitglieder |
| `fines` | Strafen |
| `fine_types` | Strafenarten |
| `events` | Termine / Kalender |
| `event_responses` | RSVP-Antworten |
| `audit_logs` | Audit-Protokoll |
| `settings` | App-Einstellungen (ICS) |
| `login_attempts` | Login-Versuche (TTL: 1h) |
| `account_lockouts` | Account-Sperren (TTL: auto) |

### Schlüssel-Schemata

**users:**
```json
{
  "id": "uuid",
  "username": "string",
  "password_hash": "bcrypt-hash",
  "role": "admin|spiess|vorstand|mitglied",
  "member_id": "uuid|null",
  "created_at": "ISO-datetime"
}
```

**members:**
```json
{
  "id": "uuid",
  "firstName": "string",
  "lastName": "string",
  "status": "aktiv|passiv|archiviert",
  "birthday": "string|null",
  "avatar_path": "string|null",
  "archived_at": "ISO-datetime|null",
  "created_at": "ISO-datetime"
}
```

**fines:**
```json
{
  "id": "uuid",
  "member_id": "uuid",
  "fine_type_id": "uuid",
  "fine_type_label": "string",
  "amount": 5.0,
  "fiscal_year": "2025/2026",
  "date": "ISO-datetime",
  "notes": "string|null"
}
```

**events:**
```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "date": "ISO-datetime",
  "location": "string",
  "fine_amount": 5.0,
  "fine_type_id": "uuid|null",
  "fine_enabled": true,
  "created_by": "string",
  "created_at": "ISO-datetime",
  "fines_processed": false,
  "source": "manual|ics",
  "ics_uid": "string|null"
}
```

---

## 10. Automatische Backups

Das System enthält einen dedizierten Backup-Container (`sau-index_backup`), der automatische Datenbank-Sicherungen auf die angeschlossene SSD durchführt.

### Zeitplan

| Typ | Zeitpunkt | Aufbewahrung |
|-----|-----------|-------------|
| Täglich | 02:00 Uhr | 7 Tage |
| Wöchentlich | Sonntag, 06:00 Uhr | 28 Tage |
| Monatlich | Letzter Tag, 23:00 Uhr | 180 Tage |

### Speicherort

```
/mnt/backups/mongodb/
├── daily/
│   └── backup_2026-02-15_02-00.gz
├── weekly/
│   └── backup_2026-02-09_06-00.gz
└── monthly/
    └── backup_2026-01-31_23-00.gz
```

### Manuelle Wiederherstellung

```bash
# Backup wiederherstellen
docker exec -i rheinzel-mongodb mongorestore \
  --archive --gzip < /mnt/backups/mongodb/daily/backup_2026-02-15_02-00.gz
```

Siehe [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) für die vollständige Backup-Dokumentation.

---

## 11. Projektstruktur

```
rheinzelmaenner/
├── backend/
│   ├── Dockerfile              # Backend Docker Image (Python 3.11)
│   ├── requirements.txt        # Python Dependencies (Entwicklung)
│   ├── requirements.prod.txt   # Python Dependencies (Produktion/Pi)
│   └── server.py               # FastAPI Application (Monolith)
├── backup/
│   ├── Dockerfile              # Backup Container (Mongo 4.4 + cron)
│   ├── backup.sh               # mongodump + Rotation Script
│   └── crontab                 # Cron-Schedule (täglich/wöchentlich/monatlich)
├── frontend/
│   ├── Dockerfile              # Frontend Docker Image (Node 20 + Nginx)
│   ├── nginx.conf              # Nginx (HTTP, Standalone)
│   ├── nginx.ssl.conf          # Nginx (HTTPS, Standalone mit Zertifikaten)
│   ├── nginx.traefik.conf      # Nginx (Traefik-Modus, nur HTTP intern)
│   ├── package.json            # Node.js Dependencies
│   └── src/
│       ├── App.js              # React Router + Lazy Loading
│       ├── components/
│       │   ├── ui/             # Shadcn/UI Komponenten
│       │   ├── TopBar.js       # Navigation mit Avatar
│       │   ├── Layout.js       # App-Layout mit Sidebar
│       │   ├── AddFineDialog.js
│       │   ├── EditFineDialog.js
│       │   ├── ChangePasswordDialog.js
│       │   ├── EventDialog.js
│       │   ├── EventDetailDialog.js
│       │   ├── ICSSettingsDialog.js
│       │   ├── QRCodeDialog.js
│       │   └── QRScanDialog.js
│       ├── contexts/
│       │   ├── AuthContext.js   # Auth + RBAC Berechtigungen
│       │   └── ThemeContext.js  # Dark Mode
│       ├── lib/
│       │   ├── api.js           # Axios API Client
│       │   └── utils.js         # Hilfsfunktionen
│       └── pages/
│           ├── Login.js
│           ├── Dashboard.js     # Persönlich + Vereinsübersicht
│           ├── Profile.js       # Profil + Avatar Upload
│           ├── Members.js       # Mitglieder + App-Zugang
│           ├── Calendar.js      # Termine + RSVP
│           ├── Fines.js         # Strafenübersicht
│           ├── FineTypes.js     # Strafenarten
│           ├── StatisticsAdvanced.js  # Erweiterte Statistiken
│           ├── Roles.js         # Benutzerrollen-Matrix
│           ├── AuditLogs.js     # Audit-Protokoll
│           └── Settings.js      # ICS + Dark Mode
├── traefik/
│   ├── docker-compose.yml       # Traefik Container
│   └── traefik.yml              # Traefik Konfiguration
├── certs/                       # SSL Zertifikate (gitignored)
├── docker-compose.yml           # Docker Compose (Traefik-Modus)
├── docker-compose.standalone.yml # Docker Compose (Standalone)
├── start.sh                     # Start-Script
├── stop.sh                      # Stop-Script
├── logs.sh                      # Log-Viewer Script
├── setup-https.sh               # SSL-Zertifikat prüfen
├── README.md                    # Diese Datei
├── DOCKER_DEPLOYMENT.md         # Deployment Anleitung
├── HTTPS_SETUP.md               # HTTPS / Cloudflare Setup
└── TRAEFIK_SETUP.md             # Traefik Multi-App Anleitung
```

---

## 12. Design

### Farbschema

| Verwendung | Farbe | Hex |
|------------|-------|-----|
| Primärfarbe | Grün | `#3E875F` / `emerald-700` |
| Hintergrund (Light) | Hellgrau | `#FAFAF9` / `stone-50` |
| Hintergrund (Dark) | Dunkelgrau | `#0C0A09` / `stone-950` |
| Text (Light) | Dunkelgrau | `#1C1917` / `stone-900` |
| Text (Dark) | Hellgrau | `#FAFAF9` / `stone-50` |
| Akzent (Fehler) | Rot | `#DC2626` / `red-600` |

### UI-Prinzipien
- **Mobile-First**: Optimiert für Smartphone-Nutzung
- **Drawer-Navigation**: Slide-out Menü für mobile Geräte
- **Touch-freundlich**: Große Buttons (min. 44px Touch-Target)
- **Responsive**: Anpassung für Tablet und Desktop
- **Dark Mode**: Vollständig unterstützt über `ThemeContext` (Button in Einstellungen)

### Komponenten
- Buttons: Abgerundet (`rounded-full`), mit Hover- und Active-States
- Cards: Weiß/Dunkel mit subtilen Schatten (`shadow-sm`)
- Inputs: Große Eingabefelder (`h-12`) mit fokussierten Ring-Effekten
- Status-Badges: Farbcodiert (Grün=Aktiv, Grau=Passiv/Archiviert)
- Toast-Benachrichtigungen: Sonner (oben rechts)
- Lazy Loading: Alle Seiten werden bei Bedarf geladen

---

## 13. Schnellstart (Entwicklung)

```bash
# Projekt klonen
git clone <repo-url>
cd rheinzelmaenner

# Backend
cd backend
pip install -r requirements.txt
# .env mit MONGO_URL und DB_NAME anlegen
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend
cd frontend
yarn install
# .env mit REACT_APP_BACKEND_URL anlegen
yarn start
```

Für Deployment auf Raspberry Pi siehe [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md).
