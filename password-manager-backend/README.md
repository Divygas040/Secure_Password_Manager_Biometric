# Backend environment setup (Phase 3A)

Run these commands from `password-manager-backend/password_manager`, which
contains `manage.py` and the backend requirements:

```sh
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Compatibility additions for the existing biometric/OTP dependencies:
pip install pyotp "opencv-python<5" "setuptools<81"
cp .env.example .env
```

Edit `.env` before running Django:

- Replace `DJANGO_SECRET_KEY` with your own private, random Django secret key.
  It is required; there is no built-in secret fallback. Never commit it.
- Set `DEBUG=True` for local development, or `DEBUG=False` for production.
  If omitted, it defaults to `False`.
- Set `EMAIL_HOST_USER` and `EMAIL_HOST_PASSWORD` to your SMTP credentials
  when testing email. Otherwise leave their values empty; SMTP delivery needs
  valid credentials. `DEFAULT_FROM_EMAIL` follows `EMAIL_HOST_USER`.
- Leave `VAULT_ENCRYPTION_KEY` empty for this phase. It is loaded as configuration
  only; password encryption is not implemented or enabled.

`.env` is loaded from `password-manager-backend/password_manager/.env`,
regardless of the shell working directory. Existing process environment
variables take precedence. Deployments can supply variables directly without
an `.env` file. Missing email credentials and the vault key default to empty
strings. The example contains placeholders only and must be edited before use.

```sh
python manage.py check
python manage.py migrate
python manage.py runserver
```

Local SQLite, localhost allowed hosts, and frontend CORS settings are preserved.
The `.env` file is ignored by Git; only `.env.example` should be tracked.

Verification used Python 3.14.7 and Django 6.1.1. The existing requirements
are unchanged in Phase 3A. `pyotp` is imported by the application but missing
from those requirements. OpenCV 5 lacks the app's `CascadeClassifier` API,
so use OpenCV 4. The legacy face-recognition package also uses
`pkg_resources`, provided by `setuptools<81`.
