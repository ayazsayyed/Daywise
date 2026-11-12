#!/bin/sh
# pg_dump (custom format, compressed) → s3://$R2_BUCKET/backups/daywise-<UTC stamp>.dump,
# then deletes backups older than $BACKUP_RETENTION_DAYS (default 14).
# Env: PGHOST/PGUSER/PGPASSWORD/PGDATABASE, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
# R2_SECRET_ACCESS_KEY, R2_BUCKET, optional SENTRY_DSN (failure alert).
set -eu

fail() {
  echo "backup: FAILED — $1" >&2
  if [ -n "${SENTRY_DSN:-}" ]; then
    # DSN: https://<key>@<host>/<project>
    key=$(echo "$SENTRY_DSN" | sed -E 's#^https://([^@]+)@.*#\1#')
    host=$(echo "$SENTRY_DSN" | sed -E 's#^https://[^@]+@([^/]+)/.*#\1#')
    project=$(echo "$SENTRY_DSN" | sed -E 's#.*/([0-9]+)$#\1#')
    curl -s -m 10 -o /dev/null -X POST "https://$host/api/$project/store/" \
      -H "Content-Type: application/json" \
      -H "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=$key, sentry_client=daywise-backup/1" \
      -d "{\"message\":\"Nightly backup failed: $1\",\"level\":\"error\",\"logger\":\"backup\",\"tags\":{\"service\":\"backup\",\"alert\":\"backup_failed\"},\"environment\":\"${SENTRY_ENVIRONMENT:-production}\"}" || true
  fi
  exit 1
}

for v in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET PGHOST PGPASSWORD; do
  eval "val=\${$v:-}"
  [ -n "$val" ] || fail "$v is not set"
done

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION=auto
# R2 rejects the newer default integrity checksums of aws-cli v2.23+.
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
EP="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
s3() { aws s3 "$@" --endpoint-url "$EP" --only-show-errors; }

stamp=$(date -u +%Y%m%dT%H%MZ)
key="backups/daywise-${stamp}.dump"
file="/tmp/daywise-${stamp}.dump"
trap 'rm -f "$file"' EXIT

start=$(date +%s)
pg_dump -Fc --no-owner --no-privileges -f "$file" || fail "pg_dump exited non-zero"
pg_restore -l "$file" > /dev/null || fail "dump is not readable by pg_restore"
size=$(wc -c < "$file")
s3 cp "$file" "s3://$R2_BUCKET/$key" || fail "upload to R2 failed"
echo "backup: uploaded $key ($size bytes) in $(( $(date +%s) - start ))s"

# Retention: keys carry their UTC date, so compare the yyyymmdd part.
days="${BACKUP_RETENTION_DAYS:-14}"
cutoff=$(date -u -d "@$(( $(date +%s) - days * 86400 ))" +%Y%m%d)
aws s3 ls "s3://$R2_BUCKET/backups/" --endpoint-url "$EP" | awk '{print $4}' | while read -r name; do
  d=$(echo "$name" | sed -n 's/^daywise-\([0-9]\{8\}\)T.*\.dump$/\1/p')
  if [ -n "$d" ] && [ "$d" -lt "$cutoff" ]; then
    s3 rm "s3://$R2_BUCKET/backups/$name" && echo "backup: pruned $name"
  fi
done
