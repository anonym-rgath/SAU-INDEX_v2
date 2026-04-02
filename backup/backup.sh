#!/bin/bash
# MongoDB Backup Script für Rheinzelmänner
# Wird per Cron im Docker-Container ausgeführt

set -e

MONGO_HOST="${MONGO_HOST:-mongodb}"
MONGO_PORT="${MONGO_PORT:-27017}"
DB_NAME="${DB_NAME:-rheinzelmaenner}"
BACKUP_BASE="/backups"
DATE=$(date +%Y-%m-%d_%H-%M)
TIMESTAMP=$(date +%s)

# Backup-Typ wird als Argument übergeben: daily, weekly, monthly
BACKUP_TYPE="${1:-daily}"
BACKUP_DIR="${BACKUP_BASE}/${BACKUP_TYPE}"

# Aufbewahrung in Tagen
case "$BACKUP_TYPE" in
  daily)   RETENTION_DAYS=7   ;;
  weekly)  RETENTION_DAYS=28  ;;
  monthly) RETENTION_DAYS=180 ;;
  *)       RETENTION_DAYS=7   ;;
esac

mkdir -p "$BACKUP_DIR"

BACKUP_FILE="${BACKUP_DIR}/backup_${DATE}.gz"

echo "[$(date)] Starte ${BACKUP_TYPE} Backup..."

# Full Backup mit mongodump + gzip
mongodump \
  --host="$MONGO_HOST" \
  --port="$MONGO_PORT" \
  --db="$DB_NAME" \
  --archive="$BACKUP_FILE" \
  --gzip \
  2>&1

if [ $? -eq 0 ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[$(date)] Backup erfolgreich: ${BACKUP_FILE} (${SIZE})"
else
  echo "[$(date)] FEHLER: Backup fehlgeschlagen!"
  exit 1
fi

# Alte Backups bereinigen
echo "[$(date)] Bereinige Backups älter als ${RETENTION_DAYS} Tage..."
DELETED=$(find "$BACKUP_DIR" -name "backup_*.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
echo "[$(date)] ${DELETED} alte Backups gelöscht."

# Übersicht
echo "[$(date)] Aktuelle Backups in ${BACKUP_DIR}:"
ls -lh "$BACKUP_DIR"/backup_*.gz 2>/dev/null || echo "  (keine)"
echo ""
