# Web-Terminal (ttyd) Setup

Web-basierter Shell-Zugang mit echtem Pi-Login uber `https://ssh.sau-index.de`, abgesichert uber Cloudflare.

## Architektur

```
Browser (https://ssh.sau-index.de)
    | HTTPS
Cloudflare (SSL + Access-Policy)
    | Tunnel
cloudflared (Raspberry Pi)
    | HTTP
Traefik (Reverse Proxy, Host: ssh.sau-index.de)
    | http://127.0.0.1:7681
ttyd (systemd-Service auf dem Host) -> /bin/login
    |
Echtes Pi-Login (Benutzer + Passwort)
```

## 1. ttyd installieren

```bash
sudo apt update
sudo apt install -y ttyd
```

Falls nicht im Repository verfugbar:
```bash
# ARM64 Binary direkt herunterladen
TTYD_VERSION=1.7.7
sudo wget -O /usr/local/bin/ttyd \
  https://github.com/tsl0922/ttyd/releases/download/$TTYD_VERSION/ttyd.aarch64
sudo chmod +x /usr/local/bin/ttyd
```

## 2. systemd-Service erstellen

```bash
sudo tee /etc/systemd/system/ttyd.service << 'EOF'
[Unit]
Description=ttyd - Web Terminal
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/ttyd --port 7681 --interface 127.0.0.1 --writable login
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

Wichtige Parameter:
- `--interface 127.0.0.1` -> Nur lokal erreichbar (nicht von aussen)
- `--writable` -> Eingaben erlaubt
- `login` -> Echtes Linux-Login mit Pi-Benutzer/Passwort

Service aktivieren und starten:
```bash
sudo systemctl daemon-reload
sudo systemctl enable ttyd
sudo systemctl start ttyd
```

### Testen (lokal auf dem Pi)
```bash
curl http://127.0.0.1:7681/
```

## 3. Traefik-Konfiguration

ttyd lauft auf dem Host (nicht in Docker). Traefik muss den Traffic an `127.0.0.1:7681` weiterleiten.

### Dynamische Traefik-Konfiguration (File Provider)

In der Traefik-Konfiguration (`traefik.yml` oder `traefik.toml`) einen File-Provider hinzufugen:

```yaml
# traefik.yml
providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
  file:
    filename: /etc/traefik/dynamic.yml
```

Dynamische Konfiguration erstellen:

```yaml
# /etc/traefik/dynamic.yml
http:
  routers:
    ttyd:
      rule: "Host(`ssh.sau-index.de`)"
      entrypoints:
        - web
      service: ttyd

  services:
    ttyd:
      loadBalancer:
        servers:
          - url: "http://host.docker.internal:7681"
```

Falls `host.docker.internal` nicht funktioniert, die IP des Docker-Bridges verwenden:
```bash
# IP herausfinden
ip addr show docker0 | grep inet
# Typisch: 172.17.0.1
```

Dann in der Config:
```yaml
servers:
  - url: "http://172.17.0.1:7681"
```

Traefik neu starten:
```bash
docker restart traefik
```

## 4. Cloudflare Tunnel

Der Tunnel muss `ssh.sau-index.de` an Traefik weiterleiten (gleicher Weg wie `rhnzl.sau-index.de`).

### Im Cloudflare Dashboard:

1. **Zero Trust** -> Networks -> Tunnels
2. Bestehenden Tunnel auswahlen
3. **"Configure"** -> **"Public Hostname"** -> **"Add a public hostname"**:
   - **Subdomain:** `ssh`
   - **Domain:** `sau-index.de`
   - **Type:** `HTTP`
   - **URL:** Gleiche wie bei `rhnzl` (z.B. `traefik:80` oder `localhost:80`)
4. Speichern

## 5. Cloudflare Access (WICHTIG!)

Ohne Access-Policy ist das Terminal fur jeden erreichbar!

1. **Zero Trust** -> Access -> Applications
2. **"Add an application"** -> **Self-hosted**
3. Konfiguration:
   - **Application name:** `SSH Terminal`
   - **Session Duration:** `1 Stunde`
   - **Application domain:** `ssh.sau-index.de`
4. **Policy hinzufugen:**
   - **Policy name:** `Nur Admins`
   - **Action:** `Allow`
   - **Include:** `Emails` -> Deine E-Mail-Adresse(n) eintragen
5. Speichern

## 6. Ergebnis

Beim Aufruf von `https://ssh.sau-index.de`:
1. Cloudflare zeigt Access-Login (E-Mail-Code)
2. Nach Verifizierung -> Pi-Login (Benutzername + Passwort)
3. Voller Shell-Zugriff auf den Raspberry Pi

### Verfugbare Befehle (alles!)

```bash
# Docker verwalten
docker ps
docker compose logs backend --tail 50
docker compose restart backend

# System verwalten
sudo systemctl status ttyd
sudo apt update

# Dateien bearbeiten
nano /home/pi/docker-compose.yml

# Netzwerk pruefen
ip addr
ping google.com
```

## 7. Service verwalten

```bash
# Status pruefen
sudo systemctl status ttyd

# Neustart
sudo systemctl restart ttyd

# Stoppen
sudo systemctl stop ttyd

# Logs ansehen
sudo journalctl -u ttyd -f
```

## Sicherheit (2 Schichten)

| Schicht | Schutz |
|---------|--------|
| **Cloudflare Access** | E-Mail-Verifizierung / IP-Whitelist |
| **Linux Login** | Pi-Benutzer + Passwort erforderlich |

ttyd lauscht nur auf `127.0.0.1` und ist von aussen nicht direkt erreichbar.
