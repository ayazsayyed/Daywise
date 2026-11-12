# Nightly pg_dump → Cloudflare R2. Same major version as the database (postgres:16).
FROM postgres:16-alpine
RUN apk add --no-cache aws-cli curl tzdata
COPY backup.sh restore.sh /usr/local/bin/
COPY crontab /etc/crontabs/root
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh
ENTRYPOINT []
# busybox crond in the foreground; the job logs to the container's stdout.
CMD ["crond", "-f", "-l", "8"]
