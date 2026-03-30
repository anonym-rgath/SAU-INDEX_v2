# Rheinzelmänner Verwaltung

Ein modernes Verwaltungssystem für die Rheinzelmänner zur Erfassung und Verwaltung von Strafen und Mitglieder-Rankings.

---

## 1. Überblick

Die Rheinzelmänner Verwaltung ist eine Full-Stack-Webanwendung zur Verwaltung von Vereinsmitgliedern und deren Strafen. Das System ermöglicht:

- Erfassung und Verwaltung von Mitgliedern mit Status (Aktiv/Passiv/Archiviert)
- Definition eigener Strafenarten mit festen oder variablen Beträgen
- Zuweisung von Strafen an Mitglieder (auch rückwirkend)
- Automatische Ranking-Berechnung nach Geschäftsjahr
- QR-Code-basierte Mitglieder-Identifikation
- Rollenbasierte Zugriffskontrolle für Admin, Spieß und Vorstand

---

## 2. Systemanforderungen

| Komponente | Minimum | Empfohlen |
|------------|---------|-----------|
| Hardware | Raspberry Pi 4 (2GB) | Raspberry Pi 4 (4GB) oder Pi 5 |
| Betriebssystem | Raspberry Pi OS 64-bit | Raspberry Pi OS Bookworm 64-bit |
| Speicher | 16GB SD-Karte | 32GB SD-Karte |
| Docker | 20.10+ | Aktuellste Version |
| Netzwerk | LAN oder WLAN | LAN (stabiler) |

> **Hinweis:** Raspberry Pi 3 und ältere 32-bit Modelle werden **nicht unterstützt** (MongoDB benötigt 64-bit ARMv8).

---

## 3. Architektur & Technologie-Stack

### Architektur

