# Rheinzelmänner - Docker Deployment Guide

Detaillierte Anleitung zur Installation auf einem Raspberry Pi 4.

---

## Systemvoraussetzungen

| Komponente | Anforderung |
|------------|-------------|
| Hardware | Raspberry Pi 4 (2GB+) oder Raspberry Pi 5 |
| Betriebssystem | Raspberry Pi OS 64-bit (Bookworm empfohlen) |
| Speicher | Min. 16GB SD-Karte |
| Netzwerk | LAN oder WLAN |

> **Wichtig:** Raspberry Pi 3 und ältere 32-bit Modelle werden **nicht unterstützt** (MongoDB benötigt ARMv8.2-A, Pi 4 hat ARMv8.0 - funktioniert nur mit MongoDB 4.4.18).

---

## Architektur

```
                    +------------------+
                    |     Browser      |
                    +--------+---------+
                             |
                    Port 443 (HTTPS)
                    Port 80 -> 301 Redirect
                             |
              +--------------v--------------+
              |   Frontend Container        |
              |   (React + Nginx + SSL)     |
              |   - Statische Dateien       |
              |   - /api/* -> Backend       |
              |   - HTTP -> HTTPS Redirect  |
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

> **HTTPS:** Die App verwendet standardmäßig HTTPS mit selbstsignierten Zertifikaten. HTTP-Anfragen werden automatisch auf HTTPS weitergeleitet.

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

### 2. Projekt herunterladen

**Option A - Git Clone:**
```bash
cd ~
git clone https://github.com/DEIN_USERNAME/rheinzelmaenner.git
cd rheinzelmaenner
```

**Option B - ZIP-Datei:**
```bash
# Auf dem PC: ZIP auf Pi kopieren
scp rheinzelmaenner.zip pi@RASPBERRY_IP:/home/pi/

# Auf dem Pi: Entpacken
cd ~
unzip rheinzelmaenner.zip
cd rheinzelmaenner
```

### 3. Konfiguration (optional)

Die `.env` Datei wird beim ersten Start automatisch erstellt. Sie können sie vorher anpassen:

```bash
cp .env.example .env
nano .env
```

Inhalt:
```env
# Port (Standard: 80)
APP_PORT=80

# JWT Secret - UNBEDINGT ÄNDERN!
# Generieren mit: openssl rand -hex 32
JWT_SECRET=ihr-geheimer-schluessel-hier

# Admin Passwort beim ersten Start
ADMIN_PASSWORD=admin123
```

### 4. App starten

```bash
# Scripts ausführbar machen
chmod +x start.sh stop.sh logs.sh

# App starten
./start.sh
```

**Erster Start dauert 5-10 Minuten** (Docker Images werden gebaut).

---

## Zugriff

Nach erfolgreichem Start:

1. **IP-Adresse ermitteln:**
   ```bash
   hostname -I
   ```

2. **Browser öffnen:**
   ```
   http://192.168.x.x
   ```

3. **Anmelden:**
   - Benutzer: `admin`
   - Passwort: `admin123` (oder wie in `.env` konfiguriert)

---

## Befehle

| Befehl | Beschreibung |
|--------|--------------|
| `./start.sh` | App starten (baut bei Bedarf) |
| `./stop.sh` | App stoppen |
| `./logs.sh` | Logs aller Services anzeigen |
| `docker compose ps` | Status aller Container |
| `docker compose restart backend` | Backend neustarten |
| `docker compose logs backend` | Nur Backend-Logs |
| `docker compose down -v` | Alles löschen inkl. Datenbank |

---

## Troubleshooting

### Container starten nicht

```bash
# Logs prüfen
docker compose logs

# Speziell MongoDB
docker compose logs mongodb

# Speziell Backend
docker compose logs backend
```

### MongoDB-Fehler: "requires ARMv8.2-A"

Sie verwenden eine falsche MongoDB-Version. Stellen Sie sicher, dass in `docker-compose.yml` steht:
```yaml
mongodb:
  image: mongo:4.4.18
```

### Port 80 belegt

```bash
# Prüfen was Port 80 nutzt
sudo lsof -i :80

# Apache deaktivieren (falls installiert)
sudo systemctl stop apache2
sudo systemctl disable apache2

# Oder anderen Port nutzen in .env:
APP_PORT=8080
```

### Login funktioniert nicht

1. Prüfen Sie die Backend-Logs:
   ```bash
   docker compose logs backend | grep -i error
   ```

2. Admin-Benutzer wird beim Start automatisch erstellt. Falls Probleme:
   ```bash
   # Datenbank zurücksetzen
   docker compose down -v
   ./start.sh
   ```

### Zu wenig Speicher

```bash
# Speicher prüfen
free -h

# Swap erhöhen
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# CONF_SWAPSIZE=2048 setzen
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

### Container neustarten sich ständig

```bash
# Ressourcen prüfen
docker stats

# Einzelnen Container-Log prüfen
docker logs rheinzel-backend --tail 100
```

---

## Autostart beim Booten

```bash
# Systemd Service erstellen
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

## Backup

### Datenbank sichern

```bash
# Backup erstellen
docker exec rheinzel-mongodb mongodump --out /data/backup

# Auf Host kopieren
docker cp rheinzel-mongodb:/data/backup ./backup_$(date +%Y%m%d)
```

### Datenbank wiederherstellen

```bash
# Backup in Container kopieren
docker cp ./backup_20241215 rheinzel-mongodb:/data/backup

# Wiederherstellen
docker exec rheinzel-mongodb mongorestore /data/backup
```

---

## Updates

```bash
# Bei Git Clone
git pull

# Neu bauen und starten
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## Sicherheitshinweise

1. **JWT_SECRET ändern** - Nutzen Sie einen zufälligen 32+ Zeichen String
2. **Admin-Passwort ändern** - Nach dem ersten Login
3. **Firewall** - App ist nur im lokalen Netzwerk erreichbar
4. **Updates** - Regelmäßig `git pull` und neu deployen

---

## Technische Details

| Service | Image | Port (intern) |
|---------|-------|---------------|
| Frontend | node:20-alpine + nginx:alpine | 80 |
| Backend | python:3.11-slim | 8001 |
| MongoDB | mongo:4.4.18 | 27017 |

### Warum MongoDB 4.4.18?

Der Raspberry Pi 4 verwendet einen ARM Cortex-A72 Prozessor (ARMv8.0-A). MongoDB 5.0+ benötigt ARMv8.2-A Features, die der Pi 4 nicht hat. MongoDB 4.4.18 ist die letzte kompatible Version.

### Dateien

| Datei | Beschreibung |
|-------|--------------|
| `docker-compose.yml` | Service-Definitionen |
| `backend/Dockerfile` | Backend Image |
| `backend/requirements.prod.txt` | Python Dependencies |
| `backend/server.py` | API Server |
| `frontend/Dockerfile` | Frontend Image |
| `frontend/nginx.conf` | Nginx Reverse Proxy |
| `start.sh` | Start-Script |
| `stop.sh` | Stop-Script |
| `logs.sh` | Log-Viewer |
