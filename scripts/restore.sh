#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# The Book Times — Database Restore Script
# Usage: ./restore.sh /path/to/backup.sql.gz
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup-file.sql.gz>"
  echo "Example: $0 /backups/mysql/thebooktimes_20260226_020000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"
MYSQL_HOST="${MYSQL_HOST:-mysql}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-thebooktimes}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-}"
MYSQL_DATABASE="${MYSQL_DATABASE:-thebooktimes}"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "═══════════════════════════════════════════════"
echo "  WARNING: This will REPLACE all data in"
echo "  database '${MYSQL_DATABASE}' on ${MYSQL_HOST}:${MYSQL_PORT}"
echo "═══════════════════════════════════════════════"
read -p "Are you sure? (type 'yes' to confirm): " CONFIRM
if [ "${CONFIRM}" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo "[$(date)] Restoring from: ${BACKUP_FILE}"

gunzip -c "${BACKUP_FILE}" | mysql \
  --host="${MYSQL_HOST}" \
  --port="${MYSQL_PORT}" \
  --user="${MYSQL_USER}" \
  --password="${MYSQL_PASSWORD}" \
  "${MYSQL_DATABASE}"

echo "[$(date)] Restore complete."
