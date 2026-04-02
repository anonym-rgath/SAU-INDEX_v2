# Rheinzelmänner - Docker Deployment Guide

Detaillierte Anleitung zur Installation und Betrieb auf einem Raspberry Pi 4.

---

## Systemvoraussetzungen

| Komponente | Anforderung |
|------------|-------------|
| Hardware | Raspberry Pi 4 (2GB+) oder Raspberry Pi 5 |
| Betriebssystem | Raspberry Pi OS 64-bit (Bookworm empfohlen) |
| System-Speicher | Min. 16GB SD-Karte |
| Backup-Speicher | SSD an USB 3.0 (empfohlen), gemountet auf `/mnt/backups` |
| Netzwerk | LAN oder WLAN |

> **Wichtig:** Raspberry Pi 3 und ältere 32-bit Modelle werden **nicht unterstützt** (MongoDB benötigt ARMv8.2-A, Pi 4 hat ARMv8.0 — funktioniert nur mit MongoDB 4.4.18).

---

## Services-Übersicht

Die Anwendung besteht aus **4 Docker-Containern** (+ optionalem Traefik):

| Service | Container | Image | Funktion |
|---------|-----------|-------|----------|
| MongoDB | `rheinzel-mongodb` | `mongo:4.4.18` | Datenbank |
| Backend | `rheinzel-backend` | Python 3.11 (Custom Build) | FastAPI API-Server |
| Frontend | `rheinzel-frontend` | Node 20 + Nginx (Custom Build) | React SPA + Reverse Proxy |
| Backup | `sau-index_backup` | Mongo 4.4 + Cron (Custom Build) | Automatische DB-Sicherungen |
| Traefik | `traefik` | `traefik:v3.3` | Reverse Proxy (optional) |

---

## Installation

### 1. Docker installieren

```bash
# Docker installieren
curl -fsSL https://get.docker.com | sh

# Benutzer zur Docker-Gruppe hinzufügen
sudo usermod -aG docker $USER

# WICHTIG: Abmelden und neu anmelden!
exit
```

Nach dem erneuten Einloggen:

```bash
# Docker Compose Plugin installieren
sudo apt-get update
sudo apt-get install -y docker-compose-plugin

# Installation prüfen
docker --version
docker compose version
```

### 2. SSD einrichten (für Backups)

```bash
# SSD identifizieren
lsblk

# Partition mounten (z.B. /dev/sda2)
sudo mkdir -p /mnt/backups
sudo mount /dev/sda2 /mnt/backups

# Permanenten Mount in fstab eintragen
echo '/dev/sda2 /mnt/backups ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab

# Backup-Verzeichnis erstellen
sudo mkdir -p /mnt/backups/mongodb
sudo chown -R $USER:$USER /mnt/backups/mongodb
```

### 3. Projekt herunterladen

**Option A — Git Clone:**
```bash
cd ~
git clone https://github.com/DEIN_USERNAME/rheinzelmaenner.git
cd rheinzelmaenner
```

**Option B — ZIP-Datei:**
```bash
# Auf dem PC: ZIP auf Pi kopieren
scp rheinzelmaenner.zip pi@RASPBERRY_IP:/home/pi/

# Auf dem Pi: Entpacken
cd ~
unzip rheinzelmaenner.zip
cd rheinzelmaenner
```

### 4. Konfiguration

Die `.env` Datei wird beim ersten Start automatisch erstellt. Du kannst sie vorher anpassen:

```bash
cp .env.example .env
nano .env
```

Inhalt:
```env
# JWT Secret - UNBEDINGT ÄNDERN!
# Generieren mit: openssl rand -hex 32
JWT_SECRET=ihr-geheimer-schluessel-hier

# Admin Passwort beim ersten Start
ADMIN_PASSWORD=admin123
```

### 5. Traefik-Netzwerk erstellen

```bash
docker network create traefik-network
```

> Nur nötig im Traefik-Modus (`docker-compose.yml`). Für Standalone entfällt dieser Schritt.

### 6. App starten

```bash
# Scripts ausführbar machen
chmod +x start.sh stop.sh logs.sh

# App starten (Traefik-Modus)
docker compose up -d --build
```

**Erster Start dauert 5-10 Minuten** (Docker Images werden gebaut).

> **Standalone-Modus** (ohne Traefik, direkt auf Port 80/443):
> ```bash
> docker compose -f docker-compose.standalone.yml up -d --build
> ```

---

## Zugriff

| Modus | URL |
|-------|-----|
| Extern (Cloudflare Tunnel) | `https://rhnzl.sau-index.de` |
| Lokal (LAN) | `http://<PI-IP>` (über Traefik auf Port 80) |

**Login-Daten:**
- Benutzer: `admin`
- Passwort: `admin123` (oder wie in `.env` konfiguriert)

---

## Befehle

| Befehl | Beschreibung |
|--------|--------------|
| `docker compose up -d --build` | App starten/aktualisieren |
| `docker compose down` | App stoppen |
| `docker compose ps` | Status aller Container |
| `docker compose logs -f` | Live-Logs aller Services |
| `docker compose logs backend` | Nur Backend-Logs |
| `docker compose restart backend` | Backend neustarten |
| `docker compose down -v` | Alles löschen **inkl. Datenbank** |

---

## Automatische Backups

### Funktionsweise

Der `sau-index_backup` Container führt per Cron automatisch `mongodump` aus und speichert komprimierte Backups (`.gz`) auf die SSD.

### Zeitplan

| Typ | Cron-Ausdruck | Zeitpunkt | Aufbewahrung |
|-----|---------------|-----------|-------------|
| Täglich | `0 2 * * *` | Jeden Tag, 02:00 Uhr | 7 Tage |
| Wöchentlich | `0 6 * * 0` | Sonntag, 06:00 Uhr | 28 Tage |
| Monatlich | `0 23 28-31 * *` | Letzter Tag, 23:00 Uhr | 180 Tage |