```
                    +------------------+
                    |     Browser      |
                    +--------+---------+
                             |
                    Port 80 (HTTP)
                             |
              +--------------v--------------+
              |   Traefik Reverse Proxy     |
              |   Routet nach Domain/Host   |
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

### Frontend
| Technologie | Verwendung |
|-------------|------------|
| React 19 | UI Framework |
| Tailwind CSS | Utility-First CSS |
| Shadcn/UI | UI Component Library |
| Recharts | Diagramme & Charts |
| html5-qrcode | QR-Code Scanner |
| qrcode.react | QR-Code Generator |
| Lucide React | Icon Library |

### Deployment
| Technologie | Verwendung |
|-------------|------------|
| Docker | Containerisierung |
| Docker Compose | Multi-Container Orchestrierung |
| Traefik | Zentraler Reverse Proxy (Multi-App fähig) |
| Nginx | Interner SPA-Server + API-Proxy |
| Cloudflare Tunnels | Externer Zugriff (HTTPS) |

> **Zwei Betriebsmodi verfügbar:**
> - `docker-compose.yml` – Traefik-Modus (mehrere Apps parallel)
> - `docker-compose.standalone.yml` – Standalone (einzelne App, direkt Port 80/443)
> 
> Siehe [TRAEFIK_SETUP.md](TRAEFIK_SETUP.md) für die Multi-App Anleitung.

---

## 4. Sicherheitskonzept

### Authentifizierung
- **JWT-Token** basierte Session-Verwaltung
- Token-Gültigkeit: 8 Stunden
- Idle-Timeout: 15 Minuten Inaktivität
- Absolutes Timeout: 8 Stunden
- Logout-Endpoint zum Beenden der Sitzung

### Passwort-Sicherheit
- **bcrypt** Hashing mit 12 Runden
- Mindestlänge: 8 Zeichen
- Mindestens 1 Großbuchstabe, 1 Kleinbuchstabe, 1 Zahl
- Passwort-Änderung für alle Benutzer möglich
- Admin kann Passwörter zurücksetzen

### Brute-Force-Schutz
- Max. 5 Login-Versuche pro Benutzer/IP
- Sperrzeit: 15 Minuten nach Überschreitung
- Rate Limiting auf Login-Endpoint

### HTTPS
- Cloudflare Origin Certificate für sau-index.de
- Cloudflare Tunnel leitet Anfragen an den lokalen Nginx (HTTP, Port 80)
- TLS 1.2/1.3 mit sicheren Cipher Suites
- Nginx Security Headers: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, HSTS

### Audit-Logging
- Alle relevanten Aktionen werden protokolliert
- Gespeicherte Daten: Benutzer, Aktion, IP-Adresse, Zeitstempel, Details
- Nur Admin kann Audit-Logs einsehen

---

## 5. Rollen & Berechtigungen

| Funktion | Admin | Spieß | Vorstand | Mitglied |
|----------|:-----:|:-----:|:--------:|:--------:|
| **Dashboard** | Vollzugriff | CRUD + eigene Strafen* | - | Nur eigene Strafen |
| **Mitglieder** | Vollzugriff | CRUD | CRUD | - |
| **Statistiken** | Vollzugriff | CRUD | Nur Lesen (anonymisiert) | - |
| **Strafenübersicht** | Vollzugriff | CRUD | - | Nur eigene (Lesen) |
| **Strafenarten** | Vollzugriff | CRUD | CRUD | - |
| **Benutzerverwaltung** | Vollzugriff | - | - | - |
| **Audit-Log** | Vollzugriff | - | - | - |

**Legende:** CRUD = Erstellen, Lesen, Aktualisieren, Löschen

### Besonderheiten
- **Spieß** kann optional einem Mitglied zugeordnet werden und sieht dann zusätzlich "Meine Strafen" im Dashboard (*)
- **Vorstand** kann optional einem Mitglied zugeordnet werden und sieht dann nur eigene Strafen im Dashboard
- **Mitglied** sieht nur eigene Strafen im Dashboard und in der Strafenübersicht
- **Vorstand** sieht Statistiken ohne Mitgliedernamen (anonymisiert)
- **Vorstand** hat keinen Zugriff auf Dashboard und Strafenübersicht
- Nur **Admin** kann neue Benutzer anlegen und Passwörter zurücksetzen
- Der letzte Admin-Benutzer kann nicht gelöscht werden

---

## 6. Funktionsübersicht

### Dashboard
- Ranking aller Mitglieder nach Strafensumme
- KPI-Anzeige: "Sau" (höchster Betrag) und "Lämmchen" (niedrigster Betrag)
- Geschäftsjahr-Auswahl
- QR-Code Scanner zur schnellen Strafen-Erfassung
- Letzte Strafen-Einträge

### Mitgliederverwaltung
- Mitglieder erstellen mit Vor- und Nachname (Pflichtfelder)
- Status: Aktiv / Passiv / Archiviert
- Archivierte Mitglieder erscheinen nicht in Rankings
- QR-Code für jedes Mitglied (Download als PNG)
- Sortierung nach Name, Status oder Erstellungsdatum

### Strafenarten
- Eigene Strafenarten definieren (z.B. "Zu spät", "Fehltermin")
- Feste Beträge oder variable Eingabe ("Sonstiges")

### Strafen-Management
- Strafen für Mitglieder erfassen
- Rückwirkende Erfassung mit Datumsauswahl (nur auf Strafenübersicht-Seite)
- Automatische Zuordnung zum korrekten Geschäftsjahr
- Optionales Notizfeld
- Bearbeiten und Löschen von Strafen

### Statistiken
- Gesamtsumme, Anzahl Strafen, Durchschnitt pro Strafe
- Balkendiagramm: Top 10 Mitglieder
- Kreisdiagramm: Strafen nach Art
- Liniendiagramm: Monatlicher Verlauf über das Geschäftsjahr
- Ranking: Aktive und passive Mitglieder getrennt (Top 5)
- Filterung nach Geschäftsjahr

### Benutzerverwaltung (nur Admin)
- Neue Benutzer anlegen (Benutzername, Passwort, Rolle)
- Spieß und Vorstand können optional einem Mitglied zugeordnet werden
- Mitglied muss immer einem Mitglied zugeordnet werden
- Benutzer bearbeiten (Rolle, Mitglied-Verknüpfung ändern)
- Benutzer löschen
- Passwörter zurücksetzen

### Audit-Log (nur Admin)
- Übersicht aller System-Aktivitäten
- Filterung nach Aktionstyp
- Suche nach Benutzer, IP oder Details

---

## 7. API-Übersicht

### Authentifizierung
| Methode | Endpoint | Beschreibung |
|---------|----------|--------------|
| POST | `/api/auth/login` | Login (Rate Limited) |
| POST | `/api/auth/logout` | Logout (Audit-Log) |
| PUT | `/api/auth/change-password` | Passwort ändern |

### Benutzerverwaltung (Admin)
| Methode | Endpoint | Beschreibung |
|---------|----------|--------------|
| GET | `/api/users` | Alle Benutzer |
| POST | `/api/users` | Benutzer erstellen |
| PUT | `/api/users/{id}` | Benutzer bearbeiten |
| DELETE | `/api/users/{id}` | Benutzer löschen |
| PUT | `/api/users/{id}/reset-password` | Passwort zurücksetzen |

### Mitglieder
| Methode | Endpoint | Beschreibung |
|---------|----------|--------------|
| GET | `/api/members` | Alle Mitglieder |
| POST | `/api/members` | Neues Mitglied |
| PUT | `/api/members/{id}` | Mitglied aktualisieren |
| DELETE | `/api/members/{id}` | Mitglied löschen |

### Strafenarten
| Methode | Endpoint | Beschreibung |
|---------|----------|--------------|
| GET | `/api/fine-types` | Alle Strafenarten |
| POST | `/api/fine-types` | Neue Strafenart |
| PUT | `/api/fine-types/{id}` | Strafenart aktualisieren |
| DELETE | `/api/fine-types/{id}` | Strafenart löschen |

### Strafen
| Methode | Endpoint | Beschreibung |
|---------|----------|--------------|
| GET | `/api/fines` | Strafen abrufen |
| POST | `/api/fines` | Neue Strafe (optionales `date` für rückwirkend) |
| PUT | `/api/fines/{id}` | Strafe aktualisieren |
| DELETE | `/api/fines/{id}` | Strafe löschen |

### Statistiken & System
| Methode | Endpoint | Beschreibung |
|---------|----------|--------------|
| GET | `/api/statistics?fiscal_year={year}` | Statistiken (MongoDB Aggregation) |
| GET | `/api/statistics/personal?fiscal_year={year}` | Persönliche Statistik |
| GET | `/api/fiscal-years` | Verfügbare Geschäftsjahre |
| GET | `/api/audit-logs` | Audit-Logs (nur Admin) |
| GET | `/health` | Health Check |

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

---

## 9. Projektstruktur

```
rheinzelmaenner/
├── backend/
│   ├── Dockerfile              # Backend Docker Image
│   ├── requirements.txt        # Python Dependencies (Entwicklung)
│   ├── requirements.prod.txt   # Python Dependencies (Produktion)
│   └── server.py               # FastAPI Application
├── frontend/
│   ├── Dockerfile              # Frontend Docker Image
│   ├── nginx.conf              # Nginx Konfiguration (HTTP)
│   ├── nginx.ssl.conf          # Nginx Konfiguration (HTTPS/Standalone)
│   ├── nginx.traefik.conf      # Nginx Konfiguration (Traefik-Modus)
│   ├── package.json            # Node.js Dependencies
│   ├── public/
│   │   └── logo.png            # App Logo
│   └── src/
│       ├── components/         # React Komponenten
│       │   ├── ui/             # Shadcn/UI Komponenten
│       │   ├── AddFineDialog.js
│       │   ├── EditFineDialog.js
│       │   ├── ChangePasswordDialog.js
│       │   ├── QRCodeDialog.js
│       │   ├── QRScanDialog.js
│       │   ├── TopBar.js
│       │   └── Layout.js
│       ├── contexts/
│       │   └── AuthContext.js  # Authentifizierung Context (inkl. Idle/Absolute Timeout)
│       ├── lib/
│       │   ├── api.js          # API Client
│       │   └── utils.js        # Hilfsfunktionen (Währung, Datum)
│       └── pages/
│           ├── Login.js
│           ├── Dashboard.js
│           ├── Members.js
│           ├── Statistics.js
│           ├── Fines.js
│           ├── FineTypes.js
│           ├── UserManagement.js
│           └── AuditLogs.js
├── traefik/                     # Traefik Reverse Proxy
│   ├── docker-compose.yml       # Traefik Container
│   └── traefik.yml              # Traefik Konfiguration
├── certs/                       # SSL Zertifikate (gitignored)
├── docker-compose.yml           # Docker Compose (Traefik-Modus)
├── docker-compose.standalone.yml # Docker Compose (Standalone, Port 80/443)
├── start.sh                     # Start-Script
├── stop.sh                      # Stop-Script
├── logs.sh                      # Log-Viewer Script
├── setup-https.sh               # SSL-Zertifikat erneuern
├── .env.example                 # Beispiel-Konfiguration
├── README.md                    # Diese Datei
├── DOCKER_DEPLOYMENT.md         # Deployment Anleitung
├── HTTPS_SETUP.md               # HTTPS Setup Anleitung
└── TRAEFIK_SETUP.md             # Traefik Multi-App Anleitung
```

---

## 10. Design

### Farbschema
| Verwendung | Farbe | Hex |
|------------|-------|-----|
| Primärfarbe | Grün | `#3E875F` / `emerald-700` |
| Hintergrund | Hellgrau | `#FAFAF9` / `stone-50` |
| Text | Dunkelgrau | `#1C1917` / `stone-900` |
| Akzent (Fehler) | Rot | `#DC2626` / `red-600` |

### UI-Prinzipien
- **Mobile-First**: Optimiert für Smartphone-Nutzung
- **Drawer-Navigation**: Slide-out Menü für mobile Geräte
- **Touch-freundlich**: Große Buttons (min. 44px Touch-Target)
- **Responsive**: Anpassung für Tablet und Desktop

### Komponenten
- Buttons: Abgerundet (`rounded-full`), mit Hover- und Active-States
- Cards: Weiß mit subtilen Schatten (`shadow-sm`)
- Inputs: Große Eingabefelder (`h-12`) mit fokussierten Ring-Effekten
- Status-Badges: Farbcodiert (Grün=Aktiv, Grau=Passiv/Archiviert)
