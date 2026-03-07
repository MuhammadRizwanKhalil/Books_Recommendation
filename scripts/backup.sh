#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# BookDiscovery — MySQL Backup Script
# Run via cron: 0 2 * * * /path/to/backup.sh
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Configuration (override via environment)
MYSQL_HOST="${MYSQL_HOST:-mysql}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_BACKUP_USER:-${MYSQL_USER:-bookdiscovery}}"
MYSQL_PASSWORD="${MYSQL_BACKUP_PASSWORD:-${MYSQL_PASSWORD:-}}"
MYSQL_DATABASE="${MYSQL_DATABASE:-bookdiscovery}"
BACKUP_DIR="${BACKUP_DIR:-/backups/mysql}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
S3_BUCKET="${BACKUP_S3_BUCKET:-}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${MYSQL_DATABASE}_${TIMESTAMP}.sql.gz"

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting MySQL backup..."

# Create compressed backup
mysqldump \
  --host="${MYSQL_HOST}" \
  --port="${MYSQL_PORT}" \
  --user="${MYSQL_USER}" \
  --password="${MYSQL_PASSWORD}" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --add-drop-table \
  --complete-insert \
  --extended-insert \
  "${MYSQL_DATABASE}" | gzip > "${BACKUP_FILE}"

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date)] Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Verify backup is not empty
MIN_SIZE=1024
ACTUAL_SIZE=$(stat -c%s "${BACKUP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_FILE}" 2>/dev/null)
if [ "${ACTUAL_SIZE}" -lt "${MIN_SIZE}" ]; then
  echo "[$(date)] ERROR: Backup file is too small (${ACTUAL_SIZE} bytes). Possible corruption."
  exit 1
fi

# Upload to S3 (if configured)
if [ -n "${S3_BUCKET}" ]; then
  echo "[$(date)] Uploading to S3: ${S3_BUCKET}..."
  aws s3 cp "${BACKUP_FILE}" "s3://${S3_BUCKET}/mysql/${MYSQL_DATABASE}_${TIMESTAMP}.sql.gz" \
    --storage-class STANDARD_IA
  echo "[$(date)] S3 upload complete."
fi

# Cleanup old backups
echo "[$(date)] Removing backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +${RETENTION_DAYS} -delete
REMAINING=$(ls -1 "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | wc -l)
echo "[$(date)] ${REMAINING} backup(s) remaining."

echo "[$(date)] Backup complete."
