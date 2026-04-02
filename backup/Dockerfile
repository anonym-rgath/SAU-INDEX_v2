FROM mongo:4.4.18

RUN apt-get update && apt-get install -y cron && rm -rf /var/lib/apt/lists/*

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

COPY crontab /etc/cron.d/backup-cron
RUN chmod 0644 /etc/cron.d/backup-cron && crontab /etc/cron.d/backup-cron

RUN touch /var/log/backup.log

CMD ["cron", "-f"]