### Speicherstruktur

```
/mnt/backups/mongodb/
├── daily/
│   ├── backup_2026-02-15_02-00.gz
│   ├── backup_2026-02-14_02-00.gz
│   └── ...
├── weekly/
│   └── backup_2026-02-09_06-00.gz
└── monthly/
    └── backup_2026-01-31_23-00.gz
```

### Backup-Logs prüfen

```bash
docker logs sau-index_backup --tail 50
```

### Manuelles Backup

```bash
docker exec sau-index_backup /usr/local/bin/backup.sh daily
```

### Datenbank wiederherstellen

```bash
# Aus täglichem Backup
docker exec -i rheinzel-mongodb mongorestore \
  --archive --gzip --drop \
  < /mnt/backups/mongodb/daily/backup_2026-02-15_02-00.gz
```

> **`--drop`** löscht bestehende Collections vor dem Restore. Ohne diesen Parameter werden Daten zusammengeführt.

---

## Cloudflare Tunnel

Der externe Zugriff läuft über einen Cloudflare Tunnel (`cloudflared`), der separat konfiguriert wird.

### Einrichtung

1. Im **Cloudflare Dashboard** (Zero Trust → Networks → Tunnels) einen Tunnel erstellen
2. `cloudflared` auf dem Pi installieren und mit Token starten:
   ```bash
   docker run -d --name cloudflared --restart unless-stopped \
     cloudflare/cloudflared:latest tunnel --no-autoupdate run \
     --token <DEIN-TUNNEL-TOKEN>
   ```
3. Public Hostname konfigurieren:

   | Public Hostname | Service |
   |----------------|---------|
   | `rhnzl.sau-index.de` | `http://localhost:80` |

> **Wichtig:** Der Tunnel verbindet sich per HTTP zum lokalen Traefik. Cloudflare übernimmt die TLS-Terminierung. **Kein** HTTP→HTTPS-Redirect in Nginx konfigurieren — das verursacht eine Endlos-Umleitung.

---

## Autostart beim Booten

```bash
sudo nano /etc/systemd/system/rheinzelmaenner.service
```

Inhalt:
```ini
[Unit]
Description=Rheinzelmaenner Verwaltung
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/pi/rheinzelmaenner
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=pi

[Install]
WantedBy=multi-user.target
```

Aktivieren:
```bash
sudo systemctl daemon-reload
sudo systemctl enable rheinzelmaenner.service
```

---

## Updates

```bash
# Code aktualisieren
cd ~/rheinzelmaenner
git pull

# Neu bauen und starten
docker compose down
docker compose build --no-cache
docker compose up -d
```

> **Tipp bei wenig Speicher:** Alte Docker-Images und Caches vorher aufräumen:
> ```bash
> docker system prune -a --volumes
> ```

---

## Troubleshooting

### Container starten nicht

```bash
# Alle Logs prüfen
docker compose logs

# Speziell MongoDB
docker compose logs mongodb

# Speziell Backend
docker compose logs backend
```

### MongoDB-Fehler: "requires ARMv8.2-A"

Falsche MongoDB-Version. In `docker-compose.yml` muss stehen:
```yaml
mongodb:
  image: mongo:4.4.18
```

### Kein Speicher auf SD-Karte

```bash
# Speicher prüfen
df -h

# Docker aufräumen
docker system prune -a --volumes

# Swap erhöhen falls nötig
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile  # CONF_SWAPSIZE=2048
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

### Login funktioniert nicht

```bash
# Backend-Logs prüfen
docker compose logs backend | grep -i error

# Bei Brute-Force-Sperre: Locks in DB löschen
docker exec rheinzel-mongodb mongo rheinzelmaenner \
  --eval "db.login_attempts.deleteMany({}); db.account_lockouts.deleteMany({})"
```

### Backup-Container läuft nicht

```bash
# Status prüfen
docker compose ps backup

# Logs prüfen
docker logs sau-index_backup --tail 20

# SSD gemountet?
mount | grep /mnt/backups
```

### Port 80 belegt

```bash
# Prüfen was Port 80 nutzt
sudo lsof -i :80

# Apache deaktivieren (falls installiert)
sudo systemctl stop apache2
sudo systemctl disable apache2
```

---

## Technische Details

| Service | Base Image | Interner Port |
|---------|-----------|---------------|
| Frontend | node:20-alpine → nginx:alpine | 80 |
| Backend | python:3.11-slim | 8001 |
| MongoDB | mongo:4.4.18 | 27017 |
| Backup | mongo:4.4.18 + cron | — |

### Warum MongoDB 4.4.18?

Der Raspberry Pi 4 verwendet einen ARM Cortex-A72 Prozessor (ARMv8.0-A). MongoDB 5.0+ benötigt ARMv8.2-A Features, die der Pi 4 nicht hat. MongoDB 4.4.18 ist die letzte kompatible Version.

### Environment-Variablen

| Variable | Standard | Beschreibung |
|----------|----------|-------------|
| `JWT_SECRET` | Auto-generiert | JWT-Signatur-Schlüssel |
| `ADMIN_PASSWORD` | `admin123` | Initiales Admin-Passwort |
| `MONGO_URL` | `mongodb://mongodb:27017` | MongoDB Connection String |
| `DB_NAME` | `rheinzelmaenner` | Datenbank-Name |
| `CORS_ORIGINS` | `*` | Erlaubte Origins |
| `MONGO_HOST` | `mongodb` | Backup: MongoDB Host |
| `MONGO_PORT` | `27017` | Backup: MongoDB Port |
