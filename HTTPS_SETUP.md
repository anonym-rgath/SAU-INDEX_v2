# HTTPS Setup mit Cloudflare

Die Rheinzelmänner-App verwendet **Cloudflare Tunnels** für den externen HTTPS-Zugriff. Optional kann ein **Cloudflare Origin Certificate** für den Standalone-Modus genutzt werden.

---

## Aktuelle Konfiguration: Cloudflare Tunnel (empfohlen)

Im Traefik-Modus (Standard) übernimmt der Cloudflare Tunnel die komplette TLS-Terminierung:

```
Browser (HTTPS) → Cloudflare Edge → Tunnel → Traefik (HTTP:80) → Nginx → Backend
```

### Vorteile
- Kein SSL-Zertifikat auf dem Pi nötig
- Automatische Zertifikatsverwaltung durch Cloudflare
- DDoS-Schutz inklusive
- Kein offener Port am Router nötig

### Einrichtung

Siehe [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md#cloudflare-tunnel) für die Tunnel-Konfiguration.

> **Wichtig:** Im Traefik-Modus darf Nginx **kein** HTTP→HTTPS-Redirect enthalten. Der Tunnel verbindet sich per HTTP. Ein Redirect verursacht eine Endlos-Umleitung.

---

## Alternative: Origin Certificate (Standalone-Modus)

Für den Standalone-Betrieb (`docker-compose.standalone.yml`) kann ein Cloudflare Origin Certificate verwendet werden.

### Zertifikat-Info

| Eigenschaft | Wert |
|-------------|------|
| Domain | sau-index.de, *.sau-index.de |
| Aussteller | Cloudflare Origin CA |
| Gültig bis | 15. Februar 2041 |
| Typ | Origin Certificate |

### Zertifikat-Dateien

```
certs/
├── sau-index.de.crt   # SSL-Zertifikat
└── sau-index.de.key   # Privater Schlüssel
```

### Nginx-Konfiguration (nginx.ssl.conf)

```nginx
server {
    listen 443 ssl;
    server_name sau-index.de *.sau-index.de;
    
    ssl_certificate /etc/nginx/certs/sau-index.de.crt;
    ssl_certificate_key /etc/nginx/certs/sau-index.de.key;
    
    # ...
}
```

### Standalone starten

```bash
docker compose -f docker-compose.standalone.yml up -d --build
```

### Cloudflare DNS-Einstellungen (für Standalone)

| Typ | Name | Inhalt | Proxy |
|-----|------|--------|-------|
| A | sau-index.de | [IP des Raspberry Pi] | Proxied (orange Wolke) |

SSL/TLS-Modus in Cloudflare: **Full (strict)**

---

## Zertifikat erneuern

Das aktuelle Zertifikat ist bis **2041** gültig. Falls ein neues benötigt wird:

1. Cloudflare Dashboard → SSL/TLS → Origin Server → Create Certificate
2. Dateien ersetzen:
   ```bash
   mv certs/sau-index.de.crt certs/sau-index.de.crt.backup
   mv certs/sau-index.de.key certs/sau-index.de.key.backup
   nano certs/sau-index.de.crt   # Neuen Inhalt einfügen
   nano certs/sau-index.de.key   # Neuen Inhalt einfügen
   ```
3. Nginx neustarten:
   ```bash
   docker compose restart frontend
   ```

---

## Troubleshooting

### Endlos-Umleitung ("Zu viele Weiterleitungen")
- **Ursache:** Nginx enthält einen HTTP→HTTPS-Redirect im Traefik-Modus
- **Lösung:** `nginx.traefik.conf` verwenden (nur `listen 80`, kein SSL)

### "SSL certificate problem"
- Prüfen ob SSL/TLS-Modus in Cloudflare auf "Full (strict)" steht (Standalone)
- Oder "Full" für Tunnel-Modus

### Zertifikat nicht gefunden (Standalone)
```bash
ls -la certs/
chmod 644 certs/sau-index.de.crt
chmod 600 certs/sau-index.de.key
```
