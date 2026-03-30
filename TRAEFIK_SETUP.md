# Traefik Setup - Mehrere Apps auf dem Raspberry Pi

## Übersicht

Mit Traefik als zentralem Reverse Proxy können mehrere Webanwendungen parallel auf dem Raspberry Pi laufen. Jede App wird über ihre eigene Domain/Subdomain angesprochen.

```
Internet → Cloudflare → Tunnel → Traefik (Port 80) → rheinzel-frontend
                                                    → andere-app
                                                    → weitere-app
```

---

## Voraussetzungen

- Docker und Docker Compose installiert
- Cloudflare Tunnel eingerichtet (`cloudflared`)
- SSH-Zugang zum Raspberry Pi

---

## Schritt 1: Traefik-Netzwerk erstellen

Dieses Netzwerk verbindet Traefik mit allen Apps. **Nur einmal ausführen:**

```bash
docker network create traefik-network
```

---

## Schritt 2: Traefik starten

```bash
cd ~/traefik
docker compose up -d
```

### Dateien im `traefik/`-Ordner:

**`traefik/docker-compose.yml`** - Traefik Container:
```yaml
services:
  traefik:
    image: traefik:v3.3
    container_name: traefik
    restart: unless-stopped
    ports:
      - "80:80"       # HTTP
      - "8080:8080"   # Dashboard (lokal)
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik.yml:/etc/traefik/traefik.yml:ro
    networks:
      - traefik-network

networks:
  traefik-network:
    external: true
```

**`traefik/traefik.yml`** - Traefik Konfiguration:
```yaml
api:
  dashboard: true
  insecure: true

entryPoints:
  web:
    address: ":80"

providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    network: traefik-network

log:
  level: "INFO"
```

### Dashboard prüfen

Nach dem Start ist das Traefik-Dashboard lokal erreichbar:

```
http://<PI-IP>:8080
```

---

## Schritt 3: Rheinzelmänner App starten

```bash
cd ~/rheinzelmaenner
docker compose up -d --build
```

Die App ist jetzt über Traefik erreichbar. Die `docker-compose.yml` enthält die Traefik-Labels:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.rheinzel.rule=Host(`rhnzl.sau-index.de`)"
  - "traefik.http.routers.rheinzel.entrypoints=web"
  - "traefik.http.services.rheinzel.loadbalancer.server.port=80"
  - "traefik.docker.network=traefik-network"
```

---

## Schritt 4: Cloudflare Tunnel konfigurieren

Im **Cloudflare Dashboard** (Zero Trust → Networks → Tunnels):

| Public Hostname | Service |
|----------------|---------|
| `rhnzl.sau-index.de` | `http://localhost:80` |

Da Traefik jetzt auf Port 80 läuft, leitet der Tunnel alle Anfragen an Traefik weiter. Traefik entscheidet anhand des `Host`-Headers, welche App die Anfrage bekommt.

---

## Schritt 5: Weitere App hinzufügen (Beispiel)

### 5a. `docker-compose.yml` der neuen App

```yaml
services:
  meine-app:
    image: meine-app:latest
    container_name: meine-app
    restart: unless-stopped
    networks:
      - traefik-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.meine-app.rule=Host(`meine-app.sau-index.de`)"
      - "traefik.http.routers.meine-app.entrypoints=web"
      - "traefik.http.services.meine-app.loadbalancer.server.port=80"
      - "traefik.docker.network=traefik-network"

networks:
  traefik-network:
    external: true
```

### 5b. Cloudflare Tunnel erweitern

Im Cloudflare Dashboard einen neuen Public Hostname hinzufügen:

| Public Hostname | Service |
|----------------|---------|
| `rhnzl.sau-index.de` | `http://localhost:80` |
| `meine-app.sau-index.de` | `http://localhost:80` |

Beide Domains zeigen auf den gleichen Port 80 (Traefik). Traefik routet anhand der Domain automatisch zum richtigen Container.

### 5c. Starten

```bash
cd ~/meine-app
docker compose up -d
```

Fertig. Die neue App ist sofort über `meine-app.sau-index.de` erreichbar.

---

## Befehle-Übersicht

| Aktion | Befehl |
|--------|--------|
| Traefik-Netzwerk erstellen | `docker network create traefik-network` |
| Traefik starten | `cd ~/traefik && docker compose up -d` |
| Traefik stoppen | `cd ~/traefik && docker compose down` |
| Traefik Logs | `cd ~/traefik && docker compose logs -f` |
| App starten | `cd ~/rheinzelmaenner && docker compose up -d --build` |
| App stoppen | `cd ~/rheinzelmaenner && docker compose down` |
| Alle Container anzeigen | `docker ps` |
| Dashboard öffnen | `http://<PI-IP>:8080` |

---

## Zurück zum Standalone-Modus

Falls du Traefik nicht mehr verwenden möchtest und nur eine App betreibst:

```bash
# Traefik stoppen
cd ~/traefik && docker compose down

# App mit Standalone-Konfiguration starten (direkt auf Port 80/443)
cd ~/rheinzelmaenner
docker compose -f docker-compose.standalone.yml up -d --build
```

---

## Architektur-Vergleich

### Vorher (Standalone)
```
Browser → Port 80/443 → Nginx (Frontend) → Backend
```

### Jetzt (Traefik)
```
Browser → Port 80 → Traefik → Nginx (Frontend) → Backend
                            → Andere App
                            → Weitere App
```

---

## Fehlerbehebung

### Container nicht erreichbar
```bash
# Prüfe ob Container im traefik-network ist
docker network inspect traefik-network

# Prüfe Traefik Routen
curl -s http://localhost:8080/api/http/routers | python3 -m json.tool
```

### 404 bei Aufruf der Domain
- Prüfe ob der `Host()`-Wert in den Labels exakt mit der Domain übereinstimmt
- Prüfe ob der Container läuft: `docker ps`
- Prüfe Traefik Logs: `docker logs traefik`

### Cloudflare Tunnel verbindet nicht
- Tunnel muss auf `http://localhost:80` zeigen (nicht 443)
- Cloudflare SSL-Modus auf "Full" setzen (nicht "Full (strict)")
