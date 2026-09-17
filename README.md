# BioPass: password manager demo

BioPass is a Next.js frontend and Django REST API with server-side authenticated
encryption at rest, email verification, and optional camera-based face verification.
It is an educational public-demo candidate, not a replacement for an independently
audited password manager. Use synthetic credentials in the demo.

## Architecture

```text
Browser
  | HTTPS, HttpOnly API session cookie + CSRF header
  v
Vercel / Next.js frontend
  | HTTPS (browser calls the configured API origin)
  v
Render / Django REST API + Gunicorn
  | private DATABASE_URL
  v
PostgreSQL (no public custom domain)
```

The frontend renders the interface; Django owns authorization. Each vault query
filters by the authenticated user and requires an unexpired server-side vault
verification grant. A changed React flag cannot unlock protected data.

## Security model

- Login passwords are hashed with Django's Argon2 password hasher.
- Vault credentials use versioned Fernet authenticated encryption. Decryption
  happens explicitly during an authorized read. Server operators with the keys
  can decrypt the data. This is **not zero-knowledge or end-to-end encryption**.
- Native Django database sessions replace JWT access/refresh tokens. Authentication
  cookies are HttpOnly, Secure in production, and host-only. Sessions have a
  30-minute idle timeout and a 12-hour absolute API lifetime. Activity renews the
  session; there is no JWT refresh endpoint or raw JWT in the browser.
- Login, signup, logout and all authenticated mutations enforce CSRF. The client
  obtains a masked CSRF token from the API and sends it in a header, with credentials.
- A valid email code or enrolled face grants five minutes of vault access. Face
  enrollment/replacement itself requires a recent **email** verification.
- Email codes use cryptographic randomness, a keyed digest, a five-minute expiry,
  one-time consumption, a 60-second resend cooldown, and five attempts per challenge.
  Challenges are bound to the login session. Shared database throttles limit login,
  signup, email and face endpoints by source and account.
- Camera captures are validated, processed in memory, and discarded. New enrollments
  retain only an encrypted 128-dimensional template under a separate key.
  Face verification has **no liveness or anti-spoofing detection**. It is not Apple
  Face ID, Windows Hello or WebAuthn. Photos/replays may fool it. Email fallback remains
  available. Do not treat this demo factor as hardware biometric security.
- Responses containing account/vault data use `Cache-Control: no-store`. The client
  clears displayed credentials on tab hiding, session failure and a five-minute
  timer. Clipboard contents cannot be reliably cleared by browser timers; users
  must clear copied credentials themselves.

## Start locally

Use Python 3.12.14 and Node 24 (Node 22.18+ is also supported).

```sh
git clone https://github.com/Divygas040/Secure_Password_Manager_Biometric.git
cd Secure_Password_Manager_Biometric
git switch production-hardening
cd password-manager-backend/password_manager
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```

Replace every placeholder in the ignored backend `.env` before starting:

- Create your own strong Django secret and two different Fernet keys using a
  trusted local secrets tool. Keep encrypted offline backups of the encryption
  keys. Do not paste secrets into logs, issues, commits, screenshots or documentation.
- Set `DEBUG=True`, `ALLOWED_HOSTS=localhost,127.0.0.1`.
- Set both origin lists to `http://127.0.0.1:3000` for the commands below.
- Leave `DATABASE_URL` empty to use local SQLite, or supply a local PostgreSQL URL.
- Set `COOKIE_SAMESITE=Lax`, `TRUST_PROXY_HTTPS=False`, `TRUSTED_PROXY_COUNT=0`,
  `SECURE_HSTS_SECONDS=0`.
- Configure an email backend and your own credentials if using email verification.
  Local SMTP remains available; production defaults to Anymail/Resend over HTTPS. Local automated tests use in-memory mail; they do not send
  real emails or expose verification codes. Do not use console/file mail in production.
- The template lists optional email fields too: use your provider's actual port,
  TLS/SSL requirements and verified sender. Do not leave placeholder strings in place.

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

Open `http://127.0.0.1:3000`. Use the same hostname spelling for frontend and API;
`localhost` and `127.0.0.1` are different sites for cookies. Sign up, log in, unlock
via an email code, then add or retrieve credentials. The dashboard offers optional
face enrollment after email verification. Later vault unlocks can use either factor.

## Validation and deployment

```sh
# In the backend project directory, with environment configured:
python manage.py check
python manage.py check --deploy
python manage.py makemigrations --check
python manage.py test
python -m pip check

# In password-manager-frontend:
npm ci
npm test
npm run lint
npm run build
npm audit
```

Deployment checks should use `DEBUG=False` and the intended production environment.
HSTS subdomain/preload warnings are intentional until domain ownership and HTTPS
coverage are confirmed; do not blindly enable preload to silence them.

- [Deployment instructions](docs/DEPLOYMENT.md)
- [Required configuration](docs/ENVIRONMENT.md)
- [Resend setup and input validation](docs/EMAIL_VALIDATION.md)
- [Legacy data and key operations](docs/DATA_MIGRATION.md)
- [Deployment checklist](DEPLOYMENT_CHECKLIST.md)
- [Baseline audit](docs/BASELINE_AUDIT.md)
- [Validation results and remaining gaps](docs/VALIDATION.md)

No deployment, purchase, subscription or billing action is performed by these
instructions. Review any provider plan/pricing prompt manually before continuing.
