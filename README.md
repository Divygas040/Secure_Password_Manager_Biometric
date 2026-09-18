# BioPass: biometric password manager demo

BioPass is a Next.js frontend and Django REST API with server-side authenticated
encryption at rest and camera-based face verification. Email is the account's
login identifier only. The application does not send messages.

This is an educational demo. Use synthetic credentials. Camera-based verification
has **no liveness or anti-spoofing detection** and is not equivalent to Apple Face ID,
passkeys or production-grade biometric identity assurance.

## Architecture and authorization

```text
Browser → Vercel / Next.js → HTTPS → Render / Django API → private PostgreSQL
www.biopassmanager.online           api.biopassmanager.online
```

```text
Signup → email + password login
  → no face enrolled: confirm current password → initial face enrollment
  → face verification → five-minute vault access

Replace face: verify current enrolled face → capture replacement → vault locked
  → verify the new face to unlock again
```

Django is the authorization boundary. A frontend state change never authorizes
vault access. Login alone cannot read saved credentials. The first enrollment
requires a session-bound current-password confirmation that expires in five minutes
and is consumed by successful enrollment. It cannot authorize replacement.

Replacement requires a current face-unlocked session. Vault grants expire in five
minutes, require the face factor, and are bound to the saved template version.
Replacing the template invalidates previous grants in all sessions. Initial setup
and replacement both leave the vault locked. Explicit lock removes enrollment and
vault authorization; logout destroys the session.

Login passwords use Django Argon2 hashing. Vault credentials and face templates use
separate Fernet authenticated-encryption keys. Captures are validated, processed in
memory and discarded; templates remain encrypted. This is server-side encryption
at rest, not zero-knowledge or end-to-end encryption. Server operators holding the
keys can decrypt the data.

Sessions use HttpOnly host-only cookies, Secure in production, with a 30-minute idle
and 12-hour absolute API lifetime. CSRF and exact-origin credentialed CORS remain
mandatory. SameSite=Lax is used for the same-site production subdomains; cross-site
previews have separate documented requirements. Database-backed rate limits cover
login, signup, password confirmation and face operations.

## Limitations

A photograph or replay may fool face matching. Someone with the account password
can enroll a face on an account that has no template yet. Once enrolled, password
confirmation cannot replace it. There is no alternate remote recovery factor if a
user cannot match their face or use a camera; do not use this demo as the sole store
for real credentials. Browser clipboard contents require manual clearing.

## Local development

Use Python 3.12.14 and Node 24 (or supported Node 22.18+).

```sh
cd password-manager-backend/password_manager
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```

In the ignored `.env`, configure your own Django secret and two different Fernet
keys. Keep encrypted offline backups of the keys; never replace them to bypass an
error. Set DEBUG=True, ALLOWED_HOSTS to localhost/127.0.0.1, both origin lists to
http://127.0.0.1:3000, COOKIE_SAMESITE=Lax, TRUST_PROXY_HTTPS=False,
TRUSTED_PROXY_COUNT=0 and SECURE_HSTS_SECONDS=0. An empty DATABASE_URL uses local
SQLite; production requires PostgreSQL. No delivery credentials are required.

```sh
python manage.py migrate
python manage.py check_data_ready
python manage.py collectstatic --noinput
python manage.py check
python manage.py runserver 127.0.0.1:8000
```

In another terminal:

```sh
cd password-manager-frontend
npm ci
cp .env.example .env.local
npm run dev
```

Open http://127.0.0.1:3000 and use consistent hostname spelling for cookies.
Sign up, log in, confirm the current password, enroll a face, verify it and use
the vault. Back up existing databases before applying schema changes.

## Validation and deployment

Backend: `python manage.py check`, `python manage.py makemigrations --check`,
`python manage.py test`, `python -m pip check`. Run `check --deploy` with the intended
production environment. Frontend: `npm ci`, `npm test`, `npm run lint`, `npm run build`.

- [Input validation](docs/INPUT_VALIDATION.md)
- [Environment variables](docs/ENVIRONMENT.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Migration and key handling](docs/DATA_MIGRATION.md)
- [Deployment checklist](DEPLOYMENT_CHECKLIST.md)
- [Validation results](docs/VALIDATION.md)
- [Original baseline audit](docs/BASELINE_AUDIT.md)

No deployment, purchase, account change or billing operation is performed by this
branch. Review and deploy through your normal process after validation.
