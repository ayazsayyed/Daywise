#!/bin/sh
# restore.sh list                     — list backups in R2
# restore.sh <key|latest> <database>  — download and restore into <database>
#   (created if missing). Restoring into the live database "daywise" requires
#   CONFIRM=daywise in the environment; stop app + worker first.
set -eu
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION=auto
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
EP="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

if [ "${1:-list}" = "list" ]; then
  aws s3 ls "s3://$R2_BUCKET/backups/" --endpoint-url "$EP"
  exit 0
fi

key="$1"; db="${2:?usage: restore.sh <key|latest> <database>}"
if [ "$key" = "latest" ]; then
  key="backups/$(aws s3 ls "s3://$R2_BUCKET/backups/" --endpoint-url "$EP" | awk '{print $4}' | grep '^daywise-.*\.dump$' | sort | tail -1)"
fi
case "$key" in backups/*) ;; *) key="backups/$key" ;; esac
if [ "$db" = "${PGDATABASE:-daywise}" ] && [ "${CONFIRM:-}" != "$db" ]; then
  echo "Refusing to overwrite the live database without CONFIRM=$db" >&2; exit 2
fi

file=/tmp/restore.dump
trap 'rm -f "$file"' EXIT
aws s3 cp "s3://$R2_BUCKET/$key" "$file" --endpoint-url "$EP" --only-show-errors
psql -d postgres -tAc "select 1 from pg_database where datname='$db'" | grep -q 1 || createdb "$db"
pg_restore --clean --if-exists --no-owner --no-privileges -d "$db" "$file"
echo "restore: $key → $db"
psql -d "$db" -tAc "select 'tenants=' || count(*) from tenants union all select 'itineraries=' || count(*) from itineraries union all select 'users=' || count(*) from users"
