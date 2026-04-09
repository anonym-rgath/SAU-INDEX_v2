# Web-Terminal (ttyd) Setup

Web-basierter Shell-Zugang uber `https://ssh.sau-index.de`, abgesichert uber Cloudflare Tunnel + Access.

## Architektur

```
Browser (https://ssh.sau-index.de)
    | HTTPS
Cloudflare (SSL + Access-Policy)
    | Tunnel
cloudflared (Raspberry Pi)
    | HTTP (lokal)
ttyd (127.0.0.1:7681) -> bash + Docker-Zugriff
```

## 1. ttyd starten

ttyd ist bereits in der `docker-compose.yml` konfiguriert:

```bash
docker compose up -d ttyd
```

### Testen (lokal auf dem Pi)
```bash
curl http://127.0.0.1:7681/
```

## 2. Cloudflare Tunnel erweitern

### Option A: Token-basierter Tunnel (Dashboard)

1. **Cloudflare Dashboard** -> Zero Trust -> Networks -> Tunnels
2. Den bestehenden Tunnel auswahlen (der fur `rhnzl.sau-index.de`)
3. **"Configure"** klicken
4. Unter **"Public Hostname"** -> **"Add a public hostname"**:
   - **Subdomain:** `ssh`
   - **Domain:** `sau-index.de`
   - **Type:** `HTTP`
   - **URL:** `127.0.0.1:7681`
5. Speichern

### Option B: Config-Datei (`config.yml`)

Falls du eine lokale `config.yml` verwendest:

```yaml
tunnel: <TUNNEL-ID>
credentials-file: /root/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: rhnzl.sau-index.de
    service: http://localhost:80
  - hostname: ssh.sau-index.de
    service: http://localhost:7681
  - service: http_status:404
```

Danach Tunnel neu starten:
```bash
docker restart cloudflared
```

## 3. DNS-Eintrag

Wird bei **Option A** automatisch erstellt. Falls nicht:

1. Cloudflare Dashboard -> DNS -> Records
2. Neuer CNAME-Eintrag:
   - **Name:** `ssh`
   - **Target:** `<TUNNEL-ID>.cfargotunnel.com`
   - **Proxy:** Aktiviert (orange Wolke)

## 4. Cloudflare Access (WICHTIG!)

Ohne Access-Policy ist das Terminal fur jeden erreichbar!

1. **Cloudflare Dashboard** -> Zero Trust -> Access -> Applications
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

### Ergebnis:
Beim Aufruf von `https://ssh.sau-index.de`:
1. Cloudflare zeigt Login-Seite (E-Mail-Code)
2. Nach Verifizierung -> Shell im Browser

## 5. Verfugbare Befehle im Terminal

Da der Docker-Socket gemountet ist:

```bash
# Container anzeigen
docker ps

# Logs anzeigen
docker logs rheinzel-backend --tail 50

# Container neu starten
docker compose restart backend

# In einen Container springen
docker exec -it rheinzel-backend bash

# Datenbank-Zugriff
docker exec -it rheinzel-mongodb mongo rheinzelmaenner
```

## Sicherheit (2 Schichten)

| Schicht | Schutz |
|---------|--------|
| **Cloudflare Access** | E-Mail-Verifizierung / IP-Whitelist |
| **Nur localhost** | Port 7681 nicht von aussen erreichbar |
