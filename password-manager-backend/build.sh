#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/password_manager"
python -m pip install -r requirements.production.lock
python manage.py collectstatic --noinput
# Prefer the Dockerfile on Render for dlib build dependencies.
# Runtime migrations and readiness validation are in ../start.sh.
