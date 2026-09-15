#!/bin/sh
set -eu
# Migrations run once during initial startup for a single demo instance.
# For multiple replicas, move migrations/readiness checks to a release job.
python manage.py migrate --noinput
python manage.py check_data_ready
python manage.py collectstatic --noinput
exec gunicorn password_manager.wsgi:application --bind "0.0.0.0:${PORT:-8000}" --workers 1 --threads 2 --timeout 120 --access-logfile /dev/null
